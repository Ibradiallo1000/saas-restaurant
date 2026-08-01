import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const read = (path) => readFile(path, "utf8")

test("Cuisine expose Commandes et Disponibilités avec une écriture strictement opérationnelle", async () => {
  const board = await read("src/modules/kitchen/KitchenBoard.tsx")
  const panel = await read("src/modules/kitchen/KitchenAvailabilityPanel.tsx")
  assert.match(board, />Commandes</)
  assert.match(board, />Disponibilités</)
  assert.match(panel, /resolveProductPreparationMode/)
  assert.match(panel, /=== "kitchen"/)
  assert.match(panel, /executeAvailabilityCommandClient/)
  assert.match(panel, /type: "SET_AVAILABILITY"/)
  assert.doesNotMatch(panel, /\b(price|basePrice|imageUrl|categoryId|options):\s/)
})

test("le catalogue POS utilise des listeners nettoyés et sans lecture ponctuelle", async () => {
  const provider = await read("src/modules/catalog/CatalogProvider.tsx")
  assert.match(provider, /onSnapshot\(productsQuery/)
  assert.match(provider, /onSnapshot\(categoriesQuery/)
  assert.match(provider, /unsubscribeProducts\(\)/)
  assert.match(provider, /unsubscribeCategories\(\)/)
  assert.doesNotMatch(provider, /getDocs\(/)
})

test("le POS garde le produit visible mais bloque carte, ajout et confirmation", async () => {
  const grid = await read("src/app/(dashboard)/pos/components/ProductGrid.tsx")
  const pos = await read("src/app/(dashboard)/pos/components/POSClient.tsx")
  const cart = await read("src/app/(dashboard)/pos/components/CartPanel.tsx")
  assert.match(grid, /resolveEffectiveProductAvailability/)
  assert.match(grid, /Épuisé/)
  assert.match(grid, /Indisponible actuellement/)
  assert.match(pos, /if \(!operationalAvailability\.orderable\)/)
  assert.match(pos, /hasUnavailableCartItems/)
  assert.match(cart, /Retirez-le du ticket/)
})

test("le menu public écoute les produits en temps réel et bloque les paniers périmés", async () => {
  const page = await read("src/modules/public/PublicPage.tsx")
  const card = await read("src/modules/public/components/DishCard.tsx")
  const cart = await read("src/modules/public/cart/CartContext.tsx")
  const drawer = await read("src/modules/public/components/CartDrawer.tsx")
  assert.match(page, /useCollection\(productsQuery\)/)
  assert.doesNotMatch(page, /useCollectionOnce\(productsQuery/)
  assert.match(card, /availabilityLabel/)
  assert.match(card, /disabled=\{!availability\.orderable\}/)
  assert.match(cart, /unavailableItems/)
  assert.match(drawer, /hasUnavailableItems/)
  assert.match(drawer, /Retirez-le du panier/)
})

test("les checkouts QR et public bloquent aussi une modale déjà ouverte", async () => {
  for (const path of [
    "src/modules/public/components/CheckoutQRModal.tsx",
    "src/modules/public/components/CheckoutPublicModal.tsx",
  ]) {
    const source = await read(path)
    assert.match(source, /if \(hasUnavailableItems\)/)
    assert.match(source, /unavailableItems\[0\]/)
  }
})
