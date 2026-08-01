"use client"

import * as React from "react"
import { collection } from "firebase/firestore"
import { AlertTriangle, PackageOpen } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import { BackLink, PageHeader, SectionNavigation } from "@/design-system/components"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useTenant } from "@/design-system/context/TenantProvider"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import {
  stockTrackingModeLabel,
  stockUnitLabel,
} from "@/modules/stock/shared/inventory-referential"
import { useInventoryReferential } from "@/modules/stock/shared/use-inventory-referential"

type DetailMode = "articles" | "alerts" | "movements" | "supplies" | "suppliers"

const STOCK_NAVIGATION = [
  { label: "Synthèse", href: "/owner/stock" },
  { label: "Articles", href: "/owner/stock/articles", matchQuery: { key: "view" } },
  { label: "Valeur", href: "/owner/stock/articles?view=value", matchQuery: { key: "view", value: "value" } },
  { label: "Alertes", href: "/owner/stock/alerts" },
  { label: "Mouvements", href: "/owner/stock/movements" },
  { label: "Achats", href: "/owner/stock/supplies" },
  { label: "Fournisseurs", href: "/owner/stock/suppliers" },
]

export function OwnerStockDetailScreen({
  mode,
  valueBreakdown = false,
}: {
  mode: DetailMode
  valueBreakdown?: boolean
}) {
  const db = useFirestore()
  const { restaurantId } = useTenant()
  const {
    activeArticles,
    balances,
    costs,
    operations,
    isLoading,
    error,
  } = useInventoryReferential(restaurantId, {
    includeCosts: true,
    includeOperations: mode === "movements",
  })
  const queryCollection = React.useCallback((name: string) => {
    if (!db || !restaurantId) return null
    return collection(db, "restaurants", restaurantId, name)
  }, [db, restaurantId])
  const supplierQuery = useMemoFirebase(
    () => mode === "suppliers" ? queryCollection("suppliers") : null,
    [mode, queryCollection]
  )
  const expenseQuery = useMemoFirebase(
    () => mode === "supplies" ? queryCollection("expenses") : null,
    [mode, queryCollection]
  )
  const supplierResult = useCollection<any>(supplierQuery)
  const expenseResult = useCollection<any>(expenseQuery)

  if (
    isLoading
    || (mode === "suppliers" && supplierResult.isLoading)
    || (mode === "supplies" && expenseResult.isLoading)
  ) {
    return <OwnerStockDetailSkeleton />
  }

  const quantities = new Map(
    balances.map((balance) => [
      String(balance.articleId || balance.id),
      Number(balance.quantity || 0),
    ])
  )
  const referenceCosts = new Map(
    costs.map((cost) => [
      String(cost.articleId || cost.id),
      Number(cost.referenceCost || 0),
    ])
  )
  const articleNames = new Map(activeArticles.map((article) => [article.id, article.name]))
  const rows = activeArticles
    .filter((article) => article.trackingMode !== "NONE")
    .map((article) => {
      const quantity = quantities.get(article.id) ?? 0
      const cost = referenceCosts.get(article.id) ?? 0
      return {
        article,
        quantity,
        cost,
        value: quantity * cost,
        health: stockHealth(
          quantity,
          Number(article.lowStockThreshold || 0),
          Number(article.outOfStockThreshold || 0)
        ),
      }
    })
  const criticalRows = rows.filter((row) => row.health !== "OK")
  const errors = error || supplierResult.error || expenseResult.error

  return (
    <main className="space-y-5 pb-24 md:space-y-6 md:pb-8">
      <PageHeader
        title={titleFor(mode, valueBreakdown)}
        density="compact"
        back={<BackLink href="/owner/stock" label="Stock" />}
      />
      <SectionNavigation parentHref="/owner/stock" parentLabel="Stock" items={STOCK_NAVIGATION} showBack={false} />

      {errors ? (
        <Card className="border-destructive">
          <CardContent className="p-4 text-sm text-destructive">
            Chargement impossible. Vérifiez les autorisations de lecture du restaurant.
          </CardContent>
        </Card>
      ) : null}

      {mode === "articles" ? (
        <ArticleRows rows={rows} valueBreakdown={valueBreakdown} />
      ) : null}
      {mode === "alerts" ? <ArticleRows rows={criticalRows} alertsOnly /> : null}
      {mode === "movements" ? (
        <MovementRows operations={operations} articleNames={articleNames} />
      ) : null}
      {mode === "supplies" ? <SupplyRows expenses={expenseResult.data || []} /> : null}
      {mode === "suppliers" ? <SupplierRows suppliers={supplierResult.data || []} /> : null}
    </main>
  )
}

