"use client"

import { Delete } from "lucide-react"
import { cn } from "@/lib/utils"

const KEYS = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "000", "0"] as const

type NumericKeypadProps = {
  value: string
  onChange: (value: string) => void
  onBackspace: () => void
  onClear: () => void
  disabled?: boolean
  className?: string
}

export function NumericKeypad({
  value,
  onChange,
  onBackspace,
  onClear,
  disabled = false,
  className,
}: NumericKeypadProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-dashboard-widget)] border border-primary/10 bg-primary/5 p-2.5",
        className
      )}
    >
      <div className="mb-2 flex min-h-6 items-center justify-between gap-2">
        <p className="text-sm font-semibold">Pavé numérique</p>
        {value ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onClear}
            className="dashboard-focus-visible rounded px-2 py-1 text-xs font-medium text-[var(--dashboard-muted)] hover:bg-primary/10 active:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Tout effacer
          </button>
        ) : null}
      </div>
      <div className="grid grid-cols-3 gap-2" aria-label="Pavé numérique">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            disabled={disabled}
            aria-label={`Ajouter ${key}`}
            onClick={() => onChange(key)}
            className="dashboard-focus-visible min-h-12 rounded-[var(--radius-dashboard-button)] border border-[var(--pos-border)] bg-[var(--pos-panel)] text-xl font-bold tabular-nums shadow-sm transition-colors hover:border-primary/30 hover:bg-primary/5 active:border-primary/40 active:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {key}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled || value.length === 0}
          aria-label="Effacer le dernier chiffre"
          onClick={onBackspace}
          className="dashboard-focus-visible flex min-h-12 items-center justify-center rounded-[var(--radius-dashboard-button)] border border-[var(--pos-border)] bg-[var(--pos-panel)] shadow-sm transition-colors hover:border-primary/30 hover:bg-primary/5 active:border-primary/40 active:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Delete aria-hidden="true" className="size-6" />
        </button>
      </div>
    </div>
  )
}
