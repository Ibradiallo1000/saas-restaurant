import assert from "node:assert/strict"
import test, { after, before } from "node:test"

import { deleteApp, initializeApp } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"

import {
  confirmOrderPayment,
  FirestoreAtomicOrderCommandStore,
  markOrderItemPreparing,
  markOrderItemReady,
  markOrderItemServed,
} from "../../src/server/orders/commands/index.ts"
import { commandProofId } from "../../src/server/orders/common/idempotency.ts"

const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST)
const projectId = "oordera-order-transactions-lot3-2"
let app
let db
let sequence = 0

before(() => {
  if (!enabled) return
  app = initializeApp({ projectId }, `lot3-2-${Date.now()}`)
  db = getFirestore(app)
})

after(async () => {
  if (app) await deleteApp(app)
})

function ids(label) {
  sequence += 1
  const suffix = `${label.toLowerCase()}-${Date.now()}-${sequence}`
  return {
    restaurantId: `restaurant-${suffix}`,
    orderId: `order-${suffix}`,
    itemId: `item-${suffix}`,
    productId: `product-${suffix}`,
    articleId: `article-${suffix}`,
    sessionId: `session-${suffix}`,
  }
}

function row(id, overrides = {}) {
  return {
    id,
    orderItemId: id,
    productId: `product-${id}`,
    preparationMode: "kitchen",
    status: "pending",
    quantity: 1,
    servedQuantity: 0,
    cancelledQuantity: 0,
    version: 1,
    ...overrides,
  }
}

async function seed(label, options = {}) {
  const value = ids(label)
  const root = db.collection("restaurants").doc(value.restaurantId)
  const orderRef = root.collection("orders").doc(value.orderId)
  const rows = options.rows ?? [row(value.itemId, options.item)]
  const embedded = options.embedded === undefined
    ? rows.map((entry) => ({ id: entry.id, orderItemId: entry.id, status: entry.status }))
    : options.embedded
  const parent = {
    restaurantId: value.restaurantId,
    paymentStatus: options.paymentStatus ?? "unpaid",
    paymentVersion: 1,
    totalAmount: 1500,
    total: 1500,
    orderStatus: options.orderStatus ?? rows[0]?.status ?? "pending",
    kitchenStatus: options.kitchenStatus ?? options.orderStatus ?? rows[0]?.status ?? "pending",
    aggregateVersion: options.aggregateVersion ?? 1,
    orderAggregate: options.orderAggregate ?? null,
    ...(options.omitCanonicalCount ? {} : {
      canonicalItemCount: options.canonicalItemCount ?? rows.length,
    }),
    ...(embedded === null ? {} : { items: embedded }),
  }
  await orderRef.set(parent)
  if (!options.legacyOnly) {
    await Promise.all(rows.map((entry) =>
      orderRef.collection("orderItems").doc(entry.id).set({
        ...entry,
        orderId: value.orderId,
        restaurantId: value.restaurantId,
      })
    ))
  }
  if (options.stock) {
    const target = rows.find((entry) => entry.id === (options.stockItemId ?? value.itemId)) ?? rows[0]
    await Promise.all([
      root.collection("products").doc(target.productId).set({ stockArticleId: value.articleId }),
      root.collection("stockItemsV2").doc(value.articleId).set({
        restaurantId: value.restaurantId,
        status: "active",
        trackingMode: "AUTOMATIC_SIMPLE",
      }),
      ...(options.missingBalance ? [] : [
        root.collection("stockBalancesV2").doc(value.articleId).set({
          restaurantId: value.restaurantId,
          articleId: value.articleId,
          quantity: 20,
          unit: "unit",
          version: 1,
        }),
      ]),
      root.collection("stockAutomaticAssociationsV2")
        .doc(`${target.productId}--${value.articleId}`)
        .set({
          restaurantId: value.restaurantId,
          productId: target.productId,
          articleId: value.articleId,
          quantity: 1,
          unit: "unit",
          status: "active",
        }),
    ])
  }
  if (options.cashSession) {
    await root.collection("cashSessions").doc(value.sessionId).set({
      restaurantId: value.restaurantId,
      status: "open",
      cashierId: "cashier-1",
    })
  }
  return { ...value, root, orderRef, rows }
}

