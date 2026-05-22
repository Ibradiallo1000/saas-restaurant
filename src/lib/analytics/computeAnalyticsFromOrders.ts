import { getOrderStatus, isOrderPaid } from "@/lib/order-lifecycle"

type AnalyticsOrder = {
  id?: string
  total?: number | null
  totalAmount?: number | null
  createdAt?: any
  items?: Array<{
    name?: string | null
    nameSnapshot?: string | null
    quantity?: number | null
  }>
}

function toDate(value: any): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value === "number") return new Date(value)
  if (typeof value.toDate === "function") return value.toDate()
  if (typeof value.toMillis === "function") return new Date(value.toMillis())
  return null
}

function getAmount(order: AnalyticsOrder) {
  return Number(order.total ?? order.totalAmount ?? 0)
}

function isKitchenServedStatus(status: string | null | undefined) {
  return status === "served" || status === "picked_up" || status === "completed"
}

export function computeAnalyticsFromOrders<T extends AnalyticsOrder>(orders: T[]) {
  const totalOrders = orders.length
  const totalRevenue = orders.reduce((sum, order) => sum + getAmount(order), 0)
  const paidRevenue = orders
    .filter((order) => isOrderPaid(order as any))
    .reduce((sum, order) => sum + getAmount(order), 0)
  const averageOrder = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const thisMonthRevenue = orders
    .filter((order) => {
      const date = toDate(order.createdAt)
      return date && date >= startOfMonth
    })
    .reduce((sum, order) => sum + getAmount(order), 0)

  const last7Days = Array.from({ length: 7 }, (_, index) => {
    const dayStart = new Date()
    dayStart.setDate(dayStart.getDate() - (6 - index))
    dayStart.setHours(0, 0, 0, 0)

    const nextDay = new Date(dayStart)
    nextDay.setDate(nextDay.getDate() + 1)

    const count = orders.filter((order) => {
      const date = toDate(order.createdAt)
      return date && date >= dayStart && date < nextDay
    }).length

    return {
      date: dayStart.toISOString(),
      label: dayStart.toLocaleDateString("fr-FR", {
        weekday: "short",
        day: "numeric",
      }),
      count,
    }
  })

  const productMap = new Map<string, number>()
  orders.forEach((order) => {
    ;(order.items || []).forEach((item) => {
      const name = item.name || item.nameSnapshot
      if (!name) return
      productMap.set(name, (productMap.get(name) || 0) + Number(item.quantity || 0))
    })
  })

  const inPreparation = orders.filter((order) => getOrderStatus(order as any) === "preparing").length
  const statusCounts = {
    pending: orders.filter((order) => getOrderStatus(order as any) === "pending").length,
    preparing: inPreparation,
    in_preparation: inPreparation,
    in_progress: inPreparation,
    ready: orders.filter((order) => getOrderStatus(order as any) === "ready").length,
    served: orders.filter((order) => isKitchenServedStatus(getOrderStatus(order as any))).length,
    completed: orders.filter((order) => getOrderStatus(order as any) === "completed").length,
  }

  return {
    totalOrders,
    totalRevenue,
    paidRevenue,
    averageOrder,
    thisMonthRevenue,
    last7Days,
    maxDayCount: Math.max(1, ...last7Days.map((day) => day.count)),
    topProducts: Array.from(productMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    statusCounts,
  }
}
