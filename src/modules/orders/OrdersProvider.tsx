"use client"

import * as React from "react"
import { limit, onSnapshot, orderBy, query, Timestamp, where } from "firebase/firestore"

import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { restaurantOrdersRef } from "@/lib/restaurant-firestore-paths"
import { orderHasKitchenItems } from "@/utils/preparation-logic"

type OrdersContextType = {
  orders: any[]
  isLoading: boolean
}

const OrdersContext = React.createContext<OrdersContextType>({
  orders: [],
  isLoading: true,
})

const ACTIVE_KITCHEN_STATUSES = ["pending", "preparing", "ready"]
const PICKED_UP_RECOVERY_STATUSES = ["picked_up", "completed"]
const KITCHEN_JOURNAL_MARKER = "__kitchenServedToday"
const KITCHEN_JOURNAL_SOURCE = "__kitchenServedTodaySource"
const KITCHEN_JOURNAL_TRANSITION_MARKER = "__kitchenTransitioningToJournal"
const DEBUG_PICKED_UP_ORDER_ID = "MEy8U4UOHDUoJz5UVZq7"

type KitchenJournalSource =
  | "canonical-served"
  | "canonical-picked-up"
  | "legacy-served"
  | "legacy-picked-up"
  | "local-buffer"

export function OrdersProvider({
  children,
  restaurantId,
}: {
  children: React.ReactNode
  restaurantId?: string
}) {
  const db = useFirestore()
  const dayRange = useLocalKitchenDayRange()
  const transitionOrdersRef = React.useRef<Map<string, any>>(new Map())
  const previousActiveOrdersRef = React.useRef<Map<string, any>>(new Map())
  const [transitionVersion, bumpTransitionVersion] = React.useReducer((value: number) => value + 1, 0)

  const activeOrdersQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null

    return query(
      restaurantOrdersRef(db, restaurantId),
      where("kitchenStatus", "in", ACTIVE_KITCHEN_STATUSES),
      orderBy("createdAt", "desc"),
      limit(150)
    )
  }, [db, restaurantId])

  const todayServedAtOrdersQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null

    return query(
      restaurantOrdersRef(db, restaurantId),
      where("timestamps.servedAt", ">=", Timestamp.fromDate(dayRange.start)),
      where("timestamps.servedAt", "<", Timestamp.fromDate(dayRange.end)),
      orderBy("timestamps.servedAt", "desc"),
      limit(100)
    )
  }, [db, dayRange.end, dayRange.start, restaurantId])

  const todayLegacyServedAtOrdersQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null

    return query(
      restaurantOrdersRef(db, restaurantId),
      where("servedAt", ">=", Timestamp.fromDate(dayRange.start)),
      where("servedAt", "<", Timestamp.fromDate(dayRange.end)),
      orderBy("servedAt", "desc"),
      limit(100)
    )
  }, [db, dayRange.end, dayRange.start, restaurantId])

  const todayPickedUpAtOrdersQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null

    return query(
      restaurantOrdersRef(db, restaurantId),
      where("timestamps.pickedUpAt", ">=", Timestamp.fromDate(dayRange.start)),
      where("timestamps.pickedUpAt", "<", Timestamp.fromDate(dayRange.end)),
      orderBy("timestamps.pickedUpAt", "desc"),
      limit(100)
    )
  }, [db, dayRange.end, dayRange.start, restaurantId])

  const todayLegacyPickedUpAtOrdersQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null

    return query(
      restaurantOrdersRef(db, restaurantId),
      where("pickedUpAt", ">=", Timestamp.fromDate(dayRange.start)),
      where("pickedUpAt", "<", Timestamp.fromDate(dayRange.end)),
      orderBy("pickedUpAt", "desc"),
      limit(100)
    )
  }, [db, dayRange.end, dayRange.start, restaurantId])

  const pickedUpRecoveryOrdersQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null

    return query(
      restaurantOrdersRef(db, restaurantId),
      where("kitchenStatus", "in", PICKED_UP_RECOVERY_STATUSES)
    )
  }, [db, restaurantId])

  const { data: activeOrders, isLoading: isLoadingActiveOrders } = useCollection(activeOrdersQuery)
  const { data: todayServedAtOrders, isLoading: isLoadingTodayServedAtOrders } = useCollection(todayServedAtOrdersQuery)
  const { data: todayLegacyServedAtOrders, isLoading: isLoadingTodayLegacyServedAtOrders } = useCollection(todayLegacyServedAtOrdersQuery)
  const { data: todayPickedUpAtOrders, isLoading: isLoadingTodayPickedUpAtOrders } = useCollection(todayPickedUpAtOrdersQuery)
  const { data: todayLegacyPickedUpAtOrders, isLoading: isLoadingTodayLegacyPickedUpAtOrders } = useCollection(todayLegacyPickedUpAtOrdersQuery)
  const { data: pickedUpRecoveryOrders, isLoading: isLoadingPickedUpRecoveryOrders } = useCollection(pickedUpRecoveryOrdersQuery)

  React.useEffect(() => {
    if (!todayPickedUpAtOrdersQuery) return

    const startTimestamp = Timestamp.fromDate(dayRange.start)
    const endTimestamp = Timestamp.fromDate(dayRange.end)

    console.group("[OrdersProvider][pickedUpAt raw listener] bounds")
    console.log("localTime", new Date().toLocaleString())
    console.log("startOfDay", dayRange.start)
    console.log("nextStartOfDay", dayRange.end)
    console.log("startOfDayISO", dayRange.start.toISOString())
    console.log("nextStartOfDayISO", dayRange.end.toISOString())
    console.log("startOfDayTimestamp", startTimestamp)
    console.log("nextStartOfDayTimestamp", endTimestamp)
    console.groupEnd()

    return onSnapshot(
      todayPickedUpAtOrdersQuery,
      (snapshot) => {
        console.group("[OrdersProvider][pickedUpAt raw listener] snapshot")
        console.log("localTime", new Date().toLocaleString())
        console.log("documentCount", snapshot.docs.length)
        snapshot.docs.forEach((documentSnapshot) => {
          const data = documentSnapshot.data() as any
          const isTargetDocument = documentSnapshot.id === DEBUG_PICKED_UP_ORDER_ID
          console.log({
            id: documentSnapshot.id,
            isTargetDocument,
            commercialReference:
              data.reference ??
              data.orderNumber ??
              data.orderCode ??
              data.code ??
              data.displayId ??
              null,
            kitchenStatus: data.kitchenStatus,
            orderType: data.orderType,
            type: data.type,
            mode: data.mode,
            timestampsPickedUpAt: data.timestamps?.pickedUpAt,
            rootPickedUpAt: data.pickedUpAt,
            itemsLength: Array.isArray(data.items) ? data.items.length : 0,
          })
          if (isTargetDocument) {
            console.group("[OrdersProvider][pickedUpAt target] snapshot item details")
            console.log("items", data.items)
            console.log(
              "itemPreparationFields",
              (data.items || []).map((item: any) => ({
                preparationMode: item?.preparationMode,
                destination: item?.destination,
                productionArea: item?.productionArea,
                status: item?.status,
              }))
            )
            console.log("orderHasKitchenItems", orderHasKitchenItems(data.items || []))
            console.groupEnd()
          }
        })
        console.groupEnd()
      },
      (error) => {
        console.group("[OrdersProvider][pickedUpAt raw listener] error")
        console.error("code", error.code)
        console.error("message", error.message)
        console.error("stack", error.stack)
        console.error(error)
        console.groupEnd()
      }
    )
  }, [dayRange.end, dayRange.start, todayPickedUpAtOrdersQuery])

  React.useEffect(() => {
    transitionOrdersRef.current.clear()
    previousActiveOrdersRef.current.clear()
    bumpTransitionVersion()
  }, [dayRange.start, restaurantId])

  React.useEffect(() => {
    if (!activeOrders) return

    const currentActiveOrders = new Map<string, any>()
    let didChangeTransitions = false

    activeOrders.forEach((order: any) => {
      if (order?.id) currentActiveOrders.set(order.id, order)
    })

    previousActiveOrdersRef.current.forEach((order, orderId) => {
      if (currentActiveOrders.has(orderId)) return
      if (mapLegacyStatus(order.kitchenStatus ?? order.status ?? order.orderStatus) !== "ready") return

      transitionOrdersRef.current.set(orderId, {
        ...order,
        kitchenStatus: "served",
        [KITCHEN_JOURNAL_MARKER]: true,
        [KITCHEN_JOURNAL_SOURCE]: "local-buffer",
        [KITCHEN_JOURNAL_TRANSITION_MARKER]: true,
      })
      didChangeTransitions = true
    })

    currentActiveOrders.forEach((_, orderId) => {
      if (transitionOrdersRef.current.delete(orderId)) didChangeTransitions = true
    })

    previousActiveOrdersRef.current = currentActiveOrders
    if (didChangeTransitions) bumpTransitionVersion()
  }, [activeOrders])

  const journalOrderIds = React.useMemo(() => {
    const canonicalServed = getStrictJournalOrders(todayServedAtOrders, "canonical-served", dayRange)
    const canonicalPickedUp = getStrictJournalOrders(todayPickedUpAtOrders, "canonical-picked-up", dayRange)
    const legacyServed = getStrictJournalOrders(todayLegacyServedAtOrders, "legacy-served", dayRange)
    const legacyPickedUp = getStrictJournalOrders(todayLegacyPickedUpAtOrders, "legacy-picked-up", dayRange)
    const pickedUpRecovery = getStrictPickedUpJournalOrders(pickedUpRecoveryOrders, dayRange)

    debugPickedUpStage("journalOrderIds:getStrictJournalOrders canonical-picked-up", canonicalPickedUp)

    return new Set(
      [
        ...canonicalServed,
        ...canonicalPickedUp,
        ...legacyServed,
        ...legacyPickedUp,
        ...pickedUpRecovery,
      ]
        .map((order: any) => order?.id)
        .filter(Boolean)
    )
  }, [
    todayLegacyPickedUpAtOrders,
    todayLegacyServedAtOrders,
    todayPickedUpAtOrders,
    pickedUpRecoveryOrders,
    todayServedAtOrders,
    dayRange,
  ])

  React.useEffect(() => {
    let didChangeTransitions = false

    journalOrderIds.forEach((orderId) => {
      if (transitionOrdersRef.current.delete(orderId)) didChangeTransitions = true
    })

    if (didChangeTransitions) bumpTransitionVersion()
  }, [journalOrderIds])

  const orders = React.useMemo(() => {
    const merged = new Map<string, any>()
    const addOrders = (
      items: any[] | null | undefined,
      source?: KitchenJournalSource
    ) => {
      const sourceOrders = source
        ? getStrictJournalOrders(items, source, dayRange)
        : items || []

      ;sourceOrders.forEach((order: any) => {
        if (!order?.id) return
        if (isDebugPickedUpOrder(order)) {
          console.group("[OrdersProvider][pickedUpAt pipeline] addOrders -> Map insertion")
          console.log("source", source ?? "active/local")
          console.log("beforeHadOrder", merged.has(order.id))
          console.log("incomingOrder", order)
          console.groupEnd()
        }
        merged.set(order.id, order)
        if (isDebugPickedUpOrder(order)) {
          console.group("[OrdersProvider][pickedUpAt pipeline] addOrders -> Map stored value")
          console.log("source", source ?? "active/local")
          console.log("storedOrder", merged.get(order.id))
          console.groupEnd()
        }
      })
    }

    addOrders(activeOrders)
    addOrders(Array.from(transitionOrdersRef.current.values()))
    addOrders(todayServedAtOrders, "canonical-served")
    addOrders(todayPickedUpAtOrders, "canonical-picked-up")
    addOrders(todayLegacyServedAtOrders, "legacy-served")
    addOrders(todayLegacyPickedUpAtOrders, "legacy-picked-up")
    getStrictPickedUpJournalOrders(pickedUpRecoveryOrders, dayRange).forEach((order: any) => {
      if (order?.id) merged.set(order.id, order)
    })

    debugPickedUpStage("orders:Map after merge", Array.from(merged.values()))

    return Array.from(merged.values())
  }, [
    activeOrders,
    journalOrderIds,
    pickedUpRecoveryOrders,
    todayLegacyPickedUpAtOrders,
    todayLegacyServedAtOrders,
    todayPickedUpAtOrders,
    todayServedAtOrders,
    transitionVersion,
    dayRange,
  ])
  const isLoading =
    isLoadingActiveOrders ||
    isLoadingTodayServedAtOrders ||
    isLoadingTodayLegacyServedAtOrders ||
    isLoadingTodayPickedUpAtOrders ||
    isLoadingTodayLegacyPickedUpAtOrders ||
    isLoadingPickedUpRecoveryOrders

  const kitchenOrders = React.useMemo(() => {
    const mergedOrders = new Map<string, any>()

    ;(orders || []).forEach((order: any) => {
      if (!order?.id) return

      const isServedToday = Boolean(order[KITCHEN_JOURNAL_MARKER])
      const kitchenStatus = mapLegacyStatus(order.kitchenStatus ?? order.status ?? order.orderStatus)
      if (!isServedToday && !ACTIVE_KITCHEN_STATUSES.includes(kitchenStatus)) return
      if (!orderHasKitchenItems(order.items || [])) return

      const normalizedKitchenStatus = isServedToday
        ? order.kitchenStatus ?? "served"
        : order.kitchenStatus ?? kitchenStatus

      mergedOrders.set(
        order.id,
        normalizedKitchenStatus === order.kitchenStatus
          ? order
          : { ...order, kitchenStatus: normalizedKitchenStatus }
      )
    })

    debugPickedUpStage("kitchenOrders:after orderHasKitchenItems/final filter", Array.from(mergedOrders.values()))

    return Array.from(mergedOrders.values())
  }, [orders])
  const stableKitchenOrders = useStableKitchenOrders(kitchenOrders)

  React.useEffect(() => {
    debugPickedUpStage("context:orders exposed to KitchenBoard", stableKitchenOrders)
  }, [stableKitchenOrders])

  const value = React.useMemo(
    () => ({
      orders: stableKitchenOrders,
      isLoading,
    }),
    [isLoading, stableKitchenOrders]
  )

  return (
    <OrdersContext.Provider value={value}>
      {children}
    </OrdersContext.Provider>
  )
}

