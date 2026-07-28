export const LEGACY_RESTAURANT_A = "restaurant-a"
export const LEGACY_RESTAURANT_B = "restaurant-b"

export function buildLegacyInventoryItem(
  overrides: Record<string, unknown> = {}
) {
  return {
    id: "item-chicken",
    name: "Poulet",
    unit: "pièce",
    stockEstimated: 10,
    lastCountedStock: 10,
    lastManualStock: 10,
    costPerUnit: 2500,
    minThreshold: 5,
    lossRate: 0,
    trackingMode: "auto",
    avgDailyConsumption: 0,
    ...overrides,
  }
}

export function buildLegacyProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: "product-chicken",
    name: "Poulet grillé",
    recipe: [{ inventoryItemId: "item-chicken", quantity: 0.5 }],
    ...overrides,
  }
}

export function buildLegacyOrderItem(overrides: Record<string, unknown> = {}) {
  return {
    productId: "product-chicken",
    productName: "Poulet grillé",
    quantity: 2,
    selectedOptions: [],
    ...overrides,
  }
}

export const LEGACY_STOCK_BASELINE = Object.freeze({
  initial: {
    [`${LEGACY_RESTAURANT_A}::item-chicken`]: 10,
    [`${LEGACY_RESTAURANT_B}::item-chicken`]: 7,
  },
  operations: [
    {
      operationId: "supply-a-1",
      restaurantId: LEGACY_RESTAURANT_A,
      itemId: "item-chicken",
      quantity: 5,
    },
    {
      operationId: "sale-a-1",
      restaurantId: LEGACY_RESTAURANT_A,
      itemId: "item-chicken",
      quantity: -1,
    },
    {
      operationId: "adjustment-b-1",
      restaurantId: LEGACY_RESTAURANT_B,
      itemId: "item-chicken",
      quantity: -2,
    },
  ],
  observed: [
    {
      restaurantId: LEGACY_RESTAURANT_A,
      itemId: "item-chicken",
      quantity: 14,
    },
    {
      restaurantId: LEGACY_RESTAURANT_B,
      itemId: "item-chicken",
      quantity: 5,
    },
  ],
})
