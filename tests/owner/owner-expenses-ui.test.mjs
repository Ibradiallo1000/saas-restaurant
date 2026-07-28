import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"

const root = process.cwd()
const list = fs.readFileSync(
  path.join(root, "src/app/owner/depenses/page.tsx"),
  "utf8"
)
const detail = fs.readFileSync(
  path.join(root, "src/app/owner/depenses/[expenseId]/page.tsx"),
  "utf8"
)

test("la page Owner n'est plus un placeholder et ne redirige jamais vers Manager", () => {
  assert.doesNotMatch(list, /Vue filtrée prête|Ouvrir la page opérationnelle/)
  assert.doesNotMatch(list + detail, /\/manager\/depenses|SupplyExpenseService/)
  assert.match(list, /OwnerTimeFilterBar/)
})

test("la page expose les huit KPI et les filtres demandés", () => {
  for (const label of [
    "Dépenses totales",
    "Montant payé",
    "Dette créée",
    "Nombre de dépenses",
    "Dépense moyenne",
    "Impact trésorerie",
    "Dette fournisseurs actuelle",
    "Paiements fournisseurs",
    "Statut de paiement",
    "Source de paiement",
  ]) {
    assert.match(list, new RegExp(label))
  }
})

test("l'historique est en lecture seule et responsive", () => {
  assert.match(list, /overflow-x-auto/)
  assert.match(list, /Voir détail/)
  assert.doesNotMatch(list, /createExpense|updateDoc|deleteDoc|Ajouter une dépense/)
})

test("le détail affiche approvisionnement, trésorerie, stock et retour Owner", () => {
  assert.match(detail, /← Retour aux dépenses/)
  assert.match(detail, /Articles approvisionnés/)
  assert.match(detail, /Mouvement de trésorerie/)
  assert.match(detail, /Mouvements de stock liés/)
  assert.match(detail, /Coût unitaire/)
  assert.match(detail, /ownerExpenseUnitLabel/)
  assert.doesNotMatch(detail, /updateDoc|deleteDoc|SupplyExpenseService/)
})
