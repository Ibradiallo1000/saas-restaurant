import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const source = (path) =>
  readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8")

test("product configuration derives stock behavior exclusively from the linked article", () => {
  const manager = source("src/app/(dashboard)/manager/components/ManagerClient.tsx")
  assert.match(manager, /Gestion du stock/)
  assert.match(manager, /Article d’inventaire/)
  assert.match(manager, /stockArticleId/)
  assert.doesNotMatch(manager, /productForm\.stockMode/)
  assert.doesNotMatch(manager, /function RecipeEditor/)
  assert.match(manager, /hasComplexConsumption: false/)
})

test("product variants no longer expose recipe or ingredient lines", () => {
  const editor = source("src/components/menu/OptionEditor.tsx")
  assert.doesNotMatch(editor, /choice\.recipe|inventoryItemId|Ajouter ingrédient|multiplier|Multiplicateur/)
  assert.match(editor, /name: "", price: 0/)
  assert.match(editor, /Option obligatoire/)
  assert.match(editor, /Choix multiple/)
})

test("product form conditionally exposes the V2 article behavior read-only", () => {
  const manager = source("src/app/(dashboard)/manager/components/ManagerClient.tsx")
  assert.match(manager, /Aucun article lié/)
  assert.match(manager, /Quantité retirée pour une vente/)
  assert.match(manager, /À chaque unité servie de ce produit/)
  assert.match(manager, /Défini dans Inventaire/)
  assert.match(manager, /Le stock est vérifié depuis Inventaire/)
  assert.match(manager, /article\.trackingMode === "AUTOMATIC_SIMPLE"/)
  assert.doesNotMatch(manager, /<select[^>]*value=\{productForm\.stockMode\}/)
  const shared = source("src/modules/stock/shared/inventory-referential.ts")
  assert.match(shared, /trackingMode === "AUTOMATIC_SIMPLE"/)
  assert.match(manager, /automaticQuantity <= 0/)
})

test("create and import do not persist an independent mode and neutralize legacy composition", () => {
  const manager = source("src/app/(dashboard)/manager/components/ManagerClient.tsx")
  const importer = source("src/modules/menu-library/MenuLibraryImportDialog.tsx")
  assert.doesNotMatch(manager, /stockMode: "NONE"/)
  assert.match(manager, /recipe: \[\]/)
  assert.match(manager, /components: \[\]/)
  assert.doesNotMatch(importer, /stockMode: "NONE"/)
  assert.match(importer, /sanitizeImportedCommercialOptions/)
  assert.match(importer, /recipe: \[\]/)
  assert.match(importer, /components: \[\]/)
})

test("fixed quantities accept whole and half-product use cases", () => {
  const manager = source("src/app/(dashboard)/manager/components/ManagerClient.tsx")
  assert.match(manager, /step="0\.1"/)
  assert.match(manager, /Number\(productForm\.quantityPerSale\)/)
  assert.doesNotMatch(manager, /Number\.isInteger\(automaticQuantity\)/)
})

test("orders leave automatic stock to the single V2 served-item trigger", () => {
  const orders = source("src/services/order.service.ts")
  assert.doesNotMatch(orders, /handleOrderSentToKitchen|decrementStockForOrderItems/)
  const trigger = source("functions/src/stock-automatic-simple.ts")
  assert.doesNotMatch(trigger, /product\.data\(\)\?\.stockMode/)
  assert.match(trigger, /article\.data\(\)\?\.trackingMode !== "AUTOMATIC_SIMPLE"/)
  assert.match(trigger, /input\.orderItemId/)
  assert.match(trigger, /input\.servedQuantityVersion/)
  assert.doesNotMatch(trigger, /isConfirmedPaymentTransition/)
})

test("supplies update V2 stock and preserve cash or credit accounting", () => {
  const supplies = source("src/services/supply-expense.service.ts")
  assert.match(supplies, /stockItemsV2/)
  assert.match(supplies, /stockBalancesV2/)
  assert.match(supplies, /stockOperationsV2/)
  assert.match(supplies, /increment\(-normalized\.paidAmount\)/)
  assert.match(supplies, /increment\(debtAmount\)/)
  assert.match(supplies, /increment\(-paymentAmount\)/)
  assert.doesNotMatch(supplies, /inventoryItems|stockEstimated/)
})

test("manager navigation exposes one transparent inventory entry and Owner uses V2", () => {
  const managerLayout = source("src/app/(manager)/layout.tsx")
  const ownerStock = source("src/app/owner/stock/page.tsx")
  assert.match(managerLayout, /label: "Inventaire", href: "\/manager\/inventory"/)
  assert.match(managerLayout, /pathname\.startsWith\("\/manager\/stock\/"\)/)
  assert.doesNotMatch(managerLayout, /label: "Stock V2"/)
  assert.match(ownerStock, /\/owner\/stock\/articles/)
  assert.match(ownerStock, /\/owner\/stock\/movements/)
  assert.doesNotMatch(ownerStock, /DailyStockScreen|\/manager\/stock/)
  assert.match(ownerStock, /Dette fournisseurs/)
})
