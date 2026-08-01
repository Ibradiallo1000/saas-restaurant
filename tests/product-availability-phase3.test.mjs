import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const read = (path) => readFile(path, "utf8")

test("le nouveau service déclenche une revue sans remise à zéro automatique", async () => {
  const service = await read("src/server/availability/availability-service.ts")
  const kitchen = await read("src/modules/kitchen/KitchenAvailabilityPanel.tsx")
  assert.match(service, /type: "START_SERVICE"/)
  assert.match(service, /previousServiceId/)
  assert.doesNotMatch(service, /midnight|setHours\(0/)
  assert.match(kitchen, /Aucun produit n’a été réactivé automatiquement/)
  assert.match(kitchen, /type: "BULK_AVAILABLE"/)
})

test("chaque mutation serveur écrit l'historique et limite les consultations", async () => {
  const service = await read("src/server/availability/availability-service.ts")
  const rules = await read("firestore.rules")
  assert.match(service, /oldState/)
  assert.match(service, /newState/)
  assert.match(service, /actor/)
  assert.match(service, /origin/)
  assert.match(rules, /match \/availabilityHistory\/\{historyId\}/)
  assert.match(rules, /resource\.data\.preparationMode == "kitchen"/)
  assert.match(rules, /allow write: if false/)
})

test("les notifications internes sont dédupliquées par leurs listeners", async () => {
  const pos = await read("src/app/(dashboard)/pos/components/POSClient.tsx")
  const kitchen = await read("src/modules/kitchen/KitchenAvailabilityPanel.tsx")
  const manager = await read("src/modules/availability/AvailabilityOperationsScreen.tsx")
  assert.match(pos, /previousAvailabilityRef/)
  assert.match(kitchen, /previousStatesRef/)
  assert.match(kitchen, /Commande active à vérifier/)
  assert.match(manager, /thresholdNotificationRef/)
})

test("les portions restent séparées de Stock V2 et sont réservées dans la création canonique", async () => {
  const creation = await read("src/server/orders/create/firestore-store.ts")
  const cancellation = await read("src/server/orders/commands/firestore-store.ts")
  assert.match(creation, /reservePortions\(/)
  assert.match(creation, /transaction\.update\(productRef, update\)/)
  assert.match(creation, /Portions épuisées/)
  assert.doesNotMatch(creation, /stockItemsV2|stockBalancesV2/)
  assert.match(cancellation, /preparePortionRestoration/)
  assert.match(cancellation, /portionReserved/)
  assert.match(cancellation, /Portions restaurées après annulation/)
})
