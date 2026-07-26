import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const managerClient = readFileSync("src/app/(dashboard)/manager/components/ManagerClient.tsx", "utf8")
const productEditor = readFileSync("src/components/menu/ProductEditor.tsx", "utf8")

test("le réglage général des avis est rendu dans la modal catégorie", () => {
  const categoryModalStart = managerClient.indexOf("{/* MODAL CATEGORY */}")
  const productModalStart = managerClient.indexOf("{/* MODAL PRODUCT")
  assert.ok(categoryModalStart > -1)
  assert.ok(productModalStart > categoryModalStart)

  const categoryModal = managerClient.slice(categoryModalStart, productModalStart)
  assert.match(categoryModal, /Autoriser les avis pour les produits de cette catégorie/)
  assert.match(categoryModal, /Désactiver les avis pour les produits de cette catégorie/)
})

test("la modal produit ne contient pas le contrôle de catégorie", () => {
  const productModalStart = managerClient.indexOf("{/* MODAL PRODUCT")
  const imageProductStart = managerClient.indexOf("<p className=\"text-sm font-semibold\">Image produit</p>", productModalStart)
  assert.ok(productModalStart > -1)
  assert.ok(imageProductStart > productModalStart)

  const productSettings = managerClient.slice(productModalStart, imageProductStart)
  assert.doesNotMatch(productSettings, /Autoriser les avis pour les produits de cette catégorie/)
  assert.doesNotMatch(productSettings, /Désactiver les avis pour les produits de cette catégorie/)
  assert.match(productSettings, /Utiliser le réglage de la catégorie/)
  assert.match(productSettings, /Toujours autoriser les avis pour ce produit/)
  assert.match(productSettings, /Toujours désactiver les avis pour ce produit/)
})

test("ProductEditor ne déclenche aucune écriture de catégorie", () => {
  assert.doesNotMatch(productEditor, /restaurants", restaurantId, "categories"/)
  assert.doesNotMatch(productEditor, /collection\(db, "restaurants", restaurantId, "categories"/)
})
