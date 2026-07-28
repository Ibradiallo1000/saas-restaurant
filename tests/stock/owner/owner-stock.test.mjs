import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import test from "node:test"

const source = (path) =>
  readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8")

test("les cartes Owner ouvrent leurs détails sans route Manager", () => {
  const page = source("src/app/owner/stock/page.tsx")
  for (const route of [
    "/owner/stock/articles?view=value",
    "/owner/stock/articles",
    "/owner/stock/alerts",
    "/owner/stock/suppliers",
    "/owner/stock/supplies",
    "/owner/stock/movements",
  ]) {
    assert.match(page, new RegExp(route.replaceAll("?", "\\?")))
  }
  assert.match(page, /focus-visible:ring-2/)
  assert.match(page, /group-hover:border-primary/)
  assert.match(page, /ChevronRight/)
  assert.doesNotMatch(page, /DailyStockScreen|\/manager\/stock/)
})

test("les cinq routes Owner de détail existent et utilisent un écran partagé", () => {
  for (const route of ["articles", "alerts", "movements", "supplies", "suppliers"]) {
    const path = new URL(
      `../../../src/app/owner/stock/${route}/page.tsx`,
      import.meta.url
    )
    assert.equal(existsSync(path), true)
    assert.match(readFileSync(path, "utf8"), /OwnerStockDetailScreen/)
  }
})

test("les détails Owner restent en lecture seule et utilisent le référentiel V2 partagé", () => {
  const detail = source("src/modules/stock/owner/ui/OwnerStockDetailScreen.tsx")
  assert.match(detail, /useInventoryReferential/)
  assert.match(detail, /stockTrackingModeLabel/)
  assert.match(detail, /stockUnitLabel/)
  assert.match(detail, /Valeur totale/)
  assert.match(detail, /Stock faible/)
  assert.match(detail, /Rupture/)
  assert.doesNotMatch(detail, /\/manager\/|updateDoc|setDoc|addDoc|writeBatch|runTransaction/)
})

test("le formulaire présente les formats d’achat repliés et sans type technique", () => {
  const form = source("src/modules/stock/articles/ui/ArticleReferentialScreen.tsx")
  assert.match(form, /Formats d’achat \(facultatif\)/)
  assert.match(form, /Le stock reste toujours suivi dans son unité de base/)
  assert.match(form, /<Collapsible open=\{open\}/)
  assert.match(form, /Nom du format/)
  assert.match(form, /Quantité contenue/)
  assert.match(form, /Unité de base/)
  assert.match(form, /readOnly/)
  assert.doesNotMatch(form, /<option value="box">|<option value="pack">|<option value="bag">/)
})

test("Approvisionnement ne simule pas encore une conversion de format non branchée", () => {
  const expenses = source("src/app/(manager)/manager/expenses/page.tsx")
  assert.doesNotMatch(expenses, /packagingId|Nombre de cartons|Quantité ajoutée au stock/)
  assert.match(expenses, /Quantité/)
  assert.match(expenses, /Prix unitaire/)
})

test("Owner décrit les contrôles physiques sans code technique", () => {
  const detail = source("src/modules/stock/owner/ui/OwnerStockDetailScreen.tsx")
  assert.match(detail, /Contrôle physique ·/)
  assert.match(detail, /écart constaté/)
  assert.match(detail, /surplus constaté/)
  assert.match(detail, /operation\.note/)
})

test("les actions de contrôle sont accessibles et limitées aux articles CONTROLLED", () => {
  const referential = source("src/modules/stock/articles/ui/ArticleReferentialScreen.tsx")
  const control = source("src/modules/stock/controlled-stock/ui/ControlledStockScreen.tsx")
  assert.match(referential, /article\.trackingMode === "CONTROLLED"/)
  assert.match(referential, /aria-label=\{`Effectuer le contrôle de/)
  assert.match(referential, /\/manager\/stock\/controls/)
  assert.match(control, /item\.trackingMode === "CONTROLLED"/)
  assert.match(control, /aria-label=\{`Effectuer le contrôle de/)
  assert.match(control, /Consommation constatée \/ écart de stock/)
})

test("toutes les pages rattachées à un article reviennent au référentiel canonique", () => {
  const referential = source("src/modules/stock/articles/ui/ArticleReferentialScreen.tsx")
  const controlled = source("src/modules/stock/controlled-stock/ui/ControlledStockScreen.tsx")
  assert.match(referential, /backToArticles/)
  assert.match(referential, /href="\/manager\/stock"/)
  assert.match(referential, /Retour aux articles/)
  assert.match(controlled, /backToArticles/)
  assert.match(controlled, /href="\/manager\/stock"/)
  assert.match(controlled, /← Retour aux articles/)
})
