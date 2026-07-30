import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { OrderAggregateError } from "../../src/server/orders/aggregate/errors.ts"
import { OrderCommandError } from "../../src/server/orders/commands/errors.ts"
import { handleKitchenCommandRequest } from "../../src/server/orders/kitchen-command/handler.ts"

const RESTAURANT_ID = "restaurant-kitchen"
const ORDER_ID = "order-kitchen"
const ITEM_ID = "item-kitchen"

class RouteCommandStore {
  constructor(overrides = {}) {
    this.item = {
      id: ITEM_ID,
      orderId: ORDER_ID,
      restaurantId: RESTAURANT_ID,
      productId: "pizza",
      preparationMode: "kitchen",
      status: "pending",
      quantity: 1,
      servedQuantity: 0,
      cancelledQuantity: 0,
      version: 1,
      ...overrides.item,
    }
    this.proofs = new Map()
    this.mutations = 0
    this.audits = 0
    this.error = overrides.error
  }

  async execute(commandName, input, transition) {
    if (this.error) throw this.error
    if (input.orderItemId !== this.item.id || input.orderId !== this.item.orderId) {
      throw new OrderCommandError("ORDER_ITEM_NOT_FOUND", "Ligne introuvable.")
    }
    const key = `${input.restaurantId}|${input.orderId}|${input.idempotencyKey}`
    const fingerprint = JSON.stringify({ commandName, expectedVersion: input.expectedVersion })
    const proof = this.proofs.get(key)
    if (proof) {
      if (proof.fingerprint !== fingerprint) {
        throw new OrderCommandError("IDEMPOTENCY_CONFLICT", "Conflit d’idempotence.")
      }
      return { ...proof.result, replayed: true }
    }
    const plan = transition({
      order: {
        id: ORDER_ID,
        restaurantId: RESTAURANT_ID,
        paymentStatus: "unpaid",
        paymentVersion: 1,
        totalAmount: 1000,
        total: 1000,
        hasUnaggregatedCancellation: false,
        orderStatus: "pending",
        kitchenStatus: "pending",
        aggregateVersion: 1,
        orderAggregate: null,
        embeddedItems: null,
        canonicalItemCount: 1,
      },
      item: structuredClone(this.item),
      items: [structuredClone(this.item)],
    })
    Object.assign(this.item, plan.itemUpdate)
    this.mutations += 1
    this.audits += 1
    const result = {
      ok: true,
      commandName,
      orderId: input.orderId,
      orderItemId: input.orderItemId,
      status: "APPLIED",
      version: this.item.version,
      replayed: false,
    }
    this.proofs.set(key, { fingerprint, result })
    return result
  }
}

function dependencies(overrides = {}) {
  return {
    store: overrides.store ?? new RouteCommandStore(),
    verifyIdToken: overrides.verifyIdToken ?? (async () => ({ uid: "kitchen-user" })),
    resolveStaffPrincipal: overrides.resolveStaffPrincipal ?? (async () => ({
      kind: "staff",
      uid: "kitchen-user",
      roles: ["kitchen"],
    })),
    verifyAppCheck: overrides.verifyAppCheck ?? (async () => undefined),
    requestId: () => "request-test",
    log: { info() {}, warn() {}, error() {} },
  }
}

function request(body = {}, headers = {}) {
  return new Request("http://localhost/api/commands", {
    method: "POST",
    headers: {
      authorization: "Bearer valid-token",
      "content-type": "application/json",
      "x-firebase-appcheck": "app-check-token",
      ...headers,
    },
    body: JSON.stringify({
      command: "MARK_ORDER_ITEM_PREPARING",
      orderItemId: ITEM_ID,
      idempotencyKey: "kitchen-request-0001",
      expectedVersion: 1,
      ...body,
    }),
  })
}

async function invoke(options = {}) {
  const response = await handleKitchenCommandRequest(
    options.request ?? request(options.body, options.headers),
    { restaurantId: RESTAURANT_ID, orderId: ORDER_ID },
    options.dependencies ?? dependencies(options.dependencyOverrides)
  )
  return { response, body: await response.json() }
}

