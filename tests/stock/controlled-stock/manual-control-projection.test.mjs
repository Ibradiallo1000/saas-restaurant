import assert from "node:assert/strict"
import test from "node:test"

import {
  buildManualControlProjection,
  calculateObservedStockGap,
} from "../../../src/modules/stock/controlled-stock/application/manual-control-projection.ts"

const balance = {
  restaurantId: "restaurant-a",
  articleId: "oil",
  quantity: 23,
  unit: "l",
  version: 4,
  lastOperationAt: "2026-07-28T16:00:00.000Z",
}

const operation = (overrides = {}) => ({
  id: "operation",
  restaurantId: "restaurant-a",
  articleId: "oil",
  type: "APPROVISIONNEMENT",
  quantityBefore: 20,
  variation: 5,
  quantityAfter: 25,
  unit: "l",
  occurredAt: "2026-07-28T10:00:00.000Z",
  createdAt: "2026-07-28T10:00:00.000Z",
  createdBy: "manager",
  idempotencyKey: "key",
  ...overrides,
})

test("calcule un écart positif, nul et un surplus", () => {
  assert.equal(calculateObservedStockGap(25, 17), 8)
  assert.equal(calculateObservedStockGap(25, 25), 0)
  assert.equal(calculateObservedStockGap(25, 27), -2)
})

test("sépare les approvisionnements et les autres mouvements depuis le dernier contrôle", () => {
  const operations = [
    operation({
      id: "control",
      type: "CONTROLE_PHYSIQUE",
      quantityBefore: 18,
      variation: 2,
      quantityAfter: 20,
      occurredAt: "2026-07-27T20:00:00.000Z",
    }),
    operation({ id: "supply", variation: 5, quantityBefore: 20, quantityAfter: 25 }),
    operation({
      id: "loss",
      type: "PERTE",
      variation: -2,
      quantityBefore: 25,
      quantityAfter: 23,
      occurredAt: "2026-07-28T16:00:00.000Z",
    }),
  ]
  const projection = buildManualControlProjection({
    balance,
    operations,
    now: "2026-07-28T18:00:00.000Z",
  })
  assert.equal(projection.stockAtLastControl, 20)
  assert.equal(projection.suppliesSinceLastControl, 5)
  assert.equal(projection.otherMovementsVariation, -2)
  assert.deepEqual(
    projection.otherMovementsSinceLastControl.map(({ id }) => id),
    ["loss"]
  )
  assert.equal(projection.theoreticalQuantity, 23)
  assert.equal(projection.controlledToday, false)
})

test("reconstruit le stock de départ en l’absence de contrôle antérieur", () => {
  const projection = buildManualControlProjection({
    balance: { ...balance, quantity: 25 },
    operations: [operation({ id: "supply" })],
    now: "2026-07-28T18:00:00.000Z",
  })
  assert.equal(projection.lastControl, null)
  assert.equal(projection.stockAtLastControl, 20)
  assert.equal(projection.suppliesSinceLastControl, 5)
})
