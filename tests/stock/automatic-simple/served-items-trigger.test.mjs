import assert from "node:assert/strict"
import test from "node:test"

import {
  getNewlyServedLines,
} from "../../../functions/src/stock-automatic-simple.ts"

function order(items, overrides = {}) {
  return { items, ...overrides }
}

function line(overrides = {}) {
  return {
    id: "line-coca",
    productId: "product-coca",
    quantity: 2,
    status: "pending",
    preparationMode: "direct",
    ...overrides,
  }
}

test("deux Coca Cola nouvellement servis produisent un delta de 2", () => {
  const result = getNewlyServedLines(
    order([line()]),
    order([line({ status: "served" })])
  )
  assert.deepEqual(result, [{
    orderItemId: "line-coca",
    productId: "product-coca",
    servedDelta: 2,
    servedQuantity: 2,
  }])
})

test("commande payée mais ligne non servie : aucun delta", () => {
  assert.deepEqual(
    getNewlyServedLines(
      order([line()], { paymentStatus: "unpaid" }),
      order([line()], { paymentStatus: "paid" })
    ),
    []
  )
})

test("rejeu du même état servi : aucun nouveau delta", () => {
  assert.deepEqual(
    getNewlyServedLines(
      order([line({ status: "served" })]),
      order([line({ status: "served" })])
    ),
    []
  )
})

test("service partiel : seule la nouvelle quantité servie est émise", () => {
  const result = getNewlyServedLines(
    order([line({ quantity: 3, servedQuantity: 1 })]),
    order([line({ quantity: 3, servedQuantity: 2 })])
  )
  assert.equal(result[0].servedDelta, 1)
  assert.equal(result[0].servedQuantity, 2)
})

test("changement de paiement après service : aucun nouveau delta", () => {
  assert.deepEqual(
    getNewlyServedLines(
      order([line({ status: "served" })], { paymentStatus: "unpaid" }),
      order([line({ status: "served" })], { paymentStatus: "paid" })
    ),
    []
  )
})

for (const preparationMode of ["direct", "kitchen", "bar"]) {
  test(`le mode ${preparationMode} n'est pas filtré`, () => {
    const result = getNewlyServedLines(
      order([line({ preparationMode })]),
      order([line({ preparationMode, status: "served" })])
    )
    assert.equal(result[0].servedDelta, 2)
  })
}

for (const context of [
  { source: "pos", orderType: "dine_in" },
  { source: "qr_table", orderType: "dine_in" },
  { source: "public", orderType: "pickup" },
  { source: "public", orderType: "delivery" },
]) {
  test(`le canal ${context.source}/${context.orderType} utilise le même signal`, () => {
    const result = getNewlyServedLines(
      order([line()], context),
      order([line({ status: context.orderType === "delivery" ? "delivered" : "served" })], context)
    )
    assert.equal(result[0].servedDelta, 2)
  })
}

test("annulation avant service : aucun delta", () => {
  assert.deepEqual(
    getNewlyServedLines(
      order([line()], { kitchenStatus: "pending" }),
      order([line()], { kitchenStatus: "cancelled" })
    ),
    []
  )
})