const actor = (ctx, role = "kitchen", id = `${role}-1`) => ({
  id,
  role,
  restaurantId: ctx.restaurantId,
})

const preparingInput = (ctx, key, overrides = {}) => ({
  restaurantId: ctx.restaurantId,
  orderId: ctx.orderId,
  orderItemId: ctx.itemId,
  actor: actor(ctx),
  sourceChannel: "kitchen",
  idempotencyKey: key,
  expectedVersion: 1,
  ...overrides,
})

const readyInput = (ctx, key, overrides = {}) => ({
  ...preparingInput(ctx, key),
  ...overrides,
})

const servedInput = (ctx, key, overrides = {}) => ({
  restaurantId: ctx.restaurantId,
  orderId: ctx.orderId,
  orderItemId: ctx.itemId,
  actor: actor(ctx, "cashier"),
  sourceChannel: "pos",
  idempotencyKey: key,
  expectedVersion: 1,
  quantityToServe: 1,
  ...overrides,
})

const paymentInput = (ctx, key, overrides = {}) => ({
  restaurantId: ctx.restaurantId,
  orderId: ctx.orderId,
  actor: actor(ctx, "cashier"),
  sourceChannel: "pos",
  idempotencyKey: key,
  expectedPaymentVersion: 1,
  expectedAmount: 1500,
  receivedAmount: 1500,
  method: "cash",
  provider: null,
  externalReference: null,
  cashSessionId: ctx.sessionId,
  ...overrides,
})

const store = () => new FirestoreAtomicOrderCommandStore(db)

async function state(ctx, itemId = ctx.itemId) {
  const [parent, item, audits, proofs, operations, progress, stockProofs, payments] =
    await Promise.all([
      ctx.orderRef.get(),
      ctx.orderRef.collection("orderItems").doc(itemId).get(),
      ctx.orderRef.collection("commandAudit").get(),
      ctx.root.collection("orderCommandIdempotency").get(),
      ctx.root.collection("stockOperationsV2").get(),
      ctx.root.collection("stockServingProgressV2").get(),
      ctx.root.collection("stockIdempotencyV2").get(),
      ctx.root.collection("payments").get(),
    ])
  return {
    parent: parent.data(),
    item: item.exists ? item.data() : null,
    auditDocs: audits.docs,
    proofs: proofs.size,
    operations: operations.size,
    progress: progress.size,
    stockProofs: stockProofs.size,
    payments: payments.size,
  }
}

async function snapshotTree(ctx) {
  const current = await state(ctx)
  return JSON.parse(JSON.stringify({
    parent: current.parent,
    item: current.item,
    audits: current.auditDocs.map((entry) => entry.data()),
    proofs: current.proofs,
    operations: current.operations,
    progress: current.progress,
    stockProofs: current.stockProofs,
    payments: current.payments,
  }))
}

test("A1 pending vers preparing met à jour ligne, parent, version, audit et preuve", { skip: !enabled }, async () => {
  const ctx = await seed("A1")
  await markOrderItemPreparing({ store: store() }, preparingInput(ctx, "lot32-a1-preparing"))
  const afterState = await state(ctx)
  assert.equal(afterState.item.status, "preparing")
  assert.equal(afterState.parent.orderStatus, "preparing")
  assert.equal(afterState.parent.aggregateVersion, 2)
  assert.equal(afterState.auditDocs.length, 1)
  assert.equal(afterState.proofs, 1)
})

test("A2 preparing vers ready met à jour ligne, parent, version, audit et preuve", { skip: !enabled }, async () => {
  const ctx = await seed("A2", { item: { status: "preparing" }, orderStatus: "preparing" })
  await markOrderItemReady({ store: store() }, readyInput(ctx, "lot32-a2-ready"))
  const afterState = await state(ctx)
  assert.equal(afterState.item.status, "ready")
  assert.equal(afterState.parent.orderStatus, "ready")
  assert.equal(afterState.parent.aggregateVersion, 2)
  assert.equal(afterState.auditDocs.length, 1)
  assert.equal(afterState.proofs, 1)
})

