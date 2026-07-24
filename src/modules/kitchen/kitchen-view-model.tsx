import * as React from "react"
import { CheckCircle, Clock, CookingPot } from "lucide-react"

import type {
  KitchenDestinationPresentation,
  KitchenDisplayStatus,
  KitchenItemPresentation,
  KitchenPriority,
  KitchenStatusPresentation,
  KitchenTimerPresentation,
} from "@/components/kitchen-ui"
import {
  ORDER_ITEM_STATUS,
  ORDER_OPERATION_STATUS,
  isOrderPaid,
  normalizeOrderItemStatus,
  normalizeOrderType,
  orderStatusFromKitchenStatus,
} from "@/lib/order-lifecycle"
import { getOrderDisplayId } from "@/lib/order-display-id"
import type { RestaurantOrder } from "@/modules/restaurant/types"
import { getEffectivePreparationMode, getKitchenOrderItems } from "@/utils/preparation-logic"

export type KitchenDisplayOrderType = "dine_in" | "pickup" | "delivery"

export type KitchenCardViewModel = {
  reference: string
  contextLines: string[]
  status: KitchenStatusPresentation
  destination: KitchenDestinationPresentation
  timer: KitchenTimerPresentation
  priority: KitchenPriority
  items: KitchenItemPresentation[]
  note: string | null
  isPaymentLocked: boolean
  isPaymentDelayed: boolean
  isRecentActivity: boolean
  isNewOrder: boolean
  totalItems: number
}

const statusLabels: Record<KitchenDisplayStatus, string> = {
  pending: "En attente",
  preparing: "En préparation",
  ready: "Prête",
  served: "Servie",
  completed: "Terminée",
  cancelled: "Annulée",
  unknown: "Statut inconnu",
}

export const actionLabels: Record<string, string> = {
  pending: "En attente",
  preparing: "Commencer",
  ready: "Marquer prête",
  served: "Servir",
  picked_up: "Récupérer",
  completed: "Terminer",
  en_preparation: "Commencer",
  pretes: "Marquer prête",
  servies: "Servir",
}

export function createKitchenCardViewModel(order: RestaurantOrder, nowMs: number): KitchenCardViewModel {
  const orderStatus = orderStatusFromKitchenStatus(order.kitchenStatus ?? (order as any).status ?? (order as any).orderStatus)
  const displayStatus = toDisplayStatus(orderStatus)
  const kitchenItems = getKitchenOrderItems(order.items || [])
  const createdAtMs = getCreatedAtMs(order, nowMs)
  const elapsedMinutes = Math.max(0, Math.floor((nowMs - createdAtMs) / 60000))
  const elapsedTime = formatElapsedTime(elapsedMinutes)
  const isPaymentLocked = isPaymentLockedForKitchen(order)
  const isPaymentDelayed = isPaymentLocked && elapsedMinutes > 10
  const type = getKitchenDisplayOrderType(order)
  const lastItemAddedAt = Math.max(0, ...kitchenItems.map((item: any) => toTimestampMs(item.createdAt)), createdAtMs)
  const isRecentActivity = nowMs - lastItemAddedAt < 20_000

  return {
    reference: getOrderDisplayId(order),
    contextLines: getKitchenContextLines(order, type),
    status: {
      status: displayStatus,
      label: statusLabels[displayStatus],
      icon: getStatusIcon(displayStatus),
    },
    destination: getDestinationPresentation(order),
    timer: {
      label: isPaymentDelayed ? "Paiement" : "Depuis",
      value: elapsedTime,
      variant: isPaymentDelayed ? "overdue" : "normal",
      icon: <Clock />,
      ariaLabel: `${isPaymentDelayed ? "Retard de paiement" : "Temps écoulé"} : ${elapsedTime}`,
    },
    priority: isPaymentDelayed ? "overdue" : "normal",
    items: kitchenItems.map((item: any, index) => createKitchenItemPresentation(order, item, index)),
    note: getOrderNote(order),
    isPaymentLocked,
    isPaymentDelayed,
    isRecentActivity,
    isNewOrder: lastItemAddedAt - createdAtMs < 10_000,
    totalItems: kitchenItems.reduce((total, item) => total + item.quantity, 0),
  }
}

export function isKitchenPaymentDelayed(order: RestaurantOrder, nowMs: number) {
  if (!isPaymentLockedForKitchen(order)) return false
  return Math.max(0, Math.floor((nowMs - getCreatedAtMs(order, nowMs)) / 60000)) > 10
}

export function getKitchenOrderTypeValue(order: RestaurantOrder) {
  const details = order as RestaurantOrder & { publicOrderType?: string | null; type?: string | null; mode?: string | null }
  return order.orderType ?? details.publicOrderType ?? details.type ?? details.mode
}

export function getKitchenCardSignature(order: RestaurantOrder) {
  const details = order as any
  return [
    order.id, order.kitchenStatus, details.status, details.orderStatus, details.paymentStatus,
    order.orderType, details.publicOrderType, details.type, details.mode, order.table, order.tableId,
    details.customer?.name, details.customer?.phone, details.customerName, details.customerPhone,
    details.phoneNumber, details.notes, details.customerNote, details.customerNotes,
    stableJson(details.deliveryAddress), toTimestampMs(order.createdAt), toTimestampMs(details.updatedAt),
    (order.items || []).map((item: any) => [item.id, item.productId, item.name, item.quantity, item.status,
      item.itemStatus, item.preparationMode, item.destination, item.productionArea, item.note, item.notes,
      stableJson(item.options), stableJson(item.extras), stableJson(item.selectedOptions),
      stableJson(item.supplements), stableJson(item.supplementNames), toTimestampMs(item.createdAt),
      toTimestampMs(item.servedAt)].join(":")) .join("|"),
  ].join("||")
}

