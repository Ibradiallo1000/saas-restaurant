import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8")
const owner = read("src/app/owner/caisse/page.tsx")
const manager = read("src/app/(manager)/manager/caisse/page.tsx")
const handovers = read("src/app/(manager)/manager/caisse/CashHandoverReviewPanel.tsx")
const approval = read("src/modules/cash/approve-cash-opening-request.ts")

test("la Caisse Owner ne réutilise plus toute la page Manager", () => {
  assert.doesNotMatch(owner, /import ManagerCaissePage/)
  assert.match(owner, /OwnerCashAlerts/)
  assert.match(owner, /OwnerOpenSessions/)
  assert.match(owner, /OwnerDiscrepancies/)
  assert.match(owner, /OwnerRecentActivity/)
  assert.match(owner, /OwnerCashHistory/)
})

test("le résumé couvre sessions ouvertes, demandes, validations, encaissements et écarts", () => {
  for (const label of [
    "Caisses ouvertes",
    "Ouvertures en attente",
    "Clôtures à valider",
    "Encaissements ouverts",
    "Écarts détectés",
  ]) assert.match(owner, new RegExp(label))
  assert.match(owner, /openSessions\.reduce/)
  assert.match(owner, /openSessions\.length/)
  assert.match(owner, /pendingClosures\.length/)
  assert.match(owner, /discrepancies\.length/)
})

test("les sessions anciennes et incomplètes ont des replis professionnels", () => {
  assert.match(owner, /Utilisateur non identifié/)
  assert.match(owner, /Montant indisponible/)
  assert.match(owner, /Écart indisponible/)
  assert.match(owner, /Statut indisponible/)
  assert.match(owner, /Number\.isFinite/)
  assert.doesNotMatch(owner, /[>"'`](?:cashSession|cashMovement|computedTotal|document Firestore)[<"'`]/)
})

test("les écarts indiquent excédent, manque et conformité sans dépendre de la couleur", () => {
  assert.match(owner, /\(excédent\)/)
  assert.match(owner, /\(manque\)/)
  assert.match(owner, /\(conforme\)/)
  assert.match(owner, /Excédent de \+/)
  assert.match(owner, /Manque de −/)
})

test("l'approbation d'ouverture est confirmée, mono-envoi et partagée avec Manager", () => {
  assert.match(owner, /role === "owner"/)
  assert.match(owner, /window\.confirm/)
  assert.match(owner, /approvingId/)
  assert.match(owner, /disabled=\{Boolean\(approvingId\)\}/)
  assert.match(owner, /Ouverture approuvée/)
  assert.match(owner, /Approbation impossible/)
  assert.match(owner, /approveCashOpeningRequest/)
  assert.match(manager, /approveCashOpeningRequest/)
  assert.doesNotMatch(manager, /runTransaction\(/)
  assert.match(approval, /runTransaction\(/)
})

test("les remises Owner conservent les commandes serveur et ajoutent les confirmations", () => {
  assert.match(owner, /audience="owner"/)
  assert.match(handovers, /reviewCashHandover/)
  assert.match(handovers, /ensureCashHandoverForReview/)
  assert.match(handovers, /window\.confirm/)
  assert.match(handovers, /if \(savingId\) return/)
  assert.match(handovers, /La remise n’a pas été modifiée/)
  assert.match(handovers, /Aucune clôture n’attend votre validation/)
})

test("les opérations de caissier ne sont pas proposées au Owner", () => {
  assert.doesNotMatch(owner, /confirmTableSessionPayment|closeCashSessionV2|Ajouter une dépense|Encaisser et cloturer|addDoc\(|updateDoc\(/)
  assert.match(manager, /confirmTableSessionPayment/)
  assert.match(manager, /Ajouter une dépense/)
})

test("le responsive utilise des cartes mobiles, des grilles tablette et un tableau desktop", () => {
  assert.match(owner, /grid-cols-2 gap-3 p-4 md:grid-cols-3 xl:grid-cols-5/)
  assert.match(owner, /lg:grid-cols-2/)
  assert.match(owner, /space-y-3 lg:hidden/)
  assert.match(owner, /hidden overflow-hidden rounded-xl border lg:block/)
  assert.match(owner, /HISTORY_LIMIT = 20/)
  assert.match(owner, /RECENT_ACTIVITY_LIMIT = 8/)
})

test("les états vides demandés sont présents", () => {
  for (const message of [
    "Aucune caisse n’est ouverte actuellement.",
    "Aucun écart de caisse détecté.",
    "Aucune opération de caisse sur cette période.",
    "Aucune alerte de caisse actuellement.",
  ]) assert.match(owner, new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
})
