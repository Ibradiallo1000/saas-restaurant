import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), "utf8")
const header = read("src/app/(dashboard)/pos/components/POSHeader.tsx")
const client = read("src/app/(dashboard)/pos/components/POSClient.tsx")
const cart = read("src/app/(dashboard)/pos/components/CartPanel.tsx")
const cartPrimitive = read("src/components/pos-ui/pos-cart.tsx")
const products = read("src/app/(dashboard)/pos/components/ProductGrid.tsx")

test("le header POS regroupe les actions secondaires et garde la déconnexion mobile", () => {
  assert.match(header, /aria-label="Ouvrir les actions du compte et de la caisse"/)
  assert.match(header, /Total encaissé/)
  assert.match(header, /Clôturer la caisse/)
  assert.match(header, /Se déconnecter/)
  assert.match(header, /<ThemeToggle/)
})

test("Caisse et Commandes sont deux onglets égaux sur toute la largeur", () => {
  assert.match(header, /flex w-full min-w-0 rounded-xl/)
  assert.match(header, /min-w-0 flex-1 items-center justify-center/)
  assert.match(header, /aria-pressed=\{active\}/)
})

test("tous les produits restent accessibles par une pagination explicite", () => {
  assert.match(client, /filteredProducts\.slice\(start, start \+ productsPerPage\)/)
  assert.match(client, /Page \{safeCurrentPage \+ 1\} \/ \{totalPages\}/)
  assert.match(client, /\{filteredProducts\.length\} produits accessibles/)
  assert.match(client, /setCurrentPage\(\(page\) => page \+ 1\)/)
  assert.match(products, /layout="twoColumns"/)
  assert.match(products, /object-cover|PosProductCard/)
})

test("le ticket affiche une image ou un fallback sans changer ses actions", () => {
  assert.match(cartPrimitive, /image\?: React\.ReactNode/)
  assert.match(cart, /getOptimizedImage\(item\.imageUrl, 112\)/)
  assert.match(cart, /<ImageIcon/)
  assert.match(cart, /grid grid-cols-2 gap-2/)
  assert.match(client, /disabled=\{!cart\.length\}/)
  assert.match(client, /Voir le ticket/)
})

test("les quatre statuts Commandes forment une grille 2 par 2 puis une ligne tablette", () => {
  assert.match(client, /aria-label="Statut des commandes" className="grid grid-cols-2 gap-2 md:grid-cols-4"/)
  assert.doesNotMatch(client, /aria-label="Statut des commandes" className="[^"]*overflow-x-auto/)
  assert.match(client, /min-h-11 min-w-0 items-center justify-between/)
  assert.match(client, /whitespace-normal leading-tight/)
  for (const label of ["En attente", "Préparation", "Prêt", "Servi"]) assert.match(client, new RegExp(`return "${label}"`))
})
