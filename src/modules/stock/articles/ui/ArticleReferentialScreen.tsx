"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { collection } from "firebase/firestore"
import {
  Archive,
  ArrowLeft,
  Boxes,
  ChevronDown,
  ClipboardCheck,
  CupSoda,
  Droplets,
  Drumstick,
  Fish,
  FolderTree,
  Library,
  Package,
  PackagePlus,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  ShoppingBasket,
  Users,
  Warehouse,
  Wheat,
} from "lucide-react"

import { AdminRouteSkeleton } from "@/components/performance/route-skeletons"
import { ManagerPeriodFilter } from "@/components/layout/manager-period-filter"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { useTenant } from "@/design-system/context/TenantProvider"
import { PageHeader as DesignPageHeader } from "@/design-system/components"

import { ArticleService } from "../application/article-service"
import {
  capabilitiesForArticleRole,
  canPerformArticleAction,
} from "../application/authorization"
import type {
  ArticlePackagingInput,
  ArticleTrackingMode,
  StockArticle,
  StockArticleCategory,
} from "../domain/article"
import { ARTICLE_LIBRARY } from "../domain/article-library"
import type { StockPrincipal } from "../../core/permissions"
import type {
  ActorId,
  RestaurantId,
  StockRole,
} from "../../core/value-objects"
import {
  getArticleFeatureFlagConfiguration,
  isArticleReferentialEnabled,
} from "../feature-flag"
import {
  FirestoreArticleCategoryRepository,
  FirestoreArticleRepository,
} from "../infrastructure/firestore-article-repositories"

type ScreenMode = "list" | "create" | "detail" | "categories"

export function ArticleReferentialScreen({
  mode,
  articleId,
}: {
  mode: ScreenMode
  articleId?: string
}) {
  const db = useFirestore()
  const router = useRouter()
  const { user, restaurantId, role, loading } = useTenant()
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const service = React.useMemo(
    () =>
      db
        ? new ArticleService({
            articles: new FirestoreArticleRepository(db),
            categories: new FirestoreArticleCategoryRepository(db),
          })
        : null,
    [db]
  )
  const principal = React.useMemo(
    () =>
      restaurantId && user
        ? buildPrincipal(user.uid, restaurantId, role)
        : null,
    [restaurantId, role, user]
  )
  const enabled = restaurantId
    ? isArticleReferentialEnabled(
        restaurantId,
        getArticleFeatureFlagConfiguration()
      )
    : false

  if (loading) return <AdminRouteSkeleton />
  if (!restaurantId || !user || !principal) {
    return (
      <StatePanel
        title="Accès indisponible"
        description="Aucun restaurant actif n’est associé à cette session."
      />
    )
  }
  if (!enabled) {
    return (
      <StatePanel
        title="Stock indisponible"
        description="Le référentiel Stock V2 n’est pas activé pour ce restaurant."
      />
    )
  }
  if (!canPerformArticleAction(principal, "read", restaurantId)) {
    return (
      <StatePanel
        title="Permission refusée"
        description="Votre rôle ne permet pas de consulter le référentiel Articles."
      />
    )
  }
  if (!service) return <AdminRouteSkeleton />

  const shared = {
    service,
    principal,
    restaurantId,
    actorId: user.uid,
    busy,
    error,
    success,
    onBusy: setBusy,
    onError: setError,
    onSuccess: setSuccess,
  }

  return (
    <main className="space-y-5 pb-24 md:pb-8">
      {error ? (
        <InlineState tone="error" message={error} onClose={() => setError(null)} />
      ) : null}
      {success ? (
        <InlineState
          tone="success"
          message={success}
          onClose={() => setSuccess(null)}
        />
      ) : null}
      {mode === "list" ? <ArticleList {...shared} /> : null}
      {mode === "create" ? (
        <ArticleEditor
          {...shared}
          onCompleted={(id) => router.push(`/manager/stock/articles/${id}`)}
        />
      ) : null}
      {mode === "detail" && articleId ? (
        <ArticleDetail {...shared} articleId={articleId} />
      ) : null}
      {mode === "categories" ? <CategoryManager {...shared} /> : null}
    </main>
  )
}

type SharedProps = {
  service: ArticleService
  principal: StockPrincipal
  restaurantId: string
  actorId: string
  busy: boolean
  error: string | null
  success: string | null
  onBusy: (value: boolean) => void
  onError: (value: string | null) => void
  onSuccess: (value: string | null) => void
}

