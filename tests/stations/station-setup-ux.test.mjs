import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"

import {
  POS_STATION_TEMPLATES,
  PREPARATION_STATION_TEMPLATES,
  QUICK_STATION_SCENARIOS,
  suggestCategoryIds,
  uniqueStationCode,
} from "../../src/lib/station-setup.ts"

const root = process.cwd()
const source = (file) => fs.readFileSync(path.join(root, file), "utf8")

test("les modèles couvrent les caisses et postes demandés sans nouveau mode", () => {
  assert.deepEqual(POS_STATION_TEMPLATES.map((item) => item.code), ["MAIN", "RESTO", "FAST", "BAR", "PAT", "BOUL", "TAKE", "POSTE"])
  assert.deepEqual(PREPARATION_STATION_TEMPLATES.map((item) => item.code), ["KITCHEN", "FAST", "BAR", "PAT", "BOUL", "GRILL", "PIZZA", "POSTE"])
  assert.deepEqual(new Set(PREPARATION_STATION_TEMPLATES.map((item) => item.type)), new Set(["kitchen", "bar"]))
  assert.equal(QUICK_STATION_SCENARIOS.length, 4)
})

test("les codes sont normalisés et rendus uniques", () => {
  assert.equal(uniqueStationCode("bar", []), "BAR")
  assert.equal(uniqueStationCode("bar", ["BAR"]), "BAR2")
  assert.equal(uniqueStationCode("bar", ["BAR", "BAR2", "BAR3"]), "BAR4")
})

test("les catégories correspondantes sont seulement suggérées", () => {
  const template = POS_STATION_TEMPLATES.find((item) => item.id === "bar")
  assert.deepEqual(suggestCategoryIds(template, [
    { id: "1", name: "Boissons fraîches" },
    { id: "2", name: "Plats principaux" },
  ]), ["1"])
})

test("les écrans masquent les termes techniques et proposent les actions groupées", () => {
  const pos = source("src/modules/pos-stations/PosStationsSettings.tsx")
  const preparation = source("src/modules/preparation-stations/PreparationStationsSettings.tsx")
  for (const label of ["Configuration rapide", "Que peut vendre cette caisse ?", "Quels caissiers peuvent utiliser ce poste ?", "Configuration avancée"]) assert.match(pos, new RegExp(label.replace(/[?]/g, "\\?")))
  assert.doesNotMatch(pos, />DEFAULT</)
  for (const label of ["Automatique selon le produit", "Hérite de", "Aucun poste — remise directe", "Affecter la sélection", "Afficher uniquement les exceptions"]) assert.match(preparation, new RegExp(label))
  assert.match(preparation, /writeBatch/)
})

test("les pages partagent PageHeader et les cartes rapides responsives", () => {
  const pos = source("src/modules/pos-stations/PosStationsSettings.tsx")
  const preparation = source("src/modules/preparation-stations/PreparationStationsSettings.tsx")
  const card = source("src/design-system/components/QuickSetupCard.tsx")
  const globals = source("src/app/globals.css")
  for (const page of [pos, preparation]) {
    assert.match(page, /<PageHeader/)
    assert.match(page, /<QuickSetupGrid/)
    assert.match(page, /<QuickSetupCard/)
  }
  assert.match(card, /aria-pressed=\{selected\}/)
  assert.match(card, /focus-visible:ring-2/)
  assert.match(card, /min-h-28/)
  assert.match(card, /quick-setup-grid/)
  assert.doesNotMatch(card, /flex-col/)
  assert.match(globals, /@media \(min-width: 1024px\)[\s\S]*?grid-template-columns: repeat\(5, minmax\(0, 1fr\)\);[\s\S]*?gap: 12px;/)
  assert.match(card, /line-clamp-2/)
})
