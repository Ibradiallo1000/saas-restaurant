"use client"

import * as React from "react"
import { collection, doc, limit, query, where } from "firebase/firestore"
import { CheckCircle2, Clock3, PauseCircle, SearchX } from "lucide-react"

import { useCollection, useDoc, useFirestore, useMemoFirebase } from "@/firebase"
import { useTenant } from "@/design-system/context/TenantProvider"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { getOptimizedImage } from "@/lib/image"
import {
  OPERATIONAL_AVAILABILITY_STATES,
  resolveOperationalAvailabilityState,
  resolvePortionControl,
  resolveProductPreparationMode,
  type OperationalAvailabilityState,
} from "@/lib/product-availability"
import { executeAvailabilityCommandClient } from "@/modules/availability/availability-command-client"
import type { RestaurantOrder } from "@/modules/restaurant/types"

export function KitchenAvailabilityPanel({ restaurantId, orders = [] }: { restaurantId: string; orders?: RestaurantOrder[] }) {
  const db = useFirestore()
  const { user } = useTenant()
  const { toast } = useToast()
  const [pendingProductId, setPendingProductId] = React.useState<string | null>(null)
  const productsQuery = useMemoFirebase(() => db && restaurantId ? query(
    collection(db, "restaurants", restaurantId, "products"),
    where("isActive", "==", true),
    limit(200)
  ) : null, [db, restaurantId])
  const categoriesQuery = useMemoFirebase(() => db && restaurantId
    ? query(collection(db, "restaurants", restaurantId, "categories"), limit(100))
    : null, [db, restaurantId])
  const staffQuery = useMemoFirebase(() => db && restaurantId
    ? query(collection(db, "restaurants", restaurantId, "staff"), limit(100))
    : null, [db, restaurantId])
  const historyQuery = useMemoFirebase(() => db && restaurantId ? query(
    collection(db, "restaurants", restaurantId, "availabilityHistory"),
    where("preparationMode", "==", "kitchen"),
    limit(100)
  ) : null, [db, restaurantId])
  const serviceRef = useMemoFirebase(() => db && restaurantId
    ? doc(db, "restaurants", restaurantId, "availabilityServiceState", "current")
    : null, [db, restaurantId])
  const productsResult = useCollection<any>(productsQuery)
  const categoriesResult = useCollection<any>(categoriesQuery)
  const staffResult = useCollection<any>(staffQuery)
  const historyResult = useCollection<any>(historyQuery)
  const serviceResult = useDoc<any>(serviceRef)
  const categories = categoriesResult.data || []
  const categoryById = React.useMemo(
    () => new Map(categories.map((category: any) => [category.id, category])),
    [categories]
  )
  const staffById = React.useMemo(
    () => new Map((staffResult.data || []).map((member: any) => [member.id, member])),
    [staffResult.data]
  )
  const products = React.useMemo(() => (productsResult.data || []).filter((product: any) => {
    const category = categoryById.get(product.categoryId) as any
    return resolveProductPreparationMode(
      product,
      category ? { preparationMode: category.preparationMode, categoryName: category.name } : null
    ) === "kitchen"
  }).sort((left: any, right: any) => String(left.name).localeCompare(String(right.name), "fr")), [categoryById, productsResult.data])
  const unavailableProducts = React.useMemo(() => products.filter((product: any) => resolveOperationalAvailabilityState(product) !== "AVAILABLE"), [products])
  const previousStatesRef = React.useRef<Map<string, OperationalAvailabilityState> | null>(null)
  React.useEffect(() => {
    const next = new Map(products.map((product: any) => [product.id, resolveOperationalAvailabilityState(product)]))
    const previous = previousStatesRef.current
    if (previous) {
      products.forEach((product: any) => {
        if (previous.get(product.id) !== "AVAILABLE" && next.get(product.id) === "AVAILABLE") {
          toast({ title: "Plat remis disponible", description: `${product.name} peut de nouveau être vendu.` })
        }
        if (previous.get(product.id) !== "SOLD_OUT" && next.get(product.id) === "SOLD_OUT" && orders.some((order) => (order.items || []).some((item: any) => item.productId === product.id && !["ready", "served", "cancelled"].includes(String(item.status || "pending"))))) {
          toast({ title: "Commande active à vérifier", description: `${product.name} est encore présent dans une commande non préparée.`, variant: "destructive" })
        }
      })
    }
    previousStatesRef.current = next
  }, [orders, products, toast])

  const updateAvailability = async (product: any, state: OperationalAvailabilityState) => {
    if (!db || !user || pendingProductId) return
    setPendingProductId(product.id)
    try {
      await executeAvailabilityCommandClient({
        user,
        restaurantId,
        command: {
          type: "SET_AVAILABILITY",
          productId: product.id,
          state,
          reason: state === "SOLD_OUT" ? "Épuisé pendant le service" : state === "PAUSED" ? "Mis en pause par la Cuisine" : null,
          scope: state === "AVAILABLE" ? "MANUAL" : "CURRENT_SERVICE",
        },
      })
      toast({ title: "Disponibilité mise à jour", description: `${product.name} : ${stateLabel(state)}` })
    } catch (error) {
      console.error(error)
      toast({ title: "Modification refusée", description: "Vérifiez vos droits et réessayez.", variant: "destructive" })
    } finally {
      setPendingProductId(null)
    }
  }

  const startService = async () => {
    if (!user || pendingProductId) return
    setPendingProductId("__service__")
    try {
      await executeAvailabilityCommandClient({ user, restaurantId, command: { type: "START_SERVICE" } })
      toast({ title: "Nouveau service ouvert", description: `${unavailableProducts.length} produit(s) à revoir. Aucun produit n’a été réactivé automatiquement.` })
    } finally { setPendingProductId(null) }
  }

  const resetAll = async () => {
    if (!user || !unavailableProducts.length || pendingProductId) return
    setPendingProductId("__bulk__")
    try {
      await executeAvailabilityCommandClient({ user, restaurantId, command: { type: "BULK_AVAILABLE", productIds: unavailableProducts.map((product: any) => product.id) } })
      toast({ title: "Produits remis disponibles", description: `${unavailableProducts.length} produit(s) mis à jour.` })
    } finally { setPendingProductId(null) }
  }

  if (productsResult.isLoading || categoriesResult.isLoading || staffResult.isLoading) {
    return <div className="flex min-h-64 items-center justify-center text-sm font-semibold text-muted-foreground"><Clock3 className="mr-2 size-4 animate-spin" />Chargement des disponibilités</div>
  }
  if (productsResult.error || categoriesResult.error) {
    return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Impossible de synchroniser les disponibilités.</div>
  }
  if (!products.length) {
    return <div className="flex min-h-64 flex-col items-center justify-center text-center text-muted-foreground"><SearchX className="mb-2 size-8" /><p className="font-semibold">Aucun produit Cuisine actif</p></div>
  }

  return <div className="h-full overflow-y-auto pb-4">
    <section className="mb-3 rounded-2xl border border-[var(--kitchen-border)] bg-[var(--kitchen-card)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-bold">Service de disponibilité</h2><p className="text-xs text-muted-foreground">{serviceResult.data?.startedAt ? `Ouvert ${formatTimestamp(serviceResult.data.startedAt)} · ${unavailableProducts.length} produit(s) à revoir` : "Aucun service explicite ouvert"}</p></div><div className="flex gap-2"><Button variant="outline" onClick={startService} disabled={Boolean(pendingProductId)}>Nouveau service</Button><Button onClick={resetAll} disabled={!unavailableProducts.length || Boolean(pendingProductId)}>Tout remettre disponible</Button></div></div>
      {unavailableProducts.length ? <p className="mt-2 text-xs font-semibold text-amber-700">Les états sont conservés tant que vous ne choisissez pas de les modifier.</p> : null}
    </section>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
    {products.map((product: any) => {
      const state = resolveOperationalAvailabilityState(product)
      const category = categoryById.get(product.categoryId) as any
      const author = staffById.get(product.operationalAvailability?.updatedBy) as any
      const portions = resolvePortionControl(product)
      return <article key={product.id} className="rounded-2xl border border-[var(--kitchen-border)] bg-[var(--kitchen-card)] p-3 shadow-sm">
        <div className="flex gap-3">
          <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-muted">
            {product.imageUrl ? <img src={getOptimizedImage(product.imageUrl, 160)} alt="" className="size-full object-cover" /> : <span className="flex size-full items-center justify-center"><CheckCircle2 className="size-6 text-muted-foreground" /></span>}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-bold">{product.name}</h3>
            <p className="text-xs text-muted-foreground">{category?.name || "Sans catégorie"}</p>
            <p className="mt-1 text-sm font-semibold">{stateLabel(state)}</p>
            {product.operationalAvailability?.reason ? <p className="text-xs text-muted-foreground">{product.operationalAvailability.reason}</p> : null}
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {product.operationalAvailability?.updatedAt
            ? `${authorLabel(author, product.operationalAvailability.updatedBy, user?.uid)} · ${formatTimestamp(product.operationalAvailability.updatedAt)}`
            : "Aucune modification opérationnelle"}
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {OPERATIONAL_AVAILABILITY_STATES.map((targetState) => <Button
            key={targetState}
            type="button"
            size="sm"
            variant={state === targetState ? "default" : "outline"}
            disabled={Boolean(pendingProductId)}
            onClick={() => updateAvailability(product, targetState)}
            className="min-w-0 px-2 text-xs"
          >{targetState === "AVAILABLE" ? "Disponible" : targetState === "SOLD_OUT" ? "Épuisé" : <><PauseCircle className="mr-1 size-3" />Pause</>}</Button>)}
        </div>
        {portions.enabled ? <div className="mt-2 flex items-center justify-between rounded-lg bg-muted px-2 py-1 text-xs"><span>{portions.available} portion(s)</span><div className="flex gap-1"><Button size="sm" variant="outline" disabled={Boolean(pendingProductId)} onClick={() => user && executeAvailabilityCommandClient({ user, restaurantId, command: { type: "ADD_PORTIONS", productId: product.id, quantity: 1 } })}>+1</Button><Button size="sm" variant="outline" disabled={Boolean(pendingProductId)} onClick={() => user && executeAvailabilityCommandClient({ user, restaurantId, command: { type: "ADD_PORTIONS", productId: product.id, quantity: 5 } })}>+5</Button></div></div> : null}
      </article>
    })}
    </div>
    <section className="mt-4 rounded-2xl border border-[var(--kitchen-border)] bg-[var(--kitchen-card)] p-3"><h2 className="font-bold">Historique récent</h2><div className="mt-2 space-y-2">{[...(historyResult.data || [])].sort((a: any, b: any) => timestampMillis(b.occurredAt) - timestampMillis(a.occurredAt)).slice(0, 20).map((entry: any) => <p key={entry.id} className="text-xs text-muted-foreground"><strong className="text-foreground">{entry.productName}</strong> · {stateLabel(entry.oldState)} → {stateLabel(entry.newState)} · {entry.reason || "Sans motif"} · {formatTimestamp(entry.occurredAt)}</p>)}</div></section>
  </div>
}

function stateLabel(state: OperationalAvailabilityState) {
  if (state === "SOLD_OUT") return "Épuisé"
  if (state === "PAUSED") return "En pause"
  return "Disponible"
}

function authorLabel(author: any, uid: string | undefined, currentUid: string | undefined) {
  if (uid === currentUid) return "Vous"
  return author?.displayName || author?.name || author?.email || uid || "Auteur inconnu"
}

function formatTimestamp(value: any) {
  const date = value?.toDate?.() ?? (value instanceof Date ? value : null)
  return date ? date.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "à l’instant"
}
function timestampMillis(value: any) { return value?.toMillis?.() ?? value?.toDate?.()?.getTime?.() ?? 0 }
