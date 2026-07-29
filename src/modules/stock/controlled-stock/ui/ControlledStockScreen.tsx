"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ClipboardCheck } from "lucide-react"

import { AdminRouteSkeleton } from "@/components/performance/route-skeletons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useTenant } from "@/design-system/context/TenantProvider"
import { PageHeader } from "@/design-system/components"
import { useFirestore } from "@/firebase"

import type { StockPrincipal } from "../../core/permissions"
import type { ActorId, RestaurantId, StockRole } from "../../core/value-objects"
import { FirestoreArticleRepository } from "../../articles/infrastructure/firestore-article-repositories"
import type { StockArticle } from "../../articles/domain/article"
import { ControlledStockService } from "../application/controlled-stock-service"
import {
  buildManualControlProjection,
  calculateObservedStockGap,
} from "../application/manual-control-projection"
import { capabilitiesForControlledStockRole } from "../application/authorization"
import type { ControlledStockBalance, ControlledStockOperation } from "../domain/models"
import { getControlledStockFeatureConfiguration, isControlledStockEnabled } from "../feature-flag"
import { FirestoreControlledStockRepository } from "../infrastructure/firestore-controlled-stock-repository"
import { stockUnitLabel } from "../../shared/inventory-referential"

type ScreenMode = "stock" | "controls" | "detail" | "supply" | "control" | "loss" | "correction" | "history"

