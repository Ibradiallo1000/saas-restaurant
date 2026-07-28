import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  LEGACY_STOCK_READ_PATHS,
  LEGACY_STOCK_WRITE_PATHS,
} from "../../../src/modules/stock/diagnostics/legacy-stock-path-registry.ts"

const inventorySource = readSource("src/services/inventory.service.ts")
const orderSource = readSource("src/services/order.service.ts")
const analyticsSource = readSource("src/services/analytics.service.ts")
const supplySource = readSource("src/services/supply-expense.service.ts")
const posSecuritySource = readSource("src/services/pos-security.service.ts")
const inventoryPageSource = readSource(
  "src/app/(manager)/manager/inventory/page.tsx"
)
const ownerPageSource = readSource("src/app/owner/page.tsx")
const ownerStockPageSource = readSource("src/app/owner/stock/page.tsx")
const rulesSource = readSource("firestore.rules")

test("registry identifiers are unique and every path has a declared authority", () => {
  assertUnique(
    LEGACY_STOCK_WRITE_PATHS.map((path) => path.id),
    "write paths"
  )
  assertUnique(
    LEGACY_STOCK_READ_PATHS.map((path) => path.id),
    "read paths"
  )
  assert.equal(
    LEGACY_STOCK_WRITE_PATHS.every(
      (path) => path.authority && path.collections.length > 0
    ),
    true
  )
})

test("article creation initializes all three legacy quantity snapshots", () => {
  assert.match(
    inventorySource,
    /async createInventoryItem[\s\S]*stockEstimated:[\s\S]*lastCountedStock:[\s\S]*lastManualStock:/
  )
})

test("legacy article modifications replace quantity or update configuration", () => {
  assert.match(
    inventorySource,
    /async adjustInventoryStock[\s\S]*stockEstimated: normalizeStockValue\(newValue\)/
  )
  assert.match(inventorySource, /async updateInventoryCost/)
  assert.match(inventorySource, /async updateInventoryMinThreshold/)
  assert.match(inventorySource, /async updateTrackingMode/)
})

test("legacy direct stock entry increments quantity but creates no movement", () => {
  const method = methodBody(
    inventorySource,
    "async addInventoryStock",
    "async adjustInventoryStock"
  )
  assert.match(method, /stockEstimated: increment\(amount\)/)
  assert.doesNotMatch(method, /INVENTORY_MOVEMENTS|transaction\.set/)
})

test("legacy physical verification records signed differences", () => {
  const method = methodBody(
    inventorySource,
    "async verifyInventoryStock",
    "async reconcileStock"
  )
  assert.match(method, /const difference = newStock - previousStock/)
  assert.match(method, /quantity: difference/)
  assert.match(method, /type: 'manual_adjustment'/)
})

test("supply entry writes one V2 operation and balance", () => {
  assert.match(supplySource, /const newStock = oldStock \+ snapshot\.input\.quantity/)
  assert.match(supplySource, /stockBalancesV2/)
  assert.match(supplySource, /stockOperationsV2/)
  assert.match(supplySource, /type: "APPROVISIONNEMENT"/)
  assert.doesNotMatch(supplySource, /stockEstimated/)
})

test("kitchen preparing no longer consumes recipe ingredients", () => {
  assert.doesNotMatch(orderSource, /handleOrderSentToKitchen/)
  assert.match(
    inventorySource,
    /async handleOrderSentToKitchen[\s\S]*inventoryProcessed/
  )
})

test("payment no longer decrements a second legacy stock authority", () => {
  assert.doesNotMatch(orderSource, /decrementStockForOrderItems/)
  assert.doesNotMatch(orderSource, /handleOrderSentToKitchen/)
})

test("payment consumption has payment-log replay protection but no active caller", () => {
  assert.match(
    inventorySource,
    /async handleOrderPaid[\s\S]*inventoryLogs[\s\S]*if \(logSnap\.exists\(\)\) return false/
  )
  assert.equal(
    countOccurrences(
      `${orderSource}\n${supplySource}\n${posSecuritySource}\n${inventoryPageSource}`,
      "handleOrderPaid("
    ),
    0
  )
})

test("cancellation and refund currently have no stock compensation", () => {
  const cancellationAndRefund = posSecuritySource.slice(
    posSecuritySource.indexOf("export async function refundOrderTransaction")
  )
  assert.match(cancellationAndRefund, /refundOrderTransaction/)
  assert.match(cancellationAndRefund, /cancelOrderTransaction/)
  assert.doesNotMatch(
    cancellationAndRefund,
    /inventoryItems|inventoryMovements|InventoryService/
  )
})

test("legacy loss or breakage has no dedicated behavior", () => {
  assert.doesNotMatch(
    `${inventorySource}\n${supplySource}\n${inventoryPageSource}`,
    /declareLoss|recordLoss|breakage|casse|perte/
  )
})

test("legacy inventory remains the transparent fallback while Owner supervision uses V2", () => {
  assert.match(inventoryPageSource, /InventoryService/)
  assert.match(inventoryPageSource, /router\.replace\("\/manager\/stock"\)/)
  assert.match(ownerPageSource, /inventoryItems/)
  assert.match(ownerStockPageSource, /useInventoryReferential/)
  const sharedReferential = readSource("src/modules/stock/shared/inventory-referential.ts")
  assert.match(sharedReferential, /stockItemsV2/)
  assert.match(sharedReferential, /stockBalancesV2/)
  assert.match(sharedReferential, /stockItemCostsV2/)
})

test("legacy manager dashboard still counts low stock from inventory.quantity", () => {
  assert.match(
    analyticsSource,
    /COLLECTION_NAMES\.INVENTORY[\s\S]*d\.data\(\)\.quantity <= d\.data\(\)\.threshold/
  )
})

test("legacy data access remains restaurant scoped", () => {
  for (const source of [inventorySource, supplySource]) {
    assert.match(
      source,
      /COLLECTION_NAMES\.RESTAURANTS,\s*restaurantId/
    )
  }
})

test("characterization exposes the manual movement/rules incompatibility", () => {
  assert.match(inventorySource, /type: 'manual_adjustment'/)
  assert.match(
    rulesSource,
    /request\.resource\.data\.type in \["supply", "adjustment", "sale"\]/
  )
  assert.doesNotMatch(
    rulesSource,
    /request\.resource\.data\.type in \[[^\]]*"manual_adjustment"/
  )
})

function readSource(relativePath) {
  return readFileSync(new URL(`../../../${relativePath}`, import.meta.url), "utf8")
}

function methodBody(source, start, end) {
  return source.slice(source.indexOf(start), source.indexOf(end))
}

function countOccurrences(source, value) {
  return source.split(value).length - 1
}

function assertUnique(values, label) {
  assert.equal(new Set(values).size, values.length, `${label} contains duplicates`)
}
