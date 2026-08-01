import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  cancelOrderItemQuantity,
  confirmOrderPayment,
  handOffOrderItems,
  markOrderItemPreparing,
  markOrderItemReady,
  markOrderItemsPreparing,
  markOrderItemsReady,
  markOrderItemServed,
  serveOrderItems,
} from "../../src/server/orders/commands/service.ts"

const RESTAURANT_ID = "restaurant-test"
const ORDER_ID = "order-test"
const ITEM_ID = "item-test"

class MemoryCommandStore {
  constructor(overrides = {}) {
    this.order = {
      id: ORDER_ID,
      restaurantId: RESTAURANT_ID,
      serviceMode: "dine_in",
      orderType: "dine_in",
      paymentStatus: "unpaid",
      paymentVersion: 1,
      totalAmount: 1500,
      total: 1500,
      hasUnaggregatedCancellation: false,
      ...overrides.order,
    }
    this.item = {
      id: ITEM_ID,
      orderId: ORDER_ID,
      restaurantId: RESTAURANT_ID,
      productId: "product-coca",
      preparationMode: "kitchen",
      status: "pending",
      quantity: 3,
      servedQuantity: 0,
      cancelledQuantity: 0,
      version: 1,
      ...overrides.item,
    }
    this.items = overrides.items
      ? structuredClone(overrides.items)
      : [this.item]
    this.item = this.items[0]
    this.stock = overrides.stock ?? 20
    this.quantityPerSale = overrides.quantityPerSale ?? 1
    this.proofs = new Map()
    this.audits = []
    this.operations = []
    this.failStock = false
    this.failBeforeCommit = false
  }

  async execute(commandName, input, transition) {
    const key = [
      commandName,
      input.actor.id,
      input.orderId,
      input.orderItemId ?? "",
      input.idempotencyKey,
    ].join("|")
    const fingerprint = JSON.stringify({ commandName, ...input, idempotencyKey: undefined })
    const proof = this.proofs.get(key)
    if (proof) {
      if (proof.fingerprint !== fingerprint) throw coded("IDEMPOTENCY_CONFLICT")
      return { ...proof.result, replayed: true }
    }

    const orderBefore = structuredClone(this.order)
    const itemsBefore = structuredClone(this.items)
    const stockBefore = this.stock
    const operationsBefore = this.operations.length
    const auditsBefore = this.audits.length
    try {
      const plan = transition({
        order: structuredClone(this.order),
        item: "orderItemId" in input
          ? structuredClone(this.items.find((item) => item.id === input.orderItemId) ?? null)
          : null,
        items: structuredClone(this.items),
      })
      const stocks = plan.stocks ?? (plan.stock ? [plan.stock] : [])
      for (const stock of stocks) {
        if (this.failStock) throw coded("STOCK_DEDUCTION_FAILED")
        const servedDelta =
          stock.servedQuantityAfter - stock.servedQuantityBefore
        const deduction = servedDelta * this.quantityPerSale
        if (this.stock >= deduction) {
          const previousQuantity = this.stock
          this.stock -= deduction
          this.operations.push({ previousQuantity, deductedQuantity: deduction, newQuantity: this.stock })
        } else {
          this.operations.push({
            previousQuantity: this.stock,
            deductedQuantity: 0,
            newQuantity: this.stock,
            warning: "INSUFFICIENT_STOCK",
          })
        }
      }
      if (plan.itemUpdate) Object.assign(this.item, plan.itemUpdate)
      for (const entry of plan.itemUpdates ?? []) {
        Object.assign(this.items.find((item) => item.id === entry.orderItemId), entry.update)
      }
      if (plan.orderUpdate) Object.assign(this.order, plan.orderUpdate)
      if (this.failBeforeCommit) throw new Error("transaction aborted")

      const stockResult = stocks.length > 0
        ? {
            deductedQuantity: this.operations.at(-1)?.deductedQuantity ?? 0,
            previousQuantity: this.operations.at(-1)?.previousQuantity,
            newQuantity: this.operations.at(-1)?.newQuantity,
          }
        : undefined
      const result = {
        ok: true,
        commandName,
        orderId: input.orderId,
        orderItemId: input.orderItemId ?? null,
        status: "APPLIED",
        version: Number(plan.result.version),
        replayed: false,
        ...(stockResult ? { stock: stockResult } : {}),
      }
      this.audits.push({ commandName, before: plan.before, after: plan.after })
      this.proofs.set(key, { fingerprint, result })
      return result
    } catch (error) {
      this.order = orderBefore
      this.items = itemsBefore
      this.item = this.items[0]
      this.stock = stockBefore
      this.operations.length = operationsBefore
      this.audits.length = auditsBefore
      throw error
    }
  }
}