function ArticleList(props: SharedProps) {
  const db = useFirestore()
  const [items, setItems] = React.useState<readonly StockArticle[]>([])
  const [categories, setCategories] = React.useState<
    readonly StockArticleCategory[]
  >([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState("")
  const [categoryId, setCategoryId] = React.useState("")
  const [status, setStatus] = React.useState<"active" | "archived" | "all">(
    "active"
  )
  const [cursor, setCursor] = React.useState<string | undefined>()
  const [nextCursor, setNextCursor] = React.useState<string | null>(null)
  const [libraryOpen, setLibraryOpen] = React.useState(false)
  const [selectedTemplates, setSelectedTemplates] = React.useState<string[]>([])
  const balancesQuery = useMemoFirebase(
    () =>
      db
        ? collection(db, "restaurants", props.restaurantId, "stockBalancesV2")
        : null,
    [db, props.restaurantId]
  )
  const suppliersQuery = useMemoFirebase(
    () =>
      db
        ? collection(db, "restaurants", props.restaurantId, "suppliers")
        : null,
    [db, props.restaurantId]
  )
  const { data: balances } = useCollection<any>(balancesQuery)
  const { data: suppliers } = useCollection<any>(suppliersQuery)
  const balanceByArticle = new Map(
    (balances || []).map((balance) => [balance.articleId || balance.id, Number(balance.quantity || 0)])
  )

  const load = React.useCallback(async () => {
    setLoading(true)
    props.onError(null)
    try {
      const [page, categoryRows] = await Promise.all([
        props.service.listArticles(
          {
            restaurantId: props.restaurantId,
            search,
            categoryId: categoryId || undefined,
            status,
            pageSize: 20,
            cursor,
          },
          props.principal
        ),
        props.service.listCategories(props.restaurantId, props.principal),
      ])
      setItems(page.items)
      setNextCursor(page.nextCursor)
      setCategories(categoryRows)
    } catch (cause) {
      props.onError(toMessage(cause))
    } finally {
      setLoading(false)
    }
  }, [
    categoryId,
    cursor,
    props.onError,
    props.principal,
    props.restaurantId,
    props.service,
    search,
    status,
  ])

  React.useEffect(() => {
    void load()
  }, [load])

  const canCreate = canPerformArticleAction(
    props.principal,
    "create",
    props.restaurantId
  )

  const importSelected = async () => {
    const templates = ARTICLE_LIBRARY.flatMap((group) => group.articles).filter(
      (template) => selectedTemplates.includes(template.id)
    )
    if (templates.length === 0) return
    props.onBusy(true)
    props.onError(null)
    try {
      const existingNames = new Set(items.map((item) => item.name.trim().toLocaleLowerCase("fr")))
      let created = 0
      for (const template of templates) {
        if (existingNames.has(template.name.trim().toLocaleLowerCase("fr"))) continue
        await props.service.createArticle(
          {
            restaurantId: props.restaurantId,
            actorId: props.actorId,
            name: template.name,
            baseUnit: template.baseUnit,
            trackingMode: template.trackingMode,
            lowStockThreshold: template.lowStockThreshold,
            outOfStockThreshold: template.outOfStockThreshold,
            packagings: [],
          },
          props.principal
        )
        existingNames.add(template.name.trim().toLocaleLowerCase("fr"))
        created += 1
      }
      props.onSuccess(
        created > 0
          ? `${created} article(s) importé(s). Le stock reste à zéro jusqu’au premier approvisionnement ou contrôle.`
          : "Les articles sélectionnés existent déjà."
      )
      setLibraryOpen(false)
      setSelectedTemplates([])
      await load()
    } catch (cause) {
      props.onError(toMessage(cause))
    } finally {
      props.onBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Articles de stock"
        description="Étape 1 : créez les objets physiques du restaurant. Leur quantité provient ensuite des approvisionnements et contrôles."
        periodFilter
      />

      <div
        className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:justify-end"
        aria-label="Actions des articles de stock"
      >
        <Button asChild variant="outline" className="w-full lg:w-auto">
          <Link href="/manager/stock/controls">
            <RotateCcw className="mr-2 h-4 w-4" />
            Contrôles du jour
          </Link>
        </Button>
        <Button asChild variant="outline" className="w-full lg:w-auto">
          <Link href="/manager/stock/articles/categories">
            <FolderTree className="mr-2 h-4 w-4" />
            Catégories
          </Link>
        </Button>
        {canCreate ? (
          <Button
            variant="outline"
            className="w-full lg:w-auto"
            onClick={() => setLibraryOpen(true)}
          >
            <Library className="mr-2 h-4 w-4" />
            Importer depuis la bibliothèque
          </Button>
        ) : null}
        {canCreate ? (
          <Button asChild className="w-full lg:w-auto">
            <Link href="/manager/stock/articles/new">
              <Plus className="mr-2 h-4 w-4" />
              Nouvel article
            </Link>
          </Button>
        ) : null}
      </div>

      {libraryOpen ? (
        <Card>
          <CardHeader>
            <CardTitle>Bibliothèque d’articles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sélectionnez librement les articles utiles. Rien n’est créé sans
              votre validation et aucune quantité initiale n’est ajoutée.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              {ARTICLE_LIBRARY.map((group) => (
                <section key={group.id} className="rounded-xl border p-4">
                  <h3 className="font-black">{group.name}</h3>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {group.articles.map((template) => (
                      <Label
                        key={template.id}
                        className="flex cursor-pointer items-center gap-2 rounded-lg border p-3"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTemplates.includes(template.id)}
                          onChange={(event) =>
                            setSelectedTemplates((current) =>
                              event.target.checked
                                ? [...current, template.id]
                                : current.filter((id) => id !== template.id)
                            )
                          }
                        />
                        <span>
                          {template.name}
                          <small className="block font-normal text-muted-foreground">
                            {trackingModeLabel(template.trackingMode)} ·{" "}
                            {unitLabel(template.baseUnit)}
                          </small>
                        </span>
                      </Label>
                    ))}
                  </div>
                </section>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setLibraryOpen(false)}>
                Annuler
              </Button>
              <Button
                disabled={props.busy || selectedTemplates.length === 0}
                onClick={() => void importSelected()}
              >
                Importer la sélection
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_220px_180px]">
          <Label className="space-y-2">
            <span>Rechercher</span>
            <span className="relative block">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setCursor(undefined)
                }}
                placeholder="Nom ou description"
              />
            </span>
          </Label>
          <SelectField
            label="Catégorie"
            value={categoryId}
            onChange={(value) => {
              setCategoryId(value)
              setCursor(undefined)
            }}
            options={[
              { value: "", label: "Toutes" },
              ...categories.map((category) => ({
                value: String(category.id),
                label: category.name,
              })),
            ]}
          />
          <SelectField
            label="Statut"
            value={status}
            onChange={(value) => {
              setStatus(value as typeof status)
              setCursor(undefined)
            }}
            options={[
              { value: "active", label: "Actifs" },
              { value: "archived", label: "Archivés" },
              { value: "all", label: "Tous" },
            ]}
          />
        </CardContent>
      </Card>

      {loading ? (
        <AdminRouteSkeleton />
      ) : items.length === 0 ? (
        <StatePanel
          title="Aucun article d’inventaire."
          description={
            search || categoryId
              ? "Aucun article ne correspond aux filtres."
              : "Commencez par créer un article ou choisissez librement des exemples dans la bibliothèque."
          }
          action={
            canCreate ? (
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild>
                  <Link href="/manager/stock/articles/new">
                    Créer un article
                  </Link>
                </Button>
                <Button variant="outline" onClick={() => setLibraryOpen(true)}>
                  Importer depuis la bibliothèque
                </Button>
              </div>
            ) : undefined
          }
        />
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((article) => {
            const categoryName =
              categories.find(
                (category) =>
                  String(category.id) === String(article.categoryId)
              )?.name ??
              (article.categoryId ? "Catégorie inconnue" : "Sans catégorie")
            const quantity =
              balanceByArticle.get(String(article.id)) ?? 0
            const supplierCount = (suppliers || []).filter((supplier) =>
              (supplier.articleIds || []).includes(String(article.id))
            ).length
            const health = stockHealthLabel(
              quantity,
              article.lowStockThreshold,
              article.outOfStockThreshold
            )
            const ArticleIcon = articleIcon(article.name, categoryName)

            return (
              <article
                key={String(article.id)}
                className={`group flex min-h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                  article.trackingMode === "CONTROLLED"
                    ? "border-primary/40"
                    : "hover:border-primary/30"
                }`}
              >
                <div className="flex items-start gap-3 border-b bg-muted/20 p-5">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                      article.trackingMode === "CONTROLLED"
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                    aria-hidden="true"
                  >
                    <ArticleIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-lg font-black leading-tight">
                      {article.name}
                    </h2>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {categoryName}
                    </p>
                  </div>
                  <Badge
                    variant={
                      article.status === "active" ? "secondary" : "outline"
                    }
                  >
                    {article.status === "active" ? "Actif" : "Archivé"}
                  </Badge>
                </div>

                <div className="flex flex-1 flex-col gap-4 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        article.trackingMode === "CONTROLLED"
                          ? "default"
                          : "outline"
                      }
                    >
                      {trackingModeLabel(article.trackingMode)}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      Unité&nbsp;:{" "}
                      <strong className="font-semibold text-foreground">
                        {unitLabel(article.baseUnit)}
                      </strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 overflow-hidden rounded-xl border bg-muted/25">
                    <StockMetric
                      icon={<Warehouse className="h-4 w-4" />}
                      label="Stock actuel"
                      value={
                        article.trackingMode === "NONE"
                          ? "Non suivi"
                          : `${quantity} ${unitLabel(article.baseUnit, quantity)}`
                      }
                      health={health}
                    />
                    <StockMetric
                      label="Seuil minimum"
                      value={`${article.lowStockThreshold} ${unitLabel(
                        article.baseUnit,
                        article.lowStockThreshold
                      )}`}
                      bordered
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <CardDetail
                      icon={<ShoppingBasket className="h-4 w-4" />}
                      label="Formats d’achat"
                      value={`${article.packagings.length}`}
                    />
                    <CardDetail
                      icon={<Package className="h-4 w-4" />}
                      label="Coût de référence"
                      value={
                        "referenceCost" in article
                          ? `${formatMoney(article.referenceCost)} FCFA`
                          : "Non renseigné"
                      }
                    />
                    <CardDetail
                      icon={<Users className="h-4 w-4" />}
                      label="Fournisseurs"
                      value={`${supplierCount}`}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 border-t bg-muted/10 px-5 py-4">
                  <Button asChild size="sm" variant="ghost">
                    <Link
                      href={`/manager/stock/articles/${article.id}`}
                      aria-label={`Modifier ${article.name}`}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Modifier
                    </Link>
                  </Button>
                  {article.status === "active" &&
                  article.trackingMode === "CONTROLLED" ? (
                    <Button asChild size="sm">
                      <Link
                        href={`/manager/stock/${article.id}/control`}
                        aria-label={`Effectuer le contrôle de ${article.name}`}
                      >
                        <ClipboardCheck className="mr-2 h-4 w-4" />
                        Effectuer le contrôle
                      </Link>
                    </Button>
                  ) : null}
                  {article.status === "active" &&
                  article.trackingMode === "AUTOMATIC_SIMPLE" ? (
                    <Button asChild size="sm">
                      <Link
                        href={`/manager/expenses?type=supply&articleId=${encodeURIComponent(String(article.id))}`}
                        aria-label={`Approvisionner ${article.name}`}
                      >
                        <PackagePlus className="mr-2 h-4 w-4" />
                        Approvisionner
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </article>
            )
          })}
        </section>
      )}

      <div className="flex justify-end gap-2">
        {cursor ? (
          <Button variant="outline" onClick={() => setCursor(undefined)}>
            Première page
          </Button>
        ) : null}
        {nextCursor ? (
          <Button variant="outline" onClick={() => setCursor(nextCursor)}>
            Page suivante
          </Button>
        ) : null}
      </div>
    </>
  )
}

function ArticleEditor(
  props: SharedProps & {
    article?: StockArticle
    onCompleted?: (articleId: string) => void
  }
) {
  const [categories, setCategories] = React.useState<
    readonly StockArticleCategory[]
  >([])
  const [name, setName] = React.useState(props.article?.name ?? "")
  const [description, setDescription] = React.useState(
    props.article?.description ?? ""
  )
  const [categoryId, setCategoryId] = React.useState(
    String(props.article?.categoryId ?? "")
  )
  const [baseUnit, setBaseUnit] = React.useState(
    props.article?.baseUnit ?? "unit"
  )
  const [lowThreshold, setLowThreshold] = React.useState(
    String(props.article?.lowStockThreshold ?? 0)
  )
  const [outThreshold, setOutThreshold] = React.useState(
    String(props.article?.outOfStockThreshold ?? 0)
  )
  const [referenceCost, setReferenceCost] = React.useState(
    props.article?.referenceCost === undefined
      ? ""
      : String(props.article.referenceCost)
  )
  const [trackingMode, setTrackingMode] = React.useState<ArticleTrackingMode>(
    props.article?.trackingMode ?? "CONTROLLED"
  )
  const [packagings, setPackagings] = React.useState<
    ArticlePackagingInput[]
  >(
    props.article?.packagings.map((packaging) => ({ ...packaging })) ?? []
  )

  React.useEffect(() => {
    props.service
      .listCategories(props.restaurantId, props.principal)
      .then((rows) => {
        const active = rows.filter((row) => row.status === "active")
        setCategories(active)
      })
      .catch((cause) => props.onError(toMessage(cause)))
  }, [
    props.onError,
    props.principal,
    props.restaurantId,
    props.service,
  ])

  const editing = Boolean(props.article)
  const canUpdateCost = canPerformArticleAction(
    props.principal,
    "update_cost",
    props.restaurantId
  )
  const canPackage = canPerformArticleAction(
    props.principal,
    "manage_packagings",
    props.restaurantId
  )

  const submit = async () => {
    props.onBusy(true)
    props.onError(null)
    props.onSuccess(null)
    try {
      if (editing && props.article) {
        const updated = await props.service.updateArticle(
          props.restaurantId,
          String(props.article.id),
          {
            name,
            description,
            categoryId,
            baseUnit,
            lowStockThreshold: Number(lowThreshold),
            outOfStockThreshold: Number(outThreshold),
            trackingMode,
            ...(canUpdateCost
              ? referenceCost === ""
                ? { removeReferenceCost: true }
                : { referenceCost: Number(referenceCost) }
              : {}),
            ...(canPackage ? { packagings } : {}),
            actorId: props.actorId,
          },
          props.principal
        )
        props.onSuccess("Article modifié.")
        props.onCompleted?.(String(updated.id))
      } else {
        const result = await props.service.createArticle(
          {
            restaurantId: props.restaurantId,
            actorId: props.actorId,
            name,
            description,
            categoryId,
            baseUnit,
            lowStockThreshold: Number(lowThreshold),
            outOfStockThreshold: Number(outThreshold),
            trackingMode,
            ...(canUpdateCost && referenceCost !== ""
              ? { referenceCost: Number(referenceCost) }
              : {}),
            ...(canPackage ? { packagings } : {}),
          },
          props.principal
        )
        props.onSuccess("Article créé.")
        props.onCompleted?.(String(result.article.id))
      }
    } catch (cause) {
      props.onError(toMessage(cause))
    } finally {
      props.onBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title={editing ? "Modifier l’article" : "Nouvel article"}
        description="Un Article décrit ce qui est stockable. Il ne contient aucune quantité."
        backToArticles={editing}
        actions={
          editing ? undefined : (
            <Button asChild variant="outline">
              <Link href="/manager/stock">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour aux articles
              </Link>
            </Button>
          )
        }
      />
      {(
        <Card>
          <CardHeader>
            <CardTitle>Informations de l’Article</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <TextField label="Nom" value={name} onChange={setName} required />
              <SelectField
                label="Catégorie"
                value={categoryId}
                onChange={setCategoryId}
                options={[
                  { value: "", label: "Sans catégorie" },
                  ...categories.map((category) => ({
                    value: String(category.id),
                    label: category.name,
                  })),
                ]}
              />
              <SelectField
                label="Unité de base"
                value={baseUnit}
                onChange={(value) => {
                  setBaseUnit(value as typeof baseUnit)
                  setPackagings((current) =>
                    current.map((packaging) => ({
                      ...packaging,
                      targetUnit: value,
                    }))
                  )
                }}
                options={[
                  { value: "unit", label: "Unité" },
                  { value: "kg", label: "Kilogramme" },
                  { value: "g", label: "Gramme" },
                  { value: "l", label: "Litre" },
                  { value: "ml", label: "Millilitre" },
                ]}
              />
              {canUpdateCost ? (
                <TextField
                  label="Coût de référence (facultatif)"
                  value={referenceCost}
                  onChange={setReferenceCost}
                  type="number"
                />
              ) : null}
              <TextField
                label="Seuil minimum (alerte de stock faible)"
                value={lowThreshold}
                onChange={setLowThreshold}
                type="number"
                help={`Une alerte apparaît lorsque le stock atteint cette quantité, exprimée en ${unitLabel(baseUnit).toLocaleLowerCase("fr")}.`}
              />
              <TextField
                label="Seuil de rupture"
                value={outThreshold}
                onChange={setOutThreshold}
                type="number"
              />
              <SelectField
                label="Mode de suivi"
                value={trackingMode}
                onChange={(value) =>
                  setTrackingMode(value as ArticleTrackingMode)
                }
                options={[
                  {
                    value: "CONTROLLED",
                    label: "Stock contrôlé",
                  },
                  {
                    value: "AUTOMATIC_SIMPLE",
                    label: "Automatique simple",
                  },
                  {
                    value: "NONE",
                    label: "Sans suivi quantitatif",
                  },
                ]}
              />
            </div>
            <div className="space-y-2">
              <Label>Description facultative</Label>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            {canPackage ? (
              <PackagingEditor
                baseUnit={baseUnit}
                value={packagings}
                onChange={setPackagings}
              />
            ) : null}
            <div className="flex justify-end">
              <Button
                disabled={props.busy || !name.trim()}
                onClick={submit}
              >
                <PackagePlus className="mr-2 h-4 w-4" />
                {props.busy
                  ? "Enregistrement…"
                  : editing
                    ? "Enregistrer"
                    : "Créer l’Article"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  )
}

function ArticleDetail(props: SharedProps & { articleId: string }) {
  const [article, setArticle] = React.useState<StockArticle | null>(null)
  const [loading, setLoading] = React.useState(true)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      setArticle(
        await props.service.getArticle(
          props.restaurantId,
          props.articleId,
          props.principal
        )
      )
    } catch (cause) {
      props.onError(toMessage(cause))
    } finally {
      setLoading(false)
    }
  }, [
    props.articleId,
    props.onError,
    props.principal,
    props.restaurantId,
    props.service,
  ])

  React.useEffect(() => {
    void load()
  }, [load])

  if (loading) return <AdminRouteSkeleton />
  if (!article) {
    return (
      <StatePanel
        title="Article introuvable"
        description="Cet Article n’existe pas ou n’est pas accessible."
      />
    )
  }

  const canUpdate = canPerformArticleAction(
    props.principal,
    "update",
    props.restaurantId
  )
  const canArchive = canPerformArticleAction(
    props.principal,
    "archive",
    props.restaurantId
  )

  const toggleArchive = async () => {
    props.onBusy(true)
    try {
      const updated =
        article.status === "active"
          ? await props.service.archiveArticle(
              props.restaurantId,
              props.articleId,
              props.actorId,
              props.principal
            )
          : await props.service.restoreArticle(
              props.restaurantId,
              props.articleId,
              props.actorId,
              props.principal
            )
      setArticle(updated)
      props.onSuccess(
        updated.status === "active" ? "Article restauré." : "Article archivé."
      )
    } catch (cause) {
      props.onError(toMessage(cause))
    } finally {
      props.onBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title={article.name}
        backToArticles
        description={
          article.status === "archived"
            ? "Article archivé : historique lisible, nouvelle utilisation interdite."
            : "Fiche du référentiel Article, indépendante des quantités."
        }
        actions={
          <>
            {canArchive ? (
              <Button
                variant="outline"
                disabled={props.busy}
                onClick={toggleArchive}
              >
                {article.status === "active" ? (
                  <Archive className="mr-2 h-4 w-4" />
                ) : (
                  <RotateCcw className="mr-2 h-4 w-4" />
                )}
                {article.status === "active" ? "Archiver" : "Restaurer"}
              </Button>
            ) : null}
          </>
        }
      />
      {article.status === "archived" ? (
        <InlineState
          tone="error"
          message="Cet Article est archivé et ne peut plus être utilisé dans une nouvelle opération."
        />
      ) : null}
      {canUpdate && article.status === "active" ? (
        <ArticleEditor {...props} article={article} onCompleted={() => void load()} />
      ) : (
        <Card>
          <CardContent className="grid gap-4 p-5 md:grid-cols-3">
            <Info label="Unité" value={unitLabel(article.baseUnit)} />
            <Info
              label="Mode de suivi"
              value={trackingModeLabel(article.trackingMode)}
            />
            <Info
              label="Seuil faible"
              value={String(article.lowStockThreshold)}
            />
            <Info
              label="Seuil rupture"
              value={String(article.outOfStockThreshold)}
            />
            <Info
              label="Formats d’achat"
              value={String(article.packagings.length)}
            />
            {"referenceCost" in article ? (
              <Info
                label="Coût de référence"
                value={`${formatMoney(article.referenceCost)} FCFA`}
              />
            ) : null}
          </CardContent>
        </Card>
      )}
    </>
  )
}

function CategoryManager(props: SharedProps) {
  const [rows, setRows] = React.useState<readonly StockArticleCategory[]>([])
  const [loading, setLoading] = React.useState(true)
  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [sortOrder, setSortOrder] = React.useState("0")
  const canManage = canPerformArticleAction(
    props.principal,
    "manage_categories",
    props.restaurantId
  )

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      setRows(
        await props.service.listCategories(
          props.restaurantId,
          props.principal
        )
      )
    } catch (cause) {
      props.onError(toMessage(cause))
    } finally {
      setLoading(false)
    }
  }, [
    props.onError,
    props.principal,
    props.restaurantId,
    props.service,
  ])

  React.useEffect(() => {
    void load()
  }, [load])

  const create = async () => {
    props.onBusy(true)
    try {
      await props.service.createCategory(
        {
          restaurantId: props.restaurantId,
          actorId: props.actorId,
          name,
          description,
          sortOrder: Number(sortOrder),
        },
        props.principal
      )
      setName("")
      setDescription("")
      props.onSuccess("Catégorie créée.")
      await load()
    } catch (cause) {
      props.onError(toMessage(cause))
    } finally {
      props.onBusy(false)
    }
  }

  const archive = async (category: StockArticleCategory) => {
    props.onBusy(true)
    try {
      await props.service.archiveCategory(
        props.restaurantId,
        String(category.id),
        props.actorId,
        props.principal
      )
      props.onSuccess("Catégorie archivée.")
      await load()
    } catch (cause) {
      props.onError(toMessage(cause))
    } finally {
      props.onBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Catégories d’Articles"
        description="Catégories propres à ce restaurant. Aucune catégorie globale n’est imposée."
        actions={
          <Button asChild variant="outline">
            <Link href="/manager/stock/articles">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Articles
            </Link>
          </Button>
        }
      />
      {!canManage ? (
        <StatePanel
          title="Consultation uniquement"
          description="Votre rôle ne permet pas de gérer les catégories."
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Nouvelle catégorie</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-[1fr_1fr_120px_auto] md:items-end">
            <TextField label="Nom" value={name} onChange={setName} />
            <TextField
              label="Description"
              value={description}
              onChange={setDescription}
            />
            <TextField
              label="Ordre"
              value={sortOrder}
              onChange={setSortOrder}
              type="number"
            />
            <Button disabled={props.busy || !name.trim()} onClick={create}>
              Créer
            </Button>
          </CardContent>
        </Card>
      )}
      {loading ? (
        <AdminRouteSkeleton />
      ) : rows.length === 0 ? (
        <StatePanel
          title="Aucune catégorie"
          description="Créez la première catégorie du restaurant."
        />
      ) : (
        <section className="grid gap-3 md:grid-cols-2">
          {rows.map((category) => (
            <Card key={String(category.id)}>
              <CardContent className="flex items-start justify-between gap-4 p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-black">{category.name}</h2>
                    <Badge variant="outline">
                      {category.status === "active" ? "Active" : "Archivée"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {category.description || "Sans description"} · ordre{" "}
                    {category.sortOrder}
                  </p>
                </div>
                {canManage && category.status === "active" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={props.busy}
                    onClick={() => archive(category)}
                  >
                    Archiver
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </>
  )
}

function PackagingEditor({
  baseUnit,
  value,
  onChange,
}: {
  baseUnit: string
  value: ArticlePackagingInput[]
  onChange: (value: ArticlePackagingInput[]) => void
}) {
  const [open, setOpen] = React.useState(false)
  const add = () =>
    onChange([
      ...value,
      {
        id: `packaging-${value.length + 1}`,
        kind: "other",
        name: "",
        quantity: 1,
        targetUnit: baseUnit,
        active: true,
      },
    ])

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <section className="space-y-3 rounded-xl border p-4">
        <CollapsibleTrigger asChild>
          <button type="button" className="flex w-full items-start justify-between gap-3 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <div>
              <h3 className="font-black">Formats d’achat (facultatif)</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Définissez les formats dans lesquels vous achetez cet article : carton, sac, bidon, pack, bouteille… Le stock reste toujours suivi dans son unité de base.
              </p>
            </div>
            <span className="flex shrink-0 items-center gap-2 text-xs font-bold text-muted-foreground">
              {value.length > 0 ? `${value.length} format${value.length > 1 ? "s" : ""}` : "Configurer"}
              <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2">
          <div className="flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={add}>
              <Boxes className="mr-2 h-4 w-4" />
              Ajouter un format
            </Button>
          </div>
          <datalist id="purchase-format-suggestions">
            {["Carton", "Pack", "Sac", "Bidon", "Bouteille", "Boîte", "Seau", "Caisse"].map((name) => <option key={name} value={name} />)}
          </datalist>
          {value.length === 0 ? (
            <p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
              Exemple : un carton contenant 24 {unitLabel(baseUnit).toLocaleLowerCase("fr")}.
            </p>
          ) : null}
          {value.map((packaging, index) => (
            <div key={packaging.id ?? index} className="grid gap-3 rounded-lg bg-muted/40 p-3 md:grid-cols-[1fr_180px_160px_auto] md:items-end">
              <label className="space-y-2 text-sm font-medium">
                <span>Nom du format</span>
                <Input
                  list="purchase-format-suggestions"
                  value={packaging.name}
                  placeholder="Ex. Carton"
                  required
                  onChange={(event) =>
                    onChange(value.map((row, rowIndex) =>
                      rowIndex === index ? { ...row, name: event.target.value } : row
                    ))
                  }
                />
              </label>
              <label className="space-y-2 text-sm font-medium">
                <span>Quantité contenue</span>
                <Input
                  type="number"
                  min="0.01"
                  step="any"
                  value={packaging.quantity}
                  required
                  onChange={(event) =>
                    onChange(value.map((row, rowIndex) =>
                      rowIndex === index ? { ...row, quantity: Number(event.target.value) } : row
                    ))
                  }
                />
              </label>
              <label className="space-y-2 text-sm font-medium">
                <span>Unité de base</span>
                <Input value={unitLabel(baseUnit).toLocaleLowerCase("fr")} readOnly aria-readonly="true" />
              </label>
              <Button type="button" variant="ghost" onClick={() => onChange(value.filter((_, rowIndex) => rowIndex !== index))}>
                Supprimer
              </Button>
            </div>
          ))}
        </CollapsibleContent>
      </section>
    </Collapsible>
  )
}

function PageHeader({
  title,
  description,
  actions,
  backToArticles = false,
  periodFilter = false,
}: {
  title: string
  description: string
  actions?: React.ReactNode
  backToArticles?: boolean
  periodFilter?: boolean
}) {
  return (
    <DesignPageHeader
      title={
        <span className={periodFilter ? "whitespace-nowrap" : undefined}>
          {title}
        </span>
      }
      subtitle={description}
      className={periodFilter ? "sm:flex-col lg:flex-row" : undefined}
      eyebrow={
        backToArticles ? (
          <Link
            href="/manager/stock"
            className="inline-flex items-center text-sm font-medium normal-case tracking-normal text-muted-foreground hover:text-foreground focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Retour aux articles
          </Link>
        ) : undefined
      }
      action={
        periodFilter || actions ? (
          <>
            {periodFilter ? <ManagerPeriodFilter /> : null}
            {actions}
          </>
        ) : null}
    />
  )
}

function StatePanel({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="flex min-h-48 flex-col items-center justify-center gap-4 p-8 text-center">
        <Boxes className="h-10 w-10 text-muted-foreground" />
        <div>
          <h2 className="text-lg font-black">{title}</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            {description}
          </p>
        </div>
        {action}
      </CardContent>
    </Card>
  )
}

function InlineState({
  tone,
  message,
  onClose,
}: {
  tone: "error" | "success"
  message: string
  onClose?: () => void
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={
        tone === "error"
          ? "flex items-center justify-between rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          : "flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800"
      }
    >
      <span>{message}</span>
      {onClose ? (
        <Button variant="ghost" size="sm" onClick={onClose}>
          Fermer
        </Button>
      ) : null}
    </div>
  )
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  required,
  help,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  required?: boolean
  help?: string
}) {
  return (
    <Label className="space-y-2">
      <span>
        {label}
        {required ? " *" : ""}
      </span>
      <Input
        type={type}
        min={type === "number" ? 0 : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {help ? (
        <span className="block text-xs font-normal text-muted-foreground">
          {help}
        </span>
      ) : null}
    </Label>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: readonly { value: string; label: string }[]
}) {
  return (
    <Label className="space-y-2">
      <span>{label}</span>
      <select
        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Label>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-muted-foreground">
        {label}
      </p>
      <p className="font-semibold">{value}</p>
    </div>
  )
}

function StockMetric({
  icon,
  label,
  value,
  health,
  bordered = false,
}: {
  icon?: React.ReactNode
  label: string
  value: string
  health?: string
  bordered?: boolean
}) {
  return (
    <div className={`p-3.5 ${bordered ? "border-l" : ""}`}>
      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-base font-black">{value}</p>
      {health ? (
        <p
          className={`mt-1 text-xs font-semibold ${
            health === "Rupture"
              ? "text-destructive"
              : health === "Stock faible"
                ? "text-amber-700"
                : "text-emerald-700"
          }`}
        >
          {health}
        </p>
      ) : null}
    </div>
  )
}

function CardDetail({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <span className="mt-0.5 text-muted-foreground" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate font-semibold">{value}</p>
      </div>
    </div>
  )
}

function articleIcon(name: string, category: string) {
  const description = `${name} ${category}`.toLocaleLowerCase("fr")
  if (
    description.includes("boisson") ||
    description.includes("coca") ||
    description.includes("eau") ||
    description.includes("jus")
  ) {
    return CupSoda
  }
  if (description.includes("huile") || description.includes("liquide")) {
    return Droplets
  }
  if (description.includes("poisson")) return Fish
  if (
    description.includes("poulet") ||
    description.includes("viande") ||
    description.includes("volaille")
  ) {
    return Drumstick
  }
  if (
    description.includes("pain") ||
    description.includes("farine") ||
    description.includes("céréale")
  ) {
    return Wheat
  }
  return Package
}

function buildPrincipal(
  actorId: string,
  restaurantId: string,
  legacyRole: string
): StockPrincipal {
  const role = toStockRole(legacyRole)
  return {
    actorId: actorId as ActorId,
    role,
    capabilities: capabilitiesForArticleRole(role),
    scope: { restaurantId: restaurantId as RestaurantId },
  }
}

function toStockRole(role: string): StockRole {
  if (role === "owner") return "owner"
  if (role === "manager") return "manager"
  if (role === "kitchen") return "kitchen_chef"
  return "employee"
}

function toMessage(cause: unknown) {
  return cause instanceof Error
    ? cause.message
    : "Une erreur inattendue est survenue."
}

function unitLabel(unit: string, quantity?: number) {
  if (unit === "unit") return quantity === 1 ? "pièce" : "pièces"
  if (unit === "kg") return "kg"
  if (unit === "g") return "g"
  if (unit === "l") return quantity === 1 ? "litre" : "litres"
  return "ml"
}

function trackingModeLabel(mode: ArticleTrackingMode) {
  if (mode === "AUTOMATIC_SIMPLE") return "Automatique"
  if (mode === "NONE") return "Sans suivi quantitatif"
  return "Contrôle manuel"
}

function stockHealthLabel(
  quantity: number,
  lowStockThreshold: number,
  outOfStockThreshold: number
) {
  if (quantity <= outOfStockThreshold) return "Rupture"
  if (quantity <= lowStockThreshold) return "Stock faible"
  return "Normal"
}

function formatMoney(value: unknown) {
  const amount = Number(value)
  return Number.isFinite(amount)
    ? Math.round(amount).toLocaleString("fr-FR")
    : "—"
}