test("A3 ready vers served applique ligne, parent, Stock, progression, audit et preuves", { skip: !enabled }, async () => {
  const ctx = await seed("A3", {
    item: { status: "ready", preparationMode: "direct" },
    orderStatus: "ready",
    stock: true,
  })
  await markOrderItemServed({ store: store() }, servedInput(ctx, "lot32-a3-served"))
  const afterState = await state(ctx)
  assert.equal(afterState.item.status, "served")
  assert.equal(afterState.parent.orderStatus, "served")
  assert.equal((await ctx.root.collection("stockBalancesV2").doc(ctx.articleId).get()).data().quantity, 19)
  assert.deepEqual(
    [afterState.operations, afterState.progress, afterState.stockProofs, afterState.auditDocs.length, afterState.proofs],
    [1, 1, 1, 1, 1],
  )
})

test("A4 la dernière ligne servie fait passer le parent à served", { skip: !enabled }, async () => {
  const secondId = `item-a4-second-${Date.now()}`
  const ctx = await seed("A4", {
    rows: [
      row(`item-a4-first-${Date.now()}`, { status: "served", servedQuantity: 1, preparationMode: "direct" }),
      row(secondId, { status: "ready", preparationMode: "direct" }),
    ],
    orderStatus: "ready",
  })
  ctx.itemId = secondId
  await markOrderItemServed({ store: store() }, servedInput(ctx, "lot32-a4-last-served"))
  assert.equal((await state(ctx)).parent.orderStatus, "served")
})

test("A5 paiement d'une commande servie fait passer le parent à completed", { skip: !enabled }, async () => {
  const ctx = await seed("A5", {
    item: { status: "served", servedQuantity: 1 },
    orderStatus: "served",
    cashSession: true,
  })
  await confirmOrderPayment({ store: store() }, paymentInput(ctx, "lot32-a5-payment"))
  const afterState = await state(ctx)
  assert.equal(afterState.parent.paymentStatus, "paid")
  assert.equal(afterState.parent.orderStatus, "completed")
  assert.equal(afterState.payments, 1)
})

test("B1 deux POS servant la même ligne ne produisent qu'une mutation Stock", { skip: !enabled }, async () => {
  const ctx = await seed("B1", {
    item: { status: "ready", preparationMode: "direct" },
    orderStatus: "ready",
    stock: true,
  })
  const input = servedInput(ctx, "lot32-b1-same-intent")
  const results = await Promise.all([
    markOrderItemServed({ store: store() }, input),
    markOrderItemServed({ store: store() }, input),
  ])
  const afterState = await state(ctx)
  assert.equal(results.filter((entry) => entry.replayed).length, 1)
  assert.deepEqual(
    [afterState.operations, afterState.progress, afterState.stockProofs, afterState.auditDocs.length, afterState.proofs],
    [1, 1, 1, 1, 1],
  )
})

test("B2 deux cuisines passant ready simultanément n'appliquent qu'une mutation", { skip: !enabled }, async () => {
  const ctx = await seed("B2")
  const results = await Promise.allSettled([
    markOrderItemReady({ store: store() }, readyInput(ctx, "lot32-b2-ready-one")),
    markOrderItemReady({ store: store() }, readyInput(ctx, "lot32-b2-ready-two")),
  ])
  assert.equal(results.filter((entry) => entry.status === "fulfilled").length, 1)
  const afterState = await state(ctx)
  assert.equal(afterState.item.status, "ready")
  assert.equal(afterState.auditDocs.length, 1)
})

test("B3 ready Cuisine et paiement concurrent convergent vers ready et paid", { skip: !enabled }, async () => {
  const ctx = await seed("B3", { cashSession: true })
  await Promise.all([
    markOrderItemReady({ store: store() }, readyInput(ctx, "lot32-b3-ready")),
    confirmOrderPayment({ store: store() }, paymentInput(ctx, "lot32-b3-payment")),
  ])
  const afterState = await state(ctx)
  assert.equal(afterState.item.status, "ready")
  assert.equal(afterState.parent.orderStatus, "ready")
  assert.equal(afterState.parent.paymentStatus, "paid")
  assert.equal(afterState.auditDocs.length, 2)
})

