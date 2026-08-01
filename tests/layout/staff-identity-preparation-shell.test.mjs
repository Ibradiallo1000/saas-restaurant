import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"

import { resolveStaffDisplayName, resolveStaffRoleLabel } from "../../src/lib/staff-identity.ts"

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), "utf8")

test("l’identité privilégie la fiche Personnel puis Firebase puis l’e-mail", () => {
  const firebaseUser = { displayName: "Nom Firebase", email: "cuisine01@example.com" }
  assert.equal(resolveStaffDisplayName({ nomComplet: "Idrissa Traoré" }, firebaseUser), "Idrissa Traoré")
  assert.equal(resolveStaffDisplayName(null, firebaseUser), "Nom Firebase")
  assert.equal(resolveStaffDisplayName(null, { displayName: "", email: "cuisine01@example.com" }), "cuisine01@example.com")
  assert.equal(resolveStaffRoleLabel("kitchen"), "Chef de cuisine")
})

test("le profil Personnel est chargé une fois dans le contexte partagé", () => {
  const tenant = read("src/design-system/context/TenantProvider.tsx")
  assert.match(tenant, /"staff", uid/)
  assert.match(tenant, /staffProfile/)
  assert.doesNotMatch(tenant, /onSnapshot/)
})

test("Préparation est plein écran et place le poste dans le header", () => {
  const shell = read("src/components/layout/protected-app-shell.tsx")
  const preparation = read("src/app/(dashboard)/preparation/PreparationClient.tsx")
  const board = read("src/modules/kitchen/KitchenBoard.tsx")
  assert.match(shell, /startsWith\("\/preparation"\)/)
  assert.match(preparation, /stationSelector/)
  assert.match(board, /subtitle=\{stationName\}/)
  assert.match(board, /resolveStaffDisplayName/)
  for (const label of ["Commandes", "Disponibilités", "En attente", "En préparation", "Prêtes"]) assert.match(board, new RegExp(label))
})

test("les zones de compte partagent la même résolution d’identité", () => {
  for (const file of [
    "src/components/layout/app-sidebar.tsx",
    "src/components/mobile/OperationalMobileHeader.tsx",
    "src/components/mobile/OperationalBottomNav.tsx",
    "src/app/(dashboard)/pos/components/POSClient.tsx",
    "src/modules/kitchen/KitchenBoard.tsx",
  ]) assert.match(read(file), /resolveStaffDisplayName/)
})
