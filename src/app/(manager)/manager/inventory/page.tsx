"use client"

import * as React from "react"
import { collection, query, where } from "firebase/firestore"
import { AlertTriangle, Info, Package, Plus, RefreshCw } from "lucide-react"

import { AdminRouteSkeleton } from "@/components/performance/route-skeletons"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { useRestaurant } from "@/design-system/context/RestaurantContext"
import { useTenant } from "@/design-system/context/TenantProvider"
import { COLLECTION_NAMES, ROLES } from "@/lib/constants"
import { getDateRange, useTimeFilter } from "@/contexts/time-filter-context"
import { cn } from "@/lib/utils"
import { InventoryService, type InventoryUnit } from "@/services/inventory.service"

type InventoryItem = {
  id: string
  name: string
  unit: InventoryUnit
  stockEstimated: number
  avgDailyConsumption?: number
  costPerUnit?: number
  minThreshold?: number
  lossRate: number
  trackingMode?: "manual" | "auto"
  lastManualCheckAt?: any
  lastManualStock?: number
}

type InventoryLog = {
  itemMargins?: Array<{
    productId?: string
    productName?: string
    sales?: number
    cost?: number
    margin?: number
    missingCost?: boolean
  }>
}

type InventoryAlert = {
  id: string
  type?: "low_stock" | "incoherent_stock" | "missing_cost"
  itemId?: string
  message?: string
  severity?: "low" | "medium" | "high"
  resolved?: boolean
}

type InventoryAction = "add" | "adjust" | "cost" | "verify" | "mode"

const UNIT_OPTIONS: InventoryUnit[] = ["pièce", "kg", "litre"]

function getFreshnessStatus(item: InventoryItem): "never" | "expired" | "ok" {
  if (!item.lastManualCheckAt) return "never"
  const date = item.lastManualCheckAt.toDate ? item.lastManualCheckAt.toDate() : new Date(item.lastManualCheckAt)
  const isExpired = Date.now() - date.getTime() > 48 * 60 * 60 * 1000
  return isExpired ? "expired" : "ok"
}

function getItemPriority(item: InventoryItem): number {
  const freshness = getFreshnessStatus(item)
  if (freshness === "never") return 1
  if (item.minThreshold && Number(item.stockEstimated) <= Number(item.minThreshold)) return 2
  if (isStockUnderFourDays(item)) return 3
  if (freshness === "expired") return 4
  return 5
}

function getFreshnessBadge(item: InventoryItem) {
  const freshness = getFreshnessStatus(item)
  if (freshness === "never") {
    return {
      label: "Jamais vérifié",
      className: "border-red-200 bg-red-100 text-red-700",
    }
  }
  if (freshness === "expired") {
    return {
      label: "> 48h",
      className: "border-orange-200 bg-orange-100 text-orange-700",
    }
  }
  return {
    label: "OK",
    className: "border-emerald-200 bg-emerald-100 text-emerald-700",
  }
}

