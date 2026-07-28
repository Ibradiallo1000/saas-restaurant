"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, ArrowDownToLine, ClipboardCheck, History, PackageSearch, Search } from "lucide-react"

import { AdminRouteSkeleton } from "@/components/performance/route-skeletons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useTenant } from "@/design-system/context/TenantProvider"
import { PageHeader } from "@/design-system/components"
import { useFirestore } from "@/firebase"

import type { StockPrincipal } from "../../core/permissions"
import type { ActorId, RestaurantId, StockRole } from "../../core/value-objects"
import type { StockArticle } from "../../articles/domain/article"
import {
  FirestoreArticleCategoryRepository,
  FirestoreArticleRepository,
} from "../../articles/infrastructure/firestore-article-repositories"
import {
  canPerformControlledStockAction,
  capabilitiesForControlledStockRole,
} from "../../controlled-stock/application/authorization"
import type {
  ControlledStockBalance,
  ControlledStockOperation,
} from "../../controlled-stock/domain/models"
import {
  getControlledStockFeatureConfiguration,
  isControlledStockEnabled,
} from "../../controlled-stock/feature-flag"
import { FirestoreControlledStockRepository } from "../../controlled-stock/infrastructure/firestore-controlled-stock-repository"
import {
  stockTrackingModeLabel,
  stockUnitLabel,
} from "../../shared/inventory-referential"
import { DailyStockService } from "../application/daily-stock-service"
import type {
  DailyStockArticle,
  DailyStockFilter,
  DailyStockSource,
  SimpleStockReport,
  TimelineEntry,
} from "../domain/models"

type ScreenMode = "dashboard" | "replenishment" | "timeline" | "reports"

const filters: readonly { value: DailyStockFilter; label: string }[] = [
  { value: "ALL", label: "Tous" },
  { value: "OUT_OF_STOCK", label: "Rupture" },
  { value: "LOW", label: "Seuil faible" },
  { value: "NORMAL", label: "Normal" },
  { value: "CONTROLLED", label: "Contrôlé" },
  { value: "AUTOMATIC_SIMPLE", label: "Automatique simple" },
  { value: "NONE", label: "Non suivi" },
  { value: "ARCHIVED", label: "Archivés" },
]

