"use client"

import * as React from "react"
import Link from "next/link"
import { collection, query, where } from "firebase/firestore"
import {
  Banknote,
  CreditCard,
  FileText,
  ReceiptText,
  ShoppingCart,
  TrendingDown,
  Users,
  Wallet,
} from "lucide-react"

import { OwnerTimeFilterBar } from "@/app/owner/_components/OwnerTimeFilterBar"
import {
  DashboardEmptyState,
  DashboardErrorState,
  DashboardLoadingState,
  DashboardSection,
  MetricCard,
  MetricGroup,
} from "@/components/dashboard-ui"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/design-system/components"
import { useRestaurant } from "@/design-system/context/RestaurantContext"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { getDateRange, useTimeFilter } from "@/contexts/time-filter-context"
import { COLLECTION_NAMES } from "@/lib/constants"
import {
  buildOwnerExpenseBreakdown,
  buildOwnerExpenseKpis,
  buildOwnerExpenseTrend,
  filterOwnerExpenses,
  ownerExpenseDate,
  ownerExpensePaymentStatusLabel,
  ownerExpenseTypeLabel,
  type OwnerCashMovement,
  type OwnerExpense,
  type OwnerExpenseFilters,
  type OwnerSupplierPayment,
} from "@/modules/owner-expenses/domain/owner-expense-read-model"

type Supplier = {
  id: string
  name?: string
  balance?: number
}

type TreasuryAccount = {
  id: string
  name?: string
}

type StaffMember = {
  id: string
  displayName?: string
  staffName?: string
  name?: string
  email?: string
}

const EMPTY_FILTERS: OwnerExpenseFilters = {
  type: "all",
  paymentStatus: "all",
  supplierId: "",
  category: "",
  paymentAccountId: "",
}