export function parseKitchenItemDetails(item: any) {
  const options: Array<{ name: string; value: string }> = Array.isArray(item.options) ? [...item.options] : []
  const extras: Array<{ name: string; price?: number }> = Array.isArray(item.extras) ? [...item.extras] : []
  const note: string | null = item.note || item.notes || null

  if (!item.options && !item.extras && Array.isArray(item.selectedOptions)) {
    item.selectedOptions.forEach((option: any) => {
      const name = String(option.optionName || "").toLowerCase().trim()
      if (name && name !== "supplement" && name !== "supplément" && name !== "extra") options.push({ name: option.optionName || "Option", value: option.choiceName })
      else extras.push({ name: option.choiceName, price: option.price })
    })
  }

  if (!extras.length && Array.isArray(item.supplements || item.supplementNames)) {
    ;(item.supplements || item.supplementNames).forEach((supplement: any) => {
      extras.push({ name: typeof supplement === "string" ? supplement : `${supplement.quantity ? `${supplement.quantity}x ` : ""}${supplement.name || ""}`, price: 0 })
    })
  }
  return { options, extras, note }
}

function createKitchenItemPresentation(order: RestaurantOrder, item: any, index: number): KitchenItemPresentation {
  const status = normalizeOrderItemStatus(item.status ?? order.kitchenStatus ?? (order as any).status ?? (order as any).orderStatus)
  const { options, extras, note } = parseKitchenItemDetails(item)
  const optionLines = [
    ...options.map((option) => `${option.name} : ${option.value}`),
    ...extras.map((extra) => `+ ${extra.name}`),
  ]
  return {
    id: String(item.id ?? `${order.id}-${item.productId ?? index}-${item.name}`),
    quantity: item.quantity,
    name: item.name,
    options: optionLines.length ? optionLines.join(" · ") : undefined,
    note: note ?? undefined,
    completed: status === ORDER_ITEM_STATUS.SERVED,
  }
}

function toDisplayStatus(status: string): KitchenDisplayStatus {
  if (status === ORDER_OPERATION_STATUS.PENDING) return "pending"
  if (status === ORDER_OPERATION_STATUS.IN_PREPARATION) return "preparing"
  if (status === ORDER_OPERATION_STATUS.READY) return "ready"
  if (status === ORDER_OPERATION_STATUS.SERVED || status === ORDER_OPERATION_STATUS.PICKED_UP) return "served"
  if (status === ORDER_OPERATION_STATUS.COMPLETED) return "completed"
  return "unknown"
}

function getStatusIcon(status: KitchenDisplayStatus) {
  if (status === "pending") return <Clock />
  if (status === "preparing") return <CookingPot />
  return <CheckCircle />
}

function getDestinationPresentation(order: RestaurantOrder): KitchenDestinationPresentation {
  const modes = new Set((order.items || []).map((item) => getEffectivePreparationMode(item)))
  if (modes.size > 1) return { destination: "mixed", label: "Commande mixte" }
  return { destination: "kitchen", label: "Cuisine" }
}

function getKitchenDisplayOrderType(order: RestaurantOrder): KitchenDisplayOrderType {
  const normalized = normalizeOrderType(getKitchenOrderTypeValue(order))
  const details = order as any
  if (order.table || order.tableId || normalized === "dine_in" || details.type === "table") return "dine_in"
  if (normalized === "delivery" || details.publicOrderType === "delivery") return "delivery"
  return "pickup"
}

function getKitchenContextLines(order: RestaurantOrder, type: KitchenDisplayOrderType) {
  const details = order as any
  const customerName = details.customer?.name || details.customerName || null
  const phone = details.customer?.phone || details.phoneNumber || details.customerPhone || null
  const table = details.table || details.tableNumber || details.tableId || null
  const address = formatDeliveryAddress(details.deliveryAddress)
  if (type === "dine_in") return [`Sur place${table ? ` • Table ${table}` : ""}`]
  if (type === "delivery") return ["Livraison", customerName ? `Client : ${customerName}` : null, phone ? `Tél. : ${phone}` : null, address ? `Adresse : ${address}` : null].filter(Boolean) as string[]
  return ["À emporter"]
}

function formatDeliveryAddress(value: any) {
  if (!value) return null
  if (typeof value === "string") return value
  return [value.label, value.street, value.zone, value.city].filter(Boolean).join(", ") || null
}

function isPaymentLockedForKitchen(order: RestaurantOrder) {
  return normalizeOrderType(getKitchenOrderTypeValue(order)) !== "dine_in" && !isOrderPaid(order)
}

function getCreatedAtMs(order: RestaurantOrder, fallback: number) {
  return order.createdAt?.toMillis?.() ?? order.createdAt?.toDate?.().getTime?.() ?? fallback
}

function formatElapsedTime(minutes: number) {
  if (minutes < 1) return "moins d’1 min"
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return remainder ? `${hours}h ${remainder}min` : `${hours}h`
}

function getOrderNote(order: RestaurantOrder) {
  const details = order as any
  return details.notes || details.customerNote || details.customerNotes || null
}

function toTimestampMs(value: any) {
  if (!value) return 0
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  if (value instanceof Date) return value.getTime()
  return value.toMillis?.() ?? value.toDate?.().getTime?.() ?? 0
}

function stableJson(value: unknown) {
  if (value == null) return ""
  try { return JSON.stringify(value) } catch { return String(value) }
}
