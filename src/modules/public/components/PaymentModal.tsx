"use client"

import * as React from "react"
import { X } from "lucide-react"

type PaymentMethod = {
  code: string
  name?: string
  logoUrl?: string
  paymentCode?: string
  type?: "ussd" | "link"
}

type PaymentModalProps = {
  open: boolean
  methods?: PaymentMethod[]
  loading?: boolean
  onClose: () => void
  onConfirm: (method: PaymentMethod) => void
}

export default function PaymentModal({
  open,
  methods = [],
  loading = false,
  onClose,
  onConfirm,
}: PaymentModalProps) {
  const [selectedMethod, setSelectedMethod] = React.useState<PaymentMethod | null>(null)
  const [paymentStarted, setPaymentStarted] = React.useState(false)

  React.useEffect(() => {
    if (!open) {
      setSelectedMethod(null)
      setPaymentStarted(false)
    }
  }, [open])

  if (!open) return null

  const selectedPaymentCode = selectedMethod?.paymentCode || selectedMethod?.code || ""

  return (
    <div className="fixed inset-0 z-[60] flex items-end bg-[color:color-mix(in_srgb,var(--bg-main)_68%,transparent)] px-3 pb-3 sm:items-center sm:justify-center sm:p-4">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-background text-foreground shadow-2xl">
        <div className="flex items-center justify-between border-b px-4 py-4">
          <div>
            <h2 className="text-lg font-black">Paiement</h2>
            <p className="text-xs font-semibold text-muted-foreground">
              Choisissez un moyen de paiement
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-muted"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 p-4">
          {loading && methods.length === 0 ? (
            <div className="rounded-2xl bg-muted p-4 text-sm font-semibold text-muted-foreground">
              Chargement des moyens de paiement...
            </div>
          ) : methods.length === 0 ? (
            <div className="rounded-2xl bg-muted p-4 text-sm font-semibold text-muted-foreground">
              Aucun moyen de paiement mobile n'est configure.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {methods.map((method) => {
              const active = selectedMethod?.code === method.code
              const methodName = method.name || method.code

              return (
                <button
                  key={method.code}
                  type="button"
                  onClick={() => {
                    setSelectedMethod(method)
                    setPaymentStarted(true)
                    if (method.type === "ussd" && method.paymentCode && typeof window !== "undefined") {
                      window.location.href = `tel:${encodeURIComponent(method.paymentCode)}`
                    }
                  }}
                  className={`flex min-h-14 items-center gap-2 rounded-xl border p-3 text-left transition hover:border-orange-500 ${
                    active
                      ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10"
                      : "bg-card hover:bg-muted"
                  }`}
                >
                  <div className="h-6 w-6 shrink-0 overflow-hidden rounded-md border border-border bg-card">
                    {method.logoUrl ? (
                      <img src={method.logoUrl} alt={methodName} className="h-full w-full object-contain" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-muted">
                        <span className="text-muted-foreground font-black uppercase text-xs">{method.code.slice(0, 2)}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-sm font-medium">{methodName}</div>
                </button>
              )
            })}
            </div>
          )}

          {selectedMethod && (
            <div className="rounded-2xl bg-muted p-4">
              <p className="text-sm font-bold">Moyen de paiement sélectionné</p>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">
                {selectedMethod.type === "ussd"
                  ? "La composition du code a ete lancee automatiquement."
                  : "Suivez les instructions du moyen choisi."}
              </p>

              {selectedMethod.type === "link" ? (
                <a
                  href={selectedPaymentCode}
                  onClick={() => setPaymentStarted(true)}
                  className="mt-3 flex h-12 items-center justify-center rounded-xl bg-[var(--color-primary)] px-4 text-sm font-black text-white"
                >
                  Ouvrir le paiement
                </a>
              ) : null}

              <p className="mt-3 break-all text-center font-mono text-sm font-black text-[var(--color-primary)]">
                {selectedPaymentCode}
              </p>
            </div>
          )}
        </div>

        <div className="border-t p-4">
          <button
            type="button"
            onClick={() => selectedMethod && onConfirm(selectedMethod)}
            disabled={!selectedMethod || !paymentStarted || loading}
            className="h-12 w-full rounded-xl bg-[var(--color-primary)] text-sm font-black text-white shadow-sm transition active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? "Validation..." : "J'ai paye"}
          </button>
        </div>
      </div>
    </div>
  )
}