export default function OwnerDepensesPage() {
  const db = useFirestore()
  const { restaurantId, loading: restaurantLoading } = useRestaurant()
  const { filter } = useTimeFilter()
  const range = React.useMemo(() => getDateRange(filter), [filter])
  const [filters, setFilters] =
    React.useState<OwnerExpenseFilters>(EMPTY_FILTERS)

  const periodCollection = React.useCallback(
    (name: string) => {
      if (!db || !restaurantId) return null
      return query(
        collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, name),
        where("createdAt", ">=", range.startDate),
        where("createdAt", "<=", range.endDate)
      )
    },
    [db, range.endDate, range.startDate, restaurantId]
  )
  const restaurantCollection = React.useCallback(
    (name: string) => {
      if (!db || !restaurantId) return null
      return collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, name)
    },
    [db, restaurantId]
  )

  const expenseQuery = useMemoFirebase(
    () => periodCollection(COLLECTION_NAMES.EXPENSES),
    [periodCollection]
  )
  const supplierPaymentQuery = useMemoFirebase(
    () => periodCollection(COLLECTION_NAMES.SUPPLIER_PAYMENTS),
    [periodCollection]
  )
  const cashMovementQuery = useMemoFirebase(
    () => periodCollection(COLLECTION_NAMES.CASH_MOVEMENTS),
    [periodCollection]
  )
  const suppliersQuery = useMemoFirebase(
    () => restaurantCollection(COLLECTION_NAMES.SUPPLIERS),
    [restaurantCollection]
  )
  const accountsQuery = useMemoFirebase(
    () => restaurantCollection(COLLECTION_NAMES.TREASURY_ACCOUNTS),
    [restaurantCollection]
  )
  const staffQuery = useMemoFirebase(
    () => restaurantCollection("staff"),
    [restaurantCollection]
  )

  const expensesResult = useCollection<OwnerExpense>(expenseQuery)
  const paymentsResult =
    useCollection<OwnerSupplierPayment>(supplierPaymentQuery)
  const movementsResult = useCollection<OwnerCashMovement>(cashMovementQuery)
  const suppliersResult = useCollection<Supplier>(suppliersQuery)
  const accountsResult = useCollection<TreasuryAccount>(accountsQuery)
  const staffResult = useCollection<StaffMember>(staffQuery)

  const expenses = React.useMemo(
    () =>
      [...(expensesResult.data || [])].sort(
        (first, second) =>
          dateMs(second.createdAt) - dateMs(first.createdAt)
      ),
    [expensesResult.data]
  )
  const supplierPayments = paymentsResult.data || []
  const suppliers = suppliersResult.data || []
  const accounts = accountsResult.data || []
  const filteredExpenses = React.useMemo(
    () => filterOwnerExpenses(expenses, filters),
    [expenses, filters]
  )
  const kpis = React.useMemo(
    () =>
      buildOwnerExpenseKpis({
        expenses,
        cashMovements: movementsResult.data || [],
        supplierBalances: suppliers.map((supplier) =>
          Number(supplier.balance || 0)
        ),
        supplierPayments,
      }),
    [expenses, movementsResult.data, supplierPayments, suppliers]
  )
  const breakdown = React.useMemo(
    () => buildOwnerExpenseBreakdown(expenses, supplierPayments),
    [expenses, supplierPayments]
  )
  const trend = React.useMemo(
    () => buildOwnerExpenseTrend(expenses, supplierPayments),
    [expenses, supplierPayments]
  )
  const categories = React.useMemo(
    () =>
      [...new Set(expenses.map((expense) => expense.category).filter(Boolean))]
        .map(String)
        .sort((first, second) => first.localeCompare(second, "fr")),
    [expenses]
  )
  const authorNames = React.useMemo(
    () =>
      new Map(
        (staffResult.data || []).map((member) => [
          member.id,
          member.displayName ||
            member.staffName ||
            member.name ||
            member.email?.split("@")[0] ||
            "Utilisateur non résolu",
        ])
      ),
    [staffResult.data]
  )

  const isLoading =
    restaurantLoading ||
    expensesResult.isLoading ||
    paymentsResult.isLoading ||
    movementsResult.isLoading ||
    suppliersResult.isLoading ||
    accountsResult.isLoading ||
    staffResult.isLoading
  const error =
    expensesResult.error ||
    paymentsResult.error ||
    movementsResult.error ||
    suppliersResult.error ||
    accountsResult.error ||
    staffResult.error

  if (isLoading) {
    return (
      <DashboardLoadingState
        className="min-h-[50vh]"
        label="Chargement des dépenses"
      />
    )
  }
  if (!restaurantId) {
    return (
      <DashboardErrorState
        title="Restaurant indisponible"
        description="Aucun restaurant n’est associé à ce compte Owner."
      />
    )
  }

  return (
    <main className="space-y-6 pb-24 md:pb-8">
      <PageHeader
        title="Dépenses"
        subtitle="Analysez les sorties d’argent, les approvisionnements et les dettes du restaurant."
        action={<OwnerTimeFilterBar />}
      />

      {error ? (
        <DashboardErrorState
          title="Données partiellement indisponibles"
          description="Une ou plusieurs sources financières n’ont pas pu être chargées."
        />
      ) : null}

      <MetricGroup className="xl:grid-cols-4">
        <MetricCard
          variant="warning"
          label="Dépenses totales"
          value={formatMoney(kpis.totalExpenses)}
          unit="FCFA"
          description="Montants enregistrés sur la période."
          icon={<ReceiptText />}
        />
        <MetricCard
          variant="finance"
          label="Montant payé"
          value={formatMoney(kpis.paidAmount)}
          unit="FCFA"
          description="Part déjà réglée des dépenses."
          icon={<Wallet />}
        />
        <MetricCard
          variant="warning"
          label="Dette créée"
          value={formatMoney(kpis.debtCreated)}
          unit="FCFA"
          description="Part non réglée créée sur la période."
          icon={<TrendingDown />}
        />
        <MetricCard
          variant="neutral"
          label="Nombre de dépenses"
          value={kpis.expenseCount}
          description="Documents enregistrés sur la période."
          icon={<FileText />}
        />
        <MetricCard
          variant="info"
          label="Dépense moyenne"
          value={formatMoney(kpis.averageExpense)}
          unit="FCFA"
          description="Montant total divisé par le nombre de dépenses."
          icon={<Banknote />}
        />
        <MetricCard
          variant="info"
          label="Impact trésorerie"
          value={formatMoney(kpis.treasuryImpact)}
          unit="FCFA"
          description="Sorties réelles rattachées aux dépenses."
          icon={<CreditCard />}
        />
        <MetricCard
          variant="warning"
          label="Dette fournisseurs actuelle"
          value={formatMoney(kpis.currentSupplierDebt)}
          unit="FCFA"
          description="Somme actuelle des soldes fournisseurs positifs."
          icon={<Users />}
        />
        <MetricCard
          variant="finance"
          label="Paiements fournisseurs"
          value={formatMoney(kpis.supplierPayments)}
          unit="FCFA"
          description="Règlements fournisseurs effectués sur la période."
          icon={<ShoppingCart />}
        />
      </MetricGroup>

      <section className="grid gap-4 xl:grid-cols-2">
        <BreakdownCard breakdown={breakdown} />
        <FinancialDistinction kpis={kpis} />
        <TrendCard trend={trend} />
        <DebtTrendCard trend={trend} />
        <SupplierCard expenses={expenses} />
      </section>

      <DashboardSection
        title="Historique des dépenses"
        description={`${filteredExpenses.length} résultat(s) en lecture seule pour la période sélectionnée.`}
      >
        <ExpenseFilters
          filters={filters}
          onChange={setFilters}
          suppliers={suppliers}
          accounts={accounts}
          categories={categories}
        />
        {filteredExpenses.length === 0 ? (
          <DashboardEmptyState
            title="Aucune dépense"
            description="Aucune dépense ne correspond à la période et aux filtres sélectionnés."
          />
        ) : (
          <ExpenseHistory
            expenses={filteredExpenses}
            authorNames={authorNames}
            accounts={accounts}
          />
        )}
      </DashboardSection>
    </main>
  )
}

