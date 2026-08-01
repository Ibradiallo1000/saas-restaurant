import assert from "node:assert/strict"
import test from "node:test"

import {
  calculateCashSessionCloseV2,
  CashSessionCloseValidationError,
} from "../../src/lib/finance/cash-session-close-v2.ts"

const aggregate = (cash = 0, mobile = 0) => ({
  totalCash: cash,
  totalMobile: mobile,
  totalMobileMoney: mobile,
  totalConfirmed: cash + mobile,
  totalPayments: 2,
  totalOrders: 2,
  totalRefunded: 0,
  totalRefunds: 0,
  totalsByProvider: {},
  totalsBySource: { pos: cash + mobile, qr_table: 0, delivery: 0, legacy: 0 },
  statusCounts: { confirmed: 2 },
})

test("le cash théorique inclut le fond initial et exclut le Mobile Money", () => {
  const close = calculateCashSessionCloseV2({
    openingBalance: 10_000,
    countedPhysicalCash: 34_000,
    retainedFloat: 10_000,
    aggregate: aggregate(25_000, 15_000),
  })
  assert.equal(close.expectedPhysicalCash, 35_000)
  assert.equal(close.expectedMobileMoney, 15_000)
  assert.equal(close.cashCountDifference, -1_000)
  assert.equal(close.expectedHandover, 24_000)
})

test("les remboursements cash nets du ledger réduisent le cash théorique", () => {
  const close = calculateCashSessionCloseV2({
    openingBalance: 5_000,
    countedPhysicalCash: 12_000,
    retainedFloat: 5_000,
    aggregate: aggregate(7_000, 3_000),
  })
  assert.equal(close.netCashSales, 7_000)
  assert.equal(close.expectedPhysicalCash, 12_000)
  assert.equal(close.cashCountDifference, 0)
})

test("le versement attendu est le cash compté moins le fond conservé", () => {
  const close = calculateCashSessionCloseV2({
    openingBalance: 0,
    countedPhysicalCash: 20_000,
    retainedFloat: 3_000,
    aggregate: aggregate(19_000, 0),
  })
  assert.equal(close.cashCountDifference, 1_000)
  assert.equal(close.expectedHandover, 17_000)
})

test("un fond conservé supérieur au cash compté est refusé", () => {
  assert.throws(
    () =>
      calculateCashSessionCloseV2({
        openingBalance: 0,
        countedPhysicalCash: 2_000,
        retainedFloat: 3_000,
        aggregate: aggregate(),
      }),
    (error) =>
      error instanceof CashSessionCloseValidationError &&
      error.code === "RETAINED_FLOAT_EXCEEDS_COUNTED_CASH"
  )
})