describe("LOT 4.1 — frontière serveur Cuisine", () => {
  it("1. refuse un token absent", async () => {
    const result = await invoke({ headers: { authorization: "" } })
    assert.equal(result.response.status, 401)
    assert.equal(result.body.error.code, "UNAUTHENTICATED")
  })

  it("2. refuse un token Firebase invalide", async () => {
    const result = await invoke({
      dependencyOverrides: { verifyIdToken: async () => { throw new Error("invalid") } },
    })
    assert.equal(result.response.status, 401)
    assert.equal(result.body.error.code, "UNAUTHENTICATED")
  })

  it("3. refuse un utilisateur sans restaurant", async () => {
    const result = await invoke({
      dependencyOverrides: {
        resolveStaffPrincipal: async () => {
          throw Object.assign(new Error("no tenant"), { code: "FORBIDDEN" })
        },
      },
    })
    assert.equal(result.response.status, 403)
    assert.equal(result.body.error.code, "FORBIDDEN")
  })

  it("4. refuse un utilisateur d’un autre restaurant", async () => {
    const result = await invoke({
      dependencyOverrides: {
        resolveStaffPrincipal: async () => {
          throw Object.assign(new Error("wrong tenant"), { code: "FORBIDDEN" })
        },
      },
    })
    assert.equal(result.response.status, 403)
  })

  it("5. refuse un rôle autre que Cuisine", async () => {
    const result = await invoke({
      dependencyOverrides: {
        resolveStaffPrincipal: async () => ({ kind: "staff", uid: "cashier", roles: ["cashier"] }),
      },
    })
    assert.equal(result.response.status, 403)
    assert.equal(result.body.error.code, "FORBIDDEN")
  })

  it("6. refuse une commande inconnue", async () => {
    const result = await invoke({ body: { command: "DO_SOMETHING" } })
    assert.equal(result.response.status, 403)
    assert.equal(result.body.error.code, "FORBIDDEN_COMMAND")
  })

  it("7. refuse MARK_ORDER_ITEM_SERVED depuis Cuisine", async () => {
    const result = await invoke({ body: { command: "MARK_ORDER_ITEM_SERVED" } })
    assert.equal(result.body.error.code, "FORBIDDEN_COMMAND")
  })

  it("8. refuse CONFIRM_ORDER_PAYMENT depuis Cuisine", async () => {
    const result = await invoke({ body: { command: "CONFIRM_ORDER_PAYMENT" } })
    assert.equal(result.body.error.code, "FORBIDDEN_COMMAND")
  })

  it("9. refuse un payload incomplet", async () => {
    const result = await invoke({ body: { orderItemId: "" } })
    assert.equal(result.response.status, 400)
    assert.equal(result.body.error.code, "INVALID_PAYLOAD")
  })

  it("10. refuse expectedVersion invalide", async () => {
    const result = await invoke({ body: { expectedVersion: 0 } })
    assert.equal(result.response.status, 400)
  })

  it("11. refuse une clé d’idempotence absente", async () => {
    const result = await invoke({ body: { idempotencyKey: "" } })
    assert.equal(result.response.status, 400)
  })

  it("12. délègue pending vers preparing au moteur LOT 2", async () => {
    const store = new RouteCommandStore()
    const result = await invoke({ dependencies: dependencies({ store }) })
    assert.equal(result.response.status, 200)
    assert.equal(store.item.status, "preparing")
    assert.equal(store.item.version, 2)
  })

  it("13. délègue preparing vers ready au moteur LOT 2", async () => {
    const store = new RouteCommandStore({ item: { status: "preparing", version: 2 } })
    const result = await invoke({
      body: {
        command: "MARK_ORDER_ITEM_READY",
        expectedVersion: 2,
        idempotencyKey: "kitchen-request-0002",
      },
      dependencies: dependencies({ store }),
    })
    assert.equal(result.response.status, 200)
    assert.equal(store.item.status, "ready")
    assert.equal(store.item.version, 3)
  })

  it("14. retourne 409 pour une transition invalide", async () => {
    const store = new RouteCommandStore({ item: { status: "served" } })
    const result = await invoke({ dependencies: dependencies({ store }) })
    assert.equal(result.response.status, 409)
    assert.equal(result.body.error.code, "INVALID_TRANSITION")
  })

  it("15. retourne 409 pour un conflit de version", async () => {
    const store = new RouteCommandStore({ item: { version: 2 } })
    const result = await invoke({ dependencies: dependencies({ store }) })
    assert.equal(result.response.status, 409)
    assert.equal(result.body.error.code, "CONCURRENT_MODIFICATION")
  })

  it("16. rejoue le même payload sans seconde mutation", async () => {
    const store = new RouteCommandStore()
    const deps = dependencies({ store })
    const first = await invoke({ dependencies: deps })
    const replay = await invoke({ dependencies: deps })
    assert.equal(first.body.result.replayed, false)
    assert.equal(replay.body.result.replayed, true)
    assert.equal(store.mutations, 1)
    assert.equal(store.audits, 1)
  })

  it("17. refuse la même clé avec un payload différent", async () => {
    const store = new RouteCommandStore()
    const deps = dependencies({ store })
    await invoke({ dependencies: deps })
    const conflict = await invoke({
      body: { expectedVersion: 2 },
      dependencies: deps,
    })
    assert.equal(conflict.response.status, 409)
    assert.equal(conflict.body.error.code, "IDEMPOTENCY_CONFLICT")
    assert.equal(store.mutations, 1)
    assert.equal(store.audits, 1)
  })

  it("18. expose une commande legacy en lecture seule sans mutation", async () => {
    const store = new RouteCommandStore({
      error: new OrderAggregateError("LEGACY_ORDER_READ_ONLY", "Commande legacy en lecture seule."),
    })
    const result = await invoke({ dependencies: dependencies({ store }) })
    assert.equal(result.response.status, 409)
    assert.equal(result.body.error.code, "LEGACY_ORDER_READ_ONLY")
    assert.equal(store.mutations, 0)
  })

  it("19. refuse une ligne appartenant à une autre commande", async () => {
    const store = new RouteCommandStore({ item: { orderId: "another-order" } })
    const result = await invoke({ dependencies: dependencies({ store }) })
    assert.equal(result.response.status, 404)
    assert.equal(result.body.error.code, "ORDER_ITEM_NOT_FOUND")
  })

  it("20. masque une erreur interne et n’expose aucune stack", async () => {
    const store = new RouteCommandStore({ error: new Error("secret database detail") })
    const result = await invoke({ dependencies: dependencies({ store }) })
    assert.equal(result.response.status, 500)
    assert.equal(result.body.error.code, "INTERNAL_ERROR")
    assert.doesNotMatch(JSON.stringify(result.body), /secret|stack/i)
  })

  it("21. refuse un acteur ou rôle injecté par le navigateur", async () => {
    const result = await invoke({ body: { actorRole: "owner", actorId: "attacker" } })
    assert.equal(result.response.status, 400)
    assert.equal(result.body.error.code, "INVALID_PAYLOAD")
  })

  it("22. observe App Check absent sans bloquer un ID token valide", async () => {
    const warnings = []
    const deps = dependencies()
    deps.log = { info() {}, warn(event) { warnings.push(event) }, error() {} }
    const result = await invoke({
      request: request({}, { "x-firebase-appcheck": "" }),
      dependencies: deps,
    })
    assert.equal(result.response.status, 200)
    assert.deepEqual(warnings, ["KITCHEN_COMMAND_APP_CHECK_MISSING"])
  })

  it("23. observe App Check invalide sans bloquer un ID token valide", async () => {
    const warnings = []
    const deps = dependencies({
      verifyAppCheck: async () => { throw new Error("invalid app check") },
    })
    deps.log = { info() {}, warn(event) { warnings.push(event) }, error() {} }
    const result = await invoke({ dependencies: deps })
    assert.equal(result.response.status, 200)
    assert.deepEqual(warnings, ["KITCHEN_COMMAND_APP_CHECK_INVALID"])
  })
})
