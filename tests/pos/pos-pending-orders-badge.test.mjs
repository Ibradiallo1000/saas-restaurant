import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const clientPath = "src/app/(dashboard)/pos/components/POSClient.tsx"
const headerPath = "src/app/(dashboard)/pos/components/POSHeader.tsx"

test("le badge Commandes compte la colonne En attente existante", async () => {
  const [client, header] = await Promise.all([
    readFile(clientPath, "utf8"),
    readFile(headerPath, "utf8"),
  ])

  assert.match(client, /pendingOrderCount = posOrders\[ORDER_OPERATION_STATUS\.PENDING\]\?\.length \?\? 0/)
  assert.match(client, /pendingOrderCount=\{pendingOrderCount\}/)
  assert.match(header, /pendingOrderCount > 0/)
  assert.match(header, /commande\$\{pendingOrderCount > 1 \? "s" : ""\} en attente/)
  assert.doesNotMatch(header, /readyOrderCount/)
})

test("le badge réutilise le flux POS sans listener Firestore dans le header", async () => {
  const header = await readFile(headerPath, "utf8")
  assert.doesNotMatch(header, /onSnapshot|useCollection|collection\(/)
})
