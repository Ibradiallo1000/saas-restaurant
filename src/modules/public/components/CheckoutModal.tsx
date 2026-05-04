"use client"

import * as React from "react"
import { addDoc, doc, getDoc, serverTimestamp } from "firebase/firestore"
import { useRouter } from "next/navigation"

import { useFirestore } from "@/firebase"
import { recalculateConfiguredUnitPrice } from "@/lib/order-pricing"
import { restaurantOrdersRef } from "@/lib/restaurant-firestore-paths"
import { useCart } from "../cart/CartContext"

export default function CheckoutModal({ open, onClose, restaurantId }: any) {
  const db = useFirestore()
  const router = useRouter()
  const { items, total, clear } = useCart()

  const [name, setName] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [table, setTable] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState("")

  if (!open || !db) return null

  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim()) {
      setError("Nom et téléphone obligatoires")
      return
    }

    if (items.length === 0) {
      setError("Panier vide")
      return
    }

    setError("")
    setLoading(true)

    try {
      const sessionId = getOrCreateOrderSessionId(restaurantId)
      const orderItems = await Promise.all(
        items.map(async (item) => {
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
            productId: item.productId,
            name: item.name,
            unitPrice,
            quantity: item.quantity,
            total: unitPrice * item.quantity,
            selectedOptions: item.selectedOptions ?? [],
          }
        })
      )
      const recalculatedTotal = orderItems.reduce((sum, item) => sum + item.total, 0)

      const order = {
        restaurantId,
        source: "client",
        status: "nouvelle",
        sessionId,
        customer: { name, phone },
        table: table || undefined,
        items: orderItems,
        total: recalculatedTotal,
        paymentMethod: null,
        paymentStatus: null,
        paidAt: null,
        createdAt: serverTimestamp(),
      }

      const orderRef = await addDoc(
        restaurantOrdersRef(db, restaurantId),
        order
      )

      clear()
      onClose()

      window.localStorage.setItem(
        getLatestOrderStorageKey(restaurantId),
        orderRef.id
      )

      router.push(
        `/order/${restaurantId}/${orderRef.id}?sessionId=${sessionId}`
      )
    } catch (e) {
      console.error(e)
      setError("Erreur lors de la commande")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-[color:color-mix(in_srgb,var(--bg-main)_68%,transparent)]">
      <div className="w-full bg-white rounded-t-3xl max-h-[90vh] flex flex-col">

        {/* HEADER */}
        <div className="p-4 border-b">
          <h2 className="text-lg font-black">Finaliser la commande</h2>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* RÉSUMÉ */}
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-500 font-semibold mb-2">
              Récapitulatif
            </p>

            <div className="flex justify-between text-sm font-black">
              <span>{items.length} article(s)</span>
              <span className="text-[var(--color-primary)]">
                {total.toLocaleString()} FCFA
              </span>
            </div>
          </div>

          {/* FORM */}
          <div className="space-y-3">

            <input
              placeholder="Nom complet *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-12 rounded-xl bg-gray-100 px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
            />

            <input
              placeholder="Téléphone *"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full h-12 rounded-xl bg-gray-100 px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
            />

            <input
              placeholder="Numéro de table (optionnel)"
              value={table}
              onChange={(e) => setTable(e.target.value)}
              className="w-full h-12 rounded-xl bg-gray-100 px-3 text-sm outline-none"
            />

          </div>

          {/* ERROR */}
          {error && (
            <p className="text-red-500 text-sm font-semibold">
              {error}
            </p>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t space-y-3">

          <div className="flex justify-between text-sm font-semibold">
            <span>Total</span>
            <span className="text-[var(--color-primary)] font-black">
              {total.toLocaleString()} FCFA
            </span>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full h-12 rounded-xl bg-[var(--color-primary)] text-white font-black shadow-lg active:scale-95 disabled:opacity-50"
          >
            {loading ? "Envoi..." : "Confirmer la commande"}
          </button>

        </div>
      </div>
    </div>
  )
}

/* ================= HELPERS ================= */

function getOrCreateOrderSessionId(restaurantId: string) {
  const storageKey = `restaurant_order_session_${restaurantId}`
  const existing = window.localStorage.getItem(storageKey)

  if (existing) return existing

  const sessionId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`

  window.localStorage.setItem(storageKey, sessionId)
  return sessionId
}

function getLatestOrderStorageKey(restaurantId: string) {
  return `restaurant_latest_order_${restaurantId}`
}
