import type {
  OrderAgePresentation,
  OrderChannelPresentation,
  OrderInfoItem,
  OrderItemPresentation,
  OrderPaymentPresentation,
  OrderStatusPresentation,
  OrderTimelineItem,
} from "@/components/orders-ui"

export interface ManagerOrderDetailViewModel {
  reference: string
  description: string
  status: OrderStatusPresentation
  payment: OrderPaymentPresentation
  channel: OrderChannelPresentation
  age: OrderAgePresentation
  info: OrderInfoItem[]
  items: OrderItemPresentation[]
  timeline: OrderTimelineItem[]
  currentTimelineId?: string
  total: string
}

export function createManagerOrderDetailViewModel(input: ManagerOrderDetailViewModel): ManagerOrderDetailViewModel {
  return input
}