export const useOrders = () => React.useContext(OrdersContext)

function mapLegacyStatus(status: string | null | undefined) {
  if (status === "preparing" || status === "preparation" || status === "en_preparation") return "preparing"
  if (status === "ready" || status === "prete" || status === "pretes") return "ready"
  if (status === "served" || status === "servie" || status === "servies") return "served"
  if (status === "completed" || status === "terminee") return "completed"
  if (status === "picked_up" || status === "recuperee") return "picked_up"
  return "pending"
}

function getStrictJournalOrders(
  orders: any[] | null | undefined,
  source: KitchenJournalSource,
  dayRange: { start: Date; end: Date }
) {
  return (orders || [])
    .map((order) => markKitchenServedToday(order, source, dayRange))
    .filter(Boolean)
}

function getStrictPickedUpJournalOrders(
  orders: any[] | null | undefined,
  dayRange: { start: Date; end: Date }
) {
  return (orders || [])
    .map((order) => {
      const canonical = markKitchenServedToday(order, "canonical-picked-up", dayRange)
      if (canonical) return canonical

      return markKitchenServedToday(order, "legacy-picked-up", dayRange)
    })
    .filter(Boolean)
}

function markKitchenServedToday(
  order: any,
  source: KitchenJournalSource,
  dayRange: { start: Date; end: Date }
) {
  const timestamp = getKitchenJournalTimestamp(order, source)
  if (isDebugPickedUpOrder(order)) {
    console.group("[OrdersProvider][pickedUpAt pipeline] markKitchenServedToday")
    console.log("stage", source)
    console.log("orderId", order?.id)
    console.log("localTime", new Date().toLocaleString())
    console.log("timestamp", timestamp)
    console.log("timestampMs", toTimestampMs(timestamp))
    console.log("startMs", dayRange.start.getTime())
    console.log("endMs", dayRange.end.getTime())
    console.log("inBusinessDay", isTimestampInBusinessDay(timestamp, dayRange.start, dayRange.end))
    console.groupEnd()
  }

  if (!isTimestampInBusinessDay(timestamp, dayRange.start, dayRange.end)) return null

  return {
    ...order,
    [KITCHEN_JOURNAL_MARKER]: true,
    [KITCHEN_JOURNAL_SOURCE]: source,
  }
}