test("B4 même commande et même clé avec un payload différent produit IDEMPOTENCY_CONFLICT", { skip: !enabled }, async () => {
  const ctx = await seed("B4")
  const sharedKey = "lot32-b4-same-order-key"
  await markOrderItemPreparing({ store: store() }, preparingInput(ctx, sharedKey))
  const afterFirst = await snapshotTree(ctx)
  await assert.rejects(
    () => markOrderItemPreparing(
      { store: store() },
      preparingInput(ctx, sharedKey, { expectedVersion: 2 }),
    ),
    (error) => error.code === "IDEMPOTENCY_CONFLICT",
  )
  assert.deepEqual(await snapshotTree(ctx), afterFirst)
  const afterState = await state(ctx)
  assert.equal(afterState.item.status, "preparing")
  assert.equal(afterState.parent.orderStatus, "preparing")
  assert.equal(afterState.parent.aggregateVersion, 2)
  assert.equal(afterState.auditDocs.length, 1)
  assert.equal(afterState.proofs, 1)
  assert.equal(afterState.operations, 0)
})

test("B4b deux commandes différentes peuvent réutiliser la même clé indépendamment", { skip: !enabled }, async () => {
  const first = await seed("B4b")
  const secondOrderId = `order-b4b-second-${Date.now()}`
  const secondItemId = `item-b4b-second-${Date.now()}`
  const secondOrderRef = first.root.collection("orders").doc(secondOrderId)
  await secondOrderRef.set({
    restaurantId: first.restaurantId,
    paymentStatus: "unpaid",
    paymentVersion: 1,
    totalAmount: 1500,
    total: 1500,
    orderStatus: "pending",
    kitchenStatus: "pending",
    aggregateVersion: 1,
    canonicalItemCount: 1,
    items: [{ id: secondItemId, orderItemId: secondItemId, status: "pending" }],
  })
  await secondOrderRef.collection("orderItems").doc(secondItemId).set({
    ...row(secondItemId),
    orderId: secondOrderId,
    restaurantId: first.restaurantId,
  })
  const second = {
    ...first,
    orderId: secondOrderId,
    itemId: secondItemId,
    orderRef: secondOrderRef,
  }
  const sharedKey = "lot32-b4b-cross-order-key"
  const [firstResult, secondResult] = await Promise.all([
    markOrderItemPreparing({ store: store() }, preparingInput(first, sharedKey)),
    markOrderItemPreparing({ store: store() }, preparingInput(second, sharedKey)),
  ])
  assert.equal(firstResult.replayed, false)
  assert.equal(secondResult.replayed, false)
  assert.equal((await state(first)).item.status, "preparing")
  assert.equal((await state(second)).item.status, "preparing")
  assert.equal((await first.orderRef.collection("commandAudit").get()).size, 1)
  assert.equal((await second.orderRef.collection("commandAudit").get()).size, 1)
  assert.equal((await first.root.collection("orderCommandIdempotency").get()).size, 2)
})

test("B5 deux commandes de versions successives convergent avec aggregateVersion cohérent", { skip: !enabled }, async () => {
  const ctx = await seed("B5")
  const first = markOrderItemPreparing({ store: store() }, preparingInput(ctx, "lot32-b5-preparing"))
  const second = markOrderItemReady({ store: store() }, readyInput(ctx, "lot32-b5-ready", { expectedVersion: 2 }))
  const results = await Promise.allSettled([first, second])
  assert.equal(results.filter((entry) => entry.status === "fulfilled").length, 1)
  const afterState = await state(ctx)
  assert.equal(afterState.item.status, "preparing")
  assert.equal(afterState.parent.aggregateVersion, 2)
})

test("C1 une erreur Stock annule exactement toutes les écritures", { skip: !enabled }, async () => {
  const ctx = await seed("C1", {
    item: { status: "ready", preparationMode: "direct" },
    orderStatus: "ready",
    stock: true,
    missingBalance: true,
  })
  const beforeState = await snapshotTree(ctx)
  await assert.rejects(
    () => markOrderItemServed({ store: store() }, servedInput(ctx, "lot32-c1-stock")),
    (error) => error.code === "STOCK_DEDUCTION_FAILED",
  )
  assert.deepEqual(await snapshotTree(ctx), beforeState)
})

