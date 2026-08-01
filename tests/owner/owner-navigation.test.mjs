import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import test from "node:test"

const source = (path) =>
  readFileSync(new URL(`../../${path}`, import.meta.url), "utf8")

const ownerNavigation = await import("../../src/config/owner-navigation.ts")

test("toutes les destinations principales du compte Owner existent", () => {
  for (const routeFile of [
    "src/app/owner/page.tsx",
    "src/app/owner/commandes/page.tsx",
    "src/app/owner/caisse/page.tsx",
    "src/app/owner/depenses/page.tsx",
    "src/app/owner/tresorerie/page.tsx",
    "src/app/owner/stock/page.tsx",
    "src/app/owner/stock/articles/page.tsx",
    "src/app/owner/stock/alerts/page.tsx",
    "src/app/owner/stock/movements/page.tsx",
    "src/app/owner/stock/supplies/page.tsx",
    "src/app/owner/stock/suppliers/page.tsx",
    "src/app/owner/avis/page.tsx",
    "src/app/owner/activite/page.tsx",
    "src/app/owner/finances/page.tsx",
    "src/app/(dashboard)/menu/page.tsx",
    "src/app/(dashboard)/tables/page.tsx",
    "src/app/(dashboard)/images/page.tsx",
    "src/app/(dashboard)/settings/page.tsx",
  ]) {
    assert.equal(existsSync(new URL(`../../${routeFile}`, import.meta.url)), true, routeFile)
  }
})

test("la navigation mobile adapte les destinations au rôle Owner", () => {
  const navigation = source("src/components/mobile/operational-navigation.ts")
  const bottomNavigation = source("src/components/mobile/OperationalBottomNav.tsx")

  assert.deepEqual(
    ownerNavigation.OWNER_MOBILE_PRIMARY_ITEMS.map(({ label }) => label),
    ["Accueil", "Activité", "Finances", "Stock"]
  )
  assert.match(bottomNavigation, /<span className="truncate">Plus<\/span>/)
  assert.match(navigation, /if \(role === ROLES\.OWNER\) return getOwnerNavigation\(\)/)
  assert.match(navigation, /href: "\/manager\/commandes"/)
  assert.match(navigation, /href: "\/manager\/caisse"/)
  assert.match(navigation, /href: "\/manager\/tresorerie"/)
  assert.match(navigation, /href: "\/manager\/depenses"/)
  assert.match(bottomNavigation, /preserveOwnerTimeParams/)
})

test("la sidebar Owner est organisée dans les cinq groupes métier attendus", () => {
  assert.deepEqual(
    ownerNavigation.OWNER_SIDEBAR_SECTIONS.map(({ label }) => label),
    ["Vue d’ensemble", "Activité", "Finances", "Stock", "Configuration"]
  )

  const destinations = ownerNavigation.OWNER_SIDEBAR_SECTIONS.flatMap(({ items }) =>
    items.map(({ href }) => href)
  )
  for (const href of [
    "/owner",
    "/owner/commandes",
    "/owner/caisse",
    "/owner/avis",
    "/owner/tresorerie",
    "/owner/depenses",
    "/owner/stock/supplies",
    "/owner/stock/suppliers",
    "/owner/stock",
    "/owner/stock/articles",
    "/owner/stock/alerts",
    "/owner/stock/movements",
    "/menu",
    "/tables",
    "/images",
    "/settings",
  ]) {
    assert.ok(destinations.includes(href), href)
  }
})

test("les états actifs Owner distinguent activité, finances, stock et Plus", () => {
  const cases = {
    "/owner": "home",
    "/owner/commandes": "activity",
    "/owner/avis": "activity",
    "/owner/caisse": "finances",
    "/owner/tresorerie": "finances",
    "/owner/depenses": "finances",
    "/owner/stock/supplies": "finances",
    "/owner/stock/suppliers": "finances",
    "/owner/stock": "stock",
    "/owner/stock/articles": "stock",
    "/owner/stock/alerts": "stock",
    "/owner/stock/movements": "stock",
    "/menu": "more",
    "/settings": "more",
  }

  for (const [pathname, expected] of Object.entries(cases)) {
    assert.equal(ownerNavigation.getOwnerMobileDestination(pathname), expected, pathname)
  }
})

test("le menu Plus Owner ne contient aucune destination Manager", () => {
  const navigation = source("src/components/mobile/operational-navigation.ts")
  const ownerBlock = navigation.slice(
    navigation.indexOf("function getOwnerNavigation"),
    navigation.indexOf("function groupDrawerItems")
  )

  assert.doesNotMatch(ownerBlock, /\/manager\//)
  assert.match(ownerBlock, /Gestion du restaurant/)
  assert.match(ownerBlock, /Déconnexion/)
})

test("les paramètres temporels sont transmis uniquement aux destinations Owner", () => {
  const params = new URLSearchParams("range=30d&start=2026-07-01&end=2026-07-31&status=late")
  assert.equal(
    ownerNavigation.preserveOwnerTimeParams("/owner/finances", params),
    "/owner/finances?range=30d&start=2026-07-01&end=2026-07-31"
  )
  assert.equal(ownerNavigation.preserveOwnerTimeParams("/settings", params), "/settings")
})

test("le Dashboard Owner ne présente aucune action vers Manager, Cuisine ou POS", () => {
  const dashboard = source("src/app/owner/page.tsx")

  assert.doesNotMatch(dashboard, /["'`]\/manager\//)
  assert.doesNotMatch(dashboard, /["'`]\/kitchen(?:[/?"'`])/)
  assert.doesNotMatch(dashboard, /["'`]\/pos(?:[/?"'`])/)
  assert.match(dashboard, /"\/owner\/commandes"/)
  assert.match(dashboard, /"\/owner\/commandes\?status=late"/)
  assert.match(dashboard, /"\/owner\/caisse"/)
  assert.match(dashboard, /"\/owner\/stock\/alerts"/)
  assert.match(dashboard, /label="Cuisine active"/)
})

test("les gardes conservent l'isolation Owner, Manager, POS et Cuisine", () => {
  const guards = source("src/lib/guards.ts")
  const routeGuard = guards.slice(guards.indexOf("export function isRouteAllowedForRole"))
  const ownerStart = routeGuard.indexOf('case "owner"')
  const managerStart = routeGuard.indexOf('case "manager"')
  const cashierStart = routeGuard.indexOf('case "cashier"')
  const kitchenStart = routeGuard.indexOf('case "kitchen"')
  const ownerCase = routeGuard.slice(ownerStart, managerStart)
  const managerCase = routeGuard.slice(managerStart, cashierStart)
  const cashierCase = routeGuard.slice(cashierStart, kitchenStart)
  const kitchenCase = routeGuard.slice(kitchenStart, routeGuard.indexOf("default:", kitchenStart))

  assert.match(ownerCase, /pathname\.startsWith\("\/owner"\)/)
  assert.doesNotMatch(ownerCase, /\/manager|\/pos|\/kitchen/)
  assert.match(managerCase, /pathname\.startsWith\("\/manager\/commandes"\)/)
  assert.match(managerCase, /pathname\.startsWith\("\/manager\/caisse"\)/)
  assert.match(cashierCase, /pathname\.startsWith\("\/pos"\)/)
  assert.match(kitchenCase, /pathname\.startsWith\("\/kitchen"\)/)
})
