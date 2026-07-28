import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const centralPath =
  "src/modules/stock/automatic-simple/infrastructure/mark-order-item-served.ts"

test("POS et Cuisine utilisent la transaction client centrale", async () => {
  const [pos, kitchen] = await Promise.all([
    readFile("src/app/(dashboard)/pos/components/POSClient.tsx", "utf8"),
    readFile("src/modules/kitchen/KitchenBoard.tsx", "utf8"),
  ])
  for (const source of [pos, kitchen]) {
    assert.match(source, /markOrderItemAsServedAndDeductStock/)
  }
})

test("la transaction centrale lie service, balance, opération, progression et idempotence", async () => {
  const source = await readFile(centralPath, "utf8")
  for (const contract of [
    "orders",
    "orderItems",
    "stockAutomaticAssociationsV2",
    "stockItemsV2",
    "stockBalancesV2",
    "stockOperationsV2",
    "stockServingProgressV2",
    "stockIdempotencyV2",
    "runTransaction",
  ]) {
    assert.match(source, new RegExp(contract))
  }
})

test("aucune Cloud Function de déduction automatique n’est exportée", async () => {
  const functionsIndex = await readFile("functions/src/index.ts", "utf8")
  assert.doesNotMatch(functionsIndex, /deductAutomaticSimpleStock/)
  assert.doesNotMatch(functionsIndex, /handleServedOrderItemsForAutomaticStock/)
})

test("les parcours publics créent la commande sans déduire au paiement", async () => {
  const sources = await Promise.all([
    readFile("src/modules/public/components/CheckoutQRModal.tsx", "utf8"),
    readFile("src/modules/public/components/CheckoutPublicModal.tsx", "utf8"),
  ])
  for (const source of sources) {
    assert.doesNotMatch(source, /stockBalancesV2/)
    assert.doesNotMatch(source, /AUTOMATIC_DEDUCTION/)
  }
})

test("une commande POS directe reste prête jusqu’à l’action explicite de service", async () => {
  const [orderService, pos] = await Promise.all([
    readFile("src/services/order.service.ts", "utf8"),
    readFile("src/app/(dashboard)/pos/components/POSClient.tsx", "utf8"),
  ])

  assert.match(
    orderService,
    /kitchenStatus:\s*requiresKitchen\s*\?\s*ORDER_OPERATION_STATUS\.PENDING\s*:\s*ORDER_OPERATION_STATUS\.READY/
  )
  assert.doesNotMatch(
    orderService,
    /kitchenStatus:\s*requiresKitchen\s*\?\s*ORDER_OPERATION_STATUS\.PENDING\s*:\s*ORDER_OPERATION_STATUS\.COMPLETED/
  )
  assert.match(pos, /\[DIRECT\]\[PAYMENT_CONFIRMED\][\s\S]*?stockEngineCalled:\s*false/)
})

test("l’action POS directe appelle le moteur central une fois avec la quantité complète", async () => {
  const pos = await readFile(
    "src/app/(dashboard)/pos/components/POSClient.tsx",
    "utf8"
  )
  const handlerStart = pos.indexOf("const markOrderItemServed")
  const handlerEnd = pos.indexOf("const releaseTableIfPaidAndServed", handlerStart)
  const handler = pos.slice(handlerStart, handlerEnd)

  assert.ok(handlerStart >= 0 && handlerEnd > handlerStart)
  assert.match(handler, /if\s*\(!selectedItem\s*\|\|\s*isServedOrderItem\(selectedItem\)\)\s*return/)
  assert.match(handler, /\[DIRECT\]\[SERVICE_ACTION\]/)
  assert.match(handler, /\[DIRECT\]\[STOCK_CALL\]/)
  assert.match(handler, /markOrderItemAsServedAndDeductStock\(\{/)
  assert.match(handler, /servedQuantity:\s*Number\(selectedItem\.quantity\s*\?\?\s*0\)/)
  assert.match(handler, /\[DIRECT\]\[STOCK_SUCCESS\]/)
  assert.match(handler, /\[DIRECT\]\[STOCK_ERROR\]/)
})

test("une commande mixte réserve le service POS aux lignes non cuisine", async () => {
  const pos = await readFile(
    "src/app/(dashboard)/pos/components/POSClient.tsx",
    "utf8"
  )

  assert.match(pos, /group\.mode\s*!==\s*"kitchen"/)
  assert.match(pos, /nextItems\.every\(isServedOrderItem\)/)
  assert.match(pos, /source:\s*"pos-direct-service"/)
})

test("OrderService crée chaque ligne avec son orderItemId comme documentId", async () => {
  const source = await readFile("src/services/order.service.ts", "utf8")
  const creationStart = source.indexOf("for (const item of mappedItems)")
  const creationEnd = source.indexOf("return orderRef.id", creationStart)
  const creation = source.slice(creationStart, creationEnd)

  assert.ok(creationStart >= 0 && creationEnd > creationStart)
  assert.match(creation, /const orderItemId = item\.orderItemId/)
  assert.match(creation, /id:\s*orderItemId/)
  assert.match(creation, /orderItemId,/)
  assert.match(creation, /servedQuantity:\s*0/)
  assert.match(
    creation,
    /setDoc\(\s*doc\(orderRef,\s*COLLECTION_NAMES\.ORDER_ITEMS,\s*orderItemId\)/
  )
  assert.doesNotMatch(creation, /addDoc\s*\(/)
})

test("le moteur refuse une ligne canonique absente sans la recréer", async () => {
  const source = await readFile(centralPath, "utf8")

  assert.match(source, /if\s*\(!orderItemSnapshot\.exists\(\)\)/)
  assert.match(source, /code:\s*"ORDER_ITEM_NOT_FOUND"/)
  assert.match(source, /const line = orderItemSnapshot\.data\(\)/)
  assert.doesNotMatch(source, /persistedItem\s*\?\?\s*embeddedItem/)
  assert.doesNotMatch(source, /transaction\.set\(input\.orderItemRef/)
  assert.doesNotMatch(source, /orderItemExists/)
})
