import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), "utf8")

test("les primitives consolident compact, dense et default", () => {
  for (const file of ["src/components/dashboard-ui/dashboard-metrics.tsx", "src/components/dashboard-ui/dashboard-layout.tsx", "src/components/dashboard-ui/dashboard-widget.tsx", "src/design-system/components/NavigationPrimitives.tsx", "src/design-system/components/PageHeader.tsx"]) {
    const source = read(file)
    assert.match(source, /compact/)
    assert.match(source, /dense/)
    assert.match(source, /default/)
  }
})

test("les grilles partagées gardent deux colonnes mobile et montent jusqu’à six", () => {
  const metrics = read("src/components/dashboard-ui/dashboard-metrics.tsx")
  const navigation = read("src/design-system/components/NavigationPrimitives.tsx")
  assert.match(metrics, /grid-cols-2/)
  assert.match(metrics, /md:grid-cols-3/)
  assert.match(metrics, /lg:grid-cols-4/)
  assert.match(metrics, /xl:grid-cols-5/)
  assert.match(metrics, /2xl:grid-cols-6/)
  assert.match(navigation, /desktopColumns === 5 && "xl:grid-cols-5"/)
})

test("les graphiques partagés gèrent ligne, barres, répartition et états", () => {
  const source = read("src/components/dashboard-ui/dashboard-data-charts.tsx")
  assert.match(source, /export function TrendChart/)
  assert.match(source, /export function ComparisonChart/)
  assert.match(source, /export function DistributionChart/)
  assert.match(source, /DashboardEmptyState/)
  assert.match(source, /DashboardLoadingState/)
  assert.match(source, /dark|currentColor/)
})

test("le Dashboard Manager affiche six KPI, cinq actions et des graphiques réels chargés", () => {
  const view = read("src/app/(dashboard)/manager/components/ManagerDashboardView.tsx")
  const client = read("src/app/(dashboard)/manager/components/ManagerClient.tsx")
  assert.match(view, /lg:grid-cols-4 xl:grid-cols-6/)
  assert.match(view, /desktopColumns=\{5\}/)
  assert.match(view, /Évolution des commandes/)
  assert.match(view, /État des commandes/)
  assert.match(view, /Encaissements et sorties/)
  assert.match(view, /État du stock/)
  assert.match(client, /buildManagerOrderTrend\(orderedOrders/)
  assert.doesNotMatch(client, /dashboardChart.*collection\(/i)
})