test("C2 un conflit de création Audit annule exactement toutes les écritures", { skip: !enabled }, async () => {
  const ctx = await seed("C2")
  const input = preparingInput(ctx, "lot32-c2-audit")
  const commandId = commandProofId({
    restaurantId: ctx.restaurantId,
    actorId: input.actor.id,
    commandName: "MarkOrderItemPreparing",
    orderId: ctx.orderId,
    orderItemId: ctx.itemId,
    idempotencyKey: input.idempotencyKey,
  })
  await ctx.orderRef.collection("commandAudit").doc(commandId).set({ sentinel: true })
  const beforeState = await snapshotTree(ctx)
  await assert.rejects(() => markOrderItemPreparing({ store: store() }, input))
  assert.deepEqual(await snapshotTree(ctx), beforeState)
})

test("C3 une projection parent incohérente annule exactement toutes les écritures", { skip: !enabled }, async () => {
  const ctx = await seed("C3", { canonicalItemCount: 2 })
  const beforeState = await snapshotTree(ctx)
  await assert.rejects(
    () => markOrderItemPreparing({ store: store() }, preparingInput(ctx, "lot32-c3-projection")),
    (error) => error.code === "LEGACY_ORDER_READ_ONLY",
  )
  assert.deepEqual(await snapshotTree(ctx), beforeState)
})

test("C4 un conflit immuable détecté au commit provoque un rollback total", { skip: !enabled }, async () => {
  const ctx = await seed("C4", {
    item: { status: "ready", preparationMode: "direct" },
    orderStatus: "ready",
    stock: true,
  })
  const operationId = ["served", ctx.orderId, ctx.itemId, ctx.articleId, 1].join("--")
  await ctx.root.collection("stockOperationsV2").doc(operationId).set({ sentinel: true })
  const beforeState = await snapshotTree(ctx)
  await assert.rejects(() =>
    markOrderItemServed({ store: store() }, servedInput(ctx, "lot32-c4-before-commit"))
  )
  assert.deepEqual(await snapshotTree(ctx), beforeState)
})

test("C5 une preuve d'idempotence corrompue bloque sans aucune écriture", { skip: !enabled }, async () => {
  const ctx = await seed("C5")
  const input = preparingInput(ctx, "lot32-c5-corrupted-proof")
  const commandId = commandProofId({
    restaurantId: ctx.restaurantId,
    actorId: input.actor.id,
    commandName: "MarkOrderItemPreparing",
    orderId: ctx.orderId,
    orderItemId: ctx.itemId,
    idempotencyKey: input.idempotencyKey,
  })
  await ctx.root.collection("orderCommandIdempotency").doc(commandId).set({ requestHash: "invalid" })
  const beforeState = await snapshotTree(ctx)
  await assert.rejects(
    () => markOrderItemPreparing({ store: store() }, input),
    (error) => error.code === "IDEMPOTENCY_CONFLICT",
  )
  assert.deepEqual(await snapshotTree(ctx), beforeState)
})

test("D1 une commande uniquement items legacy est refusée", { skip: !enabled }, async () => {
  const ctx = await seed("D1", { legacyOnly: true })
  const beforeState = await snapshotTree(ctx)
  await assert.rejects(
    () => markOrderItemPreparing({ store: store() }, preparingInput(ctx, "lot32-d1-legacy-only")),
    (error) => error.code === "ORDER_ITEM_NOT_FOUND",
  )
  assert.deepEqual(await snapshotTree(ctx), beforeState)
})

test("D2 une sous-collection orderItems incomplète est refusée", { skip: !enabled }, async () => {
  const ctx = await seed("D2", { canonicalItemCount: 2 })
  await assert.rejects(
    () => markOrderItemPreparing({ store: store() }, preparingInput(ctx, "lot32-d2-partial")),
    (error) => error.code === "LEGACY_ORDER_READ_ONLY",
  )
})

test("D3 items legacy absent autorise la mutation canonique sans le recréer", { skip: !enabled }, async () => {
  const ctx = await seed("D3", { embedded: null })
  await markOrderItemPreparing({ store: store() }, preparingInput(ctx, "lot32-d3-absent"))
  const parent = (await ctx.orderRef.get()).data()
  assert.equal(parent.orderStatus, "preparing")
  assert.equal(Object.hasOwn(parent, "items"), false)
})