function ArticleRows({
  rows,
  valueBreakdown = false,
  alertsOnly = false,
}: {
  rows: Array<{
    article: any
    quantity: number
    cost: number
    value: number
    health: "OUT" | "LOW" | "OK"
  }>
  valueBreakdown?: boolean
  alertsOnly?: boolean
}) {
  if (rows.length === 0) {
    return <Empty text={alertsOnly ? "Aucune alerte de stock." : "Aucun article suivi."} />
  }
  return (
    <section className="grid gap-3">
      {rows.map(({ article, quantity, cost, value, health }) => (
        <Card key={article.id}>
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-center">
            <div>
              <p className="font-black">{article.name}</p>
              {!valueBreakdown ? (
                <p className="text-sm text-muted-foreground">
                  {stockTrackingModeLabel(article.trackingMode)}
                </p>
              ) : null}
            </div>
            <Info label="Quantité" value={`${quantity.toLocaleString("fr-FR")} ${stockUnitLabel(article.baseUnit, quantity)}`} />
            <Info label="Coût de référence" value={`${money(cost)} FCFA`} />
            {valueBreakdown ? (
              <Info label="Valeur" value={`${money(value)} FCFA`} />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Info label="Seuil minimum" value={`${Number(article.lowStockThreshold || 0).toLocaleString("fr-FR")} ${stockUnitLabel(article.baseUnit, Number(article.lowStockThreshold || 0))}`} />
                <Health health={health} />
              </div>
            )}
          </CardContent>
        </Card>
      ))}
      {valueBreakdown ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-center justify-between p-4">
            <strong>Valeur totale</strong>
            <strong className="text-xl">{money(rows.reduce((sum, row) => sum + row.value, 0))} FCFA</strong>
          </CardContent>
        </Card>
      ) : null}
    </section>
  )
}

