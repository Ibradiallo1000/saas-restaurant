import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  appendCashKey,
  formatCashAmount,
  getCashQuickAmounts,
  isCashPaymentValid,
  parseCashAmount,
  removeLastCashDigit,
  sanitizeCashInput,
} from "../../src/components/pos/cash-payment-utils.ts"

const paymentFlowSource = await readFile(
  new URL("../../src/app/(dashboard)/pos/components/POSPaymentFlow.tsx", import.meta.url),
  "utf8"
)
const posClientSource = await readFile(
  new URL("../../src/app/(dashboard)/pos/components/POSClient.tsx", import.meta.url),
  "utf8"
)

test("la sélection Espèces conditionne l'affichage du flux cash", () => {
  assert.match(paymentFlowSource, /paymentMode === "cash"/)
  assert.match(paymentFlowSource, /onPaymentModeChange\("cash"\)/)
})

test("le pavé permet de saisir tactilement 10 000", () => {
  let value = ""
  for (const key of ["1", "0", "000"]) value = appendCashKey(value, key)
  assert.equal(value, "10000")
  assert.equal(formatCashAmount(value), "10 000")
})

test("effacer supprime uniquement le dernier chiffre", () => {
  assert.equal(removeLastCashDigit("10000"), "1000")
})

test("la remise à zéro produit une valeur vide", () => {
  assert.equal("", "")
  assert.match(paymentFlowSource, /onClear=\{\(\) => onCashReceivedChange\(""\)\}/)
})

test("un montant rapide remplace le montant reçu", () => {
  assert.match(paymentFlowSource, /onSelect=\{\(amount\) => onCashReceivedChange\(String\(amount\)\)\}/)
})

test("la monnaie est calculée immédiatement", () => {
  const total = 3_000
  const received = parseCashAmount("10000")
  assert.equal(received - total, 7_000)
})

test("un montant inférieur expose l'insuffisance exacte", () => {
  const difference = parseCashAmount("2000") - 3_000
  assert.equal(Math.abs(difference), 1_000)
  assert.equal(difference < 0, true)
})

test("la confirmation cash est invalide si le montant est insuffisant", () => {
  assert.equal(isCashPaymentValid("2999", 3_000), false)
  assert.match(posClientSource, /cashReceivedAmount < total/)
})

test("la confirmation cash est valide si le montant est suffisant", () => {
  assert.equal(isCashPaymentValid("3000", 3_000), true)
  assert.equal(isCashPaymentValid("10000", 3_000), true)
})

test("le pavé n'est rendu que dans la branche Espèces et Mobile Money garde son composant", () => {
  assert.match(paymentFlowSource, /paymentMode === "cash" \? <div/)
  assert.match(paymentFlowSource, /paymentMode === "mobile" \? mobilePaymentMethods/)
})

test("le verrou existant empêche une double confirmation", () => {
  assert.match(posClientSource, /checkoutLockRef\.current\) return false/)
  assert.match(posClientSource, /checkoutLockRef\.current = true/)
  assert.match(posClientSource, /checkoutLockRef\.current = false/)
})

test("la saisie clavier reste contrôlée et rejette les caractères non numériques", () => {
  assert.equal(sanitizeCashInput("10 000 FCFA"), "10000")
  assert.equal(sanitizeCashInput("-12.5abc"), "125")
  assert.match(paymentFlowSource, /onChange=\{\(event\) => onCashReceivedChange\(sanitizeCashInput/)
  assert.match(paymentFlowSource, /inputMode="numeric"/)
})

test("les montants rapides incluent l'exact, excluent les montants trop bas et évitent les doublons", () => {
  assert.deepEqual(getCashQuickAmounts(3_000), [3_000, 5_000, 10_000, 20_000, 50_000, 100_000])
  assert.deepEqual(getCashQuickAmounts(10_000), [10_000, 20_000, 50_000, 100_000])
  assert.deepEqual(getCashQuickAmounts(120_000), [120_000])
})