export default function ManagerInventoryPage() {
  const db = useFirestore()
  const { role } = useTenant()
  const { restaurantId, loading } = useRestaurant()
  const { filter } = useTimeFilter()
  const range = React.useMemo(() => getDateRange(filter), [filter])
  const canWrite = role === ROLES.MANAGER
  const canRead = canWrite || role === ROLES.OWNER
  const [seedLoading, setSeedLoading] = React.useState(false)
  const [createLoading, setCreateLoading] = React.useState(false)
  const [newName, setNewName] = React.useState("")
  const [newUnit, setNewUnit] = React.useState<InventoryUnit>("pièce")
  const [newStock, setNewStock] = React.useState("")
  const [newCost, setNewCost] = React.useState("")
  const [newMinThreshold, setNewMinThreshold] = React.useState("")
  const [newTrackingMode, setNewTrackingMode] = React.useState<"manual" | "auto">("auto")
  const [focusedItemId, setFocusedItemId] = React.useState<string | null>(null)
  const [showAllItems, setShowAllItems] = React.useState(false)
  const [focusMode, setFocusMode] = React.useState(false)

  const itemsQuery = useMemoFirebase(() => {
    if (!db || !restaurantId || !canRead) return null
    return collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, "inventoryItems")
  }, [db, restaurantId, canRead])
  const { data, isLoading } = useCollection<InventoryItem>(itemsQuery)

  const todayLogsQuery = useMemoFirebase(() => {
    if (!db || !restaurantId || !canRead) return null
    return query(
      collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, "inventoryLogs"),
      where("createdAt", ">=", range.startDate),
      where("createdAt", "<=", range.endDate)
    )
  }, [db, restaurantId, canRead, range.endDate, range.startDate])
  const { data: todayLogs } = useCollection<InventoryLog>(todayLogsQuery)

  const alertsQuery = useMemoFirebase(() => {
    if (!db || !restaurantId || !canRead) return null
    return query(
      collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, "inventoryAlerts"),
      where("resolved", "==", false)
    )
  }, [db, restaurantId, canRead])
  const { data: alerts } = useCollection<InventoryAlert>(alertsQuery)

  const activeAlerts = React.useMemo(() => [...(alerts || [])].sort(sortInventoryAlerts), [alerts])
  const alertItemIds = React.useMemo(
    () => new Set(activeAlerts.map((alert) => alert.itemId).filter(Boolean) as string[]),
    [activeAlerts]
  )

  const items = React.useMemo(() => {
    return [...(data || [])].sort((a, b) => {
      const prioA = getItemPriority(a)
      const prioB = getItemPriority(b)
      if (prioA !== prioB) return prioA - prioB
      return getItemName(a).localeCompare(getItemName(b))
    })
  }, [data])

  const neverVerifiedCount = items.filter(i => getFreshnessStatus(i) === "never").length
  const expiredCount = items.filter(i => getFreshnessStatus(i) === "expired").length
  const criticalCount = items.filter(i => i.minThreshold && Number(i.stockEstimated) <= Number(i.minThreshold)).length

  let reliability: "Élevée" | "Moyenne" | "Faible" = "Élevée"
  if (neverVerifiedCount > 0 || criticalCount > 0) reliability = "Faible"
  else if (expiredCount > 0 || activeAlerts.length > 0) reliability = "Moyenne"

  const priorityItems = React.useMemo(
    () => items.filter((item) => getItemPriority(item) <= 4 || alertItemIds.has(item.id) || hasMissingCost(item)),
    [items, alertItemIds]
  )
  const visibleItems = focusMode
    ? (priorityItems.length > 0 ? priorityItems : items)
    : showAllItems
      ? items
      : priorityItems
  const marginSummary = React.useMemo(() => buildMarginSummary(todayLogs || []), [todayLogs])
  const totalStockValue = React.useMemo(() => {
    return items.reduce((total, item) => {
      const stock = Math.max(0, Number(item.stockEstimated || 0))
      const cost = Number(item.costPerUnit || 0)
      return total + (stock * cost)
    }, 0)
  }, [items])
  const todayVariation = marginSummary.totalCost || 0
  const service = React.useMemo(() => (db ? new InventoryService(db) : null), [db])

  const seedItems = async () => {
    if (!service || !restaurantId || !canWrite || seedLoading) return
    setSeedLoading(true)
    try {
      await service.seedInventoryItems(restaurantId)
    } finally {
      setSeedLoading(false)
    }
  }

  const createItem = async () => {
    if (!service || !restaurantId || !canWrite || createLoading) return
    const name = newName.trim()
    const stockEstimated = Number(newStock || 0)
    if (!name || !Number.isFinite(stockEstimated) || stockEstimated < 0) return

    setCreateLoading(true)
    try {
      await service.createInventoryItem(restaurantId, {
        name,
        unit: newUnit,
        stockEstimated,
        costPerUnit: Number(newCost || 0),
        minThreshold: Number(newMinThreshold || 0),
        lossRate: 0,
        trackingMode: newTrackingMode,
      })
      setNewName("")
      setNewUnit("pièce")
      setNewStock("")
      setNewCost("")
      setNewMinThreshold("")
      setNewTrackingMode("auto")
    } finally {
      setCreateLoading(false)
    }
  }

  const focusInventoryItem = (itemId?: string) => {
    if (!itemId) return
    setFocusedItemId(itemId)
    window.setTimeout(() => {
      document.getElementById(`inventory-item-${itemId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      })
    }, 0)
  }

  const focusFirstProblem = () => {
    const firstItem = priorityItems[0]
    if (firstItem) focusInventoryItem(firstItem.id)
  }

  const startQuickVerification = () => {
    setFocusMode(true)
    setShowAllItems(false)
    const target = priorityItems[0] || items[0]
    if (target) focusInventoryItem(target.id)
  }

  if (loading || isLoading) return <AdminRouteSkeleton />

  if (!restaurantId || !canRead) {
    return (
      <main className="rounded-xl border bg-card p-6">
        <h1 className="text-xl font-black">Inventaire indisponible</h1>
        <p className="mt-2 text-sm text-muted-foreground">Restaurant introuvable ou rôle non autorisé.</p>
      </main>
    )
  }

  return (
    <main className="space-y-4 pb-20">
      {!focusMode ? (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className={cn(reliability === "Élevée" ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-500/60 dark:bg-emerald-950/30" : reliability === "Moyenne" ? "border-orange-300 bg-orange-50/60 dark:border-orange-500/60 dark:bg-orange-950/30" : "border-red-300 bg-red-50/60 dark:border-red-500/60 dark:bg-red-950/30")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <TooltipLabel
                label="Fiabilité"
                description="Indique si les stocks sont à jour. Faible = plusieurs produits non vérifiés."
              />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-black">{reliability}</p>
            <p className="text-xs font-bold text-muted-foreground mt-1">
              {reliability === "Élevée" ? "Tout est à jour" : reliability === "Moyenne" ? "Vérifications requises" : "Critique !"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4" />
              <TooltipLabel
                label="À vérifier"
                description="Nombre de produits à contrôler physiquement maintenant."
              />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-black text-orange-600">{neverVerifiedCount + expiredCount}</p>
            <p className="text-xs font-bold text-muted-foreground mt-1">
              {neverVerifiedCount} jamais, {expiredCount} {'>'} 48h
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase text-muted-foreground">
              <TooltipLabel
                label="Valeur totale"
                description="Valeur estimée de tout votre stock actuel."
              />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-black">{formatMoney(totalStockValue)}</p>
            <p className="text-xs font-bold text-muted-foreground mt-1">FCFA en stock</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase text-muted-foreground">
              <TooltipLabel
                label="Variation aujourd'hui"
                description="Valeur consommée aujourd'hui par les ventes ou les ajustements."
              />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-black">{formatMoney(todayVariation)}</p>
            <p className="text-xs font-bold text-muted-foreground mt-1">
              {todayVariation > 0 ? "FCFA consommés" : "Aucune consommation enregistrée aujourd'hui"}
            </p>
          </CardContent>
        </Card>
      </div>
      ) : null}

      {canWrite ? (
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-base font-black">
              {focusMode ? "Vérification du jour" : "Action recommandée"}
            </p>
            <p className="text-sm text-muted-foreground">
              {focusMode
                ? "Contrôlez uniquement les produits prioritaires, puis entrez le stock réel."
                : "Passez en mode guidé pour corriger les stocks rapidement."}
            </p>
          </div>
          <Button size="lg" onClick={startQuickVerification}>
            <RefreshCw className="mr-2 h-4 w-4" />
            🔍 Lancer la vérification du jour
          </Button>
          {focusMode ? (
            <Button variant="outline" onClick={() => setFocusMode(false)}>
              Revenir au tableau de bord
            </Button>
          ) : null}
        </div>
      ) : null}

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4 text-primary" />
              {focusMode ? "Produits à vérifier" : "État du stock"}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {focusMode
                ? "Saisissez le stock réel uniquement sur les produits qui demandent une action."
                : "Liste triée par priorité d'intervention."}
            </p>
          </div>
          {!focusMode && items.length > priorityItems.length ? (
            <Button variant="outline" onClick={() => setShowAllItems((value) => !value)}>
              {showAllItems ? "Masquer" : "Voir tout"}
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-background p-8 text-center">
              <p className="font-black">Aucun ingrédient</p>
              <p className="mt-1 text-sm text-muted-foreground">Créez les premiers items ou chargez les données de test.</p>
              {canWrite ? (
                <Button className="mt-4" disabled={seedLoading} onClick={seedItems}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {seedLoading ? "Création..." : "Créer Poulet, Huile, Pain"}
                </Button>
              ) : null}
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
              <p className="font-black text-emerald-800">✅ Tout est sous contrôle aujourd'hui</p>
              <p className="mt-1 text-sm text-emerald-700">Aucun stock critique à moins de 4 jours.</p>
            </div>
          ) : (
            <div className="flex flex-col rounded-xl border bg-card shadow-sm divide-y">
              {visibleItems.map((item) => (
                <InventoryRow
                  key={item.id}
                  item={item}
                  restaurantId={restaurantId}
                  canWrite={canWrite}
                  service={service}
                  focused={focusedItemId === item.id}
                />
              ))}
            </div>
          )}

          {canWrite ? (
            <details className="mt-4 rounded-lg border bg-background p-3">
              <summary className="cursor-pointer text-sm font-black">+ Ajouter stock rapide</summary>
              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_140px_140px_140px_140px_auto] md:items-end">
                <div className="space-y-2">
                  <Label>Nom</Label>
                  <Input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Ex: Riz" />
                </div>
                <div className="space-y-2">
                  <Label>Unité</Label>
                  <select
                    value={newUnit}
                    onChange={(event) => setNewUnit(event.target.value as InventoryUnit)}
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    {UNIT_OPTIONS.map((unit) => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Stock de départ</Label>
                  <Input type="number" min={0} value={newStock} onChange={(event) => setNewStock(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Coût / unité</Label>
                  <Input type="number" min={0} value={newCost} onChange={(event) => setNewCost(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Mode</Label>
                  <select
                    value={newTrackingMode}
                    onChange={(event) => setNewTrackingMode(event.target.value as "manual" | "auto")}
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="auto">Auto</option>
                    <option value="manual">Manuel</option>
                  </select>
                </div>
                <Button disabled={createLoading || !newName.trim()} onClick={createItem}>
                  <Plus className="mr-2 h-4 w-4" />
                  Ajouter
                </Button>
              </div>
            </details>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Résumé aujourd'hui</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Ventes" value={`${formatMoney(marginSummary.totalSales)} FCFA`} />
            <Metric label="Coût estimé" value={`${formatMoney(marginSummary.totalCost)} FCFA`} />
            <Metric label="Marge" value={`${formatMoney(marginSummary.margin)} FCFA`} tone={marginSummary.margin >= 0 ? "positive" : "negative"} />
          </div>
          <div className="rounded-lg border bg-background p-3">
            <p className="text-xs font-black uppercase text-muted-foreground">Top plats rentables</p>
            {marginSummary.ignoredCount > 0 ? (
              <p className="mt-1 text-xs font-bold text-orange-700">
                {marginSummary.ignoredCount} vente(s) ignorée(s): coût non défini.
              </p>
            ) : null}
            {marginSummary.topItems.length > 0 ? (
              <div className="mt-2 grid gap-2">
                {marginSummary.topItems.map((item, index) => (
                  <div key={item.productId || item.productName} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate font-bold">{index + 1}. {item.productName}</span>
                    <span className="shrink-0 font-black text-emerald-700">{formatMoney(item.margin)} FCFA</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Aucune vente avec coût fiable aujourd'hui.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  )
}

function Metric({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "positive" | "negative" }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-xs font-black uppercase text-muted-foreground">{label}</p>
      <p className={cn(
        "mt-1 text-xl font-black",
        tone === "positive" && "text-emerald-700",
        tone === "negative" && "text-red-700"
      )}>
        {value}
      </p>
    </div>
  )
}

function InventoryInfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-xs font-black uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-black">{value}</p>
    </div>
  )
}

function TooltipLabel({ label, description }: { label: string; description: string }) {
  const [open, setOpen] = React.useState(false)

  return (
    <span className="relative inline-flex items-center gap-2">
      <span>{label}</span>
      <button
        type="button"
        className="group relative inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label={`Aide: ${label}`}
        aria-expanded={open}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setOpen((value) => !value)
        }}
        onBlur={() => setOpen(false)}
      >
        <Info className="h-4 w-4" />
        <span
          className={cn(
            "pointer-events-none absolute left-0 top-7 z-50 w-64 rounded-lg bg-gray-950 p-3 text-left text-xs font-semibold normal-case leading-relaxed text-white opacity-0 shadow-xl transition group-hover:opacity-100",
            open && "opacity-100"
          )}
        >
          {description}
        </span>
      </button>
    </span>
  )
}

function InventoryRow({
  item,
  restaurantId,
  canWrite,
  service,
  focused,
}: {
  item: InventoryItem
  restaurantId: string
  canWrite: boolean
  service: InventoryService | null
  focused: boolean
}) {
  const [addValue, setAddValue] = React.useState("")
  const [adjustValue, setAdjustValue] = React.useState("")
  const [thresholdValue, setThresholdValue] = React.useState("")
  const [action, setAction] = React.useState<InventoryAction | null>(null)
  const [actionValue, setActionValue] = React.useState("")
  const [feedback, setFeedback] = React.useState("")
  const [loading, setLoading] = React.useState<InventoryAction | "quick" | null>(null)
  const [expanded, setExpanded] = React.useState(focused)
  const [quickStock, setQuickStock] = React.useState("")

  React.useEffect(() => {
    if (focused) setExpanded(true)
  }, [focused])

  const handleQuickVerifyBlur = async () => {
    if (!quickStock) return
    const val = Number(quickStock)
    if (!Number.isFinite(val) || val < 0) {
      setQuickStock("")
      return
    }
    if (loading || !service || !canWrite) return

    const expectedStock = Number(item.stockEstimated || 0)
    const stockGap = val - expectedStock
    const diff = Math.abs(stockGap)
    if (diff > expectedStock * 0.5 && diff > 10) {
      if (!window.confirm(`La variation est importante (${formatStock(diff)} ${item.unit || "pièce"} de différence). Confirmer ?`)) {
        setQuickStock("")
        return
      }
    }

    setLoading("quick")
    try {
      await service.verifyInventoryStock(restaurantId, item.id, val)
      setQuickStock("")
      showFeedback(`Stock mis à jour · Écart : ${stockGap > 0 ? "+" : ""}${formatStock(stockGap)} ${item.unit || "pièce"}`)
    } catch (e: any) {
      showFeedback(e.message || "Erreur lors de la vérification")
    } finally {
      setLoading(null)
    }
  }

  const showFeedback = (message: string) => {
    setFeedback(message)
    window.setTimeout(() => setFeedback(""), 2500)
  }

  const submitCardAction = async (nextAction: "add" | "adjust") => {
    if (!service || !canWrite || loading) return
    const value = Number((nextAction === "add" ? addValue : adjustValue) || 0)
    if (!Number.isFinite(value) || value < 0 || (nextAction === "add" && value <= 0)) return

    setLoading(nextAction)
    try {
      if (nextAction === "add") {
        await service.addInventoryStock(restaurantId, item.id, value)
        setAddValue("")
      } else {
        await service.adjustInventoryStock(restaurantId, item.id, value)
        setAdjustValue("")
      }
      showFeedback("Stock mis à jour")
    } finally {
      setLoading(null)
    }
  }

  const updateThreshold = async () => {
    if (!service || !canWrite || loading) return
    const value = Number(thresholdValue || 0)
    if (!Number.isFinite(value) || value < 0) return
    setLoading("cost")
    try {
      await service.updateInventoryMinThreshold(restaurantId, item.id, value)
      setThresholdValue("")
      showFeedback("Seuil mis à jour")
    } finally {
      setLoading(null)
    }
  }

  const openAction = (nextAction: InventoryAction) => {
    setAction(nextAction)
    setActionValue(
      nextAction === "adjust" || nextAction === "verify"
        ? String(Number(item.stockEstimated || 0))
        : nextAction === "cost"
          ? String(Number(item.costPerUnit || 0))
          : nextAction === "mode"
            ? (item.trackingMode || "auto")
            : ""
    )
  }

  const closeAction = () => {
    if (loading) return
    setAction(null)
    setActionValue("")
  }

  const submitAction = async () => {
    if (!service || !canWrite || !action || loading) return

    setLoading(action)
    try {
      if (action === "mode") {
        const mode = actionValue as "manual" | "auto"
        await service.updateTrackingMode(restaurantId, item.id, mode)
        showFeedback("Mode de suivi mis à jour")
      } else {
        const value = Number(actionValue || 0)
        if (!Number.isFinite(value) || value < 0 || (action === "add" && value <= 0)) return

        if (action === "add") {
          await service.addInventoryStock(restaurantId, item.id, value)
          showFeedback("Stock mis à jour")
        } else if (action === "adjust") {
          await service.adjustInventoryStock(restaurantId, item.id, value)
          showFeedback("Stock mis à jour")
        } else if (action === "verify") {
          await service.verifyInventoryStock(restaurantId, item.id, value)
          showFeedback("Stock vérifié")
        } else if (action === "cost") {
          await service.updateInventoryCost(restaurantId, item.id, value)
          showFeedback("Coût mis à jour")
        }
      }
      setAction(null)
      setActionValue("")
    } finally {
      setLoading(null)
    }
  }

  const toggleExpand = () => setExpanded(!expanded)
  const alert = getInventoryAlert(item)
  const freshness = getFreshnessStatus(item)
  const freshnessBadge = getFreshnessBadge(item)

  return (
    <>
      <div id={`inventory-item-${item.id}`} className="group flex flex-col transition-colors hover:bg-muted/50">
        {/* Condensed Row (Header) */}
        <div 
          onClick={toggleExpand}
          className={cn(
            "flex cursor-pointer flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between",
            focused && "bg-primary/5",
            alert.level === "critical" && "bg-red-50/30",
            alert.level === "warning" && "bg-orange-50/30",
            freshness === "never" && "bg-red-50/70 dark:bg-red-950/20",
            freshness === "expired" && "bg-orange-50/70 dark:bg-orange-950/20"
          )}
        >
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-base">{getItemName(item)}</span>
              {item.trackingMode === "manual" ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase text-amber-800 border border-amber-200">
                  🟡 Manuel
                </span>
              ) : (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-800 border border-emerald-200">
                  🟢 Auto
                </span>
              )}
              {hasMissingCost(item) ? (
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-black uppercase text-orange-700">
                  Coût non défini
                </span>
              ) : null}
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-black uppercase border", freshnessBadge.className)}>
                {freshnessBadge.label}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{formatStock(item.stockEstimated)} {item.unit || "pièce"}</span>
              <span>·</span>
              <span>{formatMoney(item.costPerUnit || 0)} FCFA</span>
              <span>·</span>
              <span className={cn("text-xs font-bold uppercase", alert.className.split(' ')[1])}>{alert.label}</span>
              {getFreshnessStatus(item) === "never" && (
                <>
                  <span>·</span>
                  <span className="text-xs font-bold text-red-600">⚠ Jamais vérifié → cliquez sur "Vérifier"</span>
                </>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
            {canWrite && (
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-muted-foreground">
                  Stock attendu : {formatStock(item.stockEstimated)} {item.unit || "pièce"}
                </p>
                <div className="relative flex items-center">
                <Input
                  type="number"
                  min={0}
                  step="any"
                  placeholder="Stock réel"
                  value={quickStock}
                  onChange={(e) => setQuickStock(e.target.value)}
                  onBlur={handleQuickVerifyBlur}
                  disabled={loading === "quick"}
                  className="h-10 w-36 text-sm font-bold placeholder:text-muted-foreground"
                />
                {loading === "quick" && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                )}
                </div>
              </div>
            )}
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); toggleExpand(); }}>
              <span className="sr-only">Toggle details</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("transition-transform", expanded && "rotate-180")}><path d="m6 9 6 6 6-6"/></svg>
            </Button>
          </div>
        </div>

        {/* Expanded Details */}
        {expanded && (
          <div className="border-t bg-muted/20 p-4">
            {feedback ? <p className="mb-4 text-sm font-black text-emerald-700">{feedback}</p> : null}
            
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <InventoryInfoBlock label="Autonomie" value={formatDaysLeft(item)} />
              {item.trackingMode === "manual" ? (
                <InventoryInfoBlock label="Consommation" value={`${formatStock(Math.max(0, (item.lastManualStock || 0) - (item.stockEstimated || 0)))} ${item.unit || "pièce"} (depuis dernier comptage)`} />
              ) : (
                <InventoryInfoBlock label="Consommation" value={formatDailyConsumption(item)} />
              )}
              <InventoryInfoBlock label="Seuil minimum" value={`${formatStock(item.minThreshold || 0)} ${item.unit || "pièce"}`} />
              <div className="rounded-lg border bg-background p-3">
                <p className="text-xs font-black uppercase text-muted-foreground">Dernière vérif.</p>
                <p className="mt-1 text-base font-black">
                  {item.lastManualCheckAt ? new Date(item.lastManualCheckAt.toDate ? item.lastManualCheckAt.toDate() : item.lastManualCheckAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Jamais"}
                </p>
              </div>
            </div>

            {canWrite && (
              <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                <Button variant="outline" className="w-full justify-start" onClick={() => openAction("add")}>
                  + Ajouter au stock
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => openAction("verify")}>
                  ✓ Vérifier (Réel)
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => openAction("adjust")}>
                  ✎ Corriger stock
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => openAction("cost")}>
                  $ Modifier coût
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => openAction("mode")}>
                  ⚙️ Changer mode
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <InventoryActionDialog
        action={action}
        item={item}
        value={actionValue}
        loading={loading === action}
        onValueChange={setActionValue}
        onSubmit={submitAction}
        onOpenChange={(open) => {
          if (!open) closeAction()
        }}
      />
    </>
  )
}

function InventoryActionDialog({
  action,
  item,
  value,
  loading,
  onValueChange,
  onSubmit,
  onOpenChange,
}: {
  action: InventoryAction | null
  item: InventoryItem
  value: string
  loading: boolean
  onValueChange: (value: string) => void
  onSubmit: () => void
  onOpenChange: (open: boolean) => void
}) {
  const copy = getInventoryActionCopy(action)
  const unitSuffix = action === "cost" ? "FCFA" : action === "mode" ? "" : item.unit || "pièce"

  return (
    <Dialog open={Boolean(action)} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-xl p-5 sm:p-6">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>
            {getItemName(item)} · {copy.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Label htmlFor={`inventory-${item.id}-${action || "action"}`}>
            {copy.label}
          </Label>
          {action === "mode" ? (
            <select
              id={`inventory-${item.id}-mode`}
              value={value}
              onChange={(e) => onValueChange(e.target.value)}
              className="h-14 w-full rounded-md border bg-background px-3 text-lg font-black"
            >
              <option value="auto">Automatique (Déduction recette)</option>
              <option value="manual">Manuel (Aucune déduction)</option>
            </select>
          ) : (
            <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
              <Input
                id={`inventory-${item.id}-${action || "action"}`}
                type="number"
                min={0}
                step="any"
                value={value}
                onChange={(event) => onValueChange(event.target.value)}
                placeholder={copy.placeholder}
                className="h-14 text-lg font-black"
                autoFocus
              />
              <span className="rounded-lg bg-muted px-3 py-2 text-sm font-black text-muted-foreground">
                {unitSuffix}
              </span>
            </div>
          )}
        </div>

        {action === "mode" && value !== (item.trackingMode || "auto") && (
          <div className="rounded-md bg-orange-50 p-3 text-sm text-orange-800">
            ⚠️ Attention : Changer le mode de suivi ne recalcule pas l'historique. L'état actuel servira de nouvelle base de référence.
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            className="h-12 w-full sm:w-auto"
            variant="outline"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            Annuler
          </Button>
          <Button className="h-12 w-full sm:w-auto" disabled={loading || !value} onClick={onSubmit}>
            {loading ? "Validation..." : copy.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function getInventoryActionCopy(action: InventoryAction | null) {
  if (action === "add") {
    return {
      title: "Ajouter stock",
      description: "Quantité achetée à ajouter au stock actuel.",
      label: "Quantité ajoutée",
      placeholder: "Ex: 10",
      submit: "Valider l'ajout",
    }
  }

  if (action === "cost") {
    return {
      title: "Éditer coût",
      description: "Coût d'achat pour une unité.",
      label: "Coût par unité",
      placeholder: "Ex: 2500",
      submit: "Valider le coût",
    }
  }

  if (action === "verify") {
    return {
      title: "Vérifier stock",
      description: "Stock réel constaté (Inventaire).",
      label: "Stock réel compté",
      placeholder: "Ex: 8",
      submit: "Confirmer stock",
    }
  }

  if (action === "mode") {
    return {
      title: "Changer mode de suivi",
      description: "Comment le stock est décrémenté.",
      label: "Mode de suivi",
      placeholder: "",
      submit: "Sauvegarder",
    }
  }

  return {
    title: "Corriger stock",
    description: "Correction administrative.",
    label: "Nouveau stock",
    placeholder: "Ex: 8",
    submit: "Valider la correction",
  }
}

function getDaysLeft(item: InventoryItem) {
  const avgDailyConsumption = Number(item.avgDailyConsumption || 0)
  if (!Number.isFinite(avgDailyConsumption) || avgDailyConsumption <= 0) return null

  const stockEstimated = Number(item.stockEstimated || 0)
  if (!Number.isFinite(stockEstimated) || stockEstimated < 0) return null

  return stockEstimated / avgDailyConsumption
}

function isStockUnderFourDays(item: InventoryItem) {
  const daysLeft = getDaysLeft(item)
  const stock = Number(item.stockEstimated || 0)
  const minThreshold = Number(item.minThreshold || 0)
  return (daysLeft !== null && daysLeft < 4) || (minThreshold > 0 && stock <= minThreshold)
}

function hasMissingCost(item: InventoryItem) {
  return Number(item.costPerUnit || 0) <= 0
}

function formatDaysLeft(item: InventoryItem) {
  const daysLeft = getDaysLeft(item)
  if (daysLeft === null) return "—"
  return `${daysLeft.toFixed(1)} j`
}

function formatDailyConsumption(item: InventoryItem) {
  const amount = Number(item.avgDailyConsumption || 0)
  if (!Number.isFinite(amount) || amount <= 0) return "—"
  return `${formatStock(amount)} ${item.unit || "pièce"} / jour`
}

function getInventoryAlert(item: InventoryItem) {
  const daysLeft = getDaysLeft(item)

  if (daysLeft !== null && daysLeft < 2) {
    return { level: "critical" as const, label: "🔴 Critique", className: "bg-red-100 text-red-700" }
  }

  const stock = Number(item.stockEstimated || 0)
  const minThreshold = Number(item.minThreshold || 0)
  if (minThreshold > 0 && stock <= minThreshold) {
    return { level: "critical" as const, label: "🔴 Stock critique", className: "bg-red-100 text-red-700" }
  }

  if (daysLeft !== null && daysLeft < 4) {
    return { level: "warning" as const, label: "🟠 Bientôt fini", className: "bg-orange-100 text-orange-700" }
  }

  return { level: "ok" as const, label: "🟢 OK", className: "bg-emerald-100 text-emerald-700" }
}

function getItemName(item: InventoryItem) {
  return typeof item.name === "string" && item.name.trim() ? item.name.trim() : "Ingrédient sans nom"
}

function formatStock(value: unknown) {
  const amount = Number(value || 0)
  if (!Number.isFinite(amount)) return "0"
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2)
}

function formatMoney(value: unknown) {
  const amount = Number(value || 0)
  if (!Number.isFinite(amount)) return "0"
  return Math.round(amount).toLocaleString("fr-FR")
}

function buildMarginSummary(logs: InventoryLog[]) {
  const productMap = new Map<string, { productId: string; productName: string; margin: number }>()
  let totalSales = 0
  let totalCost = 0
  let ignoredCount = 0

  for (const log of logs) {
    for (const item of log.itemMargins || []) {
      if (item.missingCost || Number(item.cost || 0) <= 0) {
        ignoredCount += 1
        continue
      }

      totalSales += Number(item.sales || 0)
      totalCost += Number(item.cost || 0)
      const productName = item.productName || "Plat sans nom"
      const productId = item.productId || productName
      const current = productMap.get(productId) || { productId, productName, margin: 0 }
      current.margin += Number(item.margin || 0)
      productMap.set(productId, current)
    }
  }

  return {
    totalSales,
    totalCost,
    margin: totalSales - totalCost,
    ignoredCount,
    topItems: Array.from(productMap.values()).sort((a, b) => b.margin - a.margin).slice(0, 3),
  }
}

function sortInventoryAlerts(a: InventoryAlert, b: InventoryAlert) {
  return getSeverityRank(b.severity) - getSeverityRank(a.severity)
}

function getSeverityRank(severity: InventoryAlert["severity"]) {
  if (severity === "high") return 3
  if (severity === "medium") return 2
  return 1
}

function getAlertTone(severity: InventoryAlert["severity"]) {
  if (severity === "high") return "text-red-700"
  if (severity === "medium") return "text-orange-700"
  return "text-muted-foreground"
}

function formatAlertType(type: InventoryAlert["type"]) {
  if (type === "low_stock") return "Stock faible"
  if (type === "incoherent_stock") return "Stock incohérent"
  if (type === "missing_cost") return "Coût manquant"
  return "Inventaire"
}
