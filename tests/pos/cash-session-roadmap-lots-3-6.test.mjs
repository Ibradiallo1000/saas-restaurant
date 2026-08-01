import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8")
const [rules, canonicalPage, aliasPage, managerPage, handoverPanel, sidebar, appSidebar, reconcile, inventory] =
  await Promise.all([
    read("firestore.rules"),
    read("src/app/(dashboard)/pos/sessions/page.tsx"),
    read("src/app/(dashboard)/pos/session/page.tsx"),
    read("src/app/(manager)/manager/caisse/page.tsx"),
    read("src/app/(manager)/manager/caisse/CashHandoverReviewPanel.tsx"),
    read("src/components/layout/Sidebar.tsx"),
    read("src/components/layout/app-sidebar.tsx"),
    read("scripts/cash-session-v2-reconcile.mjs"),
    read("scripts/cash-session-legacy-inventory.mjs"),
  ])

test("la route plurielle est canonique et l'ancien singulier redirige", () => {
  assert.match(canonicalPage, /submitCashHandover/)
  assert.match(aliasPage, /redirect\("\/pos\/sessions"\)/)
  assert.match(sidebar, /href: "\/pos\/sessions"/)
  assert.match(appSidebar, /href: "\/pos\/sessions"/)
})

test("la validation manager active passe par les remises et non TreasuryService", () => {
  assert.match(managerPage, /CashHandoverReviewPanel/)
  assert.doesNotMatch(managerPage, /postCashSessionMovementToTreasury\(/)
})

test("l'écran manager distingue une session clôturée d'une remise soumise", () => {
  assert.match(managerPage, /Sessions clôturées à régulariser/)
  assert.match(handoverPanel, /remise à soumettre par le caissier/)
  assert.match(handoverPanel, /Impossible de charger les remises/)
  assert.match(handoverPanel, /handoversError/)
  assert.match(handoverPanel, /Ventes espèces/)
  assert.match(handoverPanel, /Mobile Money/)
  assert.match(handoverPanel, /Fond conservé/)
  assert.match(handoverPanel, /aucune remise physique/)
  assert.match(handoverPanel, /Valider la réception/)
  assert.match(handoverPanel, /ensureCashHandoverForReview/)
  assert.match(handoverPanel, /decision: "under_review"/)
  assert.match(handoverPanel, /decision: "validated"/)
})

test("les écritures client de payments, handovers et sessions legacy sont gelées", () => {
  assert.match(rules, /match \/cashHandovers\/\{handoverId\}[\s\S]*allow create, update, delete: if false/)
  assert.match(rules, /match \/payments\/\{paymentId\}[\s\S]*allow create, update: if false/)
  assert.match(rules, /match \/cashierSessions\/\{sessionId\}[\s\S]*allow create, update, delete: if false/)
  assert.match(rules, /request\.resource\.data\.source != "session"/)
})

test("les outils de migration sont dry-run et protégés", () => {
  assert.match(reconcile, /const write = args\.write === "true"/)
  assert.match(reconcile, /--confirm=RECONCILE_CASH_SESSIONS/)
  assert.match(inventory, /deletable: \[\]/)
  assert.doesNotMatch(inventory, /\.delete\(/)
})
