"use client"

import * as React from "react"
import { addDoc, collection, doc, getDoc, orderBy, query, serverTimestamp } from "firebase/firestore"
import { useRouter } from "next/navigation"

import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { recalculateConfiguredUnitPrice } from "@/lib/order-pricing"
import { restaurantOrdersRef } from "@/lib/restaurant-firestore-paths"
import {
  type ActiveTableSession,
  type RestaurantTableRecord,
} from "@/services/table-session.service"
import { useCart } from "../cart/CartContext"

export default function CheckoutModal({
  open,
  onClose,
  restaurantId,
  tableContext,
  activeTableSession,
}: {
  open: boolean
  onClose: () => void
  restaurantId: string
  tableContext?: RestaurantTableRecord | null
  activeTableSession?: ActiveTableSession | null
}) {
  const db = useFirestore()
  const router = useRouter()
  const { items, total, clear } = useCart()

  const [name, setName] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [table, setTable] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState("")

  const tablesQuery = useMemoFirebase(() => {
    if (!db || !restaurantId || tableContext) return null
    return query(collection(db, "restaurants", restaurantId, "tables"), orderBy("createdAt", "asc"))
  }, [db, restaurantId, tableContext])
  const { data: tables } = useCollection<RestaurantTableRecord>(tablesQuery)

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

    if (!tableContext && !table) {
      setError("Veuillez selectionner une table")
      return
    }

    setError("")
    setLoading(true)

    try {
      const selectedTableId = tableContext?.id || table
      const tableSession =
        activeTableSession && activeTableSession.tableId === selectedTableId
          ? activeTableSession
          : await ensureActiveTableSession(restaurantId, selectedTableId)
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
        source: tableContext ? "qr" : "manual",
        status: "pending",
        sessionId: tableSession.sessionId,
        tableId: tableSession.tableId,
        zoneId: tableSession.zoneId,
        customer: { name, phone },
        table: tableSession.tableName,
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
    <div className="fixed inset-0 z-50 flex items-end bg-[color:color-mix(in_srgb,var(--bg-main)_68%,transparent)]">
      <div className="w-full bg-white rounded-t-3xl max-h-[90vh] flex flex-col">

        {/* HEADER */}
        <div className="p-4 border-b">
          <h2 className="text-lg font-black">Commande sur place</h2>
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

            {tableContext ? (
              <div className="inline-flex rounded-full bg-emerald-100 px-3 py-2 text-sm font-black text-emerald-700">
                Table: {tableContext.name || tableContext.id}
              </div>
            ) : (
              <select
                value={table}
                onChange={(e) => setTable(e.target.value)}
                className="w-full h-12 rounded-xl bg-gray-100 px-3 text-sm outline-none"
              >
                <option value="">Selectionner une table *</option>
                {(tables || []).map((currentTable) => (
                  <option key={currentTable.id} value={currentTable.id}>
                    {currentTable.name || currentTable.id}
                    {currentTable.status === "occupied" ? " - occupee" : ""}
                  </option>
                ))}
              </select>
            )}

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

function getLatestOrderStorageKey(restaurantId: string) {
  return `restaurant_latest_order_${restaurantId}`
}

async function ensureActiveTableSession(
  restaurantId: string,
  tableId: string
): Promise<ActiveTableSession> {
  const response = await fetch(`/api/restaurants/${restaurantId}/table-sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tableId }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error || "Impossible de preparer la session de table")
  }

  return response.json()
}
