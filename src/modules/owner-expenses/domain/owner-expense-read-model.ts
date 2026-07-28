export type OwnerExpenseType = "supply" | "salary" | "other"
export type OwnerExpensePaymentStatus = "paid" | "partial" | "unpaid"

export type OwnerExpense = {
  id: string
  type: OwnerExpenseType
  amount: number
  paidAmount: number
  debtAmount: number
  paymentStatus: OwnerExpensePaymentStatus
  paymentAccountId?: string | null
  paymentAccountName?: string | null
  supplierId?: string | null
  supplierName?: string | null
  category?: string | null
  note?: string | null
  items?: OwnerExpenseItem[]
  cashMovementId?: string | null
  createdBy?: string | null
  createdAt?: unknown
  updatedAt?: unknown
  validated?: boolean
}

export type OwnerExpenseItem = {
  articleId: string
  articleName?: string | null
  quantity: number
  unitCost: number
  lineTotal?: number
}

export type OwnerSupplierPayment = {
  id: string
  supplierId?: string | null
  supplierName?: string | null
  amount: number
  paymentAccountId?: string | null
  paymentAccountName?: string | null
  createdAt?: unknown
  createdBy?: string | null
}

export type OwnerCashMovement = {
  id: string
  type?: string
  direction?: string
  source?: string
  amount?: number
  expenseId?: string | null
  createdAt?: unknown
}

export type OwnerExpenseFilters = {
  type: "all" | OwnerExpenseType
  paymentStatus: "all" | OwnerExpensePaymentStatus
  supplierId: string
  category: string
  paymentAccountId: string
}

export type OwnerExpenseKpis = {
  totalExpenses: number
  paidAmount: number
  debtCreated: number
  expenseCount: number
  averageExpense: number
  treasuryImpact: number
  currentSupplierDebt: number
  supplierPayments: number
}

export type OwnerExpenseBreakdown = {
  id: OwnerExpenseType | "supplier_payment"
  label: string
  amount: number
  count: number
  percentage: number
}

export type OwnerExpenseTrendPoint = {
  key: string
  label: string
  expenses: number
  debtDelta: number
}

export function buildOwnerExpenseKpis(input: {
  expenses: readonly OwnerExpense[]
  cashMovements: readonly OwnerCashMovement[]
  supplierBalances: readonly number[]
  supplierPayments: readonly OwnerSupplierPayment[]
}): OwnerExpenseKpis {
  const totalExpenses = sum(input.expenses.map((expense) => expense.amount))
  const paidAmount = sum(input.expenses.map((expense) => expense.paidAmount))
  const debtCreated = sum(input.expenses.map((expense) => expense.debtAmount))
  const expenseCount = input.expenses.length
  const treasuryImpact = sum(
    input.cashMovements
      .filter(
        (movement) =>
          movement.direction === "out" &&
          (movement.source === "expense" || Boolean(movement.expenseId))
      )
      .map((movement) => Number(movement.amount || 0))
  )
  const supplierPayments = sum(
    input.supplierPayments.map((payment) => payment.amount)
  )

  return {
    totalExpenses,
    paidAmount,
    debtCreated,
    expenseCount,
    averageExpense: expenseCount > 0 ? totalExpenses / expenseCount : 0,
    treasuryImpact,
    currentSupplierDebt: sum(
      input.supplierBalances.map((balance) => Math.max(0, balance))
    ),
    supplierPayments,
  }
}

