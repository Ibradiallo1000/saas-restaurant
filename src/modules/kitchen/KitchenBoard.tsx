"use client"

import * as React from "react"
import { collection, doc, limit, orderBy, query, serverTimestamp, updateDoc, where } from "firebase/firestore"
import { ChefHat } from "lucide-react"

import { FilterTabs, PageHeader } from "@/design-system/components"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { normalizeOrderStatus } from "@/lib/order-status"
import { restaurantOrdersRef } from "@/lib/restaurant-firestore-paths"
import type { RestaurantOrder, KitchenStatus } from "@/modules/restaurant/types"
import type {
  RestaurantTableRecord,
  TableSessionRecord,
} from "@/services/table-session.service"
import { KitchenOrderCard } from "./KitchenOrderCard"

type KitchenFilter = "all" | KitchenStatus

type KitchenBoardProps = {
  orders: RestaurantOrder[]
  restaurantId: string
}

const FILTERS: Array<{
  value: KitchenFilter
  title: string
}> = [
  { value: "all", title: "Tous" },
  { value: "nouvelle", title: "En attente" },
  { value: "preparation", title: "En préparation" },
  { value: "prete", title: "Prêtes" },
  { value: "servie", title: "Servies" },
  { value: "payee", title: "Payées" },
]

export function KitchenBoard({ orders, restaurantId }: KitchenBoardProps) {
  const db = useFirestore()
  const previousSnapshotRef = React.useRef<Map<string, RestaurantOrder["status"]>>(
    new Map()
  )
  const hasInitializedRef = React.useRef(false)
  const [activeFilter, setActiveFilter] = React.useState<KitchenFilter>("all")
  const tablesQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return query(
      collection(db, "restaurants", restaurantId, "tables"),
      orderBy("createdAt", "asc")
    )
  }, [db, restaurantId])
  const { data: tables } = useCollection<RestaurantTableRecord>(tablesQuery)
  const tablesById = React.useMemo(() => {
    return new Map((tables || []).map((table) => [table.id, table]))
  }, [tables])
  const sessionsQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return query(
      collection(db, "restaurants", restaurantId, "tableSessions"),
      where("status", "==", "active"),
      orderBy("startedAt", "desc"),
      limit(50)
    )
  }, [db, restaurantId])
  const { data: sessions } = useCollection<TableSessionRecord>(sessionsQuery)
  const sessionsById = React.useMemo(() => {
    return new Map((sessions || []).map((session) => [session.id, session]))
  }, [sessions])

  // Normaliser les commandes avec un statut cuisine unifié
  const normalizedOrders = React.useMemo(() => {
    return orders.map(order => ({
      ...order,
      kitchenStatus: normalizeOrderStatus(order.status)
    }))
  }, [orders])

  const sortedOrders = React.useMemo(() => {
    return [...normalizedOrders].sort((a, b) => getCreatedAtMs(a) - getCreatedAtMs(b))
  }, [normalizedOrders])

  const visibleOrders = React.useMemo(() => {
    if (activeFilter === "all") return sortedOrders
    return sortedOrders.filter((order) => order.kitchenStatus === activeFilter)
  }, [activeFilter, sortedOrders])

  const counts = React.useMemo(() => {
    return sortedOrders.reduce<Record<KitchenFilter, number>>(
      (acc, order) => {
        acc.all += 1
        acc[order.kitchenStatus] += 1
        return acc
      },
      {
        all: 0,
        nouvelle: 0,
        preparation: 0,
        prete: 0,
        servie: 0,
        payee: 0,
      }
    )
  }, [sortedOrders])

  const groupedVisibleOrders = React.useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string
        tableName: string
        zoneName: string
        startedAt: unknown
        totalAmount: number
        orders: typeof visibleOrders
      }
    >()

    for (const order of visibleOrders) {
      const key = order.sessionId || order.id
      const table = order.tableId ? tablesById.get(order.tableId) : null
      const session = order.sessionId ? sessionsById.get(order.sessionId) : null
      const group = groups.get(key)

      if (group) {
        group.orders.push(order)
        group.totalAmount += Number(order.total || 0)
        continue
      }

      groups.set(key, {
        key,
        tableName: table?.name || order.table || order.tableId || "A emporter",
        zoneName: table?.zoneId || order.zoneId || "Zone non definie",
        startedAt: session?.startedAt || order.createdAt,
        totalAmount: Number(order.total || 0),
        orders: [order],
      })
    }

    return Array.from(groups.values())
  }, [sessionsById, tablesById, visibleOrders])

  React.useEffect(() => {
    const previousSnapshot = previousSnapshotRef.current
    const currentSnapshot = new Map(
      orders.map((order) => [order.id, order.status])
    )

    if (hasInitializedRef.current) {
      const hasNewOrder = orders.some(
        (order) => 
          normalizeOrderStatus(order.status) === "nouvelle" && 
          !previousSnapshot.has(order.id)
      )
      const hasReadyOrder = orders.some(
        (order) =>
          normalizeOrderStatus(order.status) === "prete" && 
          previousSnapshot.get(order.id) !== order.status
      )

      if (hasNewOrder || hasReadyOrder) {
        playKitchenSound()
      }
    } else {
      hasInitializedRef.current = true
    }

    previousSnapshotRef.current = currentSnapshot
  }, [orders])

  const updateStatus = async (orderId: string, newKitchenStatus: KitchenStatus) => {
    await updateDoc(doc(restaurantOrdersRef(db, restaurantId), orderId), {
      status: newKitchenStatus,
      updatedAt: serverTimestamp(),
    })
  }

  return (
    <main className="space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="space-y-6">
        <PageHeader
          icon={ChefHat}
          title="Cuisine"
          subtitle="Commandes temps réel et préparation en salle."
          action={
            <span
              className="rounded-xl px-4 py-2 text-sm font-black uppercase shadow-sm"
              style={{
                backgroundColor: "color-mix(in srgb, var(--color-primary) 10%, white)",
                color: "var(--color-primary)",
              }}
            >
              {orders.length} commande(s)
            </span>
          }
        />

        <FilterTabs
          tabs={FILTERS.map((filter) => ({
            value: filter.value,
            label: filter.title,
            count: counts[filter.value as KitchenFilter],
          }))}
          value={activeFilter}
          onChange={(value) => setActiveFilter(value as KitchenFilter)}
        />

        {visibleOrders.length === 0 ? (
          <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed bg-white text-center shadow-sm">
            <div>
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xl">
                --
              </div>
              <p className="text-base font-black text-slate-500">
                Aucune commande
              </p>
            </div>
          </div>
        ) : (
          <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {groupedVisibleOrders.map((group) => (
              <div key={group.key} className="space-y-3 rounded-xl border bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between gap-3 border-b pb-2">
                  <div>
                    <h2 className="text-base font-black">{group.tableName}</h2>
                    <p className="text-xs font-semibold text-muted-foreground">
                      {group.zoneName} - session {group.key.slice(-6)}
                    </p>
                    <p className="text-xs font-semibold text-muted-foreground">
                      Debut {formatSessionTime(group.startedAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-black text-primary">
                      {group.orders.length} commande(s)
                    </span>
                    <p className="mt-2 text-sm font-black text-primary">
                      {group.totalAmount.toLocaleString()} FCFA
                    </p>
                  </div>
                </div>
                <div className="grid gap-3">
                  {group.orders.map((order) => (
                    <KitchenOrderCard
                      key={order.id}
                      order={order}
                      onUpdateStatus={updateStatus}
                    />
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}
      </div>
    </main>
  )
}

function getCreatedAtMs(order: RestaurantOrder & { kitchenStatus?: string }) {
  return (
    order.createdAt?.toMillis?.() ??
    order.createdAt?.toDate?.().getTime?.() ??
    Date.now()
  )
}

function formatSessionTime(value: unknown) {
  const date =
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
      ? value.toDate()
      : null

  if (!date) return "--:--"

  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function playKitchenSound() {
  if (typeof window === "undefined") return

  const audio = new Audio(createBeepDataUrl())
  audio.volume = 0.65
  void audio.play().catch(() => {
    // Browsers can block audio until the first user interaction.
  })
}

function createBeepDataUrl() {
  const sampleRate = 8000
  const duration = 0.22
  const sampleCount = Math.floor(sampleRate * duration)
  const headerSize = 44
  const buffer = new ArrayBuffer(headerSize + sampleCount * 2)
  const view = new DataView(buffer)

  writeString(view, 0, "RIFF")
  view.setUint32(4, 36 + sampleCount * 2, true)
  writeString(view, 8, "WAVE")
  writeString(view, 12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(view, 36, "data")
  view.setUint32(40, sampleCount * 2, true)

  for (let i = 0; i < sampleCount; i += 1) {
    const tone =
      Math.sin((2 * Math.PI * 880 * i) / sampleRate) * 0.6 +
      Math.sin((2 * Math.PI * 1320 * i) / sampleRate) * 0.25
    const fade = 1 - i / sampleCount
    view.setInt16(headerSize + i * 2, tone * fade * 32767, true)
  }

  const bytes = new Uint8Array(buffer)
  let binary = ""

  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i])
  }

  return `data:audio/wav;base64,${window.btoa(binary)}`
}

function writeString(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i))
  }
}
