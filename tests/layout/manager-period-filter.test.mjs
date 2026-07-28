import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"

const root = process.cwd()
const source = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8")

const filter = source("src/components/layout/manager-period-filter.tsx")
const layout = source("src/app/(manager)/layout.tsx")

test("la configuration centralise exclusivement les routes Manager temporelles", () => {
  for (const route of [
    "/manager/dashboard",
    "/manager/commandes",
    "/manager/caisse",
    "/manager/tresorerie",
    "/manager/depenses",
    "/manager/inventory",
    "/manager/stock",
  ]) {
    assert.match(filter, new RegExp(`"${route}"`))
  }

  for (const route of [
    "/manager/menu",
    "/manager/tables",
    "/manager/images",
    "/manager/hours",
    "/manager/suppliers",
  ]) {
    assert.doesNotMatch(filter, new RegExp(`"${route}"`))
  }
})

test("le layout n'injecte plus aucune barre de période au-dessus des pages", () => {
  assert.doesNotMatch(layout, /GlobalTimeFilterBar|ManagerPeriodFilter/)
})

test("les six en-têtes temporels utilisent le même composant partagé", () => {
  for (const file of [
    "src/app/(dashboard)/manager/components/ManagerDashboardView.tsx",
    "src/app/(dashboard)/manager/components/ManagerOrdersView.tsx",
    "src/app/(manager)/manager/caisse/page.tsx",
    "src/app/(manager)/manager/treasury/ManagerReportsView.tsx",
    "src/app/(manager)/manager/expenses/page.tsx",
    "src/modules/stock/articles/ui/ArticleReferentialScreen.tsx",
  ]) {
    assert.match(source(file), /<ManagerPeriodFilter \/>/)
  }
})

test("le filtre partagé prévoit le défilement horizontal mobile", () => {
  assert.match(filter, /overflow-x-auto/)
  assert.match(
    source("src/components/time-filter/GlobalTimeFilterBar.tsx"),
    /shrink-0/
  )
})
