"use client"

import * as React from "react"
import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore"
import { Loader2, Plus, Power, Store } from "lucide-react"

import { DashboardWidget, DashboardWidgetHeader } from "@/components/dashboard-ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { useRestaurant } from "@/design-system/context/RestaurantContext"
import { useTenant } from "@/design-system/context/TenantProvider"
import { useToast } from "@/hooks/use-toast"
import { DEFAULT_POS_STATION } from "@/lib/pos-stations"

type StationRecord = {
  id: string
  name: string
  code: string
  isActive: boolean
  activeSessionId?: string | null
  catalogMode: "ALL" | "RESTRICTED"
  allowedCategoryIds: string[]
  allowedProductIds: string[]
  excludedProductIds: string[]
}

type StaffRecord = {
  id: string
  role?: string
  name?: string
  nomComplet?: string
  email?: string
  allowedPosStationIds?: string[]
  defaultPosStationId?: string | null
}

export function PosStationsSettings() {
  const db = useFirestore()
  const { restaurantId } = useRestaurant()
  const { user } = useTenant()
  const { toast } = useToast()
  const [name, setName] = React.useState("")
  const [code, setCode] = React.useState("")
  const [savingKey, setSavingKey] = React.useState<string | null>(null)

  const stationsQuery = useMemoFirebase(
    () => db && restaurantId ? collection(db, "restaurants", restaurantId, "posStations") : null,
    [db, restaurantId]
  )
  const staffQuery = useMemoFirebase(
    () => db && restaurantId ? collection(db, "restaurants", restaurantId, "staff") : null,
    [db, restaurantId]
  )
  const stationsResult = useCollection<any>(stationsQuery)
  const staffResult = useCollection<any>(staffQuery)
  const stations = React.useMemo(
    () => [...(stationsResult.data || [])].sort((a, b) => String(a.name).localeCompare(String(b.name))) as StationRecord[],
    [stationsResult.data]
  )
  const cashiers = React.useMemo(
    () => (staffResult.data || []).filter((member: StaffRecord) => member.role === "cashier") as StaffRecord[],
    [staffResult.data]
  )

  const createStation = async () => {
    if (!db || !restaurantId || !user || !name.trim() || !code.trim()) return
    setSavingKey("create")
    try {
      await addDoc(collection(db, "restaurants", restaurantId, "posStations"), {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        isActive: true,
        catalogMode: "ALL",
        allowedCategoryIds: [],
        allowedProductIds: [],
        excludedProductIds: [],
        activeSessionId: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user.uid,
        updatedBy: user.uid,
      })
      setName("")
      setCode("")
      toast({ title: "Poste créé" })
    } catch (error: any) {
      toast({ variant: "destructive", title: "Création impossible", description: error?.message })
    } finally {
      setSavingKey(null)
    }
  }

  const updateStation = async (station: StationRecord, values: Record<string, unknown>) => {
    if (!db || !restaurantId || !user) return
    setSavingKey(station.id)
    try {
      await updateDoc(doc(db, "restaurants", restaurantId, "posStations", station.id), {
        ...values,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      })
      toast({ title: "Poste mis à jour" })
    } catch (error: any) {
      toast({ variant: "destructive", title: "Modification impossible", description: error?.message })
    } finally {
      setSavingKey(null)
    }
  }

  const updateAssignment = async (cashier: StaffRecord, allowedIds: string[], defaultId: string | null) => {
    if (!db || !restaurantId) return
    setSavingKey(`staff-${cashier.id}`)
    try {
      const normalizedDefault = defaultId && allowedIds.includes(defaultId) ? defaultId : allowedIds[0] ?? null
      await updateDoc(doc(db, "restaurants", restaurantId, "staff", cashier.id), {
        allowedPosStationIds: allowedIds,
        defaultPosStationId: normalizedDefault,
        updatedAt: serverTimestamp(),
      })
      toast({ title: "Affectation mise à jour" })
    } catch (error: any) {
      toast({ variant: "destructive", title: "Affectation impossible", description: error?.message })
    } finally {
      setSavingKey(null)
    }
  }

  const isLoading = stationsResult.isLoading || staffResult.isLoading
  return <div className="space-y-5">
    <div>
      <h1 className="text-2xl font-black">Postes de caisse</h1>
      <p className="text-sm text-muted-foreground">Configurez les postes et les affectations. Le périmètre catalogue sera activé en Phase 2.</p>
    </div>

    <DashboardWidget>
      <DashboardWidgetHeader title="Nouveau poste" description="Un poste créé vend tout le catalogue par défaut." />
      <div className="grid gap-3 p-4 md:grid-cols-[1fr_220px_auto] md:items-end">
        <div className="space-y-1"><Label htmlFor="station-name">Nom</Label><Input id="station-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Caisse restaurant" /></div>
        <div className="space-y-1"><Label htmlFor="station-code">Code</Label><Input id="station-code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="RESTO" /></div>
        <Button onClick={createStation} disabled={savingKey === "create" || !name.trim() || !code.trim()}><Plus className="mr-2 h-4 w-4" />Créer</Button>
      </div>
    </DashboardWidget>

    <DashboardWidget>
      <DashboardWidgetHeader title="Postes actifs" description={`${DEFAULT_POS_STATION.name} reste disponible virtuellement lorsqu’aucun poste n’est affecté.`} />
      <div className="divide-y">
        {isLoading ? <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Chargement…</div> : null}
        {stations.map((station) => <StationRow key={station.id} station={station} saving={savingKey === station.id} onSave={updateStation} />)}
        {!isLoading && stations.length === 0 ? <div className="flex items-center gap-3 p-4 text-sm text-muted-foreground"><Store className="h-5 w-5" />Aucun poste configuré : la caisse DEFAULT vend tout le catalogue.</div> : null}
      </div>
    </DashboardWidget>

    <DashboardWidget>
      <DashboardWidgetHeader title="Affectations des caissiers" description="Sans affectation explicite, le caissier utilise DEFAULT." />
      <div className="divide-y">
        {cashiers.map((cashier) => <CashierAssignment key={cashier.id} cashier={cashier} stations={stations} saving={savingKey === `staff-${cashier.id}`} onSave={updateAssignment} />)}
        {!isLoading && cashiers.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Aucun caissier à affecter.</p> : null}
      </div>
    </DashboardWidget>
  </div>
}