export function DailyStockScreen({
  mode,
  disabledFallbackHref = "/manager/inventory",
}: {
  mode: ScreenMode
  disabledFallbackHref?: string | null
}) {
  const router = useRouter()
  const db = useFirestore()
  const { user, restaurantId, role, loading } = useTenant()
  const [source, setSource] = React.useState<DailyStockSource | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const principal = React.useMemo(
    () => user && restaurantId ? buildPrincipal(user.uid, restaurantId, role) : null,
    [restaurantId, role, user]
  )
  const enabled = restaurantId
    ? isControlledStockEnabled(restaurantId, getControlledStockFeatureConfiguration())
    : false

  const reload = React.useCallback(async () => {
    if (!db || !restaurantId || !principal) return
    setError(null)
    try {
      if (!canPerformControlledStockAction(principal, "read", restaurantId)) {
        throw new Error("Vous n’êtes pas autorisé à consulter le stock.")
      }
      const articleRepository = new FirestoreArticleRepository(db)
      const categoryRepository = new FirestoreArticleCategoryRepository(db)
      const stockRepository = new FirestoreControlledStockRepository(db)
      const [articlePage, categories, operationPage] = await Promise.all([
        articleRepository.list({ restaurantId, status: "all", pageSize: 100 }),
        categoryRepository.list(restaurantId),
        stockRepository.listOperations({ restaurantId, pageSize: 100 }),
      ])
      const balances = await Promise.all(
        articlePage.items
          .filter((article) => article.trackingMode !== "NONE")
          .map(async (article) => [
            String(article.id),
            await stockRepository.getBalance(restaurantId, String(article.id)),
          ] as const)
      )
      setSource({
        articles: articlePage.items,
        balances: Object.fromEntries(balances.map(([id, balance]) => [id, balance ?? undefined])),
        operations: operationPage.items,
        categories: Object.fromEntries(categories.map((category) => [String(category.id), category.name])),
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Chargement impossible.")
    }
  }, [db, principal, restaurantId])

  React.useEffect(() => { if (enabled) void reload() }, [enabled, reload])
  React.useEffect(() => {
    if (!loading && restaurantId && !enabled && disabledFallbackHref) {
      router.replace(disabledFallbackHref)
    }
  }, [disabledFallbackHref, enabled, loading, restaurantId, router])

  if (loading || (enabled && !source && !error)) return <AdminRouteSkeleton />
  if (!restaurantId || !user || !principal) return <StatePanel title="Accès indisponible" text="Aucun restaurant actif n’est associé à cette session." />
  if (!enabled) {
    return disabledFallbackHref
      ? <AdminRouteSkeleton />
      : <StatePanel title="Stock indisponible" text="Le stock V2 n’est pas activé pour ce restaurant." />
  }
  if (error || !source) return <StatePanel title="Chargement impossible" text={error ?? "Données indisponibles."} retry={reload} />

  const service = new DailyStockService()
  const now = new Date().toISOString()
  if (mode === "replenishment") return <ReplenishmentPage rows={service.replenishment(source, now)} />
  if (mode === "timeline") return <TimelinePage entries={service.timeline(source)} />
  if (mode === "reports") return <ReportsPage service={service} source={source} now={now} />
  return <DashboardPage source={source} service={service} now={now} principal={principal} restaurantId={restaurantId} />
}

function DashboardPage({
  source,
  service,
  now,
  principal,
  restaurantId,
}: {
  source: DailyStockSource
  service: DailyStockService
  now: string
  principal: StockPrincipal
  restaurantId: string
}) {
  const [query, setQuery] = React.useState("")
  const [filter, setFilter] = React.useState<DailyStockFilter>("ALL")
  const dashboard = service.buildDashboard(source, now)
  const rows = service.search(source, { query, filter }, now)
  const maySupply = canPerformControlledStockAction(principal, "supply", restaurantId)
  const mayControl = canPerformControlledStockAction(principal, "control", restaurantId)
  const mayDeclareLoss = canPerformControlledStockAction(principal, "loss", restaurantId)

  return <Page title="Stock aujourd’hui" subtitle="Les priorités du restaurant, sans indicateur inutile.">
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Metric label="Articles suivis" value={dashboard.totalTracked} />
      <Metric label="Ruptures" value={dashboard.outOfStock.length} critical />
      <Metric label="Stocks faibles" value={dashboard.lowStock.length} warning />
      <Metric label="À contrôler" value={dashboard.controlsDue.length} />
    </div>

    <Card>
      <CardHeader className="flex-row items-center justify-between"><CardTitle>Actions prioritaires</CardTitle><Badge variant={dashboard.alerts.length ? "destructive" : "secondary"}>{dashboard.alerts.length} active(s)</Badge></CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">
        {dashboard.alerts.length === 0
          ? <p className="text-sm text-muted-foreground md:col-span-3">Aucune alerte active.</p>
          : dashboard.alerts.slice(0, 6).map((alert) => <Link key={alert.id} href={`/manager/stock/${alert.articleId}`} className="rounded-lg border p-3 hover:bg-muted">
            <p className="font-semibold">{alert.articleName}</p><p className="text-sm text-muted-foreground">{alertLabel(alert.type)}</p>
          </Link>)}
      </CardContent>
    </Card>

    <div className="grid gap-3 sm:grid-cols-3">
      {maySupply && <QuickAction icon={<ArrowDownToLine />} label="Approvisionner" href="/manager/stock?filter=LOW" />}
      {mayControl && <QuickAction icon={<ClipboardCheck />} label="Contrôler" href="#articles" />}
      {mayDeclareLoss && <QuickAction icon={<AlertTriangle />} label="Déclarer une perte" href="#articles" />}
    </div>

    <div className="grid gap-4 lg:grid-cols-2">
      <OperationSummary title="Approvisionnements récents" operations={dashboard.recentSupplies} articles={source.articles} />
      <OperationSummary title="Derniers contrôles" operations={dashboard.recentControls} articles={source.articles} />
      <OperationSummary title="Derniers écarts" operations={dashboard.recentVariances} articles={source.articles} />
      <OperationSummary title="Dernières pertes" operations={dashboard.recentLosses} articles={source.articles} />
    </div>

    <Card id="articles">
      <CardHeader><CardTitle>Retrouver un article</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Nom, catégorie, mode ou état" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        <div className="flex gap-2 overflow-x-auto pb-2">{filters.map((item) => <Button key={item.value} size="sm" variant={filter === item.value ? "default" : "outline"} onClick={() => setFilter(item.value)}>{item.label}</Button>)}</div>
        <ArticleRows rows={rows} principal={principal} restaurantId={restaurantId} />
      </CardContent>
    </Card>

    <div className="grid gap-3 sm:grid-cols-3">
      <QuickAction icon={<PackageSearch />} label="À réapprovisionner" href="/manager/stock/replenishment" />
      <QuickAction icon={<History />} label="Chronologie" href="/manager/stock/timeline" />
      <QuickAction icon={<ClipboardCheck />} label="Rapports simples" href="/manager/stock/reports" />
      {principal.capabilities.includes("stock.productTracking.read") && <QuickAction icon={<PackageSearch />} label="Associations automatiques" href="/manager/stock/automatic" />}
      {principal.capabilities.includes("stock.settings.manage") && <QuickAction icon={<History />} label="Comparer ancien / V2" href="/manager/stock/transition" />}
    </div>
  </Page>
}

function ReplenishmentPage({ rows }: { rows: readonly DailyStockArticle[] }) {
  return <Page title="À réapprovisionner" subtitle="Liste de préparation uniquement, sans commande fournisseur.">
    {rows.length === 0 ? <StatePanel title="Aucun besoin" text="Tous les articles suivis sont au-dessus de leur seuil faible." /> :
      <Card><CardContent className="p-0"><div className="divide-y">{rows.map((row) => <Link href={`/manager/stock/${String(row.article.id)}`} key={String(row.article.id)} className="grid grid-cols-[1fr_auto] gap-3 p-4 hover:bg-muted sm:grid-cols-4">
        <div><p className="font-semibold">{row.article.name}</p><p className="text-xs text-muted-foreground">{row.categoryName ?? "Sans catégorie"}</p></div>
        <Info label="Actuel" value={`${row.quantity ?? "—"} ${stockUnitLabel(row.article.baseUnit, row.quantity ?? undefined)}`} />
        <Info label="Seuil faible" value={`${row.article.lowStockThreshold} ${stockUnitLabel(row.article.baseUnit, row.article.lowStockThreshold)}`} />
        <Badge className="self-center justify-self-end" variant={row.health === "OUT_OF_STOCK" ? "destructive" : "secondary"}>{row.health === "OUT_OF_STOCK" ? "Urgent" : "À prévoir"}</Badge>
      </Link>)}</div></CardContent></Card>}
  </Page>
}

function TimelinePage({ entries }: { entries: readonly TimelineEntry[] }) {
  return <Page title="Chronologie" subtitle="Les faits du stock, du plus récent au plus ancien.">
    {entries.length === 0 ? <StatePanel title="Aucun événement" text="La chronologie apparaîtra après la première opération." /> :
      <div className="space-y-3">{entries.map((entry) => <Card key={entry.id}><CardContent className="flex gap-4 p-4"><div className="w-16 shrink-0 font-semibold">{new Date(entry.occurredAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</div><div><p className="font-semibold">{entry.title}</p><p className="text-sm text-muted-foreground">{entry.detail}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(entry.occurredAt).toLocaleDateString("fr-FR")}</p></div></CardContent></Card>)}</div>}
  </Page>
}

function ReportsPage({ service, source, now }: { service: DailyStockService; source: DailyStockSource; now: string }) {
  const [type, setType] = React.useState<SimpleStockReport["type"]>("CURRENT_STATE")
  const [from, setFrom] = React.useState("")
  const [to, setTo] = React.useState("")
  const report = service.report(source, {
    type,
    ...(from ? { from: new Date(`${from}T00:00:00`).toISOString() } : {}),
    ...(to ? { to: new Date(`${to}T23:59:59`).toISOString() } : {}),
  }, now)
  return <Page title="Rapports simples" subtitle="Des faits opérationnels, sans comptabilité ni analyse financière.">
    <Card><CardContent className="grid gap-3 p-4 md:grid-cols-3">
      <select className="h-10 rounded-md border bg-background px-3" value={type} onChange={(event) => setType(event.target.value as SimpleStockReport["type"])}>
        <option value="CURRENT_STATE">État actuel du stock</option><option value="SUPPLIES">Approvisionnements</option><option value="LOSSES">Pertes</option><option value="CONTROLS">Contrôles réalisés</option><option value="VARIANCES">Écarts constatés</option>
      </select>
      <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
      <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
    </CardContent></Card>
    {type === "CURRENT_STATE" ? <ArticleRows rows={report.articles} /> : <OperationSummary title={`${report.operations.length} résultat(s)`} operations={report.operations} articles={source.articles} />}
  </Page>
}

function ArticleRows({ rows, principal, restaurantId }: { rows: readonly DailyStockArticle[]; principal?: StockPrincipal; restaurantId?: string }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted-foreground">Aucun article ne correspond.</p>
  return <div className="divide-y rounded-md border">{rows.map((row) => {
    const id = String(row.article.id)
    const mayControl = principal && restaurantId && canPerformControlledStockAction(principal, "control", restaurantId)
    const mayLoss = principal && restaurantId && canPerformControlledStockAction(principal, "loss", restaurantId)
    return <div key={id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <Link href={`/manager/stock/${id}`}><p className="font-semibold">{row.article.name}</p><p className="text-sm text-muted-foreground">{row.categoryName ?? "Sans catégorie"} · {stockTrackingModeLabel(row.article.trackingMode)}</p></Link>
      <div className="flex items-center gap-2"><strong>{row.quantity ?? "—"} {row.article.trackingMode === "NONE" ? "" : stockUnitLabel(row.article.baseUnit, row.quantity ?? undefined)}</strong><HealthBadge health={row.health} />{mayControl && row.article.trackingMode !== "NONE" && <Button asChild size="sm" variant="outline"><Link href={`/manager/stock/${id}/control`}>Contrôler</Link></Button>}{mayLoss && row.article.trackingMode !== "NONE" && <Button asChild size="sm" variant="ghost"><Link href={`/manager/stock/${id}/loss`}>Perte</Link></Button>}</div>
    </div>
  })}</div>
}

function OperationSummary({ title, operations, articles }: { title: string; operations: readonly ControlledStockOperation[]; articles: readonly StockArticle[] }) {
  const names = new Map(articles.map((article) => [String(article.id), article.name]))
  return <Card><CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent>{operations.length === 0 ? <p className="text-sm text-muted-foreground">Aucune donnée récente.</p> : <div className="space-y-3">{operations.map((operation) => <div key={operation.id} className="flex justify-between gap-4 text-sm"><div><p className="font-medium">{names.get(String(operation.articleId)) ?? "Article"}</p><p className="text-xs text-muted-foreground">{new Date(operation.occurredAt).toLocaleString("fr-FR")}</p></div><strong>{operation.variation > 0 ? "+" : ""}{operation.variation} {operation.unit}</strong></div>)}</div>}</CardContent></Card>
}

function Metric({ label, value, critical, warning }: { label: string; value: number; critical?: boolean; warning?: boolean }) {
  return <Card className={critical && value ? "border-destructive" : warning && value ? "border-amber-500" : ""}><CardContent className="p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="text-3xl font-bold">{value}</p></CardContent></Card>
}

function QuickAction({ icon, label, href }: { icon: React.ReactNode; label: string; href: string }) {
  return <Button asChild variant="outline" className="h-auto justify-start gap-3 p-4"><Link href={href}>{icon}<span>{label}</span></Link></Button>
}

function HealthBadge({ health }: { health: DailyStockArticle["health"] }) {
  if (health === "OUT_OF_STOCK") return <Badge variant="destructive">Rupture</Badge>
  if (health === "LOW") return <Badge className="bg-amber-500">Faible</Badge>
  if (health === "NOT_TRACKED") return <Badge variant="outline">Non suivi</Badge>
  return <Badge variant="secondary">Normal</Badge>
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="hidden sm:block"><p className="text-xs text-muted-foreground">{label}</p><p className="font-semibold">{value}</p></div>
}

function Page({ title, subtitle, children }: React.PropsWithChildren<{ title: string; subtitle: string }>) {
  return <main className="space-y-6 p-4 md:p-8"><PageHeader title={title} subtitle={subtitle} />{children}</main>
}

function StatePanel({ title, text, retry }: { title: string; text: string; retry?: () => void }) {
  return <Card className="m-4"><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-muted-foreground">{text}</p>{retry && <Button onClick={retry}>Réessayer</Button>}</CardContent></Card>
}

function buildPrincipal(actorId: string, restaurantId: string, legacyRole: string): StockPrincipal {
  const role: StockRole = legacyRole === "owner" ? "owner" : legacyRole === "manager" ? "manager" : legacyRole === "kitchen" ? "kitchen_chef" : "employee"
  return { actorId: actorId as ActorId, role, capabilities: capabilitiesForControlledStockRole(role), scope: { restaurantId: restaurantId as RestaurantId } }
}

function alertLabel(type: string) {
  return type === "OUT_OF_STOCK" ? "Rupture" : type === "LOW_STOCK" ? "Stock faible" : "Contrôle en retard"
}
