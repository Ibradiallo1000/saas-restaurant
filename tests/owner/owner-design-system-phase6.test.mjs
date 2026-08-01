import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const source = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8")
const primitives = source("src/design-system/components/NavigationPrimitives.tsx")
const navigationHub = source("src/modules/owner-navigation/OwnerNavigationHub.tsx")
const activity = source("src/app/owner/activite/page.tsx")
const finances = source("src/app/owner/finances/page.tsx")
const stock = source("src/app/owner/stock/page.tsx")
const stockDetail = source("src/modules/stock/owner/ui/OwnerStockDetailScreen.tsx")

test("l’en-tête partagé applique des titres compacts et des contenus facultatifs", () => {
  const header = source("src/design-system/components/PageHeader.tsx")
  assert.match(header, /text-xl font-bold/)
  assert.match(header, /min-\[390px\]:text-2xl md:text-\[1\.75rem\]/)
  assert.match(header, /icon\?: LucideIcon \| null/)
  assert.match(header, /back\?: React\.ReactNode/)
  assert.match(header, /breadcrumb\?: React\.ReactNode/)
  assert.match(header, /density\?: "compact" \| "dense" \| "default" \| "comfortable"/)
})

test("les cartes et grilles partagées couvrent navigation, accessibilité et responsive", () => {
  assert.match(primitives, /export function NavigationTile/)
  assert.match(primitives, /grid grid-cols-2/)
  assert.match(primitives, /md:grid-cols-3 lg:grid-cols-4/)
  assert.match(primitives, /2xl:grid-cols-6/)
  assert.match(primitives, /min-h-11/)
  assert.match(primitives, /focus-visible:ring-2/)
  assert.match(primitives, /navigable && showArrow/)
  assert.match(primitives, /aria-current/)
})

test("Activité utilise deux accès avec icônes et sans sous-titre inutile", () => {
  assert.match(activity, /title="Activité"/)
  assert.doesNotMatch(activity, /subtitle=/)
  assert.match(activity, /item\.id === "orders" \|\| item\.id === "reviews"/)
  assert.match(navigationHub, /renderNavigationIcon/)
  assert.match(navigationHub, /ShoppingCart/)
  assert.match(navigationHub, /Star/)
})

test("Finances expose cinq destinations iconées sans texte explicatif", () => {
  assert.match(finances, /title="Finances"/)
  assert.doesNotMatch(finances, /subtitle=/)
  for (const id of ["cash", "treasury", "expenses", "supplies", "suppliers"]) assert.match(navigationHub, new RegExp(`${id}:`))
})

test("Stock conserve exactement les six indicateurs demandés dans la grille compacte", () => {
  assert.match(stock, /<PageHeader title="Stock"/)
  assert.doesNotMatch(stock, /Les mêmes quantités et opérations que le Manager/)
  assert.equal((stock.match(/<NavigationTile/g) || []).length, 6)
  for (const label of ["Valeur du stock", "Articles suivis", "Alertes", "Dettes fournisseurs", "Achats du mois", "Paiements en attente"]) assert.match(stock, new RegExp(`title="${label}"`))
  assert.match(stock, /href="\/owner\/stock\/articles\?view=value"/)
  assert.match(stock, /href="\/owner\/stock\/articles"/)
  assert.match(stock, /href="\/owner\/stock\/alerts"/)
  assert.match(stock, /href="\/owner\/stock\/suppliers"/)
  assert.match(stock, /href="\/owner\/stock\/supplies"/)
  assert.match(stock, /<NavigationTile variant=\{pendingPayments > 0 \? "warning" : "neutral"\} title="Paiements en attente"/)
})

test("les sous-pages Stock ont un retour, une navigation interne et l’état Valeur distinct", () => {
  assert.match(stockDetail, /<BackLink href="\/owner\/stock" label="Stock"/)
  assert.match(stockDetail, /<SectionNavigation/)
  for (const label of ["Synthèse", "Articles", "Valeur", "Alertes", "Mouvements", "Achats", "Fournisseurs"]) assert.match(stockDetail, new RegExp(`label: "${label}"`))
  assert.match(stockDetail, /matchQuery: \{ key: "view" \}/)
  assert.match(stockDetail, /matchQuery: \{ key: "view", value: "value" \}/)
  assert.match(primitives, /router\.back\(\)/)
  assert.match(primitives, /referrer\?\.origin === window\.location\.origin/)
})

test("la phase UX ne modifie aucune écriture ou requête métier Stock", () => {
  assert.doesNotMatch(stockDetail, /updateDoc|setDoc|addDoc|writeBatch|runTransaction/)
  assert.doesNotMatch(stock, /updateDoc|setDoc|addDoc|writeBatch|runTransaction/)
  assert.match(stockDetail, /useInventoryReferential/)
  assert.match(stock, /useInventoryReferential/)
})
