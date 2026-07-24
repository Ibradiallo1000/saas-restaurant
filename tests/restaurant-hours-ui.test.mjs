import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

test("owner expose une section Horaires dans la configuration", () => {
  const viewModel = readFileSync("src/app/(dashboard)/settings/components/restaurant-settings-view-model.ts", "utf8")
  const view = readFileSync("src/app/(dashboard)/settings/components/RestaurantSettingsView.tsx", "utf8")
  assert.match(viewModel, /id: "hours", label: "Horaires"/)
  assert.match(view, /model\.activeTab === "hours"/)
  assert.match(view, /RestaurantHoursSettings/)
})

test("manager expose la route Horaires et l'autorise avant Fournisseurs", () => {
  const layout = readFileSync("src/app/(manager)/layout.tsx", "utf8")
  const guards = readFileSync("src/lib/guards.ts", "utf8")
  const hoursIndex = layout.indexOf('href: "/manager/hours"')
  const suppliersIndex = layout.indexOf('href: "/manager/suppliers"')
  assert.ok(hoursIndex > -1)
  assert.ok(suppliersIndex > -1)
  assert.ok(hoursIndex < suppliersIndex)
  assert.match(guards, /pathname\.startsWith\("\/manager\/hours"\)/)
})