function MovementRows({
  operations,
  articleNames,
}: {
  operations: readonly any[]
  articleNames: ReadonlyMap<string, string>
}) {
  const sorted = [...operations].sort(
    (a, b) => toDate(b.occurredAt).getTime() - toDate(a.occurredAt).getTime()
  )
  if (sorted.length === 0) return <Empty text="Aucun mouvement de stock." />
  return (
    <Card>
      <CardContent className="divide-y p-0">
        {sorted.map((operation) => {
          const variation = Number(operation.variation || 0)
          const isControl = operation.type === "CONTROLE_PHYSIQUE"
          return (
            <div key={operation.id} className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="font-bold">{articleNames.get(operation.articleId) || "Article archivé"}</p>
                <p className="text-xs text-muted-foreground">
                  {isControl
                    ? `Contrôle physique · ${variation > 0 ? "surplus constaté" : "écart constaté"} : ${Math.abs(variation).toLocaleString("fr-FR")} ${stockUnitLabel(operation.unit, Math.abs(variation))}`
                    : operationLabel(operation.type)} · {formatDate(operation.occurredAt)}
                </p>
                {operation.note ? <p className="mt-1 text-xs text-muted-foreground">{operation.note}</p> : null}
              </div>
              <strong className={variation >= 0 ? "text-emerald-700" : "text-destructive"}>
                {variation >= 0 ? "+" : ""}{variation.toLocaleString("fr-FR")} {stockUnitLabel(operation.unit, Math.abs(variation))}
              </strong>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function SupplyRows({ expenses }: { expenses: readonly any[] }) {
  const start = new Date()
  start.setDate(1)
  start.setHours(0, 0, 0, 0)
  const rows = expenses
    .filter((expense) => expense.type === "supply" && toDate(expense.createdAt) >= start)
    .sort((a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime())
  if (rows.length === 0) return <Empty text="Aucun approvisionnement ce mois-ci." />
  return (
    <Card>
      <CardContent className="divide-y p-0">
        {rows.map((expense) => (
          <div key={expense.id} className="grid gap-2 p-4 sm:grid-cols-3 sm:items-center">
            <div><p className="font-bold">{expense.supplierName || expense.note || "Approvisionnement"}</p><p className="text-xs text-muted-foreground">{formatDate(expense.createdAt)}</p></div>
            <Info label="Montant" value={`${money(Number(expense.amount || 0))} FCFA`} />
            <Info label="État" value={paymentLabel(expense.paymentStatus)} />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function SupplierRows({ suppliers }: { suppliers: readonly any[] }) {
  const rows = suppliers
    .map((supplier) => ({ ...supplier, debt: Math.max(0, Number(supplier.balance || 0)) }))
    .filter((supplier) => supplier.debt > 0)
    .sort((a, b) => b.debt - a.debt)
  if (rows.length === 0) return <Empty text="Aucune dette fournisseur." />
  return (
    <Card>
      <CardContent className="divide-y p-0">
        {rows.map((supplier) => (
          <div key={supplier.id} className="flex items-center justify-between gap-4 p-4">
            <div><p className="font-bold">{supplier.name || "Fournisseur"}</p><p className="text-xs text-muted-foreground">{supplier.phone || "Aucun contact renseigné"}</p></div>
            <strong>{money(supplier.debt)} FCFA</strong>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function Health({ health }: { health: "OUT" | "LOW" | "OK" }) {
  const label = health === "OUT" ? "Rupture" : health === "LOW" ? "Stock faible" : "Stock correct"
  return (
    <div>
      <p className="text-xs font-black uppercase text-muted-foreground">État</p>
      <p className={health === "OUT" ? "font-bold text-destructive" : health === "LOW" ? "font-bold text-amber-700" : "font-bold text-emerald-700"}>
        {health !== "OK" ? <AlertTriangle className="mr-1 inline h-4 w-4" /> : null}{label}
      </p>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-black uppercase text-muted-foreground">{label}</p><p className="font-bold">{value}</p></div>
}

function Empty({ text }: { text: string }) {
  return <Card><CardContent className="flex min-h-20 items-center justify-center gap-2 p-3 text-center text-sm text-muted-foreground"><PackageOpen className="size-4" aria-hidden="true" />{text}</CardContent></Card>
}

function OwnerStockDetailSkeleton() {
  return <main className="space-y-5 pb-24" aria-busy="true" aria-label="Chargement du stock"><div className="space-y-2"><Skeleton className="h-11 w-24" /><Skeleton className="h-7 w-48" /><Skeleton className="h-11 w-full" /></div><div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-24 rounded-xl" />)}</div></main>
}

function stockHealth(quantity: number, low: number, out: number): "OUT" | "LOW" | "OK" {
  if (quantity <= out) return "OUT"
  if (quantity <= low) return "LOW"
  return "OK"
}

function titleFor(mode: DetailMode, valueBreakdown: boolean) {
  if (mode === "articles") return valueBreakdown ? "Valeur du stock" : "Articles suivis"
  if (mode === "alerts") return "Alertes critiques"
  if (mode === "movements") return "Historique des mouvements"
  if (mode === "supplies") return "Approvisionnements du mois"
  return "Dettes fournisseurs"
}

function operationLabel(value: unknown) {
  const labels: Record<string, string> = {
    APPROVISIONNEMENT: "Approvisionnement",
    CONTROL: "Contrôle physique",
    LOSS: "Perte",
    CORRECTION: "Correction",
    AUTOMATIC_DEDUCTION: "Déduction automatique",
    AUTOMATIC_COMPENSATION: "Compensation automatique",
  }
  return labels[String(value)] || "Mouvement"
}

function paymentLabel(value: unknown) {
  if (value === "paid") return "Payé"
  if (value === "partial") return "Partiellement payé"
  return "Non payé"
}

function money(value: number) {
  return Math.round(Number.isFinite(value) ? value : 0).toLocaleString("fr-FR")
}

function toDate(value: any) {
  if (value?.toDate) return value.toDate()
  const date = new Date(value || 0)
  return Number.isNaN(date.getTime()) ? new Date(0) : date
}

function formatDate(value: any) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(toDate(value))
}
