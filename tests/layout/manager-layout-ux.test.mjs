import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"

const root = process.cwd()
const layout = fs.readFileSync(
  path.join(root, "src/app/(manager)/layout.tsx"),
  "utf8"
)
const dashboard = fs.readFileSync(
  path.join(
    root,
    "src/app/(dashboard)/manager/components/ManagerDashboardView.tsx"
  ),
  "utf8"
)

test("le layout Manager desktop ne rend plus de header global", () => {
  assert.doesNotMatch(layout, /<ManagerHeader/)
  assert.doesNotMatch(layout, /function ManagerHeader/)
  assert.match(layout, /<ManagerSidebar \/>[\s\S]*<main/)
})

test("la carte utilisateur contient l'action de déconnexion sans texte redondant", () => {
  assert.match(layout, /aria-label="Déconnexion"/)
  assert.doesNotMatch(layout, /<span>Deconnexion<\/span>/)
  assert.doesNotMatch(layout, />\s*Déconnexion\s*<\/button>/)
})

test("le Dashboard aligne son filtre avec son titre principal", () => {
  assert.match(dashboard, /title="Vue d’ensemble"/)
  assert.match(
    dashboard,
    /actions=\{[\s\S]*<ManagerPeriodFilter \/>/
  )
  assert.doesNotMatch(layout, /GlobalTimeFilterBar/)
})
