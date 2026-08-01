import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8")
const dashboard = read("src/app/owner/page.tsx")
const dashboardUi = read("src/modules/owner-dashboard/owner-dashboard-ui.tsx")
const metricsUi = read("src/components/dashboard-ui/dashboard-metrics.tsx")

test("les alertes et KPI précèdent l’activité, les tendances et les analyses", () => {
  const renderedPage = dashboard.slice(dashboard.indexOf("return (", dashboard.indexOf("function OwnerPageContent")), dashboard.indexOf("type OwnerBusinessDashboard"))
  const positions = [
    "<OwnerAlertsSection",
    "<OwnerPrimaryMetrics",
    "<OwnerLiveSection",
    'title="Situation de la caisse"',
    'title="Finances et stock"',
    'title="Situation de la période"',
    "<OwnerAnalysisSection",
  ].map((needle) => renderedPage.indexOf(needle))

  assert.ok(positions.every((position) => position >= 0), positions)
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b))
})

test("les quatre KPI Owner et leurs qualités métier restent présents", () => {
  for (const label of [
    "Chiffre d’affaires encaissé",
    "Commandes",
    "Panier moyen",
    "Solde de trésorerie",
  ]) assert.match(dashboard, new RegExp(label))

  for (const quality of ["Donnée complète", "Estimation", "Donnée partielle", "Indisponible"]) {
    assert.match(dashboardUi, new RegExp(quality))
  }
})

test("les alertes proposent des états avec et sans alerte et uniquement des routes Owner", () => {
  const alerts = dashboard.slice(dashboard.indexOf("function OwnerAlertsSection"), dashboard.indexOf("function OwnerPrimaryMetrics"))
  assert.match(alerts, /Aucune alerte importante actuellement/)
  assert.match(alerts, /Certaines commandes ne sont pas incluses/)
  assert.match(alerts, /\/owner\/caisse/)
  assert.doesNotMatch(alerts, /\/manager\/|\/pos|\/kitchen/)
})

test("la structure responsive couvre mobile, tablette et desktop", () => {
  assert.match(dashboard, /grid-cols-2 gap-2 md:gap-4 xl:grid-cols-4/)
  assert.match(dashboard, /md:grid-cols-2/)
  assert.match(dashboard, /lg:grid-cols-2/)
  assert.match(metricsUi, /compact: "p-2\.5"/)
  assert.match(metricsUi, /dense: "p-3"/)
  assert.match(metricsUi, /default: "p-4"/)
  assert.match(metricsUi, /text-base min-\[360px\]:text-lg min-\[390px\]:text-xl sm:text-/)
})

test("les textes techniques et anciens intitulés ne sont plus rendus", () => {
  const presentation = dashboard.slice(0, dashboard.indexOf("function buildBusinessDashboardData"))
  for (const obsolete of [
    "Tableau de bord",
    "Tendance commerciale",
    "Analyse business",
    "Insights disponibles",
    "Maintenant",
    "Valeur active",
    "Données commandes potentiellement partielles",
    "Votre compte utilisateur ne contient pas de restaurantId",
  ]) assert.doesNotMatch(presentation, new RegExp(obsolete))

  assert.match(presentation, /Vue d’ensemble/)
  assert.match(presentation, /Points à retenir/)
  assert.match(presentation, /Analyse de l’activité/)
  assert.match(presentation, /Activité en direct/)
  assert.match(presentation, /Montant en cours/)
  assert.match(presentation, /Impossible de charger les commandes/)
  assert.doesNotMatch(presentation, /FirebaseError|Missing index/)
})

test("les calculs et limites de la Phase 2 restent branchés sans nouvelle requête", () => {
  assert.equal((dashboard.match(/limit\(501\)/g) || []).length, 2)
  assert.match(dashboard, /resolveOwnerRevenue\(/)
  assert.match(dashboard, /resolveOwnerTreasuryBalance\(/)
  assert.match(dashboard, /buildOwnerVariation\(/)
  assert.equal((dashboard.match(/useInventoryReferential\(/g) || []).length, 1)
  assert.doesNotMatch(dashboard, /addDoc\(|updateDoc\(|serverTimestamp\(/)
})