function getKitchenJournalTimestamp(order: any, source: KitchenJournalSource) {
  if (source === "canonical-served") return order?.timestamps?.servedAt
  if (source === "canonical-picked-up") return order?.timestamps?.pickedUpAt
  if (source === "legacy-served") return order?.servedAt
  if (source === "legacy-picked-up") return order?.pickedUpAt
  return null
}

function isTimestampInBusinessDay(value: any, startOfDay: Date, nextStartOfDay: Date) {
  const timestamp = toTimestampMs(value)
  if (!timestamp) return false

  return timestamp >= startOfDay.getTime() && timestamp < nextStartOfDay.getTime()
}

function toTimestampMs(value: any) {
  if (!value) return null
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (value instanceof Date) {
    const timestamp = value.getTime()
    return Number.isFinite(timestamp) ? timestamp : null
  }

  const timestamp = value.toMillis?.() ?? value.toDate?.().getTime?.()
  return typeof timestamp === "number" && Number.isFinite(timestamp) ? timestamp : null
}

function useLocalKitchenDayRange() {
  const [range, setRange] = React.useState(() => getLocalDayRange())

  React.useEffect(() => {
    const scheduleNextDay = () => {
      const nextRange = getLocalDayRange()
      setRange(nextRange)

      const delay = Math.max(1000, nextRange.end.getTime() - Date.now() + 1000)
      return window.setTimeout(scheduleNextDay, Math.min(delay, 2_147_483_647))
    }

    const delay = Math.max(1000, range.end.getTime() - Date.now() + 1000)
    const timer = window.setTimeout(scheduleNextDay, Math.min(delay, 2_147_483_647))

    return () => window.clearTimeout(timer)
  }, [range.end])

  return range
}

