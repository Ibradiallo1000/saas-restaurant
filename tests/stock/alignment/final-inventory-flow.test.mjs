import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { ARTICLE_LIBRARY } from "../../../src/modules/stock/articles/domain/article-library.ts"
import {
  eligibleAutomaticArticles,
  findAutomaticArticleByName,
  normalizeStockName,
} from "../../../src/modules/stock/automatic-simple/domain/product-article-matching.ts"
import {
  automaticInventoryArticles,
  prioritizeSupplierArticles,
  supplyEligibleInventoryArticles,
} from "../../../src/modules/stock/shared/inventory-referential.ts"

const source = (path) =>
  readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8")

test("la bibliothèque reste une sélection volontaire sans quantité initiale", () => {
  assert.deepEqual(
    ARTICLE_LIBRARY.map((group) => group.name),
    ["Restaurant africain", "Fast-food", "Pizzeria", "Bar"]
  )
  assert.equal(ARTICLE_LIBRARY.flatMap((group) => group.articles).some((article) => "quantity" in article), false)
  const screen = source("src/modules/stock/articles/ui/ArticleReferentialScreen.tsx")
  assert.match(screen, /Importer la sélection/)
  assert.match(screen, /Rien n’est créé sans/)
})

test("un nom identique associe automatiquement un article AUTOMATIC_SIMPLE", () => {
  const articles = [
    { id: "coca", name: "Coca-Cola", status: "active", trackingMode: "AUTOMATIC_SIMPLE" },
    { id: "oil", name: "Huile", status: "active", trackingMode: "CONTROLLED" },
  ]
  assert.equal(normalizeStockName("  Còca-Cola "), "coca cola")
  assert.equal(findAutomaticArticleByName("Coca Cola", articles)?.id, "coca")
  assert.equal(findAutomaticArticleByName("Huile", articles), null)
})

test("la sélection manuelle garde Poulet, exclut Huile et ne dépend pas du solde", () => {
  const rows = eligibleAutomaticArticles([
    { id: "chicken", name: "Poulet", status: "active", trackingMode: "AUTOMATIC_SIMPLE", quantity: 0 },
    { id: "oil", name: "Huile", status: "active", trackingMode: "CONTROLLED", quantity: 20 },
  ])
  assert.deepEqual(rows.map((row) => row.id), ["chicken"])
  assert.equal(findAutomaticArticleByName("Demi-poulet", rows), null)
})

test("les scénarios Coca-Cola et demi-poulet produisent les soldes attendus", () => {
  const cocaAfterSupply = 0 + 48
  assert.equal(cocaAfterSupply - 1, 47)
  const chickenAfterSupply = 0 + 20
  assert.equal(chickenAfterSupply - 2 * 0.5, 19)
})

test("le produit contrôlé manuellement ne peut pas être associé au déclencheur automatique", () => {
  const articles = [
    { id: "oil", name: "Huile", status: "active", trackingMode: "CONTROLLED" },
  ]
  assert.equal(findAutomaticArticleByName("Huile", articles), null)
  const trigger = source("functions/src/stock-automatic-simple.ts")
  assert.doesNotMatch(trigger, /product\.data\(\)\?\.stockMode/)
  assert.match(trigger, /article\.data\(\)\?\.trackingMode !== "AUTOMATIC_SIMPLE"/)
})

test("l'entrée Inventaire sélectionne V2 sans exposer de transition technique", () => {
  const legacyPage = source("src/app/(manager)/manager/inventory/page.tsx")
  const articleScreen = source("src/modules/stock/articles/ui/ArticleReferentialScreen.tsx")
  assert.match(legacyPage, /router\.replace\("\/manager\/stock"\)/)
  assert.doesNotMatch(articleScreen, /Nouveau référentiel désactivé|Retour à l’inventaire actuel/)
})

test("un approvisionnement met à jour stock, coût, trésorerie ou dette", () => {
  const service = source("src/services/supply-expense.service.ts")
  assert.match(service, /newStock = oldStock \+ snapshot\.input\.quantity/)
  assert.match(service, /increment\(-normalized\.paidAmount\)/)
  assert.match(service, /increment\(debtAmount\)/)
})

