"use client"

import * as React from "react"
import { collection, doc, limit, orderBy, query } from "firebase/firestore"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useRestaurant } from "@/design-system/context/RestaurantContext"
import { useTenant } from "@/design-system/context/TenantProvider"
import { useCollection, useDoc, useFirestore, useMemoFirebase } from "@/firebase"
import { useToast } from "@/hooks/use-toast"
import {
  resolveOperationalAvailabilityState,
  resolvePortionControl,
} from "@/lib/product-availability"
import { executeAvailabilityCommandClient } from "./availability-command-client"

export function AvailabilityOperationsScreen() {
  const db = useFirestore()
  const { restaurantId } = useRestaurant()
  const { user } = useTenant()
  const { toast } = useToast()
  const [busy, setBusy] = React.useState<string | null>(null)
  const [portionInputs, setPortionInputs] = React.useState<Record<string, string>>({})
  const productsQuery = useMemoFirebase(() => db && restaurantId
    ? query(collection(db, "restaurants", restaurantId, "products"), limit(300))
    : null, [db, restaurantId])
  const historyQuery = useMemoFirebase(() => db && restaurantId
    ? query(collection(db, "restaurants", restaurantId, "availabilityHistory"), orderBy("occurredAt", "desc"), limit(100))
    : null, [db, restaurantId])
  const serviceRef = useMemoFirebase(() => db && restaurantId
    ? doc(db, "restaurants", restaurantId, "availabilityServiceState", "current")
    : null, [db, restaurantId])
  const productsResult = useCollection<any>(productsQuery)
  const historyResult = useCollection<any>(historyQuery)
  const serviceResult = useDoc<any>(serviceRef)
  const products = React.useMemo(() => (productsResult.data || [])
    .filter((product: any) => product.isActive !== false)
    .sort((a: any, b: any) => String(a.name).localeCompare(String(b.name), "fr")), [productsResult.data])
  const unavailable = React.useMemo(() => products.filter((product: any) => resolveOperationalAvailabilityState(product) !== "AVAILABLE"), [products])
  const thresholdNotificationRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    if (productsResult.isLoading || unavailable.length < 5) return
    const key = `${serviceResult.data?.serviceId || "no-service"}:${unavailable.map((p: any) => p.id).sort().join(",")}`
    if (thresholdNotificationRef.current === key) return
    thresholdNotificationRef.current = key
    toast({ title: "Disponibilité à surveiller", description: `${unavailable.length} produits sont actuellement indisponibles.`, variant: "destructive" })
  }, [productsResult.isLoading, serviceResult.data?.serviceId, toast, unavailable])

  const execute = async (key: string, command: Parameters<typeof executeAvailabilityCommandClient>[0]["command"], success: string) => {
    if (!user || !restaurantId || busy) return
    setBusy(key)
    try {
      await executeAvailabilityCommandClient({ user, restaurantId, command })
      toast({ title: success })
    } catch (error) {
      console.error(error)
      toast({ title: "Opération refusée", description: "Vérifiez les données et vos autorisations.", variant: "destructive" })
    } finally {
      setBusy(null)
    }
  }

  if (productsResult.isLoading || historyResult.isLoading) return <p role="status">Chargement des disponibilités…</p>
  if (productsResult.error || historyResult.error) return <p role="alert">Impossible de charger les disponibilités.</p>

  return <div className="space-y-6">
    <header><h1 className="text-2xl font-bold">Disponibilités des plats</h1><p className="text-sm text-muted-foreground">Revue du service, portions préparées et historique opérationnel.</p></header>
    <section className="rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Service courant</h2><p className="text-sm text-muted-foreground">{serviceResult.data?.startedAt ? `Ouvert ${formatTimestamp(serviceResult.data.startedAt)} · ${unavailable.length} produit(s) à revoir` : "Aucun service explicite ouvert"}</p></div><div className="flex gap-2"><Button variant="outline" disabled={Boolean(busy)} onClick={() => execute("service", { type: "START_SERVICE" }, "Nouveau service ouvert sans réinitialisation automatique")}>Nouveau service</Button><Button disabled={!unavailable.length || Boolean(busy)} onClick={() => execute("bulk", { type: "BULK_AVAILABLE", productIds: unavailable.map((p: any) => p.id) }, "Produits remis disponibles")}>Tout remettre disponible</Button></div></div>
    </section>
    <section><h2 className="mb-3 text-lg font-semibold">Produits</h2><div className="grid gap-3 lg:grid-cols-2">{products.map((product: any) => {
      const state = resolveOperationalAvailabilityState(product)
      const portions = resolvePortionControl(product)
      const entered = Number(portionInputs[product.id] || 0)
      return <article key={product.id} className="rounded-2xl border bg-card p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{product.name}</h3><p className="text-sm text-muted-foreground">{stateLabel(state)}{product.operationalAvailability?.reason ? ` · ${product.operationalAvailability.reason}` : ""}</p></div>{state !== "AVAILABLE" ? <Button size="sm" disabled={Boolean(busy)} onClick={() => execute(product.id, { type: "SET_AVAILABILITY", productId: product.id, state: "AVAILABLE", reason: "Reprise individuelle", scope: "MANUAL" }, `${product.name} est disponible`)}>Rendre disponible</Button> : null}</div>
        <div className="mt-3 border-t pt-3"><p className="text-sm font-medium">Portions préparées : {portions.enabled ? portions.available : "désactivées"}</p><div className="mt-2 flex flex-wrap gap-2"><Input className="w-24" inputMode="numeric" min={0} type="number" value={portionInputs[product.id] || ""} placeholder="Qté" onChange={(event) => setPortionInputs((current) => ({ ...current, [product.id]: event.target.value }))} />{portions.enabled ? <><Button size="sm" variant="outline" disabled={!Number.isSafeInteger(entered) || entered <= 0 || Boolean(busy)} onClick={() => execute(`add-${product.id}`, { type: "ADD_PORTIONS", productId: product.id, quantity: entered }, "Portions ajoutées")}>Ajouter</Button><Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => execute(`disable-${product.id}`, { type: "CONFIGURE_PORTIONS", productId: product.id, enabled: false, available: portions.available || 0 }, "Gestion des portions désactivée")}>Désactiver</Button></> : <Button size="sm" variant="outline" disabled={!Number.isSafeInteger(entered) || entered < 0 || Boolean(busy)} onClick={() => execute(`enable-${product.id}`, { type: "CONFIGURE_PORTIONS", productId: product.id, enabled: true, available: entered }, "Gestion des portions activée")}>Activer</Button>}</div></div>
      </article>
    })}</div></section>
    <section className="rounded-2xl border bg-card p-4"><h2 className="font-semibold">Historique</h2><div className="mt-3 space-y-2">{(historyResult.data || []).map((entry: any) => <p key={entry.id} className="text-sm text-muted-foreground"><strong className="text-foreground">{entry.productName}</strong> · {stateLabel(entry.oldState)} → {stateLabel(entry.newState)} · {entry.reason || "Sans motif"} · {entry.actor?.role || entry.origin} · {formatTimestamp(entry.occurredAt)}</p>)}</div></section>
  </div>
}

function stateLabel(value: unknown) { return value === "SOLD_OUT" ? "Épuisé" : value === "PAUSED" ? "En pause" : "Disponible" }
function formatTimestamp(value: any) { const date = value?.toDate?.(); return date ? date.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "à l’instant" }
