import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  isPosCollectionCandidate,
  mergeCanonicalPosOrders,
  resolvePosOrderColumn,
} from "../../src/modules/pos/canonical/pos-selectors.ts"
import {
  resolvePosCanonicalMode,
} from "../../src/modules/pos/canonical/feature-flag.ts"
import {
  executePosCommand,
  getCanonicalMobileMoneyProvider,
  getCanonicalPaymentAmount,
  posCommandIdempotencyKey,
  PosCommandClientError,
} from "../../src/modules/pos/canonical/pos-command-client.ts"
import { confirmTableSessionPayment } from "../../src/modules/pos/canonical/table-session-payment-client.ts"
import {
  handlePosCommandRequest,
} from "../../src/server/orders/pos-command/handler.ts"

const posPath = "src/app/(dashboard)/pos/components/POSClient.tsx"

test("les clés de création POS respectent le contrat canonique", () => {
  const key = posCommandIdempotencyKey([
    "pos-create",
    "ccb21584-d85a-4d7b-b2a6-c36f4ff5f32f",
    "cashier:with:separators",
    Date.now(),
  ])
  assert.match(key, /^[A-Za-z0-9_-]{16,128}$/)
  assert.equal(key.includes(":"), false)
})

test("le POS remplace items[] par les orderItems canoniques", () => {
  const [order] = mergeCanonicalPosOrders(
    [{ id: "order-1", items: [{ id: "legacy" }], canonicalItemCount: 1 }],
    [{ orderId: "order-1", orderItemId: "line-1", createdAt: new Date(0) }]
  )
  assert.equal(order.items.length, 1)
  assert.equal(order.items[0].orderItemId, "line-1")
  assert.equal(order.__canonicalPos, true)
})

test("une commande uniquement legacy reste en lecture seule", () => {
  const [order] = mergeCanonicalPosOrders(
    [{ id: "legacy", items: [{ id: "old" }] }],
    []
  )
  assert.equal(order.__legacyReadOnly, true)
})

test("une commande mixte conserve toutes ses lignes canoniques", () => {
  const [order] = mergeCanonicalPosOrders(
    [{ id: "mixed", canonicalItemCount: 3 }],
    [
      { orderId: "mixed", orderItemId: "k", preparationMode: "kitchen" },
      { orderId: "mixed", orderItemId: "b", preparationMode: "bar" },
      { orderId: "mixed", orderItemId: "d", preparationMode: "direct" },
    ]
  )
  assert.deepEqual(new Set(order.items.map((item) => item.preparationMode)), new Set(["kitchen", "bar", "direct"]))
})

test("détecte une projection canonique incomplète", () => {
  const [order] = mergeCanonicalPosOrders(
    [{ id: "order-1", canonicalItemCount: 2 }],
    [{ orderId: "order-1", orderItemId: "line-1" }]
  )
  assert.equal(order.__canonicalIncomplete, true)
})

test("le paiement ne retire pas une commande opérationnelle du POS", () => {
  for (const orderType of ["delivery", "takeaway", "pickup"]) {
    const order = { orderType, paymentStatus: "paid" }
    assert.equal(isPosCollectionCandidate(order, "pending"), true)
    assert.equal(resolvePosOrderColumn(order, "pending"), "pending")
  }
  assert.equal(
    resolvePosOrderColumn({ orderType: "delivery", paymentStatus: "unpaid" }, "pending"),
    "pending"
  )
})

test("les colonnes POS suivent la préparation puis la remise", () => {
  const paidDelivery = { orderType: "delivery", paymentStatus: "paid" }
  assert.equal(resolvePosOrderColumn(paidDelivery, "preparing"), "preparing")
  assert.equal(resolvePosOrderColumn(paidDelivery, "ready"), "ready")
  assert.equal(resolvePosOrderColumn(paidDelivery, "picked_up"), "completed")
  assert.equal(resolvePosOrderColumn(paidDelivery, "completed"), "completed")
})

test("une table servie non payée reste dans Servies", () => {
  const tableOrder = { orderType: "dine_in", paymentStatus: "unpaid" }
  assert.equal(isPosCollectionCandidate(tableOrder, "served"), true)
  assert.equal(resolvePosOrderColumn(tableOrder, "served"), "served")
})

