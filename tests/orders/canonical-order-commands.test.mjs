import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  cancelOrderItemQuantity,
  confirmOrderPayment,
  markOrderItemPreparing,
  markOrderItemReady,
  markOrderItemServed,
} from "../../src/server/orders/commands/service.ts"

const RESTAURANT_ID = "restaurant-test"
const ORDER_ID = "order-test"
const ITEM_ID = "item-test"

class MemoryCommandStore {
  constructor(overrides = {}) {
    this.order = {
      id: ORDER_ID,
      restaurantId: RESTAURANT_ID,
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
    const itemBefore = structuredClone(this.item)
    const stockBefore = this.stock
    const operationsBefore = this.operations.length
    const auditsBefore = this.audits.length
    try {
      const plan = transition({
        order: structuredClone(this.order),
        item: "orderItemId" in input ? structuredClone(this.item) : null,
      })
      if (plan.stock) {
        if (this.failStock) throw coded("STOCK_DEDUCTION_FAILED")
        const servedDelta =
          plan.stock.servedQuantityAfter - plan.stock.servedQuantityBefore
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
      if (plan.orderUpdate) Object.assign(this.order, plan.orderUpdate)
      if (this.failBeforeCommit) throw new Error("transaction aborted")

      const stockResult = plan.stock
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
      this.item = itemBefore
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

describe("annulation, paiement, idempotence et atomicité", () => {
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
    assert.equal(store.item.status, "ready")
    assert.equal(store.stock, 20)
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