function StationRow({ station, saving, onSave }: { station: StationRecord; saving: boolean; onSave: (station: StationRecord, values: Record<string, unknown>) => Promise<void> }) {
  const [name, setName] = React.useState(station.name)
  const [mode, setMode] = React.useState<"ALL" | "RESTRICTED">(station.catalogMode || "ALL")
  const [categories, setCategories] = React.useState((station.allowedCategoryIds || []).join(", "))
  const [products, setProducts] = React.useState((station.allowedProductIds || []).join(", "))
  const [excluded, setExcluded] = React.useState((station.excludedProductIds || []).join(", "))
  React.useEffect(() => setName(station.name), [station.name])
  const ids = (value: string) => [...new Set(value.split(",").map((entry) => entry.trim()).filter(Boolean))]
  return <div className="grid gap-3 p-4 md:grid-cols-[1fr_160px_auto_auto] md:items-center">
    <Input value={name} onChange={(event) => setName(event.target.value)} aria-label={`Nom du poste ${station.name}`} />
    <span className="text-sm font-bold text-muted-foreground">{station.code}</span>
    <Button variant="outline" disabled={saving || !name.trim() || name.trim() === station.name} onClick={() => onSave(station, { name: name.trim() })}>Renommer</Button>
    <Button variant={station.isActive ? "outline" : "default"} disabled={saving || Boolean(station.activeSessionId)} onClick={() => onSave(station, { isActive: !station.isActive })}><Power className="mr-2 h-4 w-4" />{station.isActive ? "Désactiver" : "Activer"}</Button>
    {station.activeSessionId ? <p className="text-xs text-amber-700 md:col-span-4">Une session est ouverte : ce poste ne peut pas être désactivé.</p> : null}
    <div className="grid gap-3 rounded-md border p-3 md:col-span-4 md:grid-cols-2">
      <div className="space-y-1"><Label>Mode catalogue</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={mode} onChange={(event) => setMode(event.target.value as "ALL" | "RESTRICTED")}><option value="ALL">Tout le catalogue</option><option value="RESTRICTED">Périmètre restreint</option></select></div>
      <div className="space-y-1"><Label>Produits exclus (IDs)</Label><Input value={excluded} onChange={(event) => setExcluded(event.target.value)} placeholder="produit-1, produit-2" /></div>
      <div className="space-y-1"><Label>Catégories autorisées (IDs)</Label><Input value={categories} onChange={(event) => setCategories(event.target.value)} disabled={mode === "ALL"} placeholder="categorie-1" /></div>
      <div className="space-y-1"><Label>Produits autorisés (IDs)</Label><Input value={products} onChange={(event) => setProducts(event.target.value)} disabled={mode === "ALL"} placeholder="produit-3" /></div>
      <Button className="md:col-span-2 md:justify-self-end" variant="outline" disabled={saving} onClick={() => onSave(station, { catalogMode: mode, allowedCategoryIds: ids(categories), allowedProductIds: ids(products), excludedProductIds: ids(excluded) })}>Enregistrer le périmètre</Button>
      {station.activeSessionId ? <p className="text-xs text-muted-foreground md:col-span-2">La session ouverte conserve son instantané actuel ; ce changement s’appliquera à la prochaine ouverture.</p> : null}
    </div>
  </div>
}

function CashierAssignment({ cashier, stations, saving, onSave }: { cashier: StaffRecord; stations: StationRecord[]; saving: boolean; onSave: (cashier: StaffRecord, allowed: string[], defaultId: string | null) => Promise<void> }) {
  const current = Array.isArray(cashier.allowedPosStationIds) ? cashier.allowedPosStationIds : []
  const activeStations = stations.filter((station) => station.isActive)
  const displayName = cashier.nomComplet || cashier.name || cashier.email || cashier.id
  return <div className="space-y-3 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold">{displayName}</p><span className="text-xs text-muted-foreground">{current.length === 0 ? "DEFAULT" : `${current.length} poste(s)`}</span></div>
    <div className="flex flex-wrap gap-3">
      {activeStations.map((station) => <label key={station.id} className="flex min-h-10 items-center gap-2 rounded-md border px-3 text-sm">
        <input type="checkbox" checked={current.includes(station.id)} disabled={saving} onChange={(event) => {
          const next = event.target.checked ? [...current, station.id] : current.filter((id) => id !== station.id)
          void onSave(cashier, next, cashier.defaultPosStationId ?? null)
        }} />{station.name}
      </label>)}
      {current.length > 0 ? <Button variant="ghost" disabled={saving} onClick={() => onSave(cashier, [], null)}>Réinitialiser sur DEFAULT</Button> : null}
    </div>
    {current.length > 0 ? <div className="max-w-sm space-y-1"><Label htmlFor={`default-${cashier.id}`}>Poste par défaut</Label><select id={`default-${cashier.id}`} className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={cashier.defaultPosStationId || current[0]} disabled={saving} onChange={(event) => void onSave(cashier, current, event.target.value)}>{activeStations.filter((station) => current.includes(station.id)).map((station) => <option key={station.id} value={station.id}>{station.name}</option>)}</select></div> : null}
  </div>
}
