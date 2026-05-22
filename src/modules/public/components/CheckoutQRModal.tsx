"use client"

import * as React from "react"
import { addDoc, doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore"
import { useRouter } from "next/navigation"
import { CheckCircle, X } from "lucide-react"

import { useFirestore } from "@/firebase"
import { recalculateConfiguredUnitPrice } from "@/lib/order-pricing"
import { restaurantOrdersRef } from "@/lib/restaurant-firestore-paths"
import {
  type RestaurantTableRecord,
  getOrCreateActiveTableSession,
} from "@/services/table-session.service"
import { useCart } from "../cart/CartContext"

export default function CheckoutQRModal({
  open,
  onClose,
  restaurantId,
  tableContext,
  activeOrderId,
}: {
  open: boolean
  onClose: () => void
  restaurantId: string
  tableContext: RestaurantTableRecord
  activeOrderId?: string | null
}) {
  const db = useFirestore()
  const router = useRouter()
  const { items, total, clear } = useCart()
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState("")
  const [customerNote, setCustomerNote] = React.useState("")

  React.useEffect(() => {
    if (open) setError("")
  }, [open])

  if (!open) return null

  const handleSubmit = async () => {
    if (items.length === 0) {
      setError("Commande vide")
      return
    }

    if (!tableContext?.id) {
      setError("Commande sur place uniquement via QR")
      return
    }

    setError("")
    setLoading(true)

    try {
      const tableSession = await getOrCreateActiveTableSession(
        db,
        restaurantId,
        tableContext.id
      )

      const orderItems = await Promise.all(
        items.map(async (item, index) => {
          const productSnap = await getDoc(
            doc(db, "restaurants", restaurantId, "products", item.productId)
          )

          if (!productSnap.exists()) {
            throw new Error(`Produit introuvable: ${item.productId}`)
          }

          const product = { id: productSnap.id, ...productSnap.data() }
          const unitPrice = recalculateConfiguredUnitPrice(
            product,
            item.selectedOptions ?? []
          )

          return {
            id: `${item.productId}-${Date.now()}-${index}`,
            productId: item.productId,
            name: item.name,
            status: "pending",
            createdAt: new Date(),
            unitPrice,
            quantity: item.quantity,
            total: unitPrice * item.quantity,
            selectedOptions: item.selectedOptions ?? [],
          }
        })
      )

      const recalculatedTotal = orderItems.reduce((sum, item) => sum + item.total, 0)

      if (activeOrderId) {
        const activeOrderRef = doc(
          db,
          "restaurants",
          restaurantId,
          "orders",
          activeOrderId
        )
        const activeOrderSnap = await getDoc(activeOrderRef)

        if (!activeOrderSnap.exists()) {
          throw new Error("Commande active introuvable.")
        }

        const activeOrder = activeOrderSnap.data() as any

        if (activeOrder.sessionActive === false || activeOrder.paymentStatus === "paid") {
          throw new Error("Session terminee - action impossible")
        }

        if (activeOrder.orderType !== "dine_in" || activeOrder.sessionId !== tableSession.sessionId) {
          throw new Error("Contexte de table invalide.")
        }

        const existingItems = Array.isArray(activeOrder.items) ? activeOrder.items : []
        const nextItems = [...existingItems, ...orderItems]
        const nextSubtotal = Number(activeOrder.subtotal ?? activeOrder.total ?? 0) + recalculatedTotal
        const nextTotal = Number(activeOrder.total ?? 0) + recalculatedTotal

        await updateDoc(activeOrderRef, {
          items: nextItems,
          subtotal: nextSubtotal,
          total: nextTotal,
          totalAmount: nextTotal,
          ...(customerNote.trim() ? { customerNote: customerNote.trim() } : {}),
          updatedAt: serverTimestamp(),
        })

        clear()
        onClose()
        window.localStorage.setItem(
          `restaurant_latest_order_${restaurantId}`,
          activeOrderId
        )
        router.push(
          `/order/${restaurantId}/${activeOrderId}?sessionId=${tableSession.sessionId}`
        )
        return
      }

      const order = {
        restaurantId,
        orderType: "dine_in",
        source: "qr_table",
        orderStatus: "pending",
        sessionActive: true,
        sessionId: tableSession.sessionId,
        tableId: tableContext.id,
        zoneId: tableSession.zoneId || null,
        customer: {
          phone: null,
          name: null,
        },
        customerNote: customerNote.trim() || null,
        table: tableSession.tableName || tableContext.name,
        items: orderItems,
        subtotal: recalculatedTotal,
        deliveryFee: 0,
        total: recalculatedTotal,
        totalAmount: recalculatedTotal,
        paymentMethod: null,
        paymentMethodCode: null,
        paymentType: null,
        paymentIntentStatus: "none",
        paymentCode: null,
        paymentInstruction: null,
        paymentStatus: "unpaid",
        needsCashCollection: false,
        paidAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }

      const orderRef = await addDoc(
        restaurantOrdersRef(db, restaurantId),
        order
      )

      clear()
      onClose()

      if (orderRef.id) {
        window.localStorage.setItem(
          `restaurant_latest_order_${restaurantId}`,
          orderRef.id
        )
      }

      router.push(
        `/order/${restaurantId}/${orderRef.id}?sessionId=${tableSession.sessionId}`
      )
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : "Erreur lors de la commande")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-md transition-all duration-300 sm:items-center sm:p-6">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[2rem] bg-background shadow-[0_20px_60px_rgba(0,0,0,0.5)] ring-1 ring-white/10 duration-300 ease-out animate-in slide-in-from-bottom sm:rounded-3xl sm:zoom-in-95">
        <div className="border-b border-white/5 bg-card/50 p-5 backdrop-blur-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-black">Commander</h2>
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-muted transition hover:bg-muted/80 active:scale-95"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          <div className="mb-4 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary)]/10">
              <CheckCircle className="h-6 w-6 text-[var(--color-primary)]" />
            </div>
            <p className="text-lg font-black">Récapitulatif de votre commande</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Vous allez être servi à la table {tableContext.name || tableContext.id}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-black">Ajouter une note pour la cuisine</label>
            <textarea
              value={customerNote}
              onChange={(e) => setCustomerNote(e.target.value)}
              placeholder="Ex: sans piment, allergie arachide..."
              className="min-h-20 w-full resize-none rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
            />
          </div>

          <div className="space-y-3 rounded-2xl bg-muted/60 p-4">
            <p className="text-sm font-black">Votre commande</p>

            {items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <div className="flex gap-2">
                  <span className="font-bold text-muted-foreground">{item.quantity}x</span>
                  <span className="line-clamp-1">{item.name}</span>
                </div>
                <span className="font-medium">{(item.unitPrice * item.quantity).toLocaleString()} FCFA</span>
              </div>
            ))}

            <div className="space-y-2 border-t pt-3">
              <div className="flex justify-between pt-2 text-lg font-black">
                <span>Total</span>
                <span className="text-[var(--color-primary)]">{total.toLocaleString()} FCFA</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl bg-primary/5 p-4 text-center">
            <CheckCircle className="h-8 w-8 text-[var(--color-primary)] opacity-80" />
            <p className="text-left text-sm font-medium">
              Commande sur place. Votre demande sera envoyée en cuisine.
            </p>
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3">
              <p className="text-sm font-semibold text-red-600">{error}</p>
            </div>
          ) : null}
        </div>

        <div className="border-t border-white/5 bg-background/90 p-5 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] backdrop-blur-xl">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--color-primary)] text-base font-black uppercase tracking-wide text-white shadow-[0_8px_24px_var(--color-primary)]/30 transition-all duration-300 hover:brightness-110 hover:shadow-[0_12px_32px_var(--color-primary)]/40 active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Validation en cours...
              </div>
            ) : (
              "Valider la commande"
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
