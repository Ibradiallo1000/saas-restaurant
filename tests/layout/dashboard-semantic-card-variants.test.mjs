import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), "utf8")
const variants = read("src/components/dashboard-ui/semantic-variants.ts")
const metrics = read("src/components/dashboard-ui/dashboard-metrics.tsx")
const widgets = read("src/components/dashboard-ui/dashboard-widget.tsx")
const sections = read("src/components/dashboard-ui/dashboard-layout.tsx")
const charts = read("src/components/dashboard-ui/dashboard-chart.tsx")
const alerts = read("src/components/dashboard-ui/dashboard-feedback.tsx")
const navigation = read("src/design-system/components/NavigationPrimitives.tsx")

test("les huit variantes sémantiques couvrent surfaces, icônes et hover", () => {
  for (const variant of ["neutral", "info", "activity", "finance", "success", "warning", "danger", "stock"]) {
    assert.match(variants, new RegExp(`${variant}:`))
  }
  assert.match(variants, /dark:/)
  assert.match(variants, /semanticSurfaceClasses/)
  assert.match(variants, /semanticIconClasses/)
  assert.match(variants, /semanticHoverClasses/)
  assert.match(variants, /semanticBeforeAccentClasses/)
})

test("les primitives partagées exposent la variante sans colorer Card globalement", () => {
  assert.match(metrics, /variant\?: DashboardSemanticVariant/)
  assert.match(navigation, /variant\?: DashboardSemanticVariant/)
  assert.match(widgets, /variant\?: DashboardSemanticVariant/)
  assert.match(sections, /variant\?: DashboardSemanticVariant/)
  assert.match(charts, /variant\?: DashboardSemanticVariant/)
  assert.match(sections, /resolveDashboardSectionVariant/)
  assert.match(alerts, /semanticSurfaceClasses/)
  assert.match(metrics, /rounded-full/)
})

test("Owner et Manager appliquent des couleurs selon le sens métier", () => {
  const owner = read("src/app/owner/page.tsx")
  const ownerStock = read("src/app/owner/stock/page.tsx")
  const ownerHub = read("src/modules/owner-navigation/OwnerNavigationHub.tsx")
  const manager = read("src/app/(dashboard)/manager/components/ManagerDashboardView.tsx")
  assert.match(owner, /variant: "success"/)
  assert.match(owner, /variant: "activity"/)
  assert.match(owner, /variant: "finance"/)
  assert.match(ownerStock, /variant="stock"/)
  assert.match(ownerHub, /getNavigationVariant/)
  assert.match(manager, /variant="activity"/)
  assert.match(manager, /variant="finance"/)
  assert.match(manager, /variant="info"/)
  assert.match(manager, /DashboardChartCard variant="stock"/)
  assert.match(manager, /DashboardSection surface variant="success" title="Résumé financier"/)
  assert.match(owner, /DashboardSection surface variant="finance" title="Situation de la caisse"/)
  assert.match(owner, /DashboardChartCard variant=\{valueKey === "revenue" \? "success" : "activity"\}/)
  assert.match(manager, /"danger" : "success"/)
})