test("une nouvelle session ne reprend aucune commande terminale historique", () => {
  assert.equal(isPosCollectionCandidate({
    paymentStatus: "paid",
    completedCashSessionId: "cash-session-a",
  }, "completed", "cash-session-b"), false)
  assert.equal(isPosCollectionCandidate({
    paymentStatus: "paid",
    paymentCashSessionId: "cash-session-a",
  }, "served", "cash-session-b"), false)
  assert.equal(isPosCollectionCandidate({
    paymentStatus: "paid",
  }, "picked_up", "cash-session-b"), false)
})

test("une commande terminale de la session active reste visible", () => {
  assert.equal(isPosCollectionCandidate({
    paymentStatus: "paid",
    completedCashSessionId: "cash-session-b",
  }, "completed", "cash-session-b"), true)
})

test("la session de remise prévaut sur les rattachements paiement et legacy", () => {
  const order = {
    paymentStatus: "paid",
    completedCashSessionId: "cash-session-a",
    paymentCashSessionId: "cash-session-b",
    cashSessionId: "cash-session-b",
  }
  assert.equal(isPosCollectionCandidate(order, "completed", "cash-session-a"), true)
  assert.equal(isPosCollectionCandidate(order, "completed", "cash-session-b"), false)
})

test("les commandes publiques actives restent visibles sans session", () => {
  for (const status of ["pending", "preparing", "ready"]) {
    assert.equal(isPosCollectionCandidate({ paymentStatus: "paid" }, status, "cash-session-b"), true)
  }
})

test("le feature flag couvre canonical, legacy, compare et allowlist", () => {
  assert.equal(resolvePosCanonicalMode("r1", { mode: "canonical", restaurantAllowlist: [] }), "canonical")
  assert.equal(resolvePosCanonicalMode("r1", { mode: "legacy", restaurantAllowlist: [] }), "legacy")
  assert.equal(resolvePosCanonicalMode("r1", { mode: "compare", restaurantAllowlist: [] }), "compare")
  assert.equal(resolvePosCanonicalMode("r2", { mode: "canonical", restaurantAllowlist: ["r1"] }), "legacy")
})

test("le POS canonique sert exclusivement via MARK_ORDER_ITEM_SERVED", async () => {
  const source = await readFile(posPath, "utf8")
  assert.match(source, /command:\s*"MARK_ORDER_ITEM_SERVED"/)
  assert.match(source, /expectedVersion:/)
  assert.match(source, /quantityToServe/)
})

test("le POS canonique encaisse exclusivement via CONFIRM_ORDER_PAYMENT", async () => {
  const source = await readFile(posPath, "utf8")
  assert.match(source, /command:\s*"CONFIRM_ORDER_PAYMENT"/)
  assert.match(source, /expectedPaymentVersion/)
  assert.match(source, /receivedAmount/)
})