export function ControlledStockScreen({ mode, articleId }: { mode: ScreenMode; articleId?: string }) {
  const db = useFirestore()
  const router = useRouter()
  const { user, restaurantId, role, loading } = useTenant()
  const [articles, setArticles] = React.useState<readonly StockArticle[]>([])
  const [article, setArticle] = React.useState<StockArticle | null>(null)
  const [balances, setBalances] = React.useState<Record<string, ControlledStockBalance>>({})
  const [history, setHistory] = React.useState<readonly ControlledStockOperation[]>([])
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)
  const service = React.useMemo(() => db ? new ControlledStockService({
    articles: new FirestoreArticleRepository(db),
    stock: new FirestoreControlledStockRepository(db),
  }) : null, [db])
  const principal = React.useMemo(
    () => user && restaurantId ? buildPrincipal(user.uid, restaurantId, role) : null,
    [restaurantId, role, user]
  )
  const enabled = restaurantId
    ? isControlledStockEnabled(restaurantId, getControlledStockFeatureConfiguration())
    : false

  const reload = React.useCallback(async () => {
    if (!db || !service || !principal || !restaurantId) return
    setBusy(true)
    setError(null)
    try {
      const articleRepository = new FirestoreArticleRepository(db)
      if (mode === "stock" || mode === "controls") {
        const page = await articleRepository.list({ restaurantId, status: "active", pageSize: 100 })
        const followed = page.items.filter((item) =>
          mode === "controls"
            ? item.trackingMode === "CONTROLLED"
            : item.trackingMode !== "NONE"
        )
        setArticles(followed)
        const [rows, operationPage] = await Promise.all([
          Promise.all(followed.map(async (item) => [
            String(item.id),
            await service.getCurrentQuantity(restaurantId, String(item.id), principal),
          ] as const)),
          mode === "controls"
            ? listAllOperations(service, restaurantId, principal)
            : Promise.resolve(null),
        ])
        setBalances(Object.fromEntries(rows))
        if (operationPage) setHistory(operationPage)
      } else if (articleId) {
        const selected = await articleRepository.getById(restaurantId, articleId, { includeCost: false })
        setArticle(selected)
        if (selected) {
          const balance = await service.getCurrentQuantity(restaurantId, articleId, principal)
          setBalances({ [articleId]: balance })
          if (mode === "detail" || mode === "history" || mode === "control") {
            setHistory(await listAllOperations(service, restaurantId, principal, articleId))
          }
        }
      } else if (mode === "history") {
        const page = await service.listOperations({ restaurantId, pageSize: 100 }, principal)
        setHistory(page.items)
      }
    } catch (cause) {
      setError(toMessage(cause))
    } finally {
      setBusy(false)
    }
  }, [articleId, db, mode, principal, restaurantId, service])

  React.useEffect(() => { if (enabled) void reload() }, [enabled, reload])

  if (loading) return <AdminRouteSkeleton />
  if (!restaurantId || !user || !principal) return <StatePanel title="Accès indisponible" text="Aucun restaurant actif n’est associé à cette session." />
  if (!enabled) return <StatePanel title="Stock contrôlé non activé" text="Cette nouvelle version est désactivée pour ce restaurant." />
  if (busy && !article && articles.length === 0 && history.length === 0) return <AdminRouteSkeleton />
  if (error && !article && articles.length === 0 && history.length === 0) return <StatePanel title="Chargement impossible" text={error} retry={reload} />

  if (mode === "stock") {
    return (
      <Page title="Stock" subtitle="Quantités actuellement connues, issues des opérations validées.">
        <div className="flex gap-2"><Button asChild><Link href="/manager/stock/history">Voir l’historique</Link></Button><Button variant="outline" asChild><Link href="/manager/stock/articles">Gérer les articles</Link></Button></div>
        {articles.length === 0 ? <StatePanel title="Aucun article suivi" text="Créez un article avec un suivi quantitatif pour commencer." /> :
          <div className="grid gap-3">{articles.map((item) => {
            const balance = balances[String(item.id)]
            const low = balance && balance.quantity <= item.lowStockThreshold
            return <Card key={String(item.id)}><CardContent className="flex items-center justify-between gap-4 p-5">
              <div><p className="font-semibold">{item.name}</p><p className="text-sm text-muted-foreground">{item.trackingMode === "CONTROLLED" ? "Stock contrôlé" : "Automatique simple"} · seuil minimum {item.lowStockThreshold} {item.baseUnit}</p></div>
              <div className="text-right"><p className="text-xl font-bold">{balance?.quantity ?? 0} {item.baseUnit}</p>{low ? <Badge variant="destructive">Stock faible</Badge> : <Badge variant="secondary">Disponible</Badge>}</div>
              <div className="flex flex-wrap gap-2">
                <Button asChild><Link href={`/manager/stock/${String(item.id)}`}>Ouvrir</Link></Button>
                <Button asChild variant="outline"><Link href={`/manager/stock/articles/${String(item.id)}`}>Modifier</Link></Button>
              </div>
            </CardContent></Card>
          })}</div>}
      </Page>
    )
  }

  if (mode === "controls") {
    return <ControlsTodayPage
      articles={articles}
      balances={balances}
      operations={history}
    />
  }

  if (mode === "history") return <HistoryPage operations={history} articleScoped={Boolean(articleId)} />
  if (!article || !articleId) return <StatePanel title="Article introuvable" text="Cet article n’existe pas ou n’est plus accessible." />
  if (mode === "control" && article.trackingMode !== "CONTROLLED") {
    return <StatePanel
      title="Contrôle non disponible"
      text="Seuls les articles en mode Contrôle manuel peuvent être contrôlés."
    />
  }
  const balance = balances[articleId]
  if (mode === "detail") return <ArticlePage article={article} balance={balance} operations={history} />

  return <OperationForm mode={mode} article={article} balance={balance} operations={history} busy={busy} error={error} success={success} onSubmit={async (values) => {
    if (!service) return
    setBusy(true); setError(null); setSuccess(null)
    const common = { restaurantId, articleId, unit: article.baseUnit, occurredAt: new Date().toISOString(), actorId: user.uid, idempotencyKey: crypto.randomUUID(), expectedVersion: balance?.version ?? 0 }
    try {
      if (mode === "supply") await service.recordSupply({ ...common, quantity: values.quantity, totalCost: values.cost === "" ? undefined : Number(values.cost), reference: values.reference }, principal)
      if (mode === "control") await service.recordPhysicalControl({ ...common, observedQuantity: values.quantity, note: values.note }, principal)
      if (mode === "loss") await service.recordLoss({ ...common, quantity: values.quantity, reason: values.reason, note: values.note }, principal)
      if (mode === "correction") await service.recordCorrection({ ...common, quantity: values.quantity, direction: values.direction, justification: values.note }, principal)
      setSuccess("Opération enregistrée.")
      router.push(`/manager/stock/${articleId}`)
    } catch (cause) { setError(toMessage(cause)); setBusy(false) }
  }} />
}