function ExpenseFilters({
  accounts,
  categories,
  filters,
  onChange,
  suppliers,
}: {
  accounts: readonly TreasuryAccount[]
  categories: readonly string[]
  filters: OwnerExpenseFilters
  onChange: (filters: OwnerExpenseFilters) => void
  suppliers: readonly Supplier[]
}) {
  const field = (
    key: keyof OwnerExpenseFilters,
    label: string,
    options: Array<{ value: string; label: string }>
  ) => (
    <label className="space-y-1 text-xs font-semibold text-muted-foreground">
      <span>{label}</span>
      <select
        value={filters[key]}
        onChange={(event) =>
          onChange({ ...filters, [key]: event.target.value })
        }
        className="h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )

  return (
    <div className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 xl:grid-cols-5">
      {field("type", "Type", [
        { value: "all", label: "Tous" },
        { value: "supply", label: "Approvisionnements" },
        { value: "salary", label: "Salaires" },
        { value: "other", label: "Dépenses simples" },
      ])}
      {field("paymentStatus", "Statut de paiement", [
        { value: "all", label: "Tous" },
        { value: "paid", label: "Payé" },
        { value: "partial", label: "Partiel" },
        { value: "unpaid", label: "Non payé" },
      ])}
      {field("supplierId", "Fournisseur", [
        { value: "", label: "Tous" },
        ...suppliers.map((supplier) => ({
          value: supplier.id,
          label: supplier.name || "Fournisseur",
        })),
      ])}
      {field("category", "Catégorie", [
        { value: "", label: "Toutes" },
        ...categories.map((category) => ({
          value: category,
          label: categoryLabel(category),
        })),
      ])}
      {field("paymentAccountId", "Source de paiement", [
        { value: "", label: "Toutes" },
        ...accounts.map((account) => ({
          value: account.id,
          label: accountLabel(account),
        })),
      ])}
    </div>
  )
}

function ExpenseHistory({
  accounts,
  authorNames,
  expenses,
}: {
  accounts: readonly TreasuryAccount[]
  authorNames: ReadonlyMap<string, string>
  expenses: readonly OwnerExpense[]
}) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="min-w-[1180px] w-full text-sm">
        <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
          <tr>
            {[
              "Date",
              "Type",
              "Libellé / note",
              "Fournisseur",
              "Montant total",
              "Montant payé",
              "Dette",
              "Statut",
              "Source",
              "Auteur",
              "",
            ].map((label) => (
              <th key={label} className="px-3 py-3 font-semibold">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {expenses.map((expense) => (
            <tr key={expense.id}>
              <td className="whitespace-nowrap px-3 py-3">
                {ownerExpenseDate(expense.createdAt)}
              </td>
              <td className="px-3 py-3 font-semibold">
                {ownerExpenseTypeLabel(expense.type)}
              </td>
              <td className="max-w-56 truncate px-3 py-3">
                {expense.note || expense.category || "Sans libellé"}
              </td>
              <td className="px-3 py-3">
                {expense.supplierName || "Aucun fournisseur"}
              </td>
              <td className="whitespace-nowrap px-3 py-3 font-semibold">
                {formatMoney(expense.amount)} FCFA
              </td>
              <td className="whitespace-nowrap px-3 py-3">
                {formatMoney(expense.paidAmount)} FCFA
              </td>
              <td className="whitespace-nowrap px-3 py-3">
                {formatMoney(expense.debtAmount)} FCFA
              </td>
              <td className="px-3 py-3">
                <Badge variant={expense.paymentStatus === "unpaid" ? "destructive" : "outline"}>
                  {ownerExpensePaymentStatusLabel(expense.paymentStatus)}
                </Badge>
              </td>
              <td className="px-3 py-3">
                {expense.paymentAccountName ||
                  accountLabel(
                    accounts.find(
                      (account) => account.id === expense.paymentAccountId
                    )
                  )}
              </td>
              <td className="px-3 py-3">
                {expense.createdBy
                  ? authorNames.get(expense.createdBy) ||
                    "Utilisateur non résolu"
                  : "Non renseigné"}
              </td>
              <td className="px-3 py-3">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/owner/depenses/${expense.id}`}>Voir détail</Link>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function BreakdownCard({
  breakdown,
}: {
  breakdown: ReturnType<typeof buildOwnerExpenseBreakdown>
}) {
  const maximum = Math.max(1, ...breakdown.map((item) => item.amount))
  return (
    <Card>
      <CardHeader>
        <CardTitle>Répartition par type</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {breakdown.map((item) => (
          <div key={item.id}>
            <div className="flex justify-between gap-3 text-sm">
              <span className="font-semibold">{item.label}</span>
              <span>
                {formatMoney(item.amount)} FCFA · {item.count} opération(s) ·{" "}
                {item.percentage.toFixed(1)} %
              </span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary"
                style={{ width: `${(item.amount / maximum) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function FinancialDistinction({
  kpis,
}: {
  kpis: ReturnType<typeof buildOwnerExpenseKpis>
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lecture financière</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-3">
        <FinancialValue label="Montant total" value={kpis.totalExpenses} />
        <FinancialValue label="Payé" value={kpis.paidAmount} />
        <FinancialValue label="Dette restante créée" value={kpis.debtCreated} />
        <p className="text-sm text-muted-foreground sm:col-span-3">
          Une dépense enregistrée n’est pas nécessairement une sortie immédiate
          de trésorerie. La partie non payée constitue une dette.
        </p>
      </CardContent>
    </Card>
  )
}

function FinancialValue({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-muted/30 p-3">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-black">{formatMoney(value)} FCFA</p>
    </div>
  )
}

function TrendCard({
  trend,
}: {
  trend: ReturnType<typeof buildOwnerExpenseTrend>
}) {
  const maximum = Math.max(1, ...trend.map((point) => point.expenses))
  return (
    <Card>
      <CardHeader>
        <CardTitle>Évolution des dépenses</CardTitle>
      </CardHeader>
      <CardContent>
        {trend.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune donnée sur la période.
          </p>
        ) : (
          <div className="flex min-h-48 items-end gap-2 overflow-x-auto pt-6">
            {trend.map((point) => (
              <div
                key={point.key}
                className="flex min-w-12 flex-1 flex-col items-center gap-2"
                title={`${point.label} : ${formatMoney(point.expenses)} FCFA`}
              >
                <div
                  className="w-full rounded-t-md bg-primary/80"
                  style={{
                    height: `${Math.max(8, (point.expenses / maximum) * 140)}px`,
                  }}
                />
                <span className="text-[10px] text-muted-foreground">
                  {point.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SupplierCard({ expenses }: { expenses: readonly OwnerExpense[] }) {
  const totals = new Map<string, number>()
  expenses.forEach((expense) => {
    const name = expense.supplierName || "Sans fournisseur"
    totals.set(name, (totals.get(name) || 0) + expense.amount)
  })
  const suppliers = [...totals.entries()]
    .sort((first, second) => second[1] - first[1])
    .slice(0, 5)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Principaux fournisseurs</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {suppliers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun fournisseur sur la période.
          </p>
        ) : (
          suppliers.map(([name, amount]) => (
            <div
              key={name}
              className="flex items-center justify-between gap-4 rounded-lg border p-3 text-sm"
            >
              <span className="font-semibold">{name}</span>
              <span className="font-black">{formatMoney(amount)} FCFA</span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function DebtTrendCard({
  trend,
}: {
  trend: ReturnType<typeof buildOwnerExpenseTrend>
}) {
  let cumulative = 0
  const points = trend.map((point) => {
    cumulative += point.debtDelta
    return { ...point, cumulative }
  })
  const maximum = Math.max(
    1,
    ...points.map((point) => Math.abs(point.cumulative))
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Évolution de la dette fournisseur</CardTitle>
      </CardHeader>
      <CardContent>
        {points.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun mouvement de dette sur la période.
          </p>
        ) : (
          <div className="space-y-3">
            {points.map((point) => (
              <div key={point.key}>
                <div className="flex justify-between gap-3 text-xs">
                  <span>{point.label}</span>
                  <span className="font-semibold">
                    {point.cumulative >= 0 ? "+" : ""}
                    {formatMoney(point.cumulative)} FCFA
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-muted">
                  <div
                    className={
                      point.cumulative > 0
                        ? "h-2 rounded-full bg-amber-500"
                        : "h-2 rounded-full bg-emerald-600"
                    }
                    style={{
                      width: `${(Math.abs(point.cumulative) / maximum) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Variation cumulée sur la période : dettes créées moins paiements
              fournisseurs. Ce graphique n’est pas le solde historique absolu.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function accountLabel(account?: TreasuryAccount) {
  if (!account) return "Non renseignée"
  if (account.id === "cash" || account.name === "Cash physique")
    return "Espèces"
  return account.name || account.id
}

function categoryLabel(value: string) {
  if (["supply", "salary", "other"].includes(value))
    return ownerExpenseTypeLabel(value)
  const label = value.replaceAll("_", " ").trim()
  return label ? label.charAt(0).toLocaleUpperCase("fr") + label.slice(1) : "Autre"
}

function formatMoney(value: unknown) {
  const amount = Number(value || 0)
  return Number.isFinite(amount)
    ? Math.round(amount).toLocaleString("fr-FR")
    : "0"
}

function dateMs(value: unknown) {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().getTime()
  }
  const date = new Date(value as string)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}
