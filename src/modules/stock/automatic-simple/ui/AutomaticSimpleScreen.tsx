"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { collection, getDocs } from "firebase/firestore"

import { AdminRouteSkeleton } from "@/components/performance/route-skeletons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useTenant } from "@/design-system/context/TenantProvider"
import { PageHeader } from "@/design-system/components"
import { useFirestore } from "@/firebase"

import type { StockPrincipal } from "../../core/permissions"
import type { ActorId, RestaurantId, StockRole } from "../../core/value-objects"
import type { StockArticle } from "../../articles/domain/article"
import { FirestoreArticleRepository } from "../../articles/infrastructure/firestore-article-repositories"
import { capabilitiesForControlledStockRole } from "../../controlled-stock/application/authorization"
import {
  getControlledStockFeatureConfiguration,
  isControlledStockEnabled,
} from "../../controlled-stock/feature-flag"
import { FirestoreControlledStockRepository } from "../../controlled-stock/infrastructure/firestore-controlled-stock-repository"
import { AutomaticSimpleService } from "../application/automatic-simple-service"
import type { AutomaticAssociation } from "../domain/models"
import {
  FirestoreAutomaticAssociationRepository,
  FirestoreProductLookup,
} from "../infrastructure/firestore-automatic-association-repository"
import { isAutomaticSimpleEnabled } from "../application/automatic-simple-service"
import { getAutomaticSimpleFeatureConfiguration } from "../feature-flag"

export function AutomaticSimpleScreen() {
  const router = useRouter()
  const db = useFirestore()
  const { user, restaurantId, role, loading } = useTenant()
  const [articles, setArticles] = React.useState<readonly StockArticle[]>([])
  const [products, setProducts] = React.useState<readonly { id: string; name: string }[]>([])
  const [associations, setAssociations] = React.useState<readonly AutomaticAssociation[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const principal = React.useMemo(
    () => user && restaurantId ? buildPrincipal(user.uid, restaurantId, role) : null,
    [restaurantId, role, user]
  )
  const enabled = restaurantId
    ? isControlledStockEnabled(restaurantId, getControlledStockFeatureConfiguration())
      && isAutomaticSimpleEnabled(restaurantId, getAutomaticSimpleFeatureConfiguration())
    : false

  const load = React.useCallback(async () => {
    if (!db || !restaurantId || !principal) return
    setBusy(true)
    setError(null)
    try {
      const articleRepository = new FirestoreArticleRepository(db)
      const associationRepository = new FirestoreAutomaticAssociationRepository(db)
      const service = new AutomaticSimpleService({
        articles: articleRepository,
        associations: associationRepository,
        products: new FirestoreProductLookup(db),
        stock: new FirestoreControlledStockRepository(db),
      })
      const [articlePage, productSnapshot, links] = await Promise.all([
        articleRepository.list({ restaurantId, status: "all", pageSize: 100 }),
        getDocs(collection(db, "restaurants", restaurantId, "products")),
        service.listAssociations(restaurantId, principal),
      ])
      const productRows = productSnapshot.docs
        .filter((item) => item.data().isActive !== false)
        .map((item) => ({
          id: item.id,
          name: String(item.data().name ?? item.data().label ?? "Produit"),
        }))
      setArticles(articlePage.items)
      setProducts(productRows)
      setAssociations(links)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Chargement impossible.")
    } finally {
      setBusy(false)
    }
  }, [db, principal, restaurantId])

  React.useEffect(() => { if (enabled) void load() }, [enabled, load])
  React.useEffect(() => {
    if (!loading && restaurantId && !enabled) router.replace("/manager/stock")
  }, [enabled, loading, restaurantId, router])

  if (loading || busy && associations.length === 0 && !error) return <AdminRouteSkeleton />
  if (!restaurantId || !user || !principal) return <State title="Accès indisponible" text="Aucun restaurant actif." />
  if (!enabled) return <AdminRouteSkeleton />
  if (error) return <State title="Chargement impossible" text={error} retry={load} />
  return <Associations
    articles={articles}
    products={products}
    associations={associations}
    busy={busy}
    onCreate={async (productId, articleId, quantity) => {
      if (!db) return
      setBusy(true); setError(null)
      try {
        const article = articles.find((item) => String(item.id) === articleId)
        if (!article) throw new Error("Article introuvable.")
        const service = new AutomaticSimpleService({
          articles: new FirestoreArticleRepository(db),
          associations: new FirestoreAutomaticAssociationRepository(db),
          products: new FirestoreProductLookup(db),
          stock: new FirestoreControlledStockRepository(db),
        })
        await service.createAssociation({
          restaurantId,
          productId,
          articleId,
          quantity,
          unit: article.baseUnit,
          actorId: user.uid,
        }, principal)
        await load()
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Enregistrement impossible.")
        setBusy(false)
      }
    }}
    onDisable={async (id) => {
      if (!db) return
      const service = new AutomaticSimpleService({
        articles: new FirestoreArticleRepository(db),
        associations: new FirestoreAutomaticAssociationRepository(db),
        products: new FirestoreProductLookup(db),
        stock: new FirestoreControlledStockRepository(db),
      })
      await service.disableAssociation(restaurantId, id, user.uid, principal)
      await load()
    }}
    onUpdate={async (id, quantity, unit) => {
      if (!db) return
      const service = new AutomaticSimpleService({
        articles: new FirestoreArticleRepository(db),
        associations: new FirestoreAutomaticAssociationRepository(db),
        products: new FirestoreProductLookup(db),
        stock: new FirestoreControlledStockRepository(db),
      })
      await service.updateAssociation(
        restaurantId,
        id,
        { quantity, unit, actorId: user.uid },
        principal
      )
      await load()
    }}
  />
}

function Associations({
  articles,
  products,
  associations,
  busy,
  onCreate,
  onDisable,
  onUpdate,
}: {
  articles: readonly StockArticle[]
  products: readonly { id: string; name: string }[]
  associations: readonly AutomaticAssociation[]
  busy: boolean
  onCreate: (productId: string, articleId: string, quantity: number) => Promise<void>
  onDisable: (id: string) => Promise<void>
  onUpdate: (id: string, quantity: number, unit: string) => Promise<void>
}) {
  const [productSearch, setProductSearch] = React.useState("")
  const [articleSearch, setArticleSearch] = React.useState("")
  const [productId, setProductId] = React.useState("")
  const [articleId, setArticleId] = React.useState("")
  const [quantity, setQuantity] = React.useState("1")
  const compatible = articles.filter((item) =>
    item.status === "active"
    && item.trackingMode === "AUTOMATIC_SIMPLE"
    && item.name.toLocaleLowerCase("fr").includes(articleSearch.toLocaleLowerCase("fr"))
  )
  const visibleProducts = products.filter((item) =>
    item.name.toLocaleLowerCase("fr").includes(productSearch.toLocaleLowerCase("fr"))
  )
  return <Page title="Associations automatiques" subtitle="Une quantité simple et explicite par produit et article.">
    <Card><CardHeader><CardTitle>Nouvelle association</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
      <Label className="space-y-2"><span>Rechercher un produit</span><Input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} /><select className="h-10 w-full rounded-md border bg-background px-3" value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">Choisir</option>{visibleProducts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Label>
      <Label className="space-y-2"><span>Rechercher un article compatible</span><Input value={articleSearch} onChange={(event) => setArticleSearch(event.target.value)} /><select className="h-10 w-full rounded-md border bg-background px-3" value={articleId} onChange={(event) => setArticleId(event.target.value)}><option value="">Choisir</option>{compatible.map((item) => <option key={String(item.id)} value={String(item.id)}>{item.name} ({item.baseUnit})</option>)}</select></Label>
      <Label className="space-y-2"><span>Quantité retirée</span><Input type="number" min="0" step="any" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></Label>
      <Button className="self-end" disabled={busy || !productId || !articleId || Number(quantity) <= 0} onClick={() => void onCreate(productId, articleId, Number(quantity))}>Créer l’association</Button>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Associations existantes</CardTitle></CardHeader><CardContent className="divide-y">{associations.length === 0 ? <p className="text-sm text-muted-foreground">Aucune association.</p> : associations.map((item) => {
      const product = products.find((entry) => entry.id === item.productId)
      const article = articles.find((entry) => String(entry.id) === item.articleId)
      const invalid = !article || article.status !== "active" || article.trackingMode !== "AUTOMATIC_SIMPLE"
      return <AssociationRow key={item.id} item={item} productName={product?.name} articleName={article?.name} invalid={invalid} onDisable={onDisable} onUpdate={onUpdate} />
    })}</CardContent></Card>
  </Page>
}

