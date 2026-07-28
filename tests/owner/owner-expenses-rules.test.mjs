import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"

const rules = fs.readFileSync(
  path.join(process.cwd(), "firestore.rules"),
  "utf8"
)

test("les écritures Dépenses exigent explicitement le rôle manager", () => {
  const writer =
    rules.match(
      /function canWriteRestaurantExpenseDocs[\s\S]*?\n    \}/
    )?.[0] || ""
  assert.match(writer, /userDoc\(\)\.data\.role == "manager"/)
  assert.match(writer, /\.data\.role == "manager"/)
  assert.doesNotMatch(writer, /\["manager", "owner"\]/)
})

test("expenses, suppliers, supplierPayments et expenseLogs utilisent le writer strict", () => {
  for (const [name, next] of [
    ["suppliers", "expenses"],
    ["expenses", "expenseLogs"],
    ["expenseLogs", "supplierPayments"],
    ["supplierPayments", "inventoryAlerts"],
  ]) {
    const block =
      rules.match(
        new RegExp(
          `match \\/${name}\\/\\{[^}]+\\}[\\s\\S]*?match \\/${next}`
        )
      )?.[0] || ""
    assert.match(block, /canWriteRestaurantExpenseDocs/)
    assert.match(block, /allow get, list: if canReadRestaurantBusinessDocs/)
  }
})

test("le workflow Owner validated trop large est désactivé", () => {
  const block =
    rules.match(/match \/expenses[\s\S]*?match \/expenseLogs/)?.[0] || ""
  assert.match(block, /allow update: if false/)
  assert.doesNotMatch(block, /isRestaurantOwner[\s\S]*validated is bool/)
  assert.match(block, /allow delete: if false/)
})

test("le mouvement atomique d'un paiement fournisseur reste autorisé au Manager", () => {
  const block =
    rules.match(/match \/cashMovements[\s\S]*?match \/cashSessionRequests/)?.[0] ||
    ""
  assert.match(block, /"supplier_payment"/)
  assert.match(block, /canWriteRestaurantBusinessDocs/)
})
