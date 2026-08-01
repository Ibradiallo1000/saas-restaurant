import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), "utf8")

test("Stock V2 expose les six sections canoniques sans fallback Inventaire", () => {
  const layout = read("src/app/(manager)/manager/stock/layout.tsx")
  for (const label of ["Articles", "Contrôles", "Réapprovisionnement", "Historique", "Chronologie", "Rapports"]) assert.match(layout, new RegExp(label))
  assert.match(layout, /SectionNavigation/)
  for (const file of ["src/modules/stock/daily-pilot/ui/DailyStockScreen.tsx", "src/modules/stock/automatic-simple/ui/AutomaticSimpleScreen.tsx", "src/modules/stock/articles/ui/ArticleReferentialScreen.tsx"]) assert.doesNotMatch(read(file), /\/manager\/inventory/)
})

test("Fournisseurs confirme le paiement détaillé et conserve la transaction", () => {
  const source = read("src/app/(manager)/manager/suppliers/page.tsx")
  for (const text of ["Fournisseur :", "Compte ou source :", "Dette avant paiement :", "Solde restant :"]) assert.match(source, new RegExp(text))
  assert.match(source, /service\.paySupplier/)
  assert.match(source, /if \(!service \|\| !restaurantId \|\| !user \|\| saving\) return/)
})

test("Tables et Menu confirment les actions destructives et empêchent le double envoi", () => {
  const tables = read("src/app/(dashboard)/dashboard/tables/page.tsx")
  const menu = read("src/app/(dashboard)/manager/components/ManagerClient.tsx")
  assert.match(tables, /Montant actif :/)
  assert.match(tables, /releasingTableId/)
  assert.match(tables, /closeActiveTableSession/)
  assert.match(menu, /Supprimer définitivement/)
  assert.match(menu, /deletingProductId/)
  assert.match(menu, /deleteDoc/)
})

test("Médias décrit honnêtement la suppression Firestore sans suppression externe", () => {
  const gallery = read("src/components/ImageGallery.tsx")
  assert.match(gallery, /Le fichier externe ne sera pas supprimé/)
  assert.match(gallery, /deleteDoc/)
  assert.doesNotMatch(gallery, /api\/delete-image/)
})

test("Dépenses affiche un récapitulatif avant la transaction existante", () => {
  const source = read("src/app/(manager)/manager/expenses/page.tsx")
  assert.match(source, /Récapitulatif avant enregistrement/)
  assert.match(source, /Dette créée/)
  assert.match(source, /submitExpense/)
})
