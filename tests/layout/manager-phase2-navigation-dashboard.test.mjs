import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), "utf8")
const layout = read("src/app/(manager)/layout.tsx")
const config = read("src/config/navigation.config.ts")
const mobile = read("src/components/mobile/operational-navigation.ts")
const mobileHeader = read("src/components/mobile/OperationalMobileHeader.tsx")
const mobileBottomNav = read("src/components/mobile/OperationalBottomNav.tsx")
const dashboard = read("src/app/(dashboard)/manager/components/ManagerDashboardView.tsx")
const client = read("src/app/(dashboard)/manager/components/ManagerClient.tsx")
const caisse = read("src/app/(manager)/manager/caisse/page.tsx")
const handovers = read("src/app/(manager)/manager/caisse/CashHandoverReviewPanel.tsx")

test("la navigation Manager est groupée, canonique et compacte sur tablette", () => {
  for (const label of ["Vue d’ensemble", "Opérations", "Finances", "Stock", "Équipe", "Configuration", "Médias"]) assert.match(layout, new RegExp(label))
  assert.match(layout, /\/manager\/depenses/)
  assert.match(layout, /\/manager\/tresorerie/)
  assert.match(layout, /w-\[68px\]/)
  assert.doesNotMatch(layout, /href: "\/manager\/settings"/)
})

test("la bottom navigation Manager expose les cinq destinations et le menu Plus attendu", () => {
  assert.match(config, /bottomNav: \["analytics", "commandes", "caisse", "stock", "plus"\]/)
  assert.match(config, /drawer: \["tables", "depenses", "tresorerie", "fournisseurs", "horaires", "menu", "images", "profil", "deconnexion"\]/)
  assert.match(mobile, /stock: \{ id: "stock", label: "Stock", href: "\/manager\/stock"/)
  assert.match(mobile, /analytics: \{ id: "analytics", label: "Accueil"/)
  assert.match(mobile, /images: \{ type: "link", id: "images", label: "Médias"/)
  assert.doesNotMatch(config, /drawer: \[[^\]]*"settings"/)
})

test("le Manager utilise Plus comme unique navigation secondaire mobile", () => {
  assert.match(mobileHeader, /role !== ROLES\.MANAGER \? <Sheet>/)
  assert.match(mobileBottomNav, /section\.label === "Compte"/)
  assert.match(mobileBottomNav, /aria-label="Se déconnecter"/)
  assert.match(mobileBottomNav, /<TooltipContent side="top">Se déconnecter<\/TooltipContent>/)
  assert.match(mobileBottomNav, /· Manager/)
  const grouping = mobile.slice(mobile.indexOf("function groupDrawerItems"))
  assert.ok(grouping.indexOf('{ label: "Configuration"') < grouping.indexOf('{ label: "Compte"'))
  assert.match(mobileBottomNav, /setOpen\(false\)[\s\S]*await signOut\(auth\)/)
  assert.match(mobileBottomNav, /<SheetClose key=\{item\.id\} asChild>/)
})

test("le Dashboard Manager respecte la hiérarchie opérationnelle et ses données existantes", () => {
  const titles = ["Alertes critiques", "Situation immédiate", "Actions rapides", "Suivi opérationnel", "ManagerFinancialWidget financialSummary", "Informations secondaires"]
  let cursor = -1
  for (const title of titles) {
    const index = dashboard.indexOf(title)
    assert.ok(index > cursor, `${title} doit apparaître dans l’ordre prévu`)
    cursor = index
  }
  assert.match(dashboard, /openCashSessions\.length/)
  assert.match(dashboard, /tableSummary\.occupied/)
  assert.match(dashboard, /Cuisine et tables/)
  assert.match(dashboard, /pas présentés comme du chiffre d’affaires/)
  assert.match(client, /getRestaurantOpenStatus/)
  assert.match(client, /cashSessions\.filter/)
})

test("les actions sensibles sont confirmées, bloquées en double et le filtre paiements cible sa section", () => {
  assert.match(caisse, /Confirmer le paiement de cette table/)
  assert.match(caisse, /Approuver cette ouverture de caisse/)
  assert.match(caisse, /processingOrderId\) return/)
  assert.match(caisse, /activatingRequestId\) return/)
  assert.match(caisse, /ref=\{paymentsRef\}/)
  assert.match(handovers, /Valider cette remise de caisse/)
  assert.match(handovers, /Écart :/)
  assert.match(handovers, /if \(savingId\) return/)
})