test("D4 items legacy ambigu est ignoré et audité sans bloquer", { skip: !enabled }, async () => {
  const ctx = await seed("D4", { embedded: [{ id: "unknown" }] })
  await markOrderItemPreparing({ store: store() }, preparingInput(ctx, "lot32-d4-ambiguous"))
  const afterState = await state(ctx)
  assert.equal(afterState.item.status, "preparing")
  assert.deepEqual(afterState.parent.items, [{ id: "unknown" }])
  assert.deepEqual(
    afterState.auditDocs[0].data().aggregate.warnings,
    ["LEGACY_ITEMS_PROJECTION_IGNORED"],
  )
})

test("D5 une projection legacy bijective est mise à jour", { skip: !enabled }, async () => {
  const ctx = await seed("D5")
  await markOrderItemPreparing({ store: store() }, preparingInput(ctx, "lot32-d5-bijective"))
  const parent = (await ctx.orderRef.get()).data()
  assert.equal(parent.items[0].status, "preparing")
  assert.equal(parent.items[0].version, 2)
})

test("E1 aggregateVersion reste inchangé quand la projection métier est identique", { skip: !enabled }, async () => {
  const summary = {
    schemaVersion: 1,
    activeItemCount: 1,
    pendingItemCount: 0,
    preparingItemCount: 0,
    readyItemCount: 1,
    servedItemCount: 0,
    cancelledItemCount: 0,
    allActiveItemsServed: false,
    hasKitchenItems: true,
    hasBarItems: false,
    hasDirectItems: false,
  }
  const ctx = await seed("E1", {
    item: { status: "ready" },
    orderStatus: "ready",
    orderAggregate: summary,
    embedded: null,
    cashSession: true,
  })
  await confirmOrderPayment({ store: store() }, paymentInput(ctx, "lot32-e1-no-projection"))
  assert.equal((await ctx.orderRef.get()).data().aggregateVersion, 1)
})

test("E2 aucune projection d'agrégat n'est auditée lorsque le parent est identique", { skip: !enabled }, async () => {
  const summary = {
    schemaVersion: 1, activeItemCount: 1, pendingItemCount: 0,
    preparingItemCount: 0, readyItemCount: 1, servedItemCount: 0,
    cancelledItemCount: 0, allActiveItemsServed: false, hasKitchenItems: true,
    hasBarItems: false, hasDirectItems: false,
  }
  const ctx = await seed("E2", {
    item: { status: "ready" }, orderStatus: "ready", orderAggregate: summary,
    embedded: null, cashSession: true,
  })
  await confirmOrderPayment({ store: store() }, paymentInput(ctx, "lot32-e2-audit"))
  const audit = (await state(ctx)).auditDocs[0].data()
  assert.deepEqual(audit.aggregate, { changed: false })
})

test("E3 rejouer la même idempotence ne crée aucun doublon", { skip: !enabled }, async () => {
  const ctx = await seed("E3")
  const input = preparingInput(ctx, "lot32-e3-replay")
  await markOrderItemPreparing({ store: store() }, input)
  await markOrderItemPreparing({ store: store() }, input)
  const afterState = await state(ctx)
  assert.equal(afterState.auditDocs.length, 1)
  assert.equal(afterState.proofs, 1)
})

test("E4 rejouer la même commande restitue le même résultat métier", { skip: !enabled }, async () => {
  const ctx = await seed("E4")
  const input = preparingInput(ctx, "lot32-e4-same-result")
  const first = await markOrderItemPreparing({ store: store() }, input)
  const replay = await markOrderItemPreparing({ store: store() }, input)
  assert.deepEqual(
    { ...replay, replayed: false },
    first,
  )
  assert.equal(replay.replayed, true)
})

test("E5 updatedAt et aggregateUpdatedAt sont cohérents dans le même commit", { skip: !enabled }, async () => {
  const ctx = await seed("E5")
  await markOrderItemPreparing({ store: store() }, preparingInput(ctx, "lot32-e5-timestamps"))
  const parent = (await ctx.orderRef.get()).data()
  assert.equal(parent.updatedAt.toMillis(), parent.aggregateUpdatedAt.toMillis())
})
