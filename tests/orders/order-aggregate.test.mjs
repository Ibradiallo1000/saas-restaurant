import assert from "node:assert/strict"
import test from "node:test"
import { computeOrderAggregate } from "../../src/server/orders/aggregate/compute.ts"

const parent = (overrides = {}) => ({
  orderStatus: "pending", kitchenStatus: "pending", paymentStatus: "unpaid",
  aggregateVersion: 1, orderAggregate: null, embeddedItems: null, ...overrides,
  canonicalItemCount: overrides.canonicalItemCount ?? 1,
})
const item = (overrides = {}) => ({
  id: "line", orderId: "order", restaurantId: "restaurant", productId: "product",
  preparationMode: "kitchen", status: "pending", quantity: 1,
  servedQuantity: 0, cancelledQuantity: 0, version: 1, ...overrides,
})
const status = (items, paymentStatus = "unpaid") =>
  computeOrderAggregate({ parent: parent({ paymentStatus, canonicalItemCount: items.length }), items }).orderStatus

test("priorité déterministe des états", () => {
  assert.equal(status([item()]), "pending")
  assert.equal(status([item(), item({ id: "b", status: "preparing" })]), "preparing")
  assert.equal(status([item({ status: "ready" }), item({ id: "b", status: "ready" })]), "ready")
  assert.equal(status([item({ status: "ready", quantity: 2, servedQuantity: 1 })]), "ready")
  assert.equal(status([item({ status: "served", servedQuantity: 1 })]), "served")
  assert.equal(status([item({ status: "served", servedQuantity: 1 })], "paid"), "completed")
  assert.equal(status([item({ status: "ready" })], "paid"), "ready")
  assert.equal(status([item({ status: "cancelled", cancelledQuantity: 1 })]), "cancelled")
  assert.equal(status([
    item({ status: "cancelled", cancelledQuantity: 1 }),
    item({ id: "b", status: "served", servedQuantity: 1 }),
  ]), "served")
})

test("commande mixte, annulation partielle et stabilité", () => {
  const items = [
    item({ id: "pizza", preparationMode: "kitchen", status: "ready" }),
    item({ id: "coca", preparationMode: "bar", status: "ready", quantity: 2, servedQuantity: 1 }),
    item({ id: "eau", preparationMode: "direct", status: "served", servedQuantity: 1 }),
  ]
  const first = computeOrderAggregate({ parent: parent({ canonicalItemCount: items.length }), items })
  const second = computeOrderAggregate({
    parent: parent({
      orderStatus: first.orderStatus,
      kitchenStatus: first.kitchenStatus,
      orderAggregate: first.orderAggregate,
      canonicalItemCount: items.length,
    }),
    items,
  })
  assert.equal(first.orderStatus, "ready")
  assert.equal(first.orderAggregate.hasKitchenItems, true)
  assert.equal(first.orderAggregate.hasBarItems, true)
  assert.equal(first.orderAggregate.hasDirectItems, true)
  assert.equal(second.projectionChanged, false)
  assert.equal(status([item({ status: "served", quantity: 3, servedQuantity: 2, cancelledQuantity: 1 })]), "served")
})

test("refuse lignes absentes, quantités et états incohérents", () => {
  assert.throws(() => status([]), (error) => error.code === "NO_CANONICAL_ORDER_ITEMS")
  assert.throws(
    () => status([item({ servedQuantity: 2 })]),
    (error) => error.code === "INCONSISTENT_QUANTITIES"
  )
  assert.throws(
    () => status([item({ status: "served", servedQuantity: 0 })]),
    (error) => error.code === "INVALID_ITEM_STATE"
  )
})

test("projette items[] seulement avec une bijection certaine", () => {
  const canonical = item({ status: "ready" })
  const result = computeOrderAggregate({
    parent: parent({ embeddedItems: [{ id: "line", name: "Produit" }], canonicalItemCount: 1 }),
    items: [canonical],
  })
  assert.equal(result.projectedItems[0].status, "ready")
  assert.equal(result.projectedItems[0].name, "Produit")
  const ignored = computeOrderAggregate({
    parent: parent({ embeddedItems: [{ id: "inconnu" }], canonicalItemCount: 1 }),
    items: [canonical],
  })
  assert.equal(ignored.legacyProjection, "IGNORED")
  assert.deepEqual(ignored.warnings, ["LEGACY_ITEMS_PROJECTION_IGNORED"])
})

