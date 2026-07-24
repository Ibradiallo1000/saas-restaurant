import type {
  OrderAgePresentation,
  OrderChannelPresentation,
  OrderItemSummaryPresentation,
  OrderPaymentPresentation,
  OrderPriorityDisplay,
  OrderStatusPresentation,
} from "@/components/orders-ui"

export type ManagerOrderTab = "pending" | "preparing" | "ready" | "cash_due" | "completed" | "late"
export type ManagerOrderCounts = Record<ManagerOrderTab, number>

export interface ManagerOrderListItem {
  id: string
  reference: string
  title: string
  subtitle: string
  status: OrderStatusPresentation
  payment: OrderPaymentPresentation
  channel: OrderChannelPresentation
  age: OrderAgePresentation
  priority: OrderPriorityDisplay
  total: string
  itemCount: string
  destination: string
  items: OrderItemSummaryPresentation[]
}

export type ManagerOrderListItemInput = ManagerOrderListItem

export function createManagerOrderListItem(input: ManagerOrderListItemInput): ManagerOrderListItem {
  return input
}

export const MANAGER_ORDER_TAB_LABELS: Record<ManagerOrderTab, string> = {
  pending: "En attente",
  preparing: "En préparation",
  ready: "Prêtes",
  cash_due: "À encaisser",
  completed: "Terminées",
  late: "Retard",
}
