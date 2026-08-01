import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"

const root = process.cwd()
const source = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8")

test("PageHeader porte le standard visuel unique et responsive", () => {
  const header = source("src/design-system/components/PageHeader.tsx")

  assert.match(header, /text-xl font-bold/)
  assert.match(header, /min-\[390px\]:text-2xl md:text-\[1\.75rem\]/)
  assert.doesNotMatch(header, /font-black uppercase leading-none/)
  assert.match(header, /h-6 w-6/)
  assert.match(header, /sm:flex-row sm:items-start sm:justify-between/)
  assert.match(header, /action/)
  assert.match(header, /subtitle/)
  assert.match(header, /breadcrumb/)
  assert.match(header, /density/)
  assert.match(header, /resolvePageIcon/)
})

test("les wrappers Dashboard, Rapports et Plateforme héritent du même PageHeader", () => {
  const dashboardLayout = source(
    "src/components/dashboard-ui/dashboard-layout.tsx"
  )
  const reportsLayout = source(
    "src/components/reports-ui/reports-layout.tsx"
  )
  const platformLayout = source(
    "src/components/platform-ui/platform-layout.tsx"
  )

  assert.match(dashboardLayout, /import \{ PageHeader \}/)
  assert.match(dashboardLayout, /<PageHeader/)
  assert.match(reportsLayout, /<DashboardHeader/)
  assert.match(platformLayout, /<DashboardHeader/)
})

test("les exceptions Manager, Owner et Admin utilisent le composant partagé", () => {
  for (const file of [
    "src/app/(dashboard)/dashboard/tables/page.tsx",
    "src/app/(dashboard)/manager/components/ManagerClient.tsx",
    "src/app/(manager)/manager/expenses/page.tsx",
    "src/app/(manager)/manager/suppliers/page.tsx",
    "src/app/(manager)/manager/hours/page.tsx",
    "src/app/owner/_components/OwnerSectionPage.tsx",
    "src/app/owner/stock/page.tsx",
    "src/modules/stock/owner/ui/OwnerStockDetailScreen.tsx",
    "src/components/admin/AdminDashboardPage.tsx",
    "src/components/admin/AdminRequestsPage.tsx",
    "src/components/admin/AdminRestaurantsPage.tsx",
    "src/components/admin/AdminSubscriptionsPage.tsx",
  ]) {
    assert.match(source(file), /PageHeader/)
  }
})

test("aucun écran ciblé ne code encore directement un h1", () => {
  const files = [
    ...walk("src/app/(manager)"),
    ...walk("src/app/(dashboard)/manager"),
    ...walk("src/app/owner"),
    ...walk("src/app/platform"),
    ...walk("src/components/admin"),
    ...walk("src/modules/stock"),
  ]

  for (const file of files.filter((entry) => entry.endsWith(".tsx"))) {
    assert.doesNotMatch(source(file), /<h1(?:\s|>)/, file)
  }
})

function walk(relativeDirectory) {
  const absoluteDirectory = path.join(root, relativeDirectory)
  return fs.readdirSync(absoluteDirectory, { withFileTypes: true }).flatMap(
    (entry) => {
      const relativePath = path.join(relativeDirectory, entry.name)
      return entry.isDirectory() ? walk(relativePath) : [relativePath]
    }
  )
}