export function buildOwnerExpenseBreakdown(
  expenses: readonly OwnerExpense[],
  supplierPayments: readonly OwnerSupplierPayment[]
): OwnerExpenseBreakdown[] {
  const definitions: Array<{
    id: OwnerExpenseBreakdown["id"]
    label: string
  }> = [
    { id: "supply", label: "Approvisionnements" },
    { id: "salary", label: "Salaires" },
    { id: "other", label: "Dépenses simples" },
    { id: "supplier_payment", label: "Paiements fournisseurs" },
  ]
  const supplierPaymentAmount = sum(
    supplierPayments.map((payment) => payment.amount)
  )
  const denominator =
    sum(expenses.map((expense) => expense.amount)) + supplierPaymentAmount

  return definitions.map(({ id, label }) => {
    const matchingExpenses =
      id === "supplier_payment"
        ? []
        : expenses.filter((expense) => expense.type === id)
    const amount =
      id === "supplier_payment"
        ? supplierPaymentAmount
        : sum(matchingExpenses.map((expense) => expense.amount))
    const count =
      id === "supplier_payment"
        ? supplierPayments.length
        : matchingExpenses.length

    return {
      id,
      label,
      amount,
      count,
      percentage: denominator > 0 ? (amount / denominator) * 100 : 0,
    }
  })
}

export function filterOwnerExpenses(
  expenses: readonly OwnerExpense[],
  filters: OwnerExpenseFilters
) {
  return expenses.filter((expense) => {
    if (filters.type !== "all" && expense.type !== filters.type) return false
    if (
      filters.paymentStatus !== "all" &&
      expense.paymentStatus !== filters.paymentStatus
    )
      return false
    if (filters.supplierId && expense.supplierId !== filters.supplierId)
      return false
    if (filters.category && expense.category !== filters.category) return false
    if (
      filters.paymentAccountId &&
      expense.paymentAccountId !== filters.paymentAccountId
    )
      return false
    return true
  })
}

export function buildOwnerExpenseTrend(
  expenses: readonly OwnerExpense[],
  supplierPayments: readonly OwnerSupplierPayment[]
): OwnerExpenseTrendPoint[] {
  const buckets = new Map<string, OwnerExpenseTrendPoint>()
  const bucket = (value: unknown) => {
    const date = toDate(value)
    if (!date) return null
    const key = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-")
    const existing = buckets.get(key)
    if (existing) return existing
    const created = {
      key,
      label: date.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
      }),
      expenses: 0,
      debtDelta: 0,
    }
    buckets.set(key, created)
    return created
  }

  expenses.forEach((expense) => {
    const point = bucket(expense.createdAt)
    if (!point) return
    point.expenses += expense.amount
    point.debtDelta += expense.debtAmount
  })
  supplierPayments.forEach((payment) => {
    const point = bucket(payment.createdAt)
    if (!point) return
    point.debtDelta -= payment.amount
  })

  return [...buckets.values()].sort((first, second) =>
    first.key.localeCompare(second.key)
  )
}

export function ownerExpenseTypeLabel(value: string) {
  if (value === "supply") return "Approvisionnement"
  if (value === "salary") return "Salaire"
  if (value === "other") return "Dépense simple"
  if (value === "supplier_payment") return "Paiement fournisseur"
  return "Dépense"
}

export function ownerExpensePaymentStatusLabel(value: string) {
  if (value === "paid") return "Payé"
  if (value === "partial") return "Partiel"
  if (value === "unpaid") return "Non payé"
  return "Non renseigné"
}

export function ownerExpenseUnitLabel(unit: string, quantity: number) {
  if (unit === "unit") return quantity === 1 ? "pièce" : "pièces"
  if (unit === "l") return quantity === 1 ? "litre" : "litres"
  if (unit === "kg" || unit === "g" || unit === "ml") return unit
  return unit || "unité"
}

export function ownerExpenseDate(value: unknown) {
  const date = toDate(value)
  return date ? date.toLocaleString("fr-FR") : "Date indisponible"
}

export function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate()
  }
  if (
    value &&
    typeof value === "object" &&
    "seconds" in value &&
    typeof (value as { seconds?: unknown }).seconds === "number"
  ) {
    return new Date((value as { seconds: number }).seconds * 1000)
  }
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  return null
}

function sum(values: readonly number[]) {
  return values.reduce(
    (total, value) => total + (Number.isFinite(value) ? value : 0),
    0
  )
}
