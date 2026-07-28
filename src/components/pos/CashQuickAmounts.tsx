"use client"

import { cn } from "@/lib/utils"
import { formatCashAmount } from "./cash-payment-utils"

type CashQuickAmountsProps = {
  amounts: number[]
  selectedAmount?: number
  onSelect: (amount: number) => void
  disabled?: boolean
  className?: string
}

export function CashQuickAmounts({ amounts, selectedAmount, onSelect, disabled = false, className }: CashQuickAmountsProps) {
  return (
    <div className={cn("rounded-[var(--radius-dashboard-widget)] border border-[var(--pos-border)] bg-[var(--pos-muted)] p-2.5", className)}>
      <p className="mb-2 flex min-h-6 items-center text-sm font-semibold">Montants rapides</p>
      <div className="grid grid-cols-2 gap-2">
        {amounts.map((amount) => (
          <button
            key={amount}
            type="button"
            disabled={disabled}
            aria-label={`Montant reçu ${formatCashAmount(amount)} FCFA`}
            aria-pressed={selectedAmount === amount}
            onClick={() => onSelect(amount)}
            className={cn(
              "dashboard-focus-visible min-h-12 rounded-[var(--radius-dashboard-button)] border px-2 text-sm font-bold tabular-nums shadow-sm transition-colors active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:text-base",
              selectedAmount === amount
                ? "border-primary bg-primary text-primary-foreground"
                : "border-[var(--pos-border)] bg-[var(--pos-panel)] hover:border-primary/30 hover:bg-primary/5 active:bg-primary/10"
            )}
          >
            {formatCashAmount(amount)}
          </button>
        ))}
      </div>
    </div>
  )
}
