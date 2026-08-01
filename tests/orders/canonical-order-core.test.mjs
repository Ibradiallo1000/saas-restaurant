import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { CanonicalOrderError } from "../../src/server/orders/create/errors.ts"
import { createCanonicalOrder } from "../../src/server/orders/create/service.ts"

const STAFF = { kind: "staff", uid: "cashier-1", roles: ["cashier"] }
const PUBLIC = { kind: "public", uid: "anonymous-1", roles: [] }
const IDEMPOTENCY_KEY = "idem_1234567890123456"

function request(overrides = {}) {
  return {
    schemaVersion: 1,
    channel: "pos",
    serviceMode: "takeaway",
    clientRequestId: "request-1",
    items: [
      {
        clientLineId: "line-1",
        productId: "coca",
        quantity: 2,
        options: [],
        instructions: null,
      },
    ],
    tableContext: null,
    customer: null,
    delivery: null,
    cashSessionId: null,
    notes: null,
    ...overrides,
  }
}

function product(overrides = {}) {
  return {
    id: "coca",
    name: "Coca Cola",
    price: 500,
    active: true,
    categoryId: "drinks",
    preparationMode: "direct",
    options: [],
    reviewsEnabled: false,
    ...overrides,
  }
}

function authorities(overrides = {}) {
  return {
    restaurant: {
      id: "restaurant-1",
      name: "Univers Food",
      active: true,
      currency: "FCFA",
      taxRate: 0,
      pricesIncludeTax: false,
      deliveryFee: 0,
      publicOrderingOpen: true,
    },
    products: new Map([["coca", product()]]),
    categories: new Map([
      ["drinks", { id: "drinks", name: "Boissons", active: true, preparationMode: "direct" }],
    ]),
    tableSession: null,
    ...overrides,
  }
}

class MemoryAtomicStore {
  constructor(source = authorities()) {
    this.authorities = source
    this.proofs = new Map()
    this.orders = new Map()
    this.calls = 0
    this.failBeforeCommit = false
    this.firestoreError = null
    this.pending = new Map()
  }

  async create(input, build) {
    const key = `${input.restaurantId}:${input.principal.uid}:${input.request.channel}:${input.idempotencyKey}`
    if (this.pending.has(key)) {
      await this.pending.get(key)
      return this.create(input, build)
    }
    let release
    const lock = new Promise((resolve) => { release = resolve })
    this.pending.set(key, lock)
    try {
      const proof = this.proofs.get(key)
      if (proof) {
        if (proof.requestHash !== input.requestHash) {
          throw new CanonicalOrderError("IDEMPOTENCY_CONFLICT", "Conflit.")
        }
        return { ...proof.response, replayed: true }
      }
      this.calls += 1
      if (this.firestoreError) throw this.firestoreError
      const orderId = `order-${this.calls}`
      const orderItemIds = input.request.items.map((_, index) => `${orderId}-item-${index + 1}`)
      const plan = build({
        authorities: this.authorities,
        orderId,
        orderItemIds,
        now: new Date("2026-07-29T10:00:00.000Z"),
      })
      const response = {
        ok: true,
        orderId,
        displayId: plan.displayId,
        schemaVersion: 1,
        channel: input.request.channel,
        serviceMode: input.request.serviceMode,
        orderStatus: plan.parent.orderStatus,
        paymentStatus: "unpaid",
        total: plan.parent.total,
        currency: this.authorities.restaurant.currency,
        orderItemIds,
        idempotencyKey: input.idempotencyKey,
        replayed: false,
        createdAt: plan.parent.createdAt.toISOString(),
      }
      if (this.failBeforeCommit) throw new Error("transaction aborted")
      this.orders.set(orderId, plan)
      this.proofs.set(key, { requestHash: input.requestHash, response })
      return response
    } finally {
      this.pending.delete(key)
      release()
    }
  }
}

async function create(store, body = request(), principal = STAFF, key = IDEMPOTENCY_KEY) {
  return createCanonicalOrder(
    { store },
    {
      restaurantId: "restaurant-1",
      body,
      principal,
      idempotencyKey: key,
    }
  )
}

