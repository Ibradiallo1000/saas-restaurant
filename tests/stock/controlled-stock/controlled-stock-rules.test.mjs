import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const rules = readFileSync(new URL("../../../firestore.rules", import.meta.url), "utf8")

test("règles Lot 3 : les quatre espaces V2 sont explicitement protégés", () => {
  for (const collection of [
    "stockBalancesV2",
    "stockOperationsV2",
    "stockIdempotencyV2",
    "stockOperationCostsV2",
  ]) {
    assert.match(rules, new RegExp(`match /${collection}/`))
  }
})

test("règles Lot 3 : une opération validée est immuable", () => {
  const block = rules.match(/match \/stockOperationsV2[\s\S]*?match \/stockIdempotencyV2/)?.[0] ?? ""
  assert.match(block, /allow update, delete: if false/)
  assert.match(block, /quantityAfter\s*>= 0/)
})

test("règles : un contrôle physique exige un article CONTROLLED", () => {
  const block = rules.match(/match \/stockOperationsV2[\s\S]*?match \/stockIdempotencyV2/)?.[0] ?? ""
  assert.match(block, /type != "CONTROLE_PHYSIQUE"/)
  assert.match(block, /trackingMode == "CONTROLLED"/)
})

test("règles Lot 3 : solde négatif et article NONE sont refusés", () => {
  const block = rules.match(/match \/stockBalancesV2[\s\S]*?match \/stockOperationsV2/)?.[0] ?? ""
  assert.match(block, /quantity\s*>= 0/)
  assert.match(block, /trackingMode in \["CONTROLLED", "AUTOMATIC_SIMPLE"\]/)
})

test("règles Lot 3 : les coûts sont dans un espace séparé", () => {
  const operationBlock = rules.match(/match \/stockOperationsV2[\s\S]*?match \/stockIdempotencyV2/)?.[0] ?? ""
  assert.doesNotMatch(operationBlock, /totalCost|unitCost/)
  assert.match(rules, /match \/stockOperationCostsV2/)
})