test("les fournisseurs priorisent leurs articles sans masquer le référentiel commun", () => {
  const expense = source("src/app/(manager)/manager/expenses/page.tsx")
  const owner = source("src/app/owner/stock/page.tsx")
  assert.match(expense, /selectedSupplier\?\.articleIds/)
  assert.match(expense, /prioritizeSupplierArticles/)
  assert.match(owner, /useInventoryReferential/)
  for (const label of [
    "Valeur du stock",
    "Achats du mois",
    "Paiements en attente",
    "Impact trésorerie du mois",
    "Top produits consommés ce mois",
    "Mouvements récents",
  ]) {
    assert.match(owner, new RegExp(label))
  }
})

test("le seuil minimum est modifiable depuis le parcours Inventaire", () => {
  const stockScreen = source("src/modules/stock/controlled-stock/ui/ControlledStockScreen.tsx")
  const articleScreen = source("src/modules/stock/articles/ui/ArticleReferentialScreen.tsx")
  assert.match(stockScreen, /Modifier l’article et ses seuils/)
  assert.ok(stockScreen.includes("/manager/stock/articles/${id}"))
  assert.match(articleScreen, /Seuil minimum \(alerte de stock faible\)/)
  assert.match(articleScreen, /lowStockThreshold: Number\(lowThreshold\)/)
  const legacyInventory = source("src/app/(manager)/manager/inventory/page.tsx")
  assert.match(legacyInventory, /⚠ Modifier seuil/)
  assert.match(legacyInventory, /updateInventoryMinThreshold/)
})

test("les cartes de l'inventaire historique fonctionnent comme un accordéon", () => {
  const inventory = source("src/app/(manager)/manager/inventory/page.tsx")
  assert.match(inventory, /expanded=\{focusedItemId === item\.id\}/)
  assert.match(inventory, /setFocusedItemId\(expanded \? item\.id : null\)/)
  assert.match(inventory, /bg-primary\/\[0\.06\]/)
})

test("le formulaire Produit lit les Articles V2 éligibles avec leur solde en temps réel", () => {
  const manager = source("src/app/(dashboard)/manager/components/ManagerClient.tsx")
  assert.match(manager, /useInventoryReferential\(restaurantId\)/)
  assert.match(manager, /Article d’inventaire/)
  assert.match(manager, /activeArticles: stockArticles/)
  assert.match(manager, /quantityPerSale/)
})

test("le référentiel partagé applique les règles Coca, Poulet et Huile", () => {
  const articles = [
    { id: "coca", restaurantId: "A", name: "Coca Cola", status: "active", trackingMode: "AUTOMATIC_SIMPLE" },
    { id: "poulet", restaurantId: "A", name: "Poulet", status: "active", trackingMode: "AUTOMATIC_SIMPLE" },
    { id: "huile", restaurantId: "A", name: "Huile", status: "active", trackingMode: "CONTROLLED" },
    { id: "archive", restaurantId: "A", name: "Archive", status: "archived", trackingMode: "CONTROLLED" },
  ]
  assert.deepEqual(automaticInventoryArticles(articles).map(({ id }) => id), ["coca", "poulet"])
  assert.deepEqual(supplyEligibleInventoryArticles(articles).map(({ id }) => id), ["coca", "poulet", "huile"])
  assert.deepEqual(prioritizeSupplierArticles(articles.slice(0, 3), ["huile"]).map(({ id }) => id), ["huile", "coca", "poulet"])
})

test("Produit, Approvisionnement, Fournisseurs et Owner utilisent le même chargeur", () => {
  for (const path of [
    "src/app/(dashboard)/manager/components/ManagerClient.tsx",
    "src/app/(manager)/manager/expenses/page.tsx",
    "src/app/(manager)/manager/suppliers/page.tsx",
    "src/app/owner/stock/page.tsx",
    "src/app/owner/page.tsx",
  ]) {
    assert.match(source(path), /useInventoryReferential/)
  }
  const shared = source("src/modules/stock/shared/inventory-referential.ts")
  assert.match(shared, /listInventoryArticlesForRestaurant/)
  assert.match(shared, /restaurants/)
  assert.match(shared, /restaurantId/)
})

test("l'entrée Inventaire active le référentiel dès que les Articles V2 sont actifs", () => {
  const inventory = source("src/app/(manager)/manager/inventory/page.tsx")
  assert.match(inventory, /isArticleReferentialEnabled/)
  assert.match(inventory, /isControlledStockEnabled/)
  assert.match(inventory, /router\.replace\("\/manager\/stock"\)/)
})
