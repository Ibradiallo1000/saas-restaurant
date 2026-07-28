import assert from "node:assert/strict"
import test from "node:test"

import {
  buildOwnerExpenseBreakdown,
  buildOwnerExpenseKpis,
  buildOwnerExpenseTrend,
  filterOwnerExpenses,
  ownerExpensePaymentStatusLabel,
  ownerExpenseTypeLabel,
  ownerExpenseUnitLabel,
} from "../../src/modules/owner-expenses/domain/owner-expense-read-model.ts"

const expenses = [
  {
    id: "supply-1",
    type: "supply",
    amount: 100_000,
    paidAmount: 60_000,
    debtAmount: 40_000,
    paymentStatus: "partial",
    supplierId: "supplier-1",
    category: "supply",
    paymentAccountId: "cash",
    createdAt: "2026-07-01T10:00:00.000Z",
  },
  {
    id: "salary-1",
    type: "salary",
    amount: 50_000,
    paidAmount: 50_000,
    debtAmount: 0,
    paymentStatus: "paid",
    supplierId: null,
    category: "salary",
    paymentAccountId: "mobile_money",
    createdAt: "2026-07-02T10:00:00.000Z",
  },
]

const supplierPayments = [
  {
    id: "payment-1",
    amount: 10_000,
    createdAt: "2026-07-03T10:00:00.000Z",
  },
]

test("les KPI distinguent total, payé, dette et sortie réelle", () => {
  const kpis = buildOwnerExpenseKpis({
    expenses,
    supplierPayments,
    supplierBalances: [25_000, -1, 5_000],
    cashMovements: [
      { id: "expense", direction: "out", source: "expense", amount: 110_000 },
      {
        id: "supplier-payment",
        direction: "out",
        source: "supplier_payment",
        amount: 10_000,
      },
    ],
  })

  assert.equal(kpis.totalExpenses, 150_000)
  assert.equal(kpis.paidAmount, 110_000)
  assert.equal(kpis.debtCreated, 40_000)
  assert.equal(kpis.expenseCount, 2)
  assert.equal(kpis.averageExpense, 75_000)
  assert.equal(kpis.treasuryImpact, 110_000)
  assert.equal(kpis.currentSupplierDebt, 30_000)
  assert.equal(kpis.supplierPayments, 10_000)
})

test("la répartition inclut les paiements fournisseurs sans les confondre avec expenses", () => {
  const breakdown = buildOwnerExpenseBreakdown(expenses, supplierPayments)
  assert.deepEqual(
    breakdown.map(({ id, amount, count }) => ({ id, amount, count })),
    [
      { id: "supply", amount: 100_000, count: 1 },
      { id: "salary", amount: 50_000, count: 1 },
      { id: "other", amount: 0, count: 0 },
      { id: "supplier_payment", amount: 10_000, count: 1 },
    ]
  )
  assert.equal(
    Math.round(breakdown.reduce((sum, item) => sum + item.percentage, 0)),
    100
  )
})

test("les filtres secondaires se combinent", () => {
  assert.deepEqual(
    filterOwnerExpenses(expenses, {
      type: "supply",
      paymentStatus: "partial",
      supplierId: "supplier-1",
      category: "supply",
      paymentAccountId: "cash",
    }).map((expense) => expense.id),
    ["supply-1"]
  )
})

test("la tendance de dette retranche les paiements fournisseurs", () => {
  const trend = buildOwnerExpenseTrend(expenses, supplierPayments)
  assert.deepEqual(
    trend.map(({ key, expenses: amount, debtDelta }) => ({
      key,
      amount,
      debtDelta,
    })),
    [
      { key: "2026-07-01", amount: 100_000, debtDelta: 40_000 },
      { key: "2026-07-02", amount: 50_000, debtDelta: 0 },
      { key: "2026-07-03", amount: 0, debtDelta: -10_000 },
    ]
  )
})

test("les libellés et unités ne montrent aucune valeur technique", () => {
  assert.equal(ownerExpenseTypeLabel("supply"), "Approvisionnement")
  assert.equal(ownerExpenseTypeLabel("salary"), "Salaire")
  assert.equal(ownerExpensePaymentStatusLabel("partial"), "Partiel")
  assert.equal(ownerExpenseUnitLabel("unit", 2), "pièces")
  assert.equal(ownerExpenseUnitLabel("l", 1), "litre")
})
