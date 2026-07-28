import assert from "node:assert/strict"
import test from "node:test"

import {
  LEGACY_STOCK_OBSERVABILITY_ENABLED,
  buildLegacyStockObservation,
} from "../../../src/modules/stock/diagnostics/legacy-stock-observation.ts"

test("legacy observability is disabled by default", () => {
  assert.equal(LEGACY_STOCK_OBSERVABILITY_ENABLED, false)
})

test("observation contains only operational identifiers and quantities", () => {
  const observation = buildLegacyStockObservation({
    source: " InventoryService.addInventoryStock ",
    restaurantId: " restaurant-a ",
    itemId: " item-oil ",
    operationId: " operation-1 ",
    businessId: " expense-1 ",
    quantityBefore: 5,
    quantityAfter: 8,
    outcome: "observed",
  })

  assert.deepEqual(observation, {
    source: "InventoryService.addInventoryStock",
    restaurantId: "restaurant-a",
    itemId: "item-oil",
    operationId: "operation-1",
    businessId: "expense-1",
    quantityBefore: 5,
    quantityAfter: 8,
    difference: 3,
    outcome: "observed",
    errorCode: null,
  })
  assert.equal("customerName" in observation, false)
  assert.equal("email" in observation, false)
  assert.equal("phone" in observation, false)
  assert.equal("payload" in observation, false)
})

test("invalid or absent observed quantities remain unknown", () => {
  const observation = buildLegacyStockObservation({
    source: "legacy",
    restaurantId: "restaurant-a",
    itemId: "item-a",
    quantityBefore: Number.NaN,
    quantityAfter: null,
    outcome: "failed",
    errorCode: "legacy-write-failed",
  })

  assert.equal(observation.quantityBefore, null)
  assert.equal(observation.quantityAfter, null)
  assert.equal(observation.difference, null)
})