describe("création canonique", () => {
  it("crée une commande directe simple avec prix et projection autoritaires", async () => {
    const store = new MemoryAtomicStore()
    const result = await create(store)
    const plan = store.orders.get(result.orderId)

    assert.equal(result.total, 1000)
    assert.equal(result.orderStatus, "ready")
    assert.equal(plan.items[0].preparationMode, "direct")
    assert.equal(plan.items[0].servedQuantity, 0)
    assert.deepEqual(plan.parent.items, plan.items)
    assert.equal(plan.parent.paymentStatus, "unpaid")
  })

  it("conserve le vrai numéro de table sans exposer son identifiant technique", async () => {
    const store = new MemoryAtomicStore(authorities({
      tableSession: {
        id: "session-table-9",
        tableId: "9lkVsfYMPOYztahvOOkU",
        tableName: "Table 9",
        zoneId: "salle",
        active: true,
      },
    }))
    const result = await create(store, request({
      serviceMode: "dine_in",
      tableContext: {
        tableId: "9lkVsfYMPOYztahvOOkU",
        tableSessionId: "session-table-9",
        capability: null,
      },
    }))
    const parent = store.orders.get(result.orderId).parent

    assert.equal(parent.tableId, "9lkVsfYMPOYztahvOOkU")
    assert.equal(parent.table, "Table 9")
  })

  it("crée plusieurs lignes et recalcule options, taxe et total", async () => {
    const configurable = product({
      price: 1000,
      options: [{
        name: "Taille",
        required: true,
        choices: [{ name: "Grande", price: 250, active: true }],
      }],
    })
    const store = new MemoryAtomicStore(authorities({
      restaurant: { ...authorities().restaurant, taxRate: 0.1 },
      products: new Map([
        ["coca", configurable],
        ["pain", product({ id: "pain", name: "Pain", price: 200 })],
      ]),
    }))
    const result = await create(store, request({
      items: [
        {
          clientLineId: "line-1",
          productId: "coca",
          quantity: 2,
          options: [{ optionName: "Taille", choiceName: "Grande" }],
          instructions: null,
        },
        {
          clientLineId: "line-2",
          productId: "pain",
          quantity: 1,
          options: [],
          instructions: null,
        },
      ],
    }))
    const parent = store.orders.get(result.orderId).parent

    assert.equal(parent.subtotal, 2700)
    assert.equal(parent.taxAmount, 270)
    assert.equal(parent.total, 2970)
    assert.equal(parent.items.length, 2)
    assert.equal(parent.items[0].selectedOptions[0].price, 250)
  })

  it("calcule les frais de livraison depuis le restaurant, jamais depuis le client", async () => {
    const store = new MemoryAtomicStore(authorities({
      restaurant: { ...authorities().restaurant, deliveryFee: 1500 },
    }))
    const result = await create(store, request({
      channel: "public_delivery",
      serviceMode: "delivery",
      delivery: {
        address: "Médina, Dakar",
        zoneId: "medina",
        instructions: null,
      },
    }), PUBLIC)
    const parent = store.orders.get(result.orderId).parent

    assert.equal(parent.deliveryFee, 1500)
    assert.equal(parent.total, 2500)
  })

  it("initialise cuisine à pending, Bar et direct à ready", async () => {
    const store = new MemoryAtomicStore(authorities({
      products: new Map([
        ["coca", product()],
        ["cocktail", product({ id: "cocktail", name: "Cocktail", preparationMode: "bar" })],
        ["pizza", product({ id: "pizza", name: "Pizza", preparationMode: "kitchen" })],
      ]),
    }))
    const result = await create(store, request({
      items: [
        { clientLineId: "direct", productId: "coca", quantity: 1, options: [], instructions: null },
        { clientLineId: "bar", productId: "cocktail", quantity: 1, options: [], instructions: null },
        { clientLineId: "kitchen", productId: "pizza", quantity: 1, options: [], instructions: null },
      ],
    }))
    const items = store.orders.get(result.orderId).items

    assert.deepEqual(items.map((item) => item.status), ["ready", "ready", "pending"])
    assert.equal(result.orderStatus, "pending")
  })

  it("conserve les observations générales et instructions de ligne nettoyées", async () => {
    const store = new MemoryAtomicStore()
    const result = await create(store, request({
      notes: "Ajouter un peu de piment 🌶️ <script>alert(1)</script>\u0000",
      items: [{
        clientLineId: "line-1",
        productId: "coca",
        quantity: 2,
        options: [],
        instructions: "sans oignon & allergie arachide\u0007",
      }],
    }))
    const plan = store.orders.get(result.orderId)
    assert.equal(
      plan.parent.notes,
      "Ajouter un peu de piment 🌶️ <script>alert(1)</script>"
    )
    assert.equal(plan.items[0].instructions, "sans oignon & allergie arachide")
    assert.equal(plan.parent.items[0].instructions, "sans oignon & allergie arachide")
  })

  it("refuse une commande vide et plus de 50 lignes", async () => {
    const store = new MemoryAtomicStore()
    await assert.rejects(() => create(store, request({ items: [] })), /commande est invalide/i)
    const items = Array.from({ length: 51 }, (_, index) => ({
      clientLineId: `line-${index}`,
      productId: "coca",
      quantity: 1,
      options: [],
      instructions: null,
    }))
    await assert.rejects(() => create(store, request({ items })), /commande est invalide/i)
  })

  it("applique les maxima 99 public et 999 personnel", async () => {
    await assert.rejects(
      () => create(new MemoryAtomicStore(), request({ channel: "public_takeaway", items: [{
        clientLineId: "line-1", productId: "coca", quantity: 100, options: [], instructions: null,
      }] }), PUBLIC),
      /99/
    )
    const result = await create(new MemoryAtomicStore(), request({ items: [{
      clientLineId: "line-1", productId: "coca", quantity: 999, options: [], instructions: null,
    }] }))
    assert.equal(result.total, 499500)
    await assert.rejects(
      () => create(new MemoryAtomicStore(), request({ items: [{
        clientLineId: "line-1", productId: "coca", quantity: 1000, options: [], instructions: null,
      }] })),
      /commande est invalide/i
    )
  })

  it("refuse produit supprimé, restaurant invalide et option inconnue", async () => {
    await assert.rejects(
      () => create(new MemoryAtomicStore(authorities({ products: new Map() }))),
      /Produit introuvable/
    )
    await assert.rejects(
      () => create(new MemoryAtomicStore(authorities({
        restaurant: { ...authorities().restaurant, active: false },
      }))),
      /restaurant n'est pas actif/i
    )
    await assert.rejects(
      () => create(new MemoryAtomicStore(authorities({
        products: new Map([["coca", product({
          options: [{ name: "Taille", required: false, choices: [] }],
        })]]),
      })), request({ items: [{
        clientLineId: "line-1",
        productId: "coca",
        quantity: 1,
        options: [{ optionName: "Taille", choiceName: "Inconnue" }],
        instructions: null,
      }] })),
      /Choix inconnu/
    )
  })
})