function Page({ title, subtitle, children, backToArticles = false }: React.PropsWithChildren<{ title: string; subtitle: string; backToArticles?: boolean }>) {
  return <div className="space-y-6 p-4 md:p-8"><PageHeader title={title} subtitle={subtitle} eyebrow={backToArticles ? <Link href="/manager/stock" className="inline-flex text-sm font-medium normal-case tracking-normal text-muted-foreground hover:text-foreground">← Retour aux articles</Link> : undefined} />{children}</div>
}

function ArticlePage({ article, balance, operations }: { article: StockArticle; balance?: ControlledStockBalance; operations: readonly ControlledStockOperation[] }) {
  const id = String(article.id)
  return <Page title={article.name} subtitle="Quantité actuelle et opérations essentielles." backToArticles>
    <Card><CardHeader><CardTitle>{balance?.quantity ?? 0} {article.baseUnit}</CardTitle></CardHeader><CardContent className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border p-3"><p className="text-xs font-semibold uppercase text-muted-foreground">Seuil minimum</p><p className="text-lg font-bold">{article.lowStockThreshold} {article.baseUnit}</p></div>
        <div className="rounded-lg border p-3"><p className="text-xs font-semibold uppercase text-muted-foreground">Seuil de rupture</p><p className="text-lg font-bold">{article.outOfStockThreshold} {article.baseUnit}</p></div>
      </div>
      <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline"><Link href={`/manager/stock/articles/${id}`}>Modifier l’article et ses seuils</Link></Button>
      <Button asChild><Link href={`/manager/expenses?type=supply&articleId=${encodeURIComponent(id)}`}>Approvisionner</Link></Button>
      <Button asChild variant="outline"><Link href={`/manager/stock/${id}/control`}>Contrôler</Link></Button>
      <Button asChild variant="outline"><Link href={`/manager/stock/${id}/loss`}>Déclarer une perte</Link></Button>
      <Button asChild variant="outline"><Link href={`/manager/stock/${id}/correction`}>Corriger</Link></Button>
      <Button asChild variant="ghost"><Link href={`/manager/stock/${id}/history`}>Historique</Link></Button>
      </div>
    </CardContent></Card>
    <HistoryTable operations={operations.slice(0, 10)} />
  </Page>
}

function HistoryPage({ operations, articleScoped = false }: { operations: readonly ControlledStockOperation[]; articleScoped?: boolean }) {
  return <Page title="Historique du stock" subtitle="Journal immuable des opérations validées." backToArticles={articleScoped}><HistoryTable operations={operations} /></Page>
}

function HistoryTable({ operations }: { operations: readonly ControlledStockOperation[] }) {
  if (operations.length === 0) return <StatePanel title="Aucune opération" text="L’historique apparaîtra après la première opération." />
  return <Card><CardContent className="overflow-x-auto p-0"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-4">Date</th><th>Opération</th><th>Stock avant</th><th>Variation</th><th>Stock après</th><th>Utilisateur</th><th>Commentaire</th></tr></thead><tbody>{operations.map((item) => <tr key={item.id} className="border-b"><td className="p-4">{new Date(item.occurredAt).toLocaleString("fr-FR")}</td><td>{operationLabel(item.type)}</td><td>{item.quantityBefore} {stockUnitLabel(item.unit, item.quantityBefore)}</td><td>{item.variation > 0 ? "+" : ""}{item.variation} {stockUnitLabel(item.unit, Math.abs(item.variation))}</td><td>{item.quantityAfter} {stockUnitLabel(item.unit, item.quantityAfter)}</td><td>{item.createdBy}</td><td>{item.note || "—"}</td></tr>)}</tbody></table></CardContent></Card>
}