const actors = {
  kitchen: { id: "kitchen-1", role: "kitchen", restaurantId: RESTAURANT_ID },
  cashier: { id: "cashier-1", role: "cashier", restaurantId: RESTAURANT_ID },
  manager: { id: "manager-1", role: "manager", restaurantId: RESTAURANT_ID },
}

function base(actor = actors.manager, extra = {}) {
  return {
    restaurantId: RESTAURANT_ID,
    orderId: ORDER_ID,
    orderItemId: ITEM_ID,
    actor,
    sourceChannel: actor.role === "kitchen" ? "kitchen" : actor.role === "cashier" ? "pos" : "manager",
    idempotencyKey: `idem-${actor.role}-0001`,
    expectedVersion: 1,
    ...extra,
  }
}

function coded(code) {
  return Object.assign(new Error(code), { code })
}

describe("transitions canoniques LOT 2", () => {
  it("met à jour atomiquement plusieurs lignes Cuisine en une commande", async () => {
    const items = [
      canonicalItem("kitchen-1", "kitchen", "pending", 1),
      canonicalItem("kitchen-2", "kitchen", "pending", 3),
    ]
    const store = new MemoryCommandStore({ items })
    await markOrderItemsPreparing({ store }, {
      restaurantId: RESTAURANT_ID,
      orderId: ORDER_ID,
      actor: actors.kitchen,
      sourceChannel: "kitchen",
      idempotencyKey: "kitchen-batch-preparing-0001",
      expectedItems: items.map((item) => ({
        orderItemId: item.id,
        expectedVersion: item.version,
      })),
    })
    assert.deepEqual(store.items.map((item) => item.status), ["preparing", "preparing"])
    assert.deepEqual(store.items.map((item) => item.version), [2, 4])
    assert.equal(store.audits.length, 1)

    await markOrderItemsReady({ store }, {
      restaurantId: RESTAURANT_ID,
      orderId: ORDER_ID,
      actor: actors.kitchen,
      sourceChannel: "kitchen",
      idempotencyKey: "kitchen-batch-ready-0001",
      expectedItems: store.items.map((item) => ({
        orderItemId: item.id,
        expectedVersion: item.version,
      })),
    })
    assert.deepEqual(store.items.map((item) => item.status), ["ready", "ready"])
  })

  it("annule toute la commande Cuisine groupée sur conflit ou ligne non Cuisine", async () => {
    const items = [
      canonicalItem("kitchen-1", "kitchen", "pending", 1),
      canonicalItem("kitchen-2", "kitchen", "pending", 2),
    ]
    const input = {
      restaurantId: RESTAURANT_ID,
      orderId: ORDER_ID,
      actor: actors.kitchen,
      sourceChannel: "kitchen",
      idempotencyKey: "kitchen-batch-conflict-0001",
      expectedItems: [
        { orderItemId: "kitchen-1", expectedVersion: 1 },
        { orderItemId: "kitchen-2", expectedVersion: 1 },
      ],
    }
    const conflict = new MemoryCommandStore({ items })
    await assert.rejects(
      () => markOrderItemsPreparing({ store: conflict }, input),
      (error) => error.code === "CONCURRENT_MODIFICATION"
    )
    assert.deepEqual(conflict.items.map((item) => item.status), ["pending", "pending"])

    const mixed = new MemoryCommandStore({
      items: [items[0], canonicalItem("bar-1", "bar", "pending", 1)],
    })
    await assert.rejects(
      () => markOrderItemsPreparing({ store: mixed }, {
        ...input,
        idempotencyKey: "kitchen-batch-forbidden-0001",
        expectedItems: [
          { orderItemId: "kitchen-1", expectedVersion: 1 },
          { orderItemId: "bar-1", expectedVersion: 1 },
        ],
      }),
      (error) => error.code === "FORBIDDEN_ACTOR"
    )
    assert.deepEqual(mixed.items.map((item) => item.status), ["pending", "pending"])
  })

  it("applique pending → preparing puis preparing → ready", async () => {
    const store = new MemoryCommandStore()
    await markOrderItemPreparing({ store }, base(actors.kitchen))
    assert.equal(store.item.status, "preparing")
    assert.equal(store.item.version, 2)

    await markOrderItemReady(
      { store },
      base(actors.kitchen, { expectedVersion: 2, idempotencyKey: "idem-ready-0001" })
    )
    assert.equal(store.item.status, "ready")
    assert.equal(store.item.version, 3)
    assert.equal(store.audits.length, 2)
  })

  it("autorise pending → ready et le POS pour une ligne Bar", async () => {
    const kitchenStore = new MemoryCommandStore()
    await markOrderItemReady({ store: kitchenStore }, base(actors.kitchen))
    assert.equal(kitchenStore.item.status, "ready")

    const barStore = new MemoryCommandStore({
      item: { preparationMode: "bar", status: "pending" },
    })
    await markOrderItemReady({ store: barStore }, base(actors.cashier))
    assert.equal(barStore.item.status, "ready")
  })

  it("refuse la préparation et le passage direct à prêt d'une livraison non payée", async () => {
    const delivery = {
      order: { serviceMode: "delivery", orderType: "delivery", paymentStatus: "unpaid" },
    }
    await assert.rejects(
      () => markOrderItemPreparing(
        { store: new MemoryCommandStore(delivery) },
        base(actors.kitchen)
      ),
      (error) =>
        error.code === "PREPAYMENT_REQUIRED_BEFORE_PREPARATION" &&
        error.message === "Le paiement doit être confirmé avant de traiter cette commande."
    )
    await assert.rejects(
      () => markOrderItemReady(
        { store: new MemoryCommandStore(delivery) },
        base(actors.kitchen)
      ),
      (error) => error.code === "PREPAYMENT_REQUIRED_BEFORE_PREPARATION"
    )
  })

  it("autorise la préparation d'une livraison payée", async () => {
    const store = new MemoryCommandStore({
      order: { serviceMode: "delivery", orderType: "delivery", paymentStatus: "paid" },
    })
    await markOrderItemPreparing({ store }, base(actors.kitchen))
    await markOrderItemReady(
      { store },
      base(actors.kitchen, { expectedVersion: 2, idempotencyKey: "delivery-ready-0001" })
    )
    assert.equal(store.item.status, "ready")
  })

  it("applique la même règle à takeaway et pickup", async () => {
    for (const serviceMode of ["takeaway", "pickup"]) {
      await assert.rejects(
        () => markOrderItemPreparing(
          {
            store: new MemoryCommandStore({
              order: { serviceMode, orderType: serviceMode, paymentStatus: "unpaid" },
            }),
          },
          base(actors.kitchen, { idempotencyKey: `${serviceMode}-blocked-0001` })
        ),
        (error) => error.code === "PREPAYMENT_REQUIRED_BEFORE_PREPARATION"
      )
      const paid = new MemoryCommandStore({
        order: { serviceMode, orderType: serviceMode, paymentStatus: "paid" },
      })
      await markOrderItemPreparing(
        { store: paid },
        base(actors.kitchen, { idempotencyKey: `${serviceMode}-paid-0001` })
      )
      assert.equal(paid.item.status, "preparing")
    }
  })

  it("conserve la préparation QR à table sans paiement préalable", async () => {
    const store = new MemoryCommandStore({
      order: { serviceMode: "dine_in", orderType: "dine_in", paymentStatus: "unpaid" },
    })
    await markOrderItemPreparing({ store }, base(actors.kitchen))
    assert.equal(store.item.status, "preparing")
  })

  it("interdit à la Cuisine de servir", async () => {
    const store = new MemoryCommandStore({ item: { status: "ready" } })
    await assert.rejects(
      () => markOrderItemServed(
        { store },
        base(actors.kitchen, { quantityToServe: 1 })
      ),
      (error) => error.code === "FORBIDDEN_ACTOR"
    )
  })

  it("autorise le POS à servir une ligne et déduit le stock", async () => {
    const store = new MemoryCommandStore({
      item: { preparationMode: "direct", status: "ready" },
    })
    const result = await markOrderItemServed(
      { store },
      base(actors.cashier, { quantityToServe: 3 })
    )
    assert.equal(store.item.status, "served")
    assert.equal(store.item.servedQuantity, 3)
    assert.equal(store.stock, 17)
    assert.equal(result.stock.deductedQuantity, 3)
  })

  it("refuse tout service Bar ou direct avant prépaiement pour livraison, takeaway et pickup", async () => {
    for (const serviceMode of ["delivery", "takeaway", "pickup"]) {
      for (const preparationMode of ["bar", "direct"]) {
        await assert.rejects(
          () => markOrderItemServed(
            {
              store: new MemoryCommandStore({
                order: { serviceMode, orderType: serviceMode, paymentStatus: "unpaid" },
                item: {
                  preparationMode,
                  status: preparationMode === "direct" ? "pending" : "ready",
                },
              }),
            },
            base(actors.cashier, {
              quantityToServe: 3,
              idempotencyKey: `${serviceMode}-${preparationMode}-serve-blocked`,
            })
          ),
          (error) =>
            error.code === "PREPAYMENT_REQUIRED_BEFORE_PREPARATION" &&
            error.message === "Le paiement doit être confirmé avant de traiter cette commande."
        )
      }
    }
  })

  it("conserve le service progressif QR à table sans paiement", async () => {
    for (const preparationMode of ["bar", "direct"]) {
      const store = new MemoryCommandStore({
        order: { serviceMode: "dine_in", orderType: "dine_in", paymentStatus: "unpaid" },
        item: {
          preparationMode,
          status: preparationMode === "direct" ? "pending" : "ready",
        },
      })
      await markOrderItemServed(
        { store },
        base(actors.cashier, {
          quantityToServe: 3,
          idempotencyKey: `dine-in-${preparationMode}-served`,
        })
      )
      assert.equal(store.item.status, "served")
    }
  })

  it("sert atomiquement toute une commande Sur place prête tout en conservant le service individuel", async () => {
    const items = [
      canonicalItem("kitchen-1", "kitchen", "ready", 1),
      canonicalItem("bar-1", "bar", "ready", 2),
      canonicalItem("direct-1", "direct", "pending", 1),
    ]
    const store = new MemoryCommandStore({
      order: { serviceMode: "dine_in", orderType: "dine_in", paymentStatus: "unpaid" },
      items,
    })
    await serveOrderItems({ store }, {
      restaurantId: RESTAURANT_ID,
      orderId: ORDER_ID,
      actor: actors.cashier,
      sourceChannel: "pos",
      idempotencyKey: "serve-all-dine-in-0001",
      expectedItems: items.map((item) => ({ orderItemId: item.id, expectedVersion: item.version })),
    })
    assert.deepEqual(store.items.map((item) => item.status), ["served", "served", "served"])
  })

  it("remet atomiquement une livraison payée lorsque Cuisine et Bar sont prêts", async () => {
    const items = [
      canonicalItem("kitchen-1", "kitchen", "ready", 1),
      canonicalItem("bar-1", "bar", "ready", 2),
      canonicalItem("direct-1", "direct", "pending", 3),
    ]
    const store = new MemoryCommandStore({
      order: { serviceMode: "delivery", orderType: "delivery", paymentStatus: "paid" },
      items,
    })
    await handOffOrderItems({ store }, handOffInput(items))
    assert.deepEqual(store.items.map((item) => item.status), ["served", "served", "served"])
    assert.deepEqual(store.items.map((item) => item.version), [2, 3, 4])
    assert.equal(store.operations.length, 3)
    assert.equal(store.order.completedCashSessionId, "cash-session-b")
    assert.equal(store.order.handledCashSessionId, "cash-session-b")
  })

  it("refuse la remise groupée non payée ou avec une préparation non prête sans mutation", async () => {
    const items = [
      canonicalItem("kitchen-1", "kitchen", "ready", 1),
      canonicalItem("bar-1", "bar", "ready", 1),
      canonicalItem("direct-1", "direct", "pending", 1),
    ]
    for (const serviceMode of ["delivery", "takeaway", "pickup"]) {
      const unpaid = new MemoryCommandStore({
        order: { serviceMode, orderType: serviceMode, paymentStatus: "unpaid" },
        items,
      })
      await assert.rejects(
        () => handOffOrderItems({ store: unpaid }, handOffInput(items, `${serviceMode}-unpaid`)),
        (error) => error.code === "PREPAYMENT_REQUIRED_BEFORE_PREPARATION"
      )
      assert.deepEqual(unpaid.items.map((item) => item.status), ["ready", "ready", "pending"])
    }

    const notReadyItems = [
      canonicalItem("kitchen-1", "kitchen", "preparing", 1),
      canonicalItem("bar-1", "bar", "ready", 1),
    ]
    const notReady = new MemoryCommandStore({
      order: { serviceMode: "delivery", orderType: "delivery", paymentStatus: "paid" },
      items: notReadyItems,
    })
    await assert.rejects(
      () => handOffOrderItems({ store: notReady }, handOffInput(notReadyItems, "not-ready")),
      (error) => error.code === "ORDER_NOT_READY_FOR_HANDOFF"
    )
    assert.deepEqual(notReady.items.map((item) => item.status), ["preparing", "ready"])
  })

  it("annule toute la remise groupée sur conflit de version ou erreur Stock", async () => {
    const items = [
      canonicalItem("kitchen-1", "kitchen", "ready", 1),
      canonicalItem("direct-1", "direct", "pending", 1),
    ]
    const conflict = new MemoryCommandStore({
      order: { serviceMode: "takeaway", orderType: "takeaway", paymentStatus: "paid" },
      items,
    })
    const stale = handOffInput(items, "stale")
    stale.expectedItems[1].expectedVersion = 9
    await assert.rejects(
      () => handOffOrderItems({ store: conflict }, stale),
      (error) => error.code === "CONCURRENT_MODIFICATION"
    )
    assert.deepEqual(conflict.items.map((item) => item.status), ["ready", "pending"])

    const stockFailure = new MemoryCommandStore({
      order: { serviceMode: "pickup", orderType: "pickup", paymentStatus: "paid" },
      items,
    })
    stockFailure.failStock = true
    await assert.rejects(
      () => handOffOrderItems({ store: stockFailure }, handOffInput(items, "stock-failure")),
      (error) => error.code === "STOCK_DEDUCTION_FAILED"
    )
    assert.deepEqual(stockFailure.items.map((item) => item.status), ["ready", "pending"])
    assert.equal(stockFailure.operations.length, 0)
    assert.equal(stockFailure.order.completedCashSessionId, undefined)
    assert.equal(stockFailure.order.handledCashSessionId, undefined)
  })

  it("n'impose aucune remise groupée aux commandes QR à table", async () => {
    const items = [canonicalItem("direct-1", "direct", "pending", 1)]
    await assert.rejects(
      () => handOffOrderItems(
        {
          store: new MemoryCommandStore({
            order: { serviceMode: "dine_in", orderType: "dine_in", paymentStatus: "unpaid" },
            items,
          }),
        },
        handOffInput(items, "dine-in-group")
      ),
      (error) => error.code === "INVALID_TRANSITION"
    )
  })

  it("conserve ready pendant un service partiel", async () => {
    const store = new MemoryCommandStore({ item: { status: "ready" } })
    await markOrderItemServed(
      { store },
      base(actors.cashier, { quantityToServe: 1 })
    )
    assert.equal(store.item.status, "ready")
    assert.equal(store.item.servedQuantity, 1)

    await markOrderItemServed(
      { store },
      base(actors.cashier, {
        quantityToServe: 2,
        expectedVersion: 2,
        idempotencyKey: "idem-service-0002",
      })
    )
    assert.equal(store.item.status, "served")
    assert.equal(store.item.servedQuantity, 3)
    assert.equal(store.stock, 17)
  })

  it("refuse quantité nulle, dépassement, double service et version obsolète", async () => {
    const store = new MemoryCommandStore({ item: { status: "ready" } })
    assert.throws(
      () => markOrderItemServed({ store }, base(actors.cashier, { quantityToServe: 0 })),
      (error) => error.code === "INVALID_QUANTITY"
    )
    await assert.rejects(
      () => markOrderItemServed({ store }, base(actors.cashier, {
        quantityToServe: 4,
        idempotencyKey: "idem-overflow-01",
      })),
      (error) => error.code === "QUANTITY_EXCEEDS_REMAINING"
    )
    await markOrderItemServed(
      { store },
      base(actors.cashier, { quantityToServe: 3, idempotencyKey: "idem-complete-01" })
    )
    await assert.rejects(
      () => markOrderItemServed({ store }, base(actors.cashier, {
        quantityToServe: 1,
        expectedVersion: 2,
        idempotencyKey: "idem-double-0001",
      })),
      (error) => error.code === "ITEM_ALREADY_SERVED"
    )
    await assert.rejects(
      () => markOrderItemReady({ store: new MemoryCommandStore() }, base(actors.kitchen, {
        expectedVersion: 9,
      })),
      (error) => error.code === "CONCURRENT_MODIFICATION"
    )
  })
})