test("une ligne pending produit une commande pending", () => {
  assert.equal(status([item()]), "pending")
})

test("une ligne preparing a priorité sur pending", () => {
  assert.equal(status([item(), item({ id: "b", status: "preparing" })]), "preparing")
})

test("toutes les lignes ready produisent ready", () => {
  assert.equal(status([item({ status: "ready" }), item({ id: "b", status: "ready" })]), "ready")
})

test("une ligne partiellement servie reste ready", () => {
  assert.equal(status([item({ status: "ready", quantity: 3, servedQuantity: 1 })]), "ready")
})

test("toutes les lignes servies et non payées produisent served", () => {
  assert.equal(status([item({ status: "served", servedQuantity: 1 })]), "served")
})

test("toutes les lignes servies et payées produisent completed", () => {
  assert.equal(status([item({ status: "served", servedQuantity: 1 })], "paid"), "completed")
})

test("le paiement anticipé ne fait pas passer une ligne ready à completed", () => {
  assert.equal(status([item({ status: "ready" })], "paid"), "ready")
})

test("toutes les lignes totalement annulées produisent cancelled", () => {
  assert.equal(status([item({ status: "cancelled", cancelledQuantity: 1 })]), "cancelled")
})

test("une ligne annulée n'empêche pas les autres lignes servies", () => {
  assert.equal(status([
    item({ status: "cancelled", cancelledQuantity: 1 }),
    item({ id: "b", status: "served", servedQuantity: 1 }),
  ]), "served")
})

test("une annulation partielle peut solder la quantité active", () => {
  assert.equal(status([
    item({ status: "served", quantity: 3, servedQuantity: 2, cancelledQuantity: 1 }),
  ]), "served")
})

test("les modes de préparation alimentent le résumé", () => {
  const items = [
    item({ id: "k", preparationMode: "kitchen" }),
    item({ id: "b", preparationMode: "bar" }),
    item({ id: "d", preparationMode: "direct" }),
  ]
  const result = computeOrderAggregate({
    parent: parent({ canonicalItemCount: items.length }),
    items,
  })
  assert.equal(result.orderAggregate.hasKitchenItems, true)
  assert.equal(result.orderAggregate.hasBarItems, true)
  assert.equal(result.orderAggregate.hasDirectItems, true)
})

test("un paiement inconnu est refusé", () => {
  assert.throws(
    () => status([item()], "mystery"),
    (error) => error.code === "PAYMENT_STATE_INCONSISTENT",
  )
})

test("une quantité décimale est refusée", () => {
  assert.throws(
    () => status([item({ quantity: 1.5 })]),
    (error) => error.code === "INCONSISTENT_QUANTITIES",
  )
})

test("une quantité annulée supérieure à la quantité est refusée", () => {
  assert.throws(
    () => status([item({ cancelledQuantity: 2 })]),
    (error) => error.code === "INCONSISTENT_QUANTITIES",
  )
})

test("une sous-collection canonique partielle est refusée", () => {
  assert.throws(
    () => computeOrderAggregate({
      parent: parent({ canonicalItemCount: 2 }),
      items: [item()],
    }),
    (error) => error.code === "LEGACY_ORDER_READ_ONLY",
  )
})

test("l'absence de projection legacy ne crée pas items[]", () => {
  const result = computeOrderAggregate({
    parent: parent({ embeddedItems: null }),
    items: [item()],
  })
  assert.equal(result.legacyProjection, "ABSENT")
  assert.equal(result.projectedItems, null)
})

test("un doublon legacy ambigu est ignoré et audité", () => {
  const result = computeOrderAggregate({
    parent: parent({
      canonicalItemCount: 2,
      embeddedItems: [{ id: "line" }, { id: "line" }],
    }),
    items: [item(), item({ id: "b" })],
  })
  assert.equal(result.legacyProjection, "IGNORED")
  assert.deepEqual(result.warnings, ["LEGACY_ITEMS_PROJECTION_IGNORED"])
})

test("un recalcul identique est stable", () => {
  const first = computeOrderAggregate({ parent: parent(), items: [item()] })
  const second = computeOrderAggregate({
    parent: parent({
      orderStatus: first.orderStatus,
      kitchenStatus: first.kitchenStatus,
      orderAggregate: first.orderAggregate,
    }),
    items: [item()],
  })
  assert.equal(second.projectionChanged, false)
})
