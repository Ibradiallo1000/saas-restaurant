"use client"

import * as React from "react"
import { CreditCard } from "lucide-react"

import { PublicButton, PublicCheckoutModal, PublicOptionChoice, PublicOptionGroup, PublicSurface } from "@/components/public-ui"

type PaymentMethod = {
  code: string
  name?: string
  logoUrl?: string
  paymentCode?: string
  type?: "cash" | "mobile_money" | "ussd" | "link"
  paymentCodeType?: "ussd" | "link" | null
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

  const selectedPaymentCode = selectedMethod?.paymentCode || selectedMethod?.code || ""

  return (
    <PublicCheckoutModal
      open={open}
      onOpenChange={(nextOpen) => !nextOpen && onClose()}
      title="Paiement"
      description="Choisissez un moyen de paiement mobile."
      closeOnOverlayClick={!loading}
      footer={
        <PublicButton fullWidth size="action" onClick={() => selectedMethod && onConfirm(selectedMethod)} disabled={!selectedMethod || !paymentStarted} loading={loading} loadingLabel="Validation en cours">
          J’ai payé
        </PublicButton>
      }
    >
      <div className="space-y-3">
          {loading && methods.length === 0 ? (
            <PublicSurface level="muted" radius="lg" padding="standard" className="text-public-sm font-public-semibold text-[var(--text-secondary)]" role="status">
              Chargement des moyens de paiement...
            </PublicSurface>
          ) : methods.length === 0 ? (
            <PublicSurface level="muted" radius="lg" padding="standard" className="text-public-sm font-public-semibold text-[var(--text-secondary)]">
              Aucun moyen de paiement mobile n’est configuré.
            </PublicSurface>
          ) : (
            <PublicOptionGroup title="Moyen de paiement" required min={1} max={1} selectedCount={selectedMethod ? 1 : 0}>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {methods.map((method) => {
                const active = selectedMethod?.code === method.code
                const methodName = method.name || method.code

                return (
                  <PublicOptionChoice
                    key={method.code}
                    name="tracking-payment-method"
                    value={method.code}
                    label={methodName}
                    description={method.paymentCodeType === "ussd" ? "Paiement USSD" : "Mobile Money"}
                    icon={method.logoUrl ? <img src={method.logoUrl} alt="" className="size-6 object-contain" /> : <CreditCard />}
                    selected={active}
                    controlType="radio"
                    presentation="card"
                    onSelect={() => {
                      setSelectedMethod(method)
                      setPaymentStarted(true)
                      if (method.paymentCodeType === "ussd" && method.paymentCode && typeof window !== "undefined") {
                        window.location.href = `tel:${encodeURIComponent(method.paymentCode)}`
                      }
                    }}
                  />
                )
              })}
              </div>
            </PublicOptionGroup>
          )}

          {selectedMethod && (
            <PublicSurface level="muted" radius="lg" padding="standard">
              <p className="text-public-sm font-public-bold">Moyen de paiement sélectionné</p>
              <p className="mt-1 text-public-xs font-public-semibold text-[var(--text-secondary)]">
                {selectedMethod.paymentCodeType === "ussd"
                  ? "La composition du code a été lancée automatiquement."
                  : "Suivez les instructions du moyen choisi."}
              </p>

              {selectedMethod.paymentCodeType === "link" ? (
                <a
                  href={selectedPaymentCode}
                  onClick={() => setPaymentStarted(true)}
                  className="mt-3 flex h-12 items-center justify-center rounded-[var(--radius-public-lg)] bg-[var(--action-primary-bg)] px-4 font-publicBody text-public-sm font-public-bold text-[var(--action-primary-fg)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                >
                  Ouvrir le paiement
                </a>
              ) : null}

              <p className="mt-3 break-all text-center font-mono text-public-sm font-public-bold text-[var(--brand-primary)]">
                {selectedPaymentCode}
              </p>
            </PublicSurface>
          )}
      </div>
    </PublicCheckoutModal>
  )
}