function getLocalDayRange() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setDate(end.getDate() + 1)

  return { start, end }
}

function debugPickedUpStage(stage: string, orders: any[]) {
  const matches = (orders || []).filter(isDebugPickedUpOrder)
  if (matches.length === 0) return

  console.group(`[OrdersProvider][pickedUpAt pipeline] ${stage}`)
  console.log("localTime", new Date().toLocaleString())
  console.log("matchCount", matches.length)
  matches.forEach((order) => {
    console.log({
      id: order?.id,
      commercialReference:
        order?.reference ??
        order?.orderNumber ??
        order?.orderCode ??
        order?.code ??
        order?.displayId ??
        null,
      kitchenStatus: order?.kitchenStatus,
      orderType: order?.orderType,
      type: order?.type,
      mode: order?.mode,
      timestampsPickedUpAt: order?.timestamps?.pickedUpAt,
      rootPickedUpAt: order?.pickedUpAt,
      itemsLength: Array.isArray(order?.items) ? order.items.length : 0,
      hasKitchenItems: orderHasKitchenItems(order?.items || []),
      journalMarker: Boolean(order?.[KITCHEN_JOURNAL_MARKER]),
      journalSource: order?.[KITCHEN_JOURNAL_SOURCE],
    })
  })
  console.groupEnd()
}