function canonicalItem(id, preparationMode, status, version) {
  return {
    id,
    orderId: ORDER_ID,
    restaurantId: RESTAURANT_ID,
    productId: `product-${id}`,
    preparationMode,
    status,
    quantity: 1,
    servedQuantity: 0,
    cancelledQuantity: 0,
    version,
  }
}

function handOffInput(items, suffix = "success") {
  return {
    restaurantId: RESTAURANT_ID,
    orderId: ORDER_ID,
    actor: actors.cashier,
    sourceChannel: "pos",
    cashSessionId: "cash-session-b",
    idempotencyKey: `hand-off-${suffix}-0001`,
    expectedItems: items.map((item) => ({
      orderItemId: item.id,
      expectedVersion: item.version,
    })),
  }
}

describe("annulation, paiement, idempotence et atomicité", () => {
  const paymentInput = (overrides = {}) => ({
    restaurantId: RESTAURANT_ID,
    orderId: ORDER_ID,
    actor: actors.cashier,
    sourceChannel: "pos",
    idempotencyKey: "pos-dine-in-payment-0001",
    expectedPaymentVersion: 1,
    expectedAmount: 1500,
    receivedAmount: 1500,
    method: "cash",
    provider: null,
    externalReference: null,
    cashSessionId: "session-1",
    ...overrides,
  })

  it("refuse l'encaissement anticipé d'une commande POS Sur place", async () => {
    const store = new MemoryCommandStore({
      order: { source: "pos", serviceMode: "dine_in", orderType: "dine_in" },
    })
    await assert.rejects(
      () => confirmOrderPayment({ store }, paymentInput()),
      (error) =>
        error.code === "POS_DINE_IN_PAYMENT_REQUIRES_SERVED_ORDER" &&
        error.status === 409
    )
    assert.equal(store.order.paymentStatus, "unpaid")
  })

  it("autorise l'encaissement POS Sur place lorsque toutes les lignes sont servies", async () => {
    const store = new MemoryCommandStore({
      order: { source: "pos", serviceMode: "dine_in", orderType: "dine_in" },
      item: { status: "served", servedQuantity: 3 },
    })
    await confirmOrderPayment({ store }, paymentInput())
    assert.equal(store.order.paymentStatus, "paid")
  })

  it("ne change pas le paiement QR à table", async () => {
    const store = new MemoryCommandStore({
      order: { source: "qr_table", serviceMode: "dine_in", orderType: "dine_in" },
    })
    await confirmOrderPayment({ store }, paymentInput({ idempotencyKey: "qr-payment-unchanged-0001" }))
    assert.equal(store.order.paymentStatus, "paid")
  })

  it("annule uniquement la quantité non servie sans restaurer le stock", async () => {
    const store = new MemoryCommandStore({
      item: { status: "ready", servedQuantity: 1 },
      stock: 19,
    })
    await cancelOrderItemQuantity(
      { store },
      base(actors.manager, { quantityToCancel: 2, reason: "client" })
    )
    assert.equal(store.item.cancelledQuantity, 2)
    assert.equal(store.item.status, "served")
    assert.equal(store.stock, 19)
    assert.equal(store.operations.length, 0)
  })

  it("refuse annulation excessive, ligne annulée et commande payée", async () => {
    await assert.rejects(
      () => cancelOrderItemQuantity(
        { store: new MemoryCommandStore({ item: { servedQuantity: 2 } }) },
        base(actors.manager, { quantityToCancel: 2, reason: null })
      ),
      (error) => error.code === "QUANTITY_EXCEEDS_REMAINING"
    )
    await assert.rejects(
      () => cancelOrderItemQuantity(
        { store: new MemoryCommandStore({ item: { status: "cancelled", cancelledQuantity: 3 } }) },
        base(actors.manager, { quantityToCancel: 1, reason: null })
      ),
      (error) => error.code === "ITEM_CANCELLED"
    )
    await assert.rejects(
      () => cancelOrderItemQuantity(
        { store: new MemoryCommandStore({ order: { paymentStatus: "paid" } }) },
        base(actors.manager, { quantityToCancel: 1, reason: null })
      ),
      (error) => error.code === "PAID_ORDER_REQUIRES_REFUND"
    )
  })

  it("confirme le paiement sans servir ni modifier le stock ou le parent métier", async () => {
    const store = new MemoryCommandStore({ item: { status: "ready" } })
    const result = await confirmOrderPayment({ store }, {
      restaurantId: RESTAURANT_ID,
      orderId: ORDER_ID,
      actor: actors.cashier,
      sourceChannel: "pos",
      idempotencyKey: "idem-payment-001",
      expectedPaymentVersion: 1,
      expectedAmount: 1500,
      receivedAmount: 2000,
      method: "cash",
      provider: null,
      externalReference: null,
      cashSessionId: "session-1",
    })
    assert.equal(result.version, 2)
    assert.equal(store.order.paymentStatus, "paid")
    assert.equal(store.order.paymentCashSessionId, "session-1")
    assert.equal(store.item.status, "ready")
    assert.equal(store.stock, 20)
  })

  it("régularise une ancienne livraison déjà en préparation et trace l'anomalie", async () => {
    const store = new MemoryCommandStore({
      order: { serviceMode: "delivery", orderType: "delivery", paymentStatus: "unpaid" },
      item: { status: "preparing" },
    })
    await confirmOrderPayment({ store }, {
      restaurantId: RESTAURANT_ID,
      orderId: ORDER_ID,
      actor: actors.cashier,
      sourceChannel: "pos",
      idempotencyKey: "legacy-delivery-payment-0001",
      expectedPaymentVersion: 1,
      expectedAmount: 1500,
      receivedAmount: 1500,
      method: "mobile_money",
      provider: "orange-money",
      externalReference: null,
      cashSessionId: "session-1",
    })
    assert.equal(store.order.paymentStatus, "paid")
    assert.equal(store.item.status, "preparing")
    assert.equal(
      store.audits.at(-1).after.paymentConfirmedAfterPreparationStarted,
      true
    )
  })

  it("refuse paiement partiel, montant obsolète et double paiement", async () => {
    const input = {
      restaurantId: RESTAURANT_ID,
      orderId: ORDER_ID,
      actor: actors.cashier,
      sourceChannel: "pos",
      idempotencyKey: "idem-payment-002",
      expectedPaymentVersion: 1,
      expectedAmount: 1500,
      receivedAmount: 1000,
      method: "cash",
      provider: null,
      externalReference: null,
      cashSessionId: "session-1",
    }
    await assert.rejects(
      () => confirmOrderPayment({ store: new MemoryCommandStore() }, input),
      (error) => error.code === "PARTIAL_PAYMENT_UNSUPPORTED"
    )
    await assert.rejects(
      () => confirmOrderPayment(
        { store: new MemoryCommandStore() },
        { ...input, expectedAmount: 1400, receivedAmount: 1400 }
      ),
      (error) => error.code === "PAYMENT_AMOUNT_MISMATCH"
    )
    await assert.rejects(
      () => confirmOrderPayment(
        { store: new MemoryCommandStore({ order: { paymentStatus: "paid" } }) },
        { ...input, receivedAmount: 1500 }
      ),
      (error) => error.code === "PAYMENT_ALREADY_CONFIRMED"
    )
  })

  it("rejoue un double clic et refuse une même clé avec un autre payload", async () => {
    const store = new MemoryCommandStore({ item: { status: "ready" } })
    const input = base(actors.cashier, {
      quantityToServe: 1,
      idempotencyKey: "idem-replay-0001",
    })
    const first = await markOrderItemServed({ store }, input)
    const replay = await markOrderItemServed({ store }, input)
    assert.equal(first.replayed, false)
    assert.equal(replay.replayed, true)
    assert.equal(store.stock, 19)
    assert.equal(store.operations.length, 1)
    assert.equal(store.audits.length, 1)

    await assert.rejects(
      () => markOrderItemServed({ store }, { ...input, quantityToServe: 2 }),
      (error) => error.code === "IDEMPOTENCY_CONFLICT"
    )
  })

  it("sérialise deux POS et deux cuisines avec la version métier", async () => {
    const posStore = new MemoryCommandStore({ item: { status: "ready" } })
    const posResults = await Promise.allSettled([
      markOrderItemServed(
        { store: posStore },
        base(actors.cashier, { quantityToServe: 1, idempotencyKey: "idem-pos-a-0001" })
      ),
      markOrderItemServed(
        { store: posStore },
        base(actors.cashier, { quantityToServe: 1, idempotencyKey: "idem-pos-b-0001" })
      ),
    ])
    assert.equal(posResults.filter((result) => result.status === "fulfilled").length, 1)
    assert.equal(posResults.filter(
      (result) => result.status === "rejected" && result.reason.code === "CONCURRENT_MODIFICATION"
    ).length, 1)
    assert.equal(posStore.stock, 19)

    const kitchenStore = new MemoryCommandStore()
    const kitchenResults = await Promise.allSettled([
      markOrderItemPreparing(
        { store: kitchenStore },
        base(actors.kitchen, { idempotencyKey: "idem-kitchen-a1" })
      ),
      markOrderItemPreparing(
        { store: kitchenStore },
        base(actors.kitchen, { idempotencyKey: "idem-kitchen-b1" })
      ),
    ])
    assert.equal(kitchenResults.filter((result) => result.status === "fulfilled").length, 1)
    assert.equal(kitchenResults.filter(
      (result) => result.status === "rejected" && result.reason.code === "CONCURRENT_MODIFICATION"
    ).length, 1)
  })

  it("conserve l'atomicité lors d'une erreur Stock ou avant commit", async () => {
    const stockFailure = new MemoryCommandStore({ item: { status: "ready" } })
    stockFailure.failStock = true
    await assert.rejects(
      () => markOrderItemServed(
        { store: stockFailure },
        base(actors.cashier, { quantityToServe: 1 })
      ),
      (error) => error.code === "STOCK_DEDUCTION_FAILED"
    )
    assert.equal(stockFailure.item.servedQuantity, 0)
    assert.equal(stockFailure.stock, 20)
    assert.equal(stockFailure.audits.length, 0)

    const rollback = new MemoryCommandStore({ item: { status: "ready" } })
    rollback.failBeforeCommit = true
    await assert.rejects(
      () => markOrderItemServed(
        { store: rollback },
        base(actors.cashier, { quantityToServe: 1 })
      ),
      /transaction aborted/
    )
    assert.equal(rollback.item.servedQuantity, 0)
    assert.equal(rollback.stock, 20)
    assert.equal(rollback.proofs.size, 0)
  })

  it("enregistre le service avec warning sans stock négatif", async () => {
    const store = new MemoryCommandStore({
      item: { status: "ready" },
      stock: 2,
      quantityPerSale: 1,
    })
    await markOrderItemServed(
      { store },
      base(actors.cashier, { quantityToServe: 3 })
    )
    assert.equal(store.item.status, "served")
    assert.equal(store.stock, 2)
    assert.equal(store.operations[0].warning, "INSUFFICIENT_STOCK")
  })
})
