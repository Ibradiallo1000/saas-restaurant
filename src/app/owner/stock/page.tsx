"use client"

import Link from "next/link"
import { collection } from "firebase/firestore"
import { Activity, AlertTriangle, Banknote, ChevronRight, Clock3, PackageSearch, ReceiptText, ShoppingCart, Truck } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useTenant } from "@/design-system/context/TenantProvider"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { stockUnitLabel } from "@/modules/stock/shared/inventory-referential"
import { useInventoryReferential } from "@/modules/stock/shared/use-inventory-referential"
import { PageHeader } from "@/design-system/components"

export default function OwnerStockPage() {
  const db = useFirestore()
  const { restaurantId } = useTenant()
  const queryCollection = (name: string) => {
    if (!db || !restaurantId) return null
    return collection(db, "restaurants", restaurantId, name)
  }
  const {
    articles,
    balances,
    costs,
    operations,
  } = useInventoryReferential(restaurantId, {
    includeCosts: true,
    includeOperations: true,
  })
  const { data: suppliers } = useCollection<any>(useMemoFirebase(
    () => queryCollection("suppliers"),
    [db, restaurantId]
  ))
  const { data: expenses } = useCollection<any>(useMemoFirebase(
    () => queryCollection("expenses"),
    [db, restaurantId]
  ))
  const quantities = new Map((balances || []).map((item) => [item.articleId || item.id, Number(item.quantity || 0)]))
  const referenceCosts = new Map((costs || []).map((item) => [item.articleId || item.id, Number(item.referenceCost || 0)]))
  const followed = (articles || []).filter((item) => item.status === "active" && item.trackingMode !== "NONE")
  const stockValue = followed.reduce(
    (sum, item) => sum + (quantities.get(item.id) || 0) * (referenceCosts.get(item.id) || 0),
    0
  )
  const critical = followed.filter(
    (item) => (quantities.get(item.id) || 0) <= Number(item.lowStockThreshold || 0)
  ).length
  const supplierDebt = (suppliers || []).reduce((sum, item) => sum + Math.max(0, Number(item.balance || 0)), 0)
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)
  const supplies = (expenses || []).filter((item) => item.type === "supply")
  const monthlySupplies = supplies.filter((item) => toDate(item.createdAt) >= startOfMonth)
  const monthlyPurchases = monthlySupplies.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const treasuryImpact = monthlySupplies.reduce((sum, item) => sum + Number(item.paidAmount || 0), 0)
  const pendingPayments = (expenses || []).filter(
    (item) => Number(item.debtAmount || 0) > 0 || item.paymentStatus === "unpaid" || item.paymentStatus === "partial"
  ).length
  const recentOperations = [...(operations || [])]
    .sort((a, b) => toDate(b.occurredAt).getTime() - toDate(a.occurredAt).getTime())
    .slice(0, 8)
  const consumedByArticle = new Map<string, number>()
  for (const operation of operations || []) {
    if (toDate(operation.occurredAt) < startOfMonth || Number(operation.variation || 0) >= 0) continue
    consumedByArticle.set(
      operation.articleId,
      (consumedByArticle.get(operation.articleId) || 0) + Math.abs(Number(operation.variation || 0))
    )
  }
  const articleNames = new Map((articles || []).map((item) => [item.id, item.name]))
  const topConsumed = [...consumedByArticle.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

  return (
    <main className="space-y-6 pb-24 md:pb-8">
      <PageHeader
        title="Supervision du stock"
        subtitle="Les mêmes quantités et opérations que le Manager, complétées par la vision financière Owner."
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Metric href="/owner/stock/articles?view=value" title="Valeur du stock" value={`${formatMoney(stockValue)} FCFA`} icon={<Banknote className="h-5 w-5" />} />
        <Metric href="/owner/stock/articles" title="Articles suivis" value={String(followed.length)} icon={<PackageSearch className="h-5 w-5" />} />
        <Metric href="/owner/stock/alerts" title="Alertes critiques" value={String(critical)} icon={<AlertTriangle className="h-5 w-5" />} />
        <Metric href="/owner/stock/suppliers" title="Dette fournisseurs" value={`${formatMoney(supplierDebt)} FCFA`} icon={<Truck className="h-5 w-5" />} />
        <Metric href="/owner/stock/supplies" title="Achats du mois" value={`${formatMoney(monthlyPurchases)} FCFA`} icon={<ShoppingCart className="h-5 w-5" />} />
        <Metric title="Paiements en attente" value={String(pendingPayments)} icon={<Clock3 className="h-5 w-5" />} />
        <Metric title="Impact trésorerie du mois" value={`-${formatMoney(treasuryImpact)} FCFA`} icon={<Activity className="h-5 w-5" />} />
      </section>

      <Card>
        <CardHeader><CardTitle>Achats et fournisseurs</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <p className="rounded-xl border p-3 text-sm"><strong>{supplies.length}</strong><br />approvisionnement(s) enregistré(s)</p>
          <Button asChild variant="outline"><Link href="/owner/depenses"><ReceiptText className="mr-2 h-4 w-4" />Achats et dettes</Link></Button>
          <Button asChild variant="outline"><Link href="/owner/tresorerie"><Banknote className="mr-2 h-4 w-4" />Impact trésorerie</Link></Button>
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Top produits consommés ce mois</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {topConsumed.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune consommation enregistrée ce mois.</p>
            ) : topConsumed.map(([articleId, quantity]) => (
              <div key={articleId} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                <strong>{articleNames.get(articleId) || "Article archivé"}</strong>
                <span>{quantity.toLocaleString("fr-FR")}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Mouvements récents</CardTitle>
            <Button asChild size="sm" variant="ghost">
              <Link href="/owner/stock/movements">Voir tout<ChevronRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentOperations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun mouvement de stock.</p>
            ) : recentOperations.map((operation) => (
              <div key={operation.id} className="rounded-lg border p-3 text-sm">
                <div className="flex justify-between gap-3">
                  <strong>{articleNames.get(operation.articleId) || "Article archivé"}</strong>
                  <span className={Number(operation.variation || 0) >= 0 ? "text-emerald-700" : "text-destructive"}>
                    {Number(operation.variation || 0) >= 0 ? "+" : ""}{Number(operation.variation || 0).toLocaleString("fr-FR")} {stockUnitLabel(operation.unit, Math.abs(Number(operation.variation || 0)))}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{ownerOperationLabel(operation)} · {formatDate(operation.occurredAt)}</p>
                {operation.note ? <p className="mt-1 text-xs text-muted-foreground">{String(operation.note)}</p> : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </main>
  )
}

function Metric({
  title,
  value,
  icon,
  href,
}: {
  title: string
  value: string
  icon: React.ReactNode
  href?: string
}) {
  const content = (
    <CardContent className="flex items-start justify-between gap-3 p-4">
      <div><p className="text-xs font-black uppercase text-muted-foreground">{title}</p><p className="mt-2 text-2xl font-black">{value}</p></div>
      <span className="flex items-center gap-1 text-primary">{icon}{href ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : null}</span>
    </CardContent>
  )
  return href ? (
    <Link
      href={href}
      aria-label={`Voir le détail : ${title}`}
      className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Card className="h-full cursor-pointer transition-colors group-hover:border-primary/40 group-hover:bg-muted/40">
        {content}
      </Card>
    </Link>
  ) : <Card>{content}</Card>
}

function formatMoney(value: number) {
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

function ownerOperationLabel(operation: any) {
  const variation = Number(operation.variation || 0)
  if (operation.type === "CONTROLE_PHYSIQUE") {
    const kind = variation > 0 ? "surplus constaté" : "écart constaté"
    return `Contrôle physique · ${kind} : ${Math.abs(variation).toLocaleString("fr-FR")} ${stockUnitLabel(operation.unit, Math.abs(variation))}`
  }
  const labels: Record<string, string> = {
    APPROVISIONNEMENT: "Approvisionnement",
    PERTE: "Perte",
    CORRECTION_POSITIVE: "Correction positive",
    CORRECTION_NEGATIVE: "Correction négative",
    AUTOMATIC_DEDUCTION: "Déduction automatique",
    AUTOMATIC_COMPENSATION: "Compensation automatique",
  }
  return labels[String(operation.type)] || "Mouvement de stock"
}
