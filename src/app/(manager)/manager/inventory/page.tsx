"use client"

import * as React from "react"
import { collection, query, where } from "firebase/firestore"
import { AlertTriangle, Package, Plus, RefreshCw } from "lucide-react"

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

type InventoryAction = "add" | "adjust" | "cost"

const UNIT_OPTIONS: InventoryUnit[] = ["pièce", "kg", "litre"]

export default function ManagerInventoryPage() {
  const db = useFirestore()
  const { role } = useTenant()
  const { restaurantId, loading } = useRestaurant()
  const canWrite = role === ROLES.MANAGER
  const canRead = canWrite || role === ROLES.OWNER
  const [seedLoading, setSeedLoading] = React.useState(false)
  const [createLoading, setCreateLoading] = React.useState(false)
  const [newName, setNewName] = React.useState("")
  const [newUnit, setNewUnit] = React.useState<InventoryUnit>("pièce")
  const [newStock, setNewStock] = React.useState("")
  const [newCost, setNewCost] = React.useState("")
  const [newMinThreshold, setNewMinThreshold] = React.useState("")
  const [focusedItemId, setFocusedItemId] = React.useState<string | null>(null)
  const [showAllItems, setShowAllItems] = React.useState(false)

  const itemsQuery = useMemoFirebase(() => {
    if (!db || !restaurantId || !canRead) return null
    return collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, "inventoryItems")
  }, [db, restaurantId, canRead])
  const { data, isLoading } = useCollection<InventoryItem>(itemsQuery)

  const todayLogsQuery = useMemoFirebase(() => {
    if (!db || !restaurantId || !canRead) return null
    return query(
      collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, "inventoryLogs"),
      where("createdDate", "==", getTodayKey())
    )
  }, [db, restaurantId, canRead])
  const { data: todayLogs } = useCollection<InventoryLog>(todayLogsQuery)

  const alertsQuery = useMemoFirebase(() => {
    if (!db || !restaurantId || !canRead) return null
    return query(
      collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, "inventoryAlerts"),
      where("resolved", "==", false)
    )
  }, [db, restaurantId, canRead])
  const { data: alerts } = useCollection<InventoryAlert>(alertsQuery)

  const items = React.useMemo(
    () => [...(data || [])].sort((a, b) => getItemName(a).localeCompare(getItemName(b))),
    [data]
  )
  const activeAlerts = React.useMemo(() => [...(alerts || [])].sort(sortInventoryAlerts), [alerts])
  const alertItemIds = React.useMemo(
    () => new Set(activeAlerts.map((alert) => alert.itemId).filter(Boolean) as string[]),
    [activeAlerts]
  )
  const priorityItems = React.useMemo(
    () => items.filter((item) => alertItemIds.has(item.id) || isStockUnderFourDays(item) || hasMissingCost(item)),
    [items, alertItemIds]
  )
  const visibleItems = showAllItems ? items : priorityItems
  const marginSummary = React.useMemo(() => buildMarginSummary(todayLogs || []), [todayLogs])
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
      })
      setNewName("")
      setNewUnit("pièce")
      setNewStock("")
      setNewCost("")
      setNewMinThreshold("")
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
      <Card className={cn(activeAlerts.length > 0 ? "border-orange-300 bg-orange-50/60 text-orange-950 dark:border-orange-500/60 dark:bg-orange-950/30 dark:text-orange-50" : "border-emerald-300 bg-emerald-50/60 text-emerald-950 dark:border-emerald-500/60 dark:bg-emerald-950/30 dark:text-emerald-50")}>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className={cn("h-4 w-4", activeAlerts.length > 0 ? "text-orange-700 dark:text-orange-300" : "text-emerald-700 dark:text-emerald-300")} />
              Alertes
            </CardTitle>
            <p className={cn("mt-1 text-sm font-bold", activeAlerts.length > 0 ? "text-orange-800 dark:text-orange-100" : "text-emerald-800 dark:text-emerald-100")}>
              {activeAlerts.length > 0 ? `${activeAlerts.length} action(s) à traiter maintenant.` : "✅ Tout est sous contrôle aujourd'hui"}
            </p>
          </div>
          <Button disabled={priorityItems.length === 0} onClick={focusFirstProblem}>
            Corriger maintenant
          </Button>
        </CardHeader>
        {activeAlerts.length > 0 ? (
          <CardContent className="grid gap-2">
            {activeAlerts.map((alert) => (
              <div key={alert.id} className="flex flex-col gap-2 rounded-lg border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className={cn("text-sm font-black", getAlertTone(alert.severity))}>
                    {alert.message || "Alerte inventaire"}
                  </p>
                  <p className="text-xs font-bold uppercase text-muted-foreground">{formatAlertType(alert.type)}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => focusInventoryItem(alert.itemId)}>
                  Corriger
                </Button>
              </div>
            ))}
          </CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4 text-primary" />
              Stock critique
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Produits à moins de 4 jours ou avec une correction à faire.
            </p>
          </div>
          {items.length > priorityItems.length ? (
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
            <div className="grid gap-3">
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
                  <Label>Seuil minimum</Label>
                  <Input type="number" min={0} value={newMinThreshold} onChange={(event) => setNewMinThreshold(event.target.value)} />
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
  const [loading, setLoading] = React.useState<InventoryAction | null>(null)

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
      nextAction === "adjust"
        ? String(Number(item.stockEstimated || 0))
        : nextAction === "cost"
          ? String(Number(item.costPerUnit || 0))
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
    const value = Number(actionValue || 0)
    if (!Number.isFinite(value) || value < 0 || (action === "add" && value <= 0)) return

    setLoading(action)
    try {
      if (action === "add") {
        await service.addInventoryStock(restaurantId, item.id, value)
        showFeedback("Stock mis à jour")
      } else if (action === "adjust") {
        await service.adjustInventoryStock(restaurantId, item.id, value)
        showFeedback("Stock mis à jour")
      } else {
        await service.updateInventoryCost(restaurantId, item.id, value)
        showFeedback("Coût mis à jour")
      }
      setAction(null)
      setActionValue("")
    } finally {
      setLoading(null)
    }
  }

  return (
    <>
      <article
        id={`inventory-item-${item.id}`}
        className={cn(
          "space-y-5 rounded-xl border bg-card p-5 shadow-sm",
          getInventoryAlert(item).level === "critical" && "border-red-300 bg-red-50/50",
          getInventoryAlert(item).level === "warning" && "border-orange-300 bg-orange-50/50",
          focused && "ring-2 ring-primary"
        )}
      >
        <section className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xl font-black">{getItemName(item)}</p>
                {hasMissingCost(item) ? (
                  <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-black uppercase text-orange-700">
                    Coût non défini
                  </span>
                ) : null}
                {Number(item.stockEstimated || 0) < 0 ? (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black uppercase text-red-700">
                    ⚠ Stock incohérent
                  </span>
                ) : null}
              </div>
              <p className="text-xs font-bold uppercase text-muted-foreground">{getInventoryAlert(item).label}</p>
              {feedback ? <p className="text-sm font-black text-emerald-700">{feedback}</p> : null}
            </div>
            <div className="rounded-lg border bg-background px-3 py-2">
              <p className="text-xs font-black uppercase text-muted-foreground">Coût</p>
              <p className="text-lg font-black">{formatMoney(item.costPerUnit || 0)} FCFA</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <InventoryInfoBlock
              label="Stock actuel"
              value={`${formatStock(item.stockEstimated)} ${item.unit || "pièce"}`}
            />
            <InventoryInfoBlock label="Autonomie" value={formatDaysLeft(item)} />
            <InventoryInfoBlock label="Consommation" value={formatDailyConsumption(item)} />
            <InventoryInfoBlock label="Seuil minimum" value={`${formatStock(item.minThreshold || 0)} ${item.unit || "pièce"}`} />
          </div>
        </section>

        {canWrite ? (
          <section className="grid gap-4 border-t pt-4 lg:grid-cols-2">
            <div className="space-y-2 rounded-lg border bg-background p-3">
              <Label htmlFor={`add-${item.id}`}>Ajouter stock</Label>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <Input
                  id={`add-${item.id}`}
                  type="number"
                  min={0}
                  step="any"
                  value={addValue}
                  onChange={(event) => setAddValue(event.target.value)}
                  placeholder="Ex: 10"
                  className="h-12 text-base font-bold"
                />
                <Button className="h-12" disabled={loading === "add" || !addValue} onClick={() => submitCardAction("add")}>
                  Valider
                </Button>
              </div>
            </div>

            <div className="space-y-2 rounded-lg border bg-background p-3">
              <Label htmlFor={`adjust-${item.id}`}>Corriger stock</Label>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <Input
                  id={`adjust-${item.id}`}
                  type="number"
                  min={0}
                  step="any"
                  value={adjustValue}
                  onChange={(event) => setAdjustValue(event.target.value)}
                  placeholder={`Actuel: ${formatStock(item.stockEstimated)}`}
                  className="h-12 text-base font-bold"
                />
                <Button className="h-12" disabled={loading === "adjust" || !adjustValue} onClick={() => submitCardAction("adjust")}>
                  Valider
                </Button>
              </div>
            </div>

            <div className="space-y-2 rounded-lg border bg-background p-3">
              <Label>Coût</Label>
              <div className="flex min-h-12 items-center justify-between gap-3 rounded-md border px-3">
                <span className="text-base font-black">{formatMoney(item.costPerUnit || 0)} FCFA</span>
                <Button variant="outline" onClick={() => openAction("cost")}>
                  Modifier
                </Button>
              </div>
            </div>

            <div className="space-y-2 rounded-lg border bg-background p-3">
              <Label htmlFor={`threshold-${item.id}`}>Seuil minimum</Label>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <Input
                  id={`threshold-${item.id}`}
                  type="number"
                  min={0}
                  step="any"
                  value={thresholdValue}
                  onChange={(event) => setThresholdValue(event.target.value)}
                  placeholder={`Actuel: ${formatStock(item.minThreshold || 0)}`}
                  className="h-12 text-base font-bold"
                />
                <Button className="h-12" variant="outline" disabled={loading === "cost" || !thresholdValue} onClick={updateThreshold}>
                  Valider
                </Button>
              </div>
            </div>
          </section>
        ) : null}
      </article>

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
  const unitSuffix = action === "cost" ? "FCFA" : item.unit || "pièce"

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
        </div>

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

  return {
    title: "Corriger stock",
    description: "Stock réel compté maintenant.",
    label: "Stock réel",
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

function getTodayKey() {
  return new Date().toISOString().slice(0, 10)
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
