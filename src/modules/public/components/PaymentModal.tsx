"use client"

import * as React from "react"
import { X } from "lucide-react"

type PaymentMethod = {
  name: string
  code: string
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

  React.useEffect(() => {
    if (!open) setSelectedMethod(null)
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-end bg-[color:color-mix(in_srgb,var(--bg-main)_68%,transparent)] px-3 pb-3 sm:items-center sm:justify-center sm:p-4">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-background text-foreground shadow-2xl">
        <div className="flex items-center justify-between border-b px-4 py-4">
          <div>
            <h2 className="text-lg font-black">Mobile Money</h2>
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
          {methods.length === 0 ? (
            <div className="rounded-2xl bg-muted p-4 text-sm font-semibold text-muted-foreground">
              Aucun moyen de paiement mobile n'est configure.
            </div>
          ) : (
            methods.map((method) => {
              const active = selectedMethod?.name === method.name && selectedMethod?.code === method.code

              return (
                <button
                  key={`${method.name}-${method.code}`}
                  type="button"
                  onClick={() => setSelectedMethod(method)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    active
                      ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10"
                      : "bg-card hover:bg-muted"
                  }`}
                >
                  <div className="font-black">{method.name}</div>
                  <div className="mt-1 font-mono text-sm font-bold text-[var(--color-primary)]">
                    {method.code}
                  </div>
                </button>
              )
            })
          )}

          {selectedMethod && (
            <div className="rounded-2xl bg-muted p-4">
              <p className="text-sm font-bold">Composez ce code sur votre téléphone</p>
              <p className="mt-2 font-mono text-lg font-black text-[var(--color-primary)]">
                {selectedMethod.code}
              </p>
            </div>
          )}
        </div>

        <div className="border-t p-4">
          <button
            type="button"
            onClick={() => selectedMethod && onConfirm(selectedMethod)}
            disabled={!selectedMethod || loading}
            className="h-12 w-full rounded-xl bg-[var(--color-primary)] text-sm font-black text-white shadow-sm transition active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? "Validation..." : "J’ai payé"}
          </button>
        </div>
      </div>
    </div>
  )
}
