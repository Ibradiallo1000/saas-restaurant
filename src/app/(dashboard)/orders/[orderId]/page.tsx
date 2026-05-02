import OrderTrackingPage from "@/modules/public/pages/OrderTrackingPage"

export default function Page({ params }: any) {
  return <OrderTrackingPage orderId={params.orderId} />
}