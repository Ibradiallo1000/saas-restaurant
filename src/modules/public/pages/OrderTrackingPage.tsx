"use client"

import * as React from "react"
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase"
import { doc } from "firebase/firestore"
import { CheckCircle2, Clock, CookingPot, Bell } from "lucide-react"
import { normalizeOrderStatus } from "@/lib/order-status"

export default function OrderTrackingPage({ orderId }: { orderId: string }) {
  const db = useFirestore()

  const orderRef = useMemoFirebase(() => {
    if (!db || !orderId) return null
    return doc(db, "orders", orderId)
  }, [db, orderId])

  const { data: order, isLoading } = useDoc(orderRef)

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        Chargement...
      </div>
    )
  }

  if (!order) {
    return <div className="min-h-screen bg-background p-10 text-center text-foreground">Commande introuvable</div>
  }

  const steps = [
    { key: "nouvelle", label: "Nouvelle", icon: Clock },
    { key: "preparation", label: "En préparation", icon: CookingPot },
    { key: "prete", label: "Prête", icon: Bell },
    { key: "servie", label: "Servie", icon: CheckCircle2 },
    { key: "payee", label: "Payée", icon: CheckCircle2 },
  ]

  const currentIndex = steps.findIndex(s => s.key === normalizeOrderStatus(order.status))

  return (
    <div className="max-w-md mx-auto min-h-screen bg-background p-4 space-y-6 text-foreground">

      {/* 🔥 HEADER SUCCESS */}
      <div className="bg-green-500 text-white rounded-2xl p-5 shadow-lg">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-8 h-8" />
          <div>
            <h2 className="text-lg font-bold">
              Commande confirmée
            </h2>
            <p className="text-sm opacity-90">
              La cuisine prépare votre commande
            </p>
          </div>
        </div>
      </div>

      {/* 🔥 ORDER CARD */}
      <div className="bg-card text-card-foreground rounded-2xl shadow p-4 space-y-2">

        <div className="flex justify-between items-center">
          <span className="font-semibold">
            Commande #{order.id?.slice(-6)}
          </span>
          <span className="text-green-600 font-bold">
            {order.total} FCFA
          </span>
        </div>

        <div className="text-sm text-muted-foreground">
          {order.items?.length} article(s)
        </div>

        {order.table && (
          <div className="text-xs bg-muted px-3 py-1 rounded-full w-fit">
            Sur place - Table {order.table}
          </div>
        )}

      </div>

      {/* 🔥 TIMELINE */}
      <div className="bg-card text-card-foreground rounded-2xl shadow p-5 space-y-6">

        <h3 className="font-semibold">
          Suivi de la commande
        </h3>

        <div className="space-y-4">

          {steps.map((step, index) => {
            const active = index <= currentIndex
            const isCurrent = index === currentIndex
            const Icon = step.icon

            return (
              <div key={step.key} className="flex items-start gap-4">

                {/* DOT */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 flex items-center justify-center rounded-full
                    ${active ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"}`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  {index !== steps.length - 1 && (
                    <div className={`w-[2px] h-10 ${
                      active ? "bg-green-500" : "bg-muted"
                    }`} />
                  )}
                </div>

                {/* TEXT */}
                <div className="flex-1">
                  <p className={`font-medium ${
                    active ? "text-foreground" : "text-muted-foreground"
                  }`}>
                    {step.label}
                  </p>

                  {isCurrent && (
                    <p className="text-xs text-green-600 mt-1">
                      En cours...
                    </p>
                  )}
                </div>

              </div>
            )
          })}

        </div>

      </div>

    </div>
  )
}
