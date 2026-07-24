"use client"

import * as React from "react"
import { doc, getDoc, increment, runTransaction, serverTimestamp } from "firebase/firestore"
import { useRouter } from "next/navigation"
import { CheckCircle } from "lucide-react"

import { PublicButton, PublicCheckoutModal, PublicPrice, PublicSurface } from "@/components/public-ui"
import { useFirestore } from "@/firebase"
import { ORDER_OPERATION_STATUS } from "@/lib/order-lifecycle"
import { recalculateConfiguredUnitPrice } from "@/lib/order-pricing"
import { restaurantOrdersRef } from "@/lib/restaurant-firestore-paths"
import { generateReviewAccessToken, rememberOrderReviewAccess, restaurantReviewAccessRef, REVIEW_ACCESS_TOKEN_VERSION } from "@/lib/reputation/review-access-token"
import {
  type RestaurantTableRecord,
  getOrCreateActiveTableSession,
} from "@/services/table-session.service"
import {
  orderHasKitchenItems,
  resolveProductPreparationMode,
} from "@/utils/preparation-logic"
import { useCart } from "../cart/CartContext"
import { rememberTrackedOrder } from "../orderTrackingStorage"

export default function CheckoutQRModal({
  open,
  onClose,
  restaurantId,
  tableContext,
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
  const submittingRef = React.useRef(false)

  React.useEffect(() => {
    if (open) setError("")
  }, [open])

  const handleSubmit = async () => {
    if (loading || submittingRef.current) return

    if (items.length === 0) {
      setError("Commande vide")
      return
    }

    if (!tableContext?.id) {
      setError("Commande sur place uniquement via QR")
      return
    }

    submittingRef.current = true
    setError("")
    setLoading(true)

    try {
      const tableSession = await getOrCreateActiveTableSession(
        db,
        restaurantId,
        tableContext.id
      )
      const tableSessionId = tableSession.tableSessionId || tableSession.sessionId
      const tableZoneId = tableSession.zoneId || tableContext.zoneId || "main"

      const clientUserId = getOrCreateTableUserId()

      const orderItems = await Promise.all(
        items.map(async (item, index) => {
          const productSnap = await getDoc(
            doc(db, "restaurants", restaurantId, "products", item.productId)
          )

          if (!productSnap.exists()) {
            throw new Error(`Produit introuvable: ${item.productId}`)
          }

          const product = { id: productSnap.id, ...productSnap.data() } as any
          const unitPrice = recalculateConfiguredUnitPrice(
            product,
            item.selectedOptions ?? []
          )
          let categoryName = item.categoryName || ""
          if (!product.preparationMode && !categoryName && product.categoryId) {
            const categorySnap = await getDoc(
              doc(db, "restaurants", restaurantId, "categories", product.categoryId)
            )
            categoryName = categorySnap.data()?.name || ""
          }
          const preparationMode = item.preparationMode || resolveProductPreparationMode(product, categoryName)

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
            preparationMode,
          }
        })
      )

      const recalculatedTotal = orderItems.reduce((sum, item) => sum + item.total, 0)
      const requiresKitchen = orderHasKitchenItems(orderItems)

      if (process.env.NODE_ENV !== "production") {
        console.info("[preparationMode][qr_table]", {
          restaurantId,
          tableSessionId,
          items: orderItems.map((item) => ({
            productId: item.productId,
            name: item.name,
            preparationMode: item.preparationMode,
            sentToKitchen: item.preparationMode === "kitchen",
          })),
          kitchenItems: orderItems
            .filter((item) => item.preparationMode === "kitchen")
            .map((item) => item.productId),
          requiresKitchen,
        })
      }

      const order = {
        restaurantId,
        orderType: "dine_in",
        source: "qr_table",
        kitchenStatus: requiresKitchen ? ORDER_OPERATION_STATUS.PENDING : ORDER_OPERATION_STATUS.COMPLETED,
        orderStatus: requiresKitchen ? ORDER_OPERATION_STATUS.PENDING : ORDER_OPERATION_STATUS.COMPLETED,
        sessionActive: true,
        sessionId: tableSessionId,
        tableSessionId,
        createdBy: clientUserId,
        createdByLabel: "Toi",
        tableId: tableContext.id,
        zoneId: tableZoneId,
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

      const orderRef = doc(restaurantOrdersRef(db, restaurantId))
      const tableSessionRef = doc(db, "restaurants", restaurantId, "tableSessions", tableSessionId)
      const reviewToken = generateReviewAccessToken()
      const reviewAccessRef = restaurantReviewAccessRef(db, restaurantId, orderRef.id)

      await runTransaction(db, async (transaction) => {
        const sessionSnap = await transaction.get(tableSessionRef)
        if (!sessionSnap.exists() || sessionSnap.data()?.status !== "active") {
          throw new Error("Session de table introuvable ou fermee")
        }

        transaction.set(orderRef, order)
        transaction.set(reviewAccessRef, {
          restaurantId,
          orderId: orderRef.id,
          reviewToken,
          createdAt: serverTimestamp(),
          expiresAt: null,
          version: REVIEW_ACCESS_TOKEN_VERSION,
        })
        transaction.update(tableSessionRef, {
          totalAmount: increment(recalculatedTotal),
          lastActivityAt: serverTimestamp(),
        })
      })

      clear()
      onClose()

      if (orderRef.id) {
        rememberOrderReviewAccess({
          restaurantId,
          orderId: orderRef.id,
          reviewToken,
        })
        rememberTrackedOrder({
          restaurantId,
          orderId: orderRef.id,
          tableSessionId,
        })
      }

      router.push(
        `/order/${restaurantId}/${orderRef.id}?tableSessionId=${tableSessionId}&access=${encodeURIComponent(reviewToken)}`
      )
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : "Erreur lors de la commande")
    } finally {
      setLoading(false)
      submittingRef.current = false
    }
  }

  return (
    <PublicCheckoutModal
      open={open}
      onOpenChange={(nextOpen) => !nextOpen && onClose()}
      title="Commander"
      description={`Service à la table ${tableContext.name || tableContext.id}`}
      closeOnOverlayClick={!loading}
      footer={
        <PublicButton fullWidth size="action" loading={loading} loadingLabel="Validation en cours" onClick={handleSubmit}>
          Valider la commande
        </PublicButton>
      }
    >
      <div className="space-y-[var(--space-5)]">
        <div className="text-center">
          <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-[var(--radius-public-full)] bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]">
            <CheckCircle className="size-6" aria-hidden="true" />
          </span>
          <h3 className="text-public-lg font-public-extrabold text-[var(--text-primary)]">Récapitulatif de votre commande</h3>
          <p className="mt-1 text-public-sm text-[var(--text-secondary)]">Votre commande sera servie sur place.</p>
        </div>

        <div className="grid gap-2">
          <label htmlFor="qr-customer-note" className="text-public-sm font-public-semibold text-[var(--text-primary)]">Ajouter une note pour la cuisine</label>
          <textarea id="qr-customer-note" value={customerNote} onChange={(event) => setCustomerNote(event.target.value)} placeholder="Ex. : sans piment, allergie arachide..." rows={3} className="min-h-20 w-full resize-none rounded-[var(--radius-public-md)] border border-[var(--border-public-control)] bg-[var(--surface-public-card)] px-4 py-3 font-publicBody text-public-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus-visible:border-[var(--focus-ring)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--focus-ring)_28%,transparent)]" />
        </div>

        <PublicSurface level="muted" radius="lg" padding="standard" className="space-y-3">
          <h3 className="text-public-sm font-public-bold">Votre commande</h3>
          {items.map((item) => (
            <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 text-public-sm">
              <span className="min-w-0 truncate"><strong className="mr-2 text-[var(--text-secondary)]">{item.quantity}×</strong>{item.name}</span>
              <PublicPrice role="card" value={(item.unitPrice * item.quantity).toLocaleString()} suffix="FCFA" />
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-[var(--border-public-subtle)] pt-3">
            <strong className="text-public-lg">Total</strong>
            <PublicPrice role="total" value={total.toLocaleString()} suffix="FCFA" aria-label={`Total ${total.toLocaleString()} FCFA`} />
          </div>
        </PublicSurface>

        <PublicSurface level="muted" radius="md" padding="standard" className="flex items-center gap-3">
          <CheckCircle className="size-6 shrink-0 text-[var(--brand-primary)]" aria-hidden="true" />
          <p className="text-public-sm text-[var(--text-secondary)]">Commande sur place. Votre demande sera envoyée en cuisine.</p>
        </PublicSurface>

        {error ? <PublicSurface role="alert" level="card" border="default" radius="md" padding="compact" className="border-[var(--danger)] text-public-sm font-public-semibold text-[var(--danger)]">{error}</PublicSurface> : null}
      </div>
    </PublicCheckoutModal>
  )
}

function getOrCreateTableUserId() {
  const storageKey = "tableUserId"
  const existingUserId = window.localStorage.getItem(storageKey)

  if (existingUserId) return existingUserId

  const userId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `guest-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

  window.localStorage.setItem(storageKey, userId)
  return userId
}
