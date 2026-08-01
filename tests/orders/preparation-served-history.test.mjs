import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8")

test("l'historique servi est filtré par poste, statut et journée", async () => {
  const source = await read("src/modules/kitchen/canonical-read/use-served-preparation-history.ts")
  assert.match(source, /collectionGroup\(db, "orderItems"\)/)
  assert.match(source, /"preparationStationId" : "preparationMode"/)
  assert.match(source, /where\("status", "==", "served"\)/)
  assert.match(source, /where\("servedAt", ">=", Timestamp\.fromDate\(dayStart\)\)/)
  assert.match(source, /return \(\) => \{[\s\S]*unsubscribe\(\)/)
})

test("la vue servie reste en lecture seule et conserve les colonnes actives", async () => {
  const source = await read("src/modules/kitchen/KitchenBoard.tsx")
  assert.match(source, /Servies aujourd’hui/)
  assert.match(source, /Historique en lecture seule du poste sélectionné/)
  assert.match(source, /Préparées aujourd’hui/)
  assert.match(source, /Encore prêtes à remettre/)
  assert.doesNotMatch(source, /ServedTodayPanel[\s\S]*executeKitchenItemsTransition/)
})

test("le passage à prêt horodate la fin de préparation", async () => {
  const source = await read("src/server/orders/commands/firestore-store.ts")
  assert.match(source, /commandName === "MarkOrderItemReady"[\s\S]*result\.readyAt = now/)
  assert.match(source, /result\.readyBy = input\.actor\.id/)
})
