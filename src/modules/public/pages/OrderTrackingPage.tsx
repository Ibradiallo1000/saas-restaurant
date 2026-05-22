"use client"

import * as React from "react"
import { doc } from "firebase/firestore"
import { CheckCircle2 } from "lucide-react"

import { OrderStepper } from "@/components/OrderStepper"
import { PaymentBadge } from "@/components/PaymentBadge"
import { useDoc, useFirestore, useMemoFirebase } from "@/firebase"
import {
  ORDER_OPERATION_STATUS,
  getOrderStatus,
} from "@/lib/order-lifecycle"

export default function OrderTrackingPage({
  orderId,
  restaurantId,
}: {
  orderId: string
  restaurantId?: string | null
}) {
  const db = useFirestore()

  const orderRef = useMemoFirebase(() => {
    if (!db || !restaurantId || !orderId) return null
    return doc(db, "restaurants", restaurantId, "orders", orderId)
  }, [db, restaurantId, orderId])

  const { data: order, isLoading } = useDoc(orderRef)

  if (isLoading) {
    return (
      <div className="app-background flex min-h-screen items-center justify-center text-foreground">
        Chargement...
      </div>
    )
  }

  if (!order) {
    return (
      <div className="app-background min-h-screen p-10 text-center text-foreground">
        Commande introuvable
      </div>
    )
  }

  const orderStatus = getOrderStatus(order)
  const orderWithPayment = order as typeof order & {
    paymentIntentStatus?: string | null
    paymentVerificationStatus?: string | null
  }
  const isServed =
    orderStatus === ORDER_OPERATION_STATUS.SERVED ||
    orderStatus === ORDER_OPERATION_STATUS.PICKED_UP ||
    orderStatus === ORDER_OPERATION_STATUS.COMPLETED

  return (
    <div className="app-background mx-auto min-h-screen max-w-md space-y-6 p-4 text-foreground">
      <div className="rounded-2xl bg-green-500 p-5 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-8 w-8" />
          <div>
            <h2 className="text-lg font-bold">
              {isServed ? "Commande finalisée" : "Commande confirmée"}
            </h2>
            <p className="text-sm opacity-90">
              {isServed ? "Merci pour votre commande" : "La cuisine prépare votre commande"}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2 rounded-2xl bg-card p-4 text-card-foreground shadow">
        <div className="flex items-center justify-between">
          <span className="font-semibold">Commande #{order.id?.slice(-6)}</span>
          <span className="font-bold text-green-600">
            {Number(order.total ?? 0).toLocaleString()} FCFA
          </span>
        </div>

        <div className="text-sm text-muted-foreground">
          {order.items?.length ?? 0} article(s)
        </div>

        {order.table ? (
          <div className="w-fit rounded-full bg-muted px-3 py-1 text-xs">
            Sur place - Table {order.table}
          </div>
        ) : null}
      </div>

      <PaymentBadge
        paymentIntentStatus={orderWithPayment.paymentIntentStatus}
        paymentVerificationStatus={orderWithPayment.paymentVerificationStatus}
      />

      {isServed ? (
        <div className="space-y-2 rounded-2xl bg-card p-5 text-card-foreground shadow">
          <h3 className="text-xl font-black">Commande servie</h3>
          <p className="text-sm text-muted-foreground">Profitez de votre repas</p>
        </div>
      ) : (
        <div className="space-y-6 rounded-2xl bg-card p-5 text-card-foreground shadow">
          <h3 className="font-semibold">Suivi de la commande</h3>

          <OrderStepper orderType={order.orderType} orderStatus={order.orderStatus} />
        </div>
      )}
    </div>
  )
}
