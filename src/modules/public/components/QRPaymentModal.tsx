"use client"

import * as React from "react"
import { doc, serverTimestamp, updateDoc } from "firebase/firestore"
import { Banknote, CreditCard } from "lucide-react"

import { useFirestore } from "@/firebase"
import {
  getAvailablePaymentMethods,
  type AvailablePaymentMethod,
} from "@/services/payment-methods.service"

type QRPaymentModalProps = {
  open: boolean
  restaurantId: string
  order: any
  onClose: () => void
}

const QR_PAYMENT_CHANNEL = "qr"

export default function QRPaymentModal({
  open,
  restaurantId,
  order,
  onClose,
}: QRPaymentModalProps) {
  const db = useFirestore()
  const [methods, setMethods] = React.useState<AvailablePaymentMethod[]>([])
  const [loadingMethods, setLoadingMethods] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState("")
  const [paymentStarted, setPaymentStarted] = React.useState(false)
  const [statusMessage, setStatusMessage] = React.useState("")
  const [fallbackCode, setFallbackCode] = React.useState("")

  React.useEffect(() => {
    if (!open || !db || !restaurantId || !order?.id) return

    let cancelled = false

    async function loadMethods() {
      setLoadingMethods(true)
      setError("")

      try {
        const availableMethods = await getAvailablePaymentMethods(db, restaurantId, QR_PAYMENT_CHANNEL, {
          amount: Number(order.total ?? order.totalAmount ?? 0),
        })

        if (!cancelled) setMethods(availableMethods)
      } catch (paymentError) {
        console.error(paymentError)
        if (!cancelled) {
          setMethods([])
          setError("Impossible de charger les moyens de paiement.")
        }
      } finally {
        if (!cancelled) setLoadingMethods(false)
      }
    }

    loadMethods()

    return () => {
      cancelled = true
    }
  }, [db, open, order?.id, order?.total, order?.totalAmount, restaurantId])

  React.useEffect(() => {
    if (!open) {
      setError("")
      setPaymentStarted(false)
      setStatusMessage("")
      setFallbackCode("")
    }
  }, [open])

  if (!open) return null

  const isPaymentLocked = saving || paymentStarted || order?.paymentStatus !== "unpaid"

  const handlePaymentClick = async (method: AvailablePaymentMethod) => {
    if (order.paymentStatus !== "unpaid") return
    if (!db || !restaurantId || !order?.id || isPaymentLocked) return

    setPaymentStarted(true)
    setSaving(true)
    setError("")
    setStatusMessage("")
    setFallbackCode("")

    try {
      const orderRef = doc(db, "restaurants", restaurantId, "orders", order.id)

      if (method.type === "cash") {
        await updateDoc(orderRef, {
          paymentMethod: "cash",
          paymentMethodCode: null,
          paymentProvider: null,
          paymentType: "cash",
          paymentStatus: "pending_cash",
          paymentIntentStatus: "pending",
          needsCashCollection: true,
          source: "qr_table",
          updatedAt: serverTimestamp(),
        })

        setStatusMessage("Un serveur va passer pour encaisser votre paiement")
        onClose()
        return
      }

      await updateDoc(orderRef, {
        paymentMethod: method.code,
        paymentMethodCode: method.code,
        paymentProvider: method.code,
        paymentType: "mobile_money",
        paymentStatus: "pending_mobile",
        paymentIntentStatus: "submitted",
        paymentCode: method.paymentCode || null,
        paymentInstruction:
          method.paymentCodeType === "ussd"
            ? "La composition du code a ete lancee automatiquement."
            : "Suivez les instructions du moyen choisi.",
        paymentVerificationStatus: "pending_manual_review",
        paymentVerificationRequestedAt: serverTimestamp(),
        needsCashCollection: false,
        source: "qr_table",
        updatedAt: serverTimestamp(),
      })

      setStatusMessage("Paiement en cours de validation...")

      if (method.paymentCodeType === "ussd" && method.paymentCode) {
        if (typeof window === "undefined") {
          setFallbackCode(method.paymentCode)
          return
        }

        try {
          window.location.href = `tel:${encodeURIComponent(method.paymentCode)}`
        } catch (ussdError) {
          console.error(ussdError)
          setFallbackCode(method.paymentCode)
        }
      }
    } catch (paymentError) {
      console.error(paymentError)
      setPaymentStarted(false)
      setError("Impossible d'initialiser le paiement.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-4 space-y-3">
      {loadingMethods ? (
        <div className="rounded-2xl bg-muted p-4 text-sm font-semibold text-muted-foreground">
          Chargement des moyens de paiement...
        </div>
      ) : methods.length === 0 ? (
        <div className="rounded-2xl bg-muted p-4 text-sm font-semibold text-muted-foreground">
          Aucun moyen de paiement configure.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {methods.map((method) => (
            <button
              key={method.code}
              type="button"
              onClick={() => handlePaymentClick(method)}
              disabled={isPaymentLocked}
              className="flex min-h-16 items-center gap-3 rounded-xl border border-border bg-background p-3 text-left transition hover:bg-muted active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                {method.type === "cash" ? (
                  <Banknote className="h-5 w-5 text-[var(--color-primary)]" />
                ) : method.logoUrl ? (
                  <img src={method.logoUrl} alt={method.name} className="h-6 w-6 object-contain" />
                ) : (
                  <CreditCard className="h-5 w-5 text-[var(--color-primary)]" />
                )}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-black">{method.name}</span>
                <span className="block text-xs font-semibold text-muted-foreground">
                  {method.type === "cash" ? "Paiement en especes" : "Mobile Money"}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {statusMessage ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm font-black text-amber-700">
          {statusMessage}
        </div>
      ) : null}

      {fallbackCode ? (
        <div className="rounded-2xl bg-muted p-4">
          <p className="text-sm font-semibold text-muted-foreground">
            Composez ce code sur votre telephone :
          </p>
          <p className="mt-2 break-all font-mono text-base font-black text-[var(--color-primary)]">
            {fallbackCode}
          </p>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm font-semibold text-red-600">
          {error}
        </div>
      ) : null}
    </div>
  )
}
