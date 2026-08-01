import assert from "node:assert/strict"
import test from "node:test"

import {
  CashHandoverValidationError,
  cleanHandoverNote,
  normalizeHandoverAmount,
} from "../../src/lib/finance/cash-handover-domain.ts"

test("les montants de remise sont entiers, positifs ou nuls", () => {
  assert.equal(normalizeHandoverAmount("12000.4", "amount"), 12000)
  assert.throws(
    () => normalizeHandoverAmount(-1, "amount"),
    (error) => error instanceof CashHandoverValidationError
  )
})

test("les notes sont bornées et le HTML est neutralisé", () => {
  assert.equal(cleanHandoverNote("<script>alert(1)</script> Remise"), "alert(1) Remise")
  assert.equal(cleanHandoverNote("x".repeat(700))?.length, 500)
})

test("une correction ou un rejet exige une note", () => {
  assert.throws(
    () => cleanHandoverNote(" ", true),
    (error) => error.code === "HANDOVER_NOTE_REQUIRED"
  )
})