function ControlsTodayPage({
  articles,
  balances,
  operations,
}: {
  articles: readonly StockArticle[]
  balances: Readonly<Record<string, ControlledStockBalance>>
  operations: readonly ControlledStockOperation[]
}) {
  const now = new Date().toISOString()
  return <Page title="Contrôles du jour" subtitle="Articles en contrôle manuel à vérifier selon l’organisation du restaurant.">
    {articles.length === 0 ? (
      <StatePanel title="Aucun article à contrôler" text="Aucun article actif n’utilise le mode Contrôle manuel." />
    ) : (
      <div className="grid gap-3">
        {articles.map((article) => {
          const id = String(article.id)
          const balance = balances[id]
          if (!balance) return null
          const projection = buildManualControlProjection({ balance, operations, now })
          return (
            <Card key={id}>
              <CardContent className="grid gap-4 p-5 md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-center">
                <div>
                  <p className="font-black">{article.name}</p>
                  <p className="text-sm text-muted-foreground">Contrôle manuel · {stockUnitLabel(article.baseUnit)}</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase text-muted-foreground">Stock théorique actuel</p>
                  <p className="font-bold">{balance.quantity.toLocaleString("fr-FR")} {stockUnitLabel(article.baseUnit, balance.quantity)}</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase text-muted-foreground">Dernier contrôle</p>
                  <p className="font-bold">{projection.lastControl ? new Date(projection.lastControl.occurredAt).toLocaleString("fr-FR") : "Jamais contrôlé"}</p>
                  <Badge className="mt-1" variant={projection.controlledToday ? "secondary" : "outline"}>
                    {projection.controlledToday ? "Contrôlé aujourd’hui" : "À vérifier"}
                  </Badge>
                </div>
                <Button asChild>
                  <Link href={`/manager/stock/${id}/control`} aria-label={`Effectuer le contrôle de ${article.name}`}>
                    <ClipboardCheck className="mr-2 h-4 w-4" />Effectuer le contrôle
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    )}
  </Page>
}

function OperationForm({ mode, article, balance, operations, busy, error, success, onSubmit }: { mode: Exclude<ScreenMode, "stock" | "controls" | "detail" | "history">; article: StockArticle; balance?: ControlledStockBalance; operations: readonly ControlledStockOperation[]; busy: boolean; error: string | null; success: string | null; onSubmit: (values: { quantity: number; cost: string; reference: string; reason: string; note: string; direction: "POSITIVE" | "NEGATIVE" }) => Promise<void> }) {
  const [quantity, setQuantity] = React.useState("")
  const [cost, setCost] = React.useState("")
  const [reference, setReference] = React.useState("")
  const [reason, setReason] = React.useState("CASSE")
  const [note, setNote] = React.useState("")
  const [direction, setDirection] = React.useState<"POSITIVE" | "NEGATIVE">("POSITIVE")
  if (mode === "control") {
    return <ManualControlForm
      article={article}
      balance={balance}
      operations={operations}
      quantity={quantity}
      setQuantity={setQuantity}
      note={note}
      setNote={setNote}
      busy={busy}
      error={error}
      success={success}
      onSubmit={() => onSubmit({ quantity: Number(quantity), cost, reference, reason, note, direction })}
    />
  }
  const labels = { supply: "Enregistrer un approvisionnement", loss: "Déclarer une perte", correction: "Corriger le stock" }
  return <Page title={labels[mode]} subtitle={`${article.name} — stock connu : ${balance?.quantity ?? 0} ${article.baseUnit}`} backToArticles>
    <Card><CardContent className="space-y-4 p-6"><Label className="space-y-2"><span>Quantité</span><Input type="number" min="0" step="any" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></Label>
      {mode === "supply" && <><Label className="space-y-2"><span>Coût total (facultatif)</span><Input type="number" min="0" value={cost} onChange={(event) => setCost(event.target.value)} /></Label><Label className="space-y-2"><span>Référence (facultative)</span><Input value={reference} onChange={(event) => setReference(event.target.value)} /></Label></>}
      {mode === "loss" && <Label className="space-y-2"><span>Motif</span><select className="h-10 w-full rounded-md border bg-background px-3" value={reason} onChange={(event) => setReason(event.target.value)}><option>CASSE</option><option>DETERIORATION</option><option>EXPIRATION</option><option>ERREUR</option><option>AUTRE</option></select></Label>}
      {mode === "correction" && <Label className="space-y-2"><span>Sens</span><select className="h-10 w-full rounded-md border bg-background px-3" value={direction} onChange={(event) => setDirection(event.target.value as "POSITIVE" | "NEGATIVE")}><option value="POSITIVE">Ajouter</option><option value="NEGATIVE">Retirer</option></select></Label>}
      {(mode !== "supply") && <Label className="space-y-2"><span>{mode === "correction" ? "Justification obligatoire" : "Note (facultative)"}</span><Textarea value={note} onChange={(event) => setNote(event.target.value)} /></Label>}
      {error && <p className="text-sm text-destructive">{error}</p>}{success && <p className="text-sm text-emerald-600">{success}</p>}
      <div className="flex gap-2"><Button disabled={busy || quantity === ""} onClick={() => void onSubmit({ quantity: Number(quantity), cost, reference, reason, note, direction })}>{busy ? "Enregistrement…" : "Valider"}</Button><Button asChild variant="outline"><Link href={`/manager/stock/${String(article.id)}`}>Annuler</Link></Button></div>
    </CardContent></Card>
  </Page>
}

function ManualControlForm({
  article,
  balance,
  operations,
  quantity,
  setQuantity,
  note,
  setNote,
  busy,
  error,
  success,
  onSubmit,
}: {
  article: StockArticle
  balance?: ControlledStockBalance
  operations: readonly ControlledStockOperation[]
  quantity: string
  setQuantity: (value: string) => void
  note: string
  setNote: (value: string) => void
  busy: boolean
  error: string | null
  success: string | null
  onSubmit: () => Promise<void>
}) {
  if (!balance) return <StatePanel title="Solde indisponible" text="Le stock théorique de cet article est introuvable." />
  const projection = buildManualControlProjection({
    balance,
    operations,
    now: new Date().toISOString(),
  })
  const observed = quantity === "" ? null : Number(quantity)
  const gap = observed === null || !Number.isFinite(observed)
    ? null
    : calculateObservedStockGap(projection.theoreticalQuantity, observed)
  const unit = (value?: number) => stockUnitLabel(article.baseUnit, value)

  return <Page title={`Contrôle du stock — ${article.name}`} subtitle="Saisissez le stock réellement constaté. L’écart peut inclure consommation, pertes ou erreurs de comptage." backToArticles>
    <Card>
      <CardContent className="space-y-6 p-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ControlMetric
            label="Stock au dernier contrôle"
            value={`${projection.stockAtLastControl.toLocaleString("fr-FR")} ${unit(projection.stockAtLastControl)}`}
            help={projection.lastControl ? new Date(projection.lastControl.occurredAt).toLocaleString("fr-FR") : "Aucun contrôle antérieur"}
          />
          <ControlMetric
            label="Approvisionnements depuis"
            value={`+${projection.suppliesSinceLastControl.toLocaleString("fr-FR")} ${unit(projection.suppliesSinceLastControl)}`}
          />
          <ControlMetric
            label="Autres mouvements"
            value={`${projection.otherMovementsVariation > 0 ? "+" : ""}${projection.otherMovementsVariation.toLocaleString("fr-FR")} ${unit(Math.abs(projection.otherMovementsVariation))}`}
            help="Pertes, corrections ou opérations automatiques, affichées séparément."
          />
          <ControlMetric
            label="Stock théorique actuel"
            value={`${projection.theoreticalQuantity.toLocaleString("fr-FR")} ${unit(projection.theoreticalQuantity)}`}
          />
        </div>

        {projection.otherMovementsSinceLastControl.length > 0 ? (
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs font-black uppercase text-muted-foreground">Détail des autres mouvements</p>
            <ul className="mt-2 space-y-1 text-sm">
              {projection.otherMovementsSinceLastControl.map((operation) => (
                <li key={operation.id} className="flex justify-between gap-3">
                  <span>{operationLabel(operation.type)} · {new Date(operation.occurredAt).toLocaleString("fr-FR")}</span>
                  <strong>{operation.variation > 0 ? "+" : ""}{operation.variation.toLocaleString("fr-FR")} {unit(Math.abs(operation.variation))}</strong>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <Label className="space-y-2">
          <span>Stock réel constaté</span>
          <div className="flex items-center gap-2">
            <Input type="number" min="0" step="any" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
            <span className="min-w-20 text-sm text-muted-foreground">{unit(observed ?? undefined)}</span>
          </div>
        </Label>

        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-xs font-black uppercase text-muted-foreground">Consommation constatée / écart de stock</p>
          <p className="mt-1 text-2xl font-black">
            {gap === null ? "—" : `${Math.abs(gap).toLocaleString("fr-FR")} ${unit(Math.abs(gap))}`}
          </p>
          {gap !== null ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {gap > 0
                ? "Le stock réel est inférieur au stock théorique."
                : gap < 0
                  ? "Le stock réel est supérieur au stock théorique : surplus constaté."
                  : "Aucun écart constaté."}
            </p>
          ) : null}
        </div>

        <Label className="space-y-2">
          <span>Commentaire facultatif</span>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Ex. utilisation cuisine, perte, renversement, erreur de comptage…"
          />
        </Label>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {success ? <p className="text-sm text-emerald-600">{success}</p> : null}
        <div className="flex gap-2">
          <Button disabled={busy || observed === null || observed < 0} onClick={() => void onSubmit()}>
            {busy ? "Enregistrement…" : "Valider le contrôle"}
          </Button>
          <Button asChild variant="outline"><Link href={`/manager/stock/${String(article.id)}`}>Annuler</Link></Button>
        </div>
      </CardContent>
    </Card>
  </Page>
}

function ControlMetric({ label, value, help }: { label: string; value: string; help?: string }) {
  return <div className="rounded-lg border p-3">
    <p className="text-xs font-black uppercase text-muted-foreground">{label}</p>
    <p className="mt-1 text-lg font-bold">{value}</p>
    {help ? <p className="mt-1 text-xs text-muted-foreground">{help}</p> : null}
  </div>
}

function operationLabel(type: ControlledStockOperation["type"]) {
  if (type === "APPROVISIONNEMENT") return "Approvisionnement"
  if (type === "CONTROLE_PHYSIQUE") return "Contrôle physique"
  if (type === "PERTE") return "Perte"
  if (type === "CORRECTION_POSITIVE") return "Correction positive"
  if (type === "CORRECTION_NEGATIVE") return "Correction négative"
  if (type === "AUTOMATIC_DEDUCTION") return "Déduction automatique"
  return "Compensation automatique"
}

function StatePanel({ title, text, retry }: { title: string; text: string; retry?: () => void }) {
  return <Card className="m-4"><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-muted-foreground">{text}</p>{retry && <Button onClick={retry}>Réessayer</Button>}</CardContent></Card>
}

function buildPrincipal(actorId: string, restaurantId: string, legacyRole: string): StockPrincipal {
  const role: StockRole = legacyRole === "owner" ? "owner" : legacyRole === "manager" ? "manager" : legacyRole === "kitchen" ? "kitchen_chef" : "employee"
  return { actorId: actorId as ActorId, role, capabilities: capabilitiesForControlledStockRole(role), scope: { restaurantId: restaurantId as RestaurantId } }
}

function toMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : "Une erreur inattendue est survenue."
}

async function listAllOperations(
  service: ControlledStockService,
  restaurantId: string,
  principal: StockPrincipal,
  articleId?: string
) {
  const operations: ControlledStockOperation[] = []
  let cursor: string | undefined
  do {
    const page = await service.listOperations(
      { restaurantId, articleId, pageSize: 100, cursor },
      principal
    )
    operations.push(...page.items)
    cursor = page.nextCursor ?? undefined
  } while (cursor)
  return operations
}