function AssociationRow({
  item,
  productName,
  articleName,
  invalid,
  onDisable,
  onUpdate,
}: {
  item: AutomaticAssociation
  productName?: string
  articleName?: string
  invalid: boolean
  onDisable: (id: string) => Promise<void>
  onUpdate: (id: string, quantity: number, unit: string) => Promise<void>
}) {
  const [editing, setEditing] = React.useState(false)
  const [quantity, setQuantity] = React.useState(String(item.quantity))
  return <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
    <div><p className="font-semibold">{productName ?? item.productId} → {articleName ?? item.articleId}</p><p className="text-sm text-muted-foreground">{item.quantity} {item.unit} par unité vendue</p></div>
    {editing ? <div className="flex items-center gap-2"><Input className="w-24" type="number" min="0" step="any" value={quantity} onChange={(event) => setQuantity(event.target.value)} /><Button size="sm" disabled={Number(quantity) <= 0} onClick={() => { void onUpdate(item.id, Number(quantity), item.unit); setEditing(false) }}>Enregistrer</Button><Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Annuler</Button></div> :
      <div className="flex gap-2">{invalid ? <Badge variant="destructive">Obsolète</Badge> : <Badge variant={item.status === "active" ? "secondary" : "outline"}>{item.status === "active" ? "Active" : "Inactive"}</Badge>}{item.status === "active" && <><Button size="sm" variant="outline" onClick={() => setEditing(true)}>Modifier</Button><Button size="sm" variant="outline" onClick={() => void onDisable(item.id)}>Désactiver</Button></>}</div>}
  </div>
}

function Page({ title, subtitle, children }: React.PropsWithChildren<{ title: string; subtitle: string }>) {
  return <main className="space-y-6 p-4 md:p-8"><PageHeader title={title} subtitle={subtitle} />{children}</main>
}

function State({ title, text, retry }: { title: string; text: string; retry?: () => void }) {
  return <Card className="m-4"><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent className="space-y-3"><p>{text}</p>{retry && <Button onClick={retry}>Réessayer</Button>}</CardContent></Card>
}

function buildPrincipal(actorId: string, restaurantId: string, legacyRole: string): StockPrincipal {
  const role: StockRole = legacyRole === "owner" ? "owner" : legacyRole === "manager" ? "manager" : legacyRole === "kitchen" ? "kitchen_chef" : "employee"
  return { actorId: actorId as ActorId, role, capabilities: capabilitiesForControlledStockRole(role), scope: { restaurantId: restaurantId as RestaurantId } }
}