describe("idempotence et atomicité", () => {
  it("retourne la même commande lors d'un rejeu", async () => {
    const store = new MemoryAtomicStore()
    const first = await create(store)
    const replay = await create(store)

    assert.equal(replay.orderId, first.orderId)
    assert.equal(replay.total, first.total)
    assert.equal(replay.replayed, true)
    assert.equal(store.orders.size, 1)
  })

  it("résiste à un double clic concurrent", async () => {
    const store = new MemoryAtomicStore()
    const [left, right] = await Promise.all([create(store), create(store)])

    assert.equal(left.orderId, right.orderId)
    assert.equal(store.orders.size, 1)
    assert.equal([left.replayed, right.replayed].filter(Boolean).length, 1)
  })

  it("refuse une requête différente avec la même clé", async () => {
    const store = new MemoryAtomicStore()
    await create(store)
    await assert.rejects(
      () => create(store, request({ notes: "requête différente" })),
      (error) => error?.code === "IDEMPOTENCY_CONFLICT"
    )
  })

  it("ne persiste rien lors d'un rollback transactionnel", async () => {
    const store = new MemoryAtomicStore()
    store.failBeforeCommit = true

    await assert.rejects(() => create(store), /transaction aborted/)
    assert.equal(store.orders.size, 0)
    assert.equal(store.proofs.size, 0)
  })

  it("propage une erreur Firestore sans créer de document", async () => {
    const store = new MemoryAtomicStore()
    store.firestoreError = new Error("firestore unavailable")

    await assert.rejects(() => create(store), /firestore unavailable/)
    assert.equal(store.orders.size, 0)
    assert.equal(store.proofs.size, 0)
  })
})