test("le POS Sur place sépare l'envoi de la commande de l'encaissement", async () => {
  const [source, cartPanel] = await Promise.all([
    readFile(posPath, "utf8"),
    readFile("src/app/(dashboard)/pos/components/CartPanel.tsx", "utf8"),
  ])
  assert.match(source, /if \(!isDineInCreation\) \{\s*await executePosCommand\(/)
  assert.match(source, /if \(orderType === "dine-in"\) \{\s*const succeeded = await handleCheckout\(\)/)
  assert.match(cartPanel, /orderType === "dine-in" \? "Envoyer la commande" : "Choisir le paiement"/)
})

test("l'encaissement affiché d'une commande POS Sur place attend l'état served", async () => {
  const source = await readFile(posPath, "utf8")
  assert.match(source, /order\.source === "pos" && normalizedType === "dine_in"/)
  assert.match(source, /currentOrderStatus === ORDER_OPERATION_STATUS\.SERVED/)
  assert.match(source, /getPOSOperationStatus\(order\) === ORDER_OPERATION_STATUS\.SERVED/)
})

test("l'encaissement POS Sur place ne dépend pas d'une demande de paiement QR", async () => {
  const source = await readFile(posPath, "utf8")
  assert.match(
    source,
    /if \(isPosDineInOrder\) \{\s*openOrderPaymentDialog\(selectedOrderDetail\)\s*return/
  )
  assert.match(
    source,
    /isPosDineInOrder\s*\? openOrderPaymentDialog\(order\)\s*:\s*paymentSession/
  )
})

test("l'encaissement POS Sur place demande Espèces ou Mobile Money", async () => {
  const source = await readFile(posPath, "utf8")
  assert.match(source, /setCollectingOrderId\(order\.id\)/)
  assert.match(source, /if \(collectingOrder\) \{/)
  assert.match(source, /handleCollectOrder\(collectingOrder, selectedPaymentMode\)/)
  assert.match(source, /total=\{collectingOrder \? getCanonicalPaymentAmount\(collectingOrder\) : total\}/)
})

test("le POS ne souscrit pas aux mouvements de caisse inutilisés", async () => {
  const source = await readFile(
    "src/modules/restaurant-live/RestaurantLiveDataProvider.tsx",
    "utf8"
  )
  assert.match(source, /if \(!enabled \|\| isPosRoute \|\| !db \|\| !restaurantId\) return null/)
})

test("les actions opérationnelles POS verrouillent uniquement la commande concernée", async () => {
  const source = await readFile(posPath, "utf8")
  assert.match(source, /pendingOrderActionIdsRef = React\.useRef<Set<string>>/)
  assert.match(source, /startOrderAction\(order\.id\)/)
  assert.match(source, /finishOrderAction\(order\.id\)/)
  assert.match(source, /pendingOrderActionIds\.has\(order\.id\)/)

  for (const handler of ["markOrderPaid", "markOrderItemServed", "handOffOrderItems"]) {
    const start = source.indexOf(`const ${handler} = async`)
    const end = source.indexOf("\n  const ", start + 10)
    const body = source.slice(start, end)
    assert.doesNotMatch(body, /setProcessing\(/)
    assert.match(body, /pendingOrderActionIdsRef\.current\.has\(order\.id\)/)
  }
})

test("la validation d'une session de table utilise une seule requête navigateur", async () => {
  const originalFetch = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) })
    return new Response(JSON.stringify({ ok: true, confirmedCount: 2, orderCount: 2 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  }
  try {
    const result = await confirmTableSessionPayment({
      user: { getIdToken: async () => "token" },
      restaurantId: "restaurant-1",
      tableSessionId: "table-session-1",
      cashSessionId: "cash-session-1",
      method: "cash",
      provider: null,
      idempotencyKey: "table-session-payment-0001",
    })
    assert.equal(calls.length, 1)
    assert.match(calls[0].url, /table-sessions\/table-session-1\/confirm-payment/)
    assert.equal(calls[0].body.method, "cash")
    assert.equal(result.confirmedCount, 2)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("le détail POS se ferme uniquement après une remise groupée réussie", async () => {
  const source = await readFile(posPath, "utf8")
  const start = source.indexOf("const handOffOrderItems = async")
  const end = source.indexOf("\n  const handleOrderTypeChange", start)
  const handler = source.slice(start, end)
  const command = handler.indexOf("await executePosCommand(")
  const close = handler.indexOf("setSelectedOrderDetailId((currentOrderId)")
  const error = handler.indexOf("} catch (error: any)")

  assert.ok(command >= 0)
  assert.ok(close > command)
  assert.ok(close < error)
  assert.match(handler, /currentOrderId === order\.id \? null : currentOrderId/)
})

test("le POS Sur place conserve le service individuel et propose le service groupé", async () => {
  const source = await readFile(posPath, "utf8")
  assert.match(source, /command: "SERVE_ORDER_ITEMS"/)
  assert.match(source, /Tout marquer comme servi/)
  assert.match(source, /onServeItem=\{/)
  assert.match(source, /onServeAll=\{/)
})

test("le badge Commandes compte en temps réel les commandes prêtes", async () => {
  const [client, header, layout] = await Promise.all([
    readFile(posPath, "utf8"),
    readFile("src/app/(dashboard)/pos/components/POSHeader.tsx", "utf8"),
    readFile("src/app/(dashboard)/pos/components/POSLayout.tsx", "utf8"),
  ])

  assert.match(client, /readyOrderCount = posOrders\[ORDER_OPERATION_STATUS\.READY\]\?\.length \?\? 0/)
  assert.match(client, /readyOrderCount=\{readyOrderCount\}/)
  assert.match(layout, /readyOrderCount=\{readyOrderCount\}/)
  assert.match(header, /readyOrderCount > 0/)
  assert.match(header, /prête.*à traiter/)
  assert.doesNotMatch(header, /unpaidServedCount/)
})

test("les cartes et le détail POS affichent les images des articles du catalogue", async () => {
  const source = await readFile(posPath, "utf8")

  assert.match(source, /productImages\.get\(String\(item\.productId/)
  assert.match(source, /imageUrl:\s*item\.imageUrl/)
  assert.match(source, /getOptimizedImage\(item\.imageUrl, 64\)/)
  assert.match(source, /getOptimizedImage\(item\.imageUrl, 80\)/)
  assert.match(source, /loading="lazy"/)
})

test("POS et Manager ne bouclent plus sur CONFIRM_ORDER_PAYMENT côté navigateur", async () => {
  const [posSource, managerSource, routeSource] = await Promise.all([
    readFile(posPath, "utf8"),
    readFile("src/app/(manager)/manager/caisse/page.tsx", "utf8"),
    readFile("src/app/api/restaurants/[restaurantId]/table-sessions/[tableSessionId]/confirm-payment/route.ts", "utf8"),
  ])
  const posStart = posSource.indexOf("const validateTableSessionPayment = async")
  const posEnd = posSource.indexOf("\n  const markOrderItemServed", posStart)
  const managerStart = managerSource.indexOf("const validateTableSessionPayment = async")
  const managerEnd = managerSource.indexOf("\n  const [processingOrderId", managerStart)
  assert.match(posSource.slice(posStart, posEnd), /confirmTableSessionPayment\(/)
  assert.doesNotMatch(posSource.slice(posStart, posEnd), /for \(/)
  assert.match(managerSource.slice(managerStart, managerEnd), /confirmTableSessionPayment\(/)
  assert.doesNotMatch(managerSource.slice(managerStart, managerEnd), /for \(/)
  assert.match(routeSource, /await confirmOrderPayment\(/)
  assert.match(routeSource, /String\(order\.paymentStatus\)\.toLowerCase\(\) === "paid"\) continue/)
  assert.doesNotMatch(routeSource, /collection\("payments"\).*\.(create|add|set)/s)
})

test("le paiement POS utilise le total parent autoritaire avec les frais de livraison", () => {
  const order = {
    totalAmount: 1750,
    total: 1750,
    deliveryFee: 250,
    items: [{ priceSnapshot: 1500, quantity: 1 }],
  }
  assert.equal(getCanonicalPaymentAmount(order), 1750)
  assert.equal(getCanonicalPaymentAmount({
    items: [{ priceSnapshot: 750, quantity: 2 }],
  }), 1500)
})

test("la validation Mobile Money reprend le fournisseur de la demande de paiement", () => {
  assert.equal(getCanonicalMobileMoneyProvider({
    paymentMethodCode: "orange_money",
    paymentRequest: { provider: "wave" },
  }), "orange_money")
  assert.equal(getCanonicalMobileMoneyProvider({
    paymentRequest: { provider: "wave" },
  }), "wave")
  assert.equal(getCanonicalMobileMoneyProvider({
    paymentRequest: { provider: "mobile_money" },
  }, "moov_money"), "moov_money")
  assert.equal(getCanonicalMobileMoneyProvider({
    paymentRequest: { provider: "mobile_money" },
  }), null)
})

test("le client POS propage le code et le message métier retournés par l'API", async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({
    ok: false,
    error: {
      code: "PREPAYMENT_REQUIRED_BEFORE_PREPARATION",
      message: "Le paiement doit être confirmé avant de traiter cette commande.",
      retryable: false,
    },
  }), {
    status: 409,
    headers: { "content-type": "application/json" },
  })

  try {
    await assert.rejects(
      executePosCommand({
        user: { getIdToken: async () => "token" },
        restaurantId: "restaurant-1",
        orderId: "order-1",
        command: "CONFIRM_ORDER_PAYMENT",
        payload: {},
      }),
      (error) => {
        assert.ok(error instanceof PosCommandClientError)
        assert.equal(error.code, "PREPAYMENT_REQUIRED_BEFORE_PREPARATION")
        assert.equal(
          error.message,
          "Le paiement doit être confirmé avant de traiter cette commande."
        )
        return true
      }
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("le POS masque la validation après synchronisation du statut paid", async () => {
  const source = await readFile(posPath, "utf8")
  assert.match(source, /const isPaid = isOrderPaid\(order\)/)
  assert.match(source, /\{!isPaid \? \(/)
  assert.match(source, /Paiement confirmé/)
})

test("le paiement canonique ne sert aucune ligne et ne retire aucun Stock", async () => {
  const source = await readFile(
    "src/server/orders/commands/transitions.ts",
    "utf8"
  )
  const start = source.indexOf("export function planPayment")
  const payment = source.slice(start)
  assert.match(payment, /itemUpdate:\s*null/)
  assert.match(payment, /stock:\s*null/)
})

test("le service canonique porte le plan Stock sans modifier le paiement", async () => {
  const source = await readFile(
    "src/server/orders/commands/transitions.ts",
    "utf8"
  )
  const start = source.indexOf("export function planServed")
  const end = source.indexOf("export function planCancellation")
  const served = source.slice(start, end)
  assert.match(served, /plan\.stock/)
  assert.doesNotMatch(served, /paymentStatus/)
})

test("aucune permission d’écriture orderItems n’est accordée au POS", async () => {
  const rules = await readFile("firestore.rules", "utf8")
  const groupRule = rules.slice(rules.indexOf("match /{path=**}/orderItems"))
  assert.match(groupRule, /allow list:/)
  assert.doesNotMatch(groupRule.slice(0, groupRule.indexOf("match /{document=**}")), /allow (create|update|write)/)
})

test("la frontière serveur ignore actorId et actorRole injectés", async () => {
  let captured
  const response = await handlePosCommandRequest(
    request({
      command: "MARK_ORDER_ITEM_SERVED",
      orderItemId: "line-1",
      expectedVersion: 1,
      quantityToServe: 1,
      idempotencyKey: "serve-order-1-line-1",
      actorId: "attacker",
      actorRole: "owner",
    }),
    { restaurantId: "restaurant-1", orderId: "order-1" },
    dependencies((command, input) => {
      captured = { command, input }
      return result("MarkOrderItemServed", "line-1")
    })
  )
  assert.equal(response.status, 200)
  assert.equal(captured.input.actor.id, "cashier-1")
  assert.equal(captured.input.actor.role, "cashier")
})

test("une ligne pending Cuisine est refusée par le moteur de transitions", async () => {
  const response = await handlePosCommandRequest(
    request({
      command: "MARK_ORDER_ITEM_SERVED",
      orderItemId: "line-1",
      expectedVersion: 1,
      quantityToServe: 1,
      idempotencyKey: "serve-order-1-line-1",
    }),
    { restaurantId: "restaurant-1", orderId: "order-1" },
    dependencies((command, input, transition) =>
      transition(state({ status: "pending", preparationMode: "kitchen" }), input)
    )
  )
  assert.equal(response.status, 409)
  assert.equal((await response.json()).error.code, "INVALID_TRANSITION")
})

test("une ligne ready peut être servie par la frontière POS", async () => {
  const response = await handlePosCommandRequest(
    request({
      command: "MARK_ORDER_ITEM_SERVED",
      orderItemId: "line-1",
      expectedVersion: 1,
      quantityToServe: 1,
      idempotencyKey: "serve-order-1-line-1",
    }),
    { restaurantId: "restaurant-1", orderId: "order-1" },
    dependencies((command, input, transition) => {
      const plan = transition(state({ status: "ready" }), input)
      assert.equal(plan.itemUpdate.status, "served")
      assert.ok(plan.stock)
      return result(command, "line-1")
    })
  )
  assert.equal(response.status, 200)
})

test("la confirmation paiement reconstruit l’acteur côté serveur", async () => {
  let captured
  const response = await handlePosCommandRequest(
    request({
      command: "CONFIRM_ORDER_PAYMENT",
      expectedPaymentVersion: 1,
      expectedAmount: 1000,
      receivedAmount: 1500,
      method: "cash",
      provider: null,
      externalReference: null,
      cashSessionId: "cash-session-1",
      idempotencyKey: "payment-order-1-v1",
    }),
    { restaurantId: "restaurant-1", orderId: "order-1" },
    dependencies((command, input) => {
      captured = input
      return result(command, null)
    })
  )
  assert.equal(response.status, 200)
  assert.equal(captured.actor.id, "cashier-1")
  assert.equal(captured.sourceChannel, "pos")
})

test("la frontière POS accepte une remise groupée avec les versions de toutes les lignes", async () => {
  let captured
  const response = await handlePosCommandRequest(
    request({
      command: "HAND_OFF_ORDER_ITEMS",
      expectedItems: [
        { orderItemId: "kitchen-1", expectedVersion: 2 },
        { orderItemId: "direct-1", expectedVersion: 1 },
      ],
      cashSessionId: "cash-session-b",
      idempotencyKey: "hand-off-order-1-ready",
    }),
    { restaurantId: "restaurant-1", orderId: "order-1" },
    dependencies((command, input) => {
      captured = { command, input }
      return result(command, null)
    })
  )
  assert.equal(response.status, 200)
  assert.equal(captured.command, "HandOffOrderItems")
  assert.equal(captured.input.cashSessionId, "cash-session-b")
  assert.deepEqual(captured.input.expectedItems, [
    { orderItemId: "kitchen-1", expectedVersion: 2 },
    { orderItemId: "direct-1", expectedVersion: 1 },
  ])
})

test("le POS utilise la remise groupée comme action principale hors table", async () => {
  const source = await readFile(posPath, "utf8")
  assert.match(source, /command:\s*"HAND_OFF_ORDER_ITEMS"/)
  assert.match(source, /Tout remettre au livreur/)
  assert.match(source, /Tout remettre au client/)
  assert.match(source, /En attente de validation du paiement/)
  assert.match(source, /!requiresGroupedHandOff &&/)
})

test("le POS conserve les observations générales et instructions par ligne", async () => {
  const source = await readFile(posPath, "utf8")
  assert.match(source, /Observation client/)
  assert.match(source, /order\.notes \|\| order\.customerNote/)
  assert.match(source, /item\.instructions \|\| item\.note \|\| item\.notes/)
  assert.match(source, /Instruction :/)
  assert.doesNotMatch(source, /dangerouslySetInnerHTML/)
})

test("la route répartit Cuisine et POS sans dupliquer le moteur", async () => {
  const source = await readFile(
    "src/app/api/restaurants/[restaurantId]/orders/[orderId]/commands/route.ts",
    "utf8"
  )
  assert.match(source, /POS_COMMANDS/)
  assert.match(source, /handlePosCommandRequest/)
  assert.match(source, /handleKitchenCommandRequest/)
  assert.match(source, /FirestoreAtomicOrderCommandStore/)
})

test("le backfill des sessions est terminal, idempotent et dry-run par défaut", async () => {
  const source = await readFile(
    "scripts/backfill-order-payment-cash-session.mjs",
    "utf8"
  )
  assert.match(source, /const dryRun = args\.write !== true/)
  assert.match(source, /if \(!isTerminalOrder\(order\)\)/)
  assert.match(source, /if \(stringValue\(order\.paymentCashSessionId\)\)/)
  assert.match(source, /sessions\.length !== 1/)
  assert.doesNotMatch(source, /createdAt.*sessionId|paidAt.*sessionId|completedAt.*sessionId/)
})

function request(body) {
  return new Request("http://localhost/commands", {
    method: "POST",
    headers: {
      authorization: "Bearer token",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  })
}

function dependencies(execute) {
  return {
    store: { execute },
    verifyIdToken: async () => ({ uid: "cashier-1" }),
    resolveStaffPrincipal: async () => ({
      kind: "staff",
      uid: "cashier-1",
      roles: ["cashier"],
    }),
    requestId: () => "request-1",
    log: { info() {}, error() {} },
  }
}

function result(commandName, orderItemId) {
  return {
    ok: true,
    commandName,
    orderId: "order-1",
    orderItemId,
    status: "APPLIED",
    version: 2,
    replayed: false,
  }
}

function state(itemOverrides = {}) {
  const item = {
    id: "line-1",
    orderId: "order-1",
    restaurantId: "restaurant-1",
    productId: "product-1",
    preparationMode: "kitchen",
    status: "ready",
    quantity: 1,
    servedQuantity: 0,
    cancelledQuantity: 0,
    version: 1,
    ...itemOverrides,
  }
  return {
    order: {
      id: "order-1",
      restaurantId: "restaurant-1",
      paymentStatus: "unpaid",
      paymentVersion: 1,
      totalAmount: 1000,
      total: 1000,
      hasUnaggregatedCancellation: false,
      orderStatus: "ready",
      kitchenStatus: "ready",
      aggregateVersion: 1,
      orderAggregate: null,
      embeddedItems: null,
      canonicalItemCount: 1,
    },
    item,
    items: [item],
  }
}
