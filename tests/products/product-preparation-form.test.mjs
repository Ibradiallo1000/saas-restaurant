import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { resolvePreparationStation, VIRTUAL_PREPARATION_STATIONS } from "../../src/lib/preparation-stations.ts"

const managerPath = "src/app/(dashboard)/manager/components/ManagerClient.tsx"
const platformPath = "src/app/platform/menu-library/components/PlatformMenuLibraryClient.tsx"
const importPath = "src/modules/menu-library/MenuLibraryImportDialog.tsx"
const preparationLogicPath = "src/utils/preparation-logic.ts"

test("les libellés produit partagés conservent les valeurs internes", async () => {
  const shared = await readFile(preparationLogicPath, "utf8")
  assert.match(shared, /value: 'kitchen', label: 'À préparer'/)
  assert.match(shared, /value: 'direct', label: 'Service direct'/)
  assert.match(shared, /value: 'bar', label: 'À préparer au bar\/comptoir'/)
  assert.match(shared, /getPreparationModeLabel/)
})

test("la résolution conserve produit, catégorie, compatible puis virtuel", () => {
  const stations = [
    { id: "kitchen-a", name: "Cuisine A", code: "A", type: "kitchen", isActive: true, acceptsOrders: true },
    { id: "kitchen-b", name: "Cuisine B", code: "B", type: "kitchen", isActive: true, acceptsOrders: true },
  ]
  assert.equal(resolvePreparationStation({ preparationMode: "kitchen", productStationId: "kitchen-b", categoryStationId: "kitchen-a", stations })?.id, "kitchen-b")
  assert.equal(resolvePreparationStation({ preparationMode: "kitchen", categoryStationId: "kitchen-a", stations })?.id, "kitchen-a")
  assert.equal(resolvePreparationStation({ preparationMode: "kitchen", stations })?.id, "kitchen-a")
  assert.equal(resolvePreparationStation({ preparationMode: "bar", stations: [] })?.id, VIRTUAL_PREPARATION_STATIONS.bar.id)
  assert.equal(resolvePreparationStation({ preparationMode: "direct", productStationId: "kitchen-a", stations }), null)
})

test("le formulaire restaurant couvre création, modification, héritage, exception et direct", async () => {
  const manager = await readFile(managerPath, "utf8")
  assert.match(manager, /preparationStationId: product\.preparationStationId \|\| ""/)
  assert.match(manager, /<option value="">\s*Hériter de la catégorie/)
  assert.match(manager, /station\.isActive !== false && station\.acceptsOrders !== false/)
  assert.match(manager, /station\.type === productForm\.preparationMode/)
  assert.match(manager, /productForm\.preparationMode === "direct" \|\| !productForm\.preparationStationId/)
  assert.match(manager, /Destination héritée\s*:/)
})

test("le catalogue global garde seulement le mode et l'import ne reçoit aucun poste", async () => {
  const [platform, importer] = await Promise.all([
    readFile(platformPath, "utf8"),
    readFile(importPath, "utf8"),
  ])
  assert.match(platform, /preparationMode: productForm\.preparationMode/)
  assert.match(platform, /poste précis sera configuré ou résolu dans le restaurant après l’import/)
  assert.doesNotMatch(platform, /preparationStationId/)
  assert.match(importer, /preparationMode: product\.preparationMode \|\| "kitchen"/)
  assert.doesNotMatch(importer, /preparationStationId|preparationStations/)
})
