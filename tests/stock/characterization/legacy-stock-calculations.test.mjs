import assert from "node:assert/strict"
import test from "node:test"

import {
  computeConsumption,
  computeEstimatedCost,
} from "../../../src/lib/product-components.ts"
import {
  compareLegacyStock,
  findDuplicateOperationIds,
  legacyStockKey,
  projectLegacyStock,
} from "../../../src/modules/stock/diagnostics/legacy-stock-comparison.ts"
import {
  LEGACY_RESTAURANT_A,
  LEGACY_RESTAURANT_B,
  LEGACY_STOCK_BASELINE,
  buildLegacyOrderItem,
  buildLegacyProduct,
} from "../fixtures/legacy-stock-fixtures.ts"

test("legacy recipe consumption aggregates order quantity outside the recipe calculator", () => {
  const product = buildLegacyProduct()
  const orderItem = buildLegacyOrderItem()
  const perProduct = computeConsumption(orderItem, product)

  assert.deepEqual(perProduct, [
    { inventoryItemId: "item-chicken", quantity: 0.5 },
  ])
  assert.equal(perProduct[0].quantity * orderItem.quantity, 1)
})

test("legacy recipes accept itemId, ingredientId and qty aliases", () => {
  const product = buildLegacyProduct({
    recipe: [
      { itemId: "item-rice", qty: 0.2 },
      { ingredientId: "item-oil", quantity: 0.03 },
      { quantity: 99 },
    ],
  })

  assert.deepEqual(computeConsumption(buildLegacyOrderItem(), product), [
    { inventoryItemId: "item-rice", quantity: 0.2 },
    { inventoryItemId: "item-oil", quantity: 0.03 },
  ])
})

test("legacy variants multiply base and selected addon consumption", () => {
  const product = buildLegacyProduct({
    components: [
      {
        id: "base",
        type: "base",
        recipe: [{ inventoryItemId: "item-flour", quantity: 0.2 }],
      },
      {
        id: "variant",
        type: "variant",
        options: [{ name: "Grande", multiplier: 1.5 }],
      },
      {
        id: "addon",
        type: "addon",
        options: [
          {
            name: "Fromage",
            recipe: [{ inventoryItemId: "item-cheese", quantity: 0.04 }],
          },
        ],
      },
    ],
  })
  const orderItem = buildLegacyOrderItem({
    variant: { name: "Grande" },
    addons: [{ name: "Fromage" }],
  })

  assert.deepEqual(computeConsumption(orderItem, product), [
    { inventoryItemId: "item-flour", quantity: 0.30000000000000004 },
    { inventoryItemId: "item-cheese", quantity: 0.06 },
  ])
})

test("legacy displayed recipe cost treats missing and invalid costs as zero", () => {
  const product = buildLegacyProduct({
    recipe: [
      { inventoryItemId: "known", quantity: 2 },
      { inventoryItemId: "missing", quantity: 4 },
    ],
  })

  assert.equal(
    computeEstimatedCost(product, [{ id: "known", costPerUnit: 300 }]),
    600
  )
})

test("reference baseline reproduces additions, outputs and negative adjustments", () => {
  const projected = projectLegacyStock(
    LEGACY_STOCK_BASELINE.initial,
    LEGACY_STOCK_BASELINE.operations
  )

  assert.deepEqual(projected, {
    [legacyStockKey(LEGACY_RESTAURANT_A, "item-chicken")]: 14,
    [legacyStockKey(LEGACY_RESTAURANT_B, "item-chicken")]: 5,
  })
  assert.equal(
    compareLegacyStock(LEGACY_STOCK_BASELINE).matches,
    true
  )
})

test("comparison isolates restaurants sharing the same item identifier", () => {
  const projected = projectLegacyStock(
    {
      [legacyStockKey(LEGACY_RESTAURANT_A, "shared-item")]: 5,
      [legacyStockKey(LEGACY_RESTAURANT_B, "shared-item")]: 9,
    },
    [
      {
        operationId: "restaurant-a-only",
        restaurantId: LEGACY_RESTAURANT_A,
        itemId: "shared-item",
        quantity: -2,
      },
    ]
  )

  assert.equal(projected[legacyStockKey(LEGACY_RESTAURANT_A, "shared-item")], 3)
  assert.equal(projected[legacyStockKey(LEGACY_RESTAURANT_B, "shared-item")], 9)
})

test("comparison reports duplicate and unexplained operations without mutating data", () => {
  const operations = [
    {
      operationId: "same-operation",
      restaurantId: LEGACY_RESTAURANT_A,
      itemId: "item-chicken",
      quantity: -1,
    },
    {
      operationId: "same-operation",
      restaurantId: LEGACY_RESTAURANT_A,
      itemId: "item-chicken",
      quantity: -1,
    },
  ]
  const comparison = compareLegacyStock({
    initial: {},
    operations,
    observed: [
      {
        restaurantId: LEGACY_RESTAURANT_A,
        itemId: "unexplained",
        quantity: 3,
      },
    ],
  })

  assert.deepEqual(findDuplicateOperationIds(operations), ["same-operation"])
  assert.deepEqual(comparison.unexplainedObservedKeys, [
    `${LEGACY_RESTAURANT_A}::unexplained`,
  ])
  assert.equal(comparison.matches, false)
})
