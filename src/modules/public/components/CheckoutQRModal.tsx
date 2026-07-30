"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CheckCircle } from "lucide-react"

import { PublicButton, PublicCheckoutModal, PublicPrice, PublicSurface } from "@/components/public-ui"
import { useFirebaseApp, useUser } from "@/firebase"
import { type RestaurantTableRecord } from "@/services/table-session.service"
import { useCart } from "../cart/CartContext"
import { rememberTrackedOrder } from "../orderTrackingStorage"
import {
  clearPublicIdempotencyKey,
  comparePublicOrderProjections,
  createCanonicalTableSession,
  createCanonicalQrOrder,
  qrCanonicalEnabled,
  rememberQrCapability,
  resolveQrCanonicalMode,
  stablePublicIdempotencyKey,
} from "../canonical"

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
  const app = useFirebaseApp()
  const { user } = useUser()
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
      const qrMode = resolveQrCanonicalMode(restaurantId)
      if (qrCanonicalEnabled(qrMode)) {
        if (!user?.isAnonymous) {
          throw new Error("La session client a expiré. Rechargez la page puis réessayez.")
        }
        const tableSession = await createCanonicalTableSession({
          app,
          user,
          restaurantId,
          tableId: tableContext.id,
        })
        const requestScope = `qr-order:${restaurantId}:${tableSession.tableSessionId}`
        const idempotencyKey = stablePublicIdempotencyKey(requestScope)
        const response = await createCanonicalQrOrder({
          app,
          user,
          restaurantId,
          idempotencyKey,
          body: {
            schemaVersion: 1,
            channel: "qr_table",
            serviceMode: "dine_in",
            clientRequestId: idempotencyKey,
            items: items.map((item, index) => ({
              clientLineId: `${item.productId}-${index}`,
              productId: item.productId,
              quantity: item.quantity,
              options: (item.selectedOptions ?? []).map((option: any) => ({
                optionName: String(option.optionName ?? option.groupName ?? option.name ?? ""),
                choiceName: String(option.choiceName ?? option.name ?? option.value ?? ""),
              })),
              instructions: null,
            })),
            tableContext: {
              tableId: tableContext.id,
              tableSessionId: tableSession.tableSessionId,
              capability: tableSession.capability,
            },
            customer: null,
            delivery: null,
            cashSessionId: null,
            notes: customerNote.trim() || null,
          },
        })
        if (qrMode === "compare" && process.env.NODE_ENV !== "production") {
          console.info("[QR][CANONICAL_COMPARE]", comparePublicOrderProjections(
            {
              lineCount: response.orderItemIds.length,
              lines: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
              total: response.total,
              serviceMode: response.serviceMode,
              tableId: tableContext.id,
              status: response.orderStatus,
            },
            {
              lineCount: items.length,
              lines: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
              total,
              serviceMode: "dine_in",
              tableId: tableContext.id,
              status: items.some((item) => item.preparationMode === "kitchen") ? "pending" : "ready",
            }
          ))
        }

        clear()
        clearPublicIdempotencyKey(requestScope)
        onClose()
        rememberTrackedOrder({
          restaurantId,
          orderId: response.orderId,
          tableSessionId: tableSession.tableSessionId,
        })
        rememberQrCapability(response.orderId, tableSession.capability ?? "")
        router.push(
          `/order/${restaurantId}/${response.orderId}?tableSessionId=${tableSession.tableSessionId}`
        )
        return
      }
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