function isDebugPickedUpOrder(order: any) {
  if (!order) return false
  return order.id === DEBUG_PICKED_UP_ORDER_ID
}

function useStableKitchenOrders(orders: any[]) {
  const previousRef = React.useRef<{
    byId: Map<string, { signature: string; order: any }>
    list: any[]
  }>({
    byId: new Map(),
    list: [],
  })

  return React.useMemo(() => {
    const previous = previousRef.current
    const nextById = new Map<string, { signature: string; order: any }>()
    let didChangeList = previous.list.length !== orders.length

    const nextList = orders.map((order, index) => {
      const signature = getKitchenOrderRenderSignature(order)
      const cached = previous.byId.get(order.id)
      const stableOrder =
        cached && cached.signature === signature ? cached.order : order

      if (stableOrder !== previous.list[index]) didChangeList = true
      nextById.set(order.id, { signature, order: stableOrder })

      return stableOrder
    })

    const stableList = didChangeList ? nextList : previous.list
    previousRef.current = { byId: nextById, list: stableList }

    return stableList
  }, [orders])
}

function getKitchenOrderRenderSignature(order: any) {
  const itemsSignature = (order.items || [])
    .map((item: any) =>
      [
        item.id,
        item.productId,
        item.name,
        item.quantity,
        item.status,
        item.itemStatus,
        item.preparationMode,
        item.destination,
        item.productionArea,
        toTimestampMs(item.createdAt),
        toTimestampMs(item.servedAt),
      ].join(":")
    )
    .join("|")

  return [
    order.id,
    order.kitchenStatus,
    order.status,
    order.orderStatus,
    order.paymentStatus,
    order.orderType,
    order.type,
    order.mode,
    order.total,
    order.totalAmount,
    toTimestampMs(order.createdAt),
    toTimestampMs(order.updatedAt),
    toTimestampMs(order.timestamps?.servedAt),
    toTimestampMs(order.timestamps?.pickedUpAt),
    toTimestampMs(order.servedAt),
    toTimestampMs(order.pickedUpAt),
    order[KITCHEN_JOURNAL_MARKER] ? "journal" : "",
    order[KITCHEN_JOURNAL_SOURCE] ?? "",
    itemsSignature,
  ].join("||")
}
