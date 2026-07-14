import * as React from "react"
import { Minus, Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import { PublicIconButton } from "./public-icon-button"

export interface PublicQuantityControlsProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  quantity: number
  onDecrease: () => void
  onIncrease: () => void
  decreaseDisabled?: boolean
  increaseDisabled?: boolean
  disabled?: boolean
  min?: number
  max?: number
  decreaseLabel?: string
  increaseLabel?: string
  quantityLabel?: string
  size?: "compact" | "standard"
}

const PublicQuantityControls = React.forwardRef<HTMLDivElement, PublicQuantityControlsProps>(
  (
    {
      className,
      decreaseDisabled = false,
      decreaseLabel = "Diminuer la quantité",
      disabled = false,
      increaseDisabled = false,
      increaseLabel = "Augmenter la quantité",
      max,
      min,
      onDecrease,
      onIncrease,
      quantity,
      quantityLabel = "Quantité",
      size = "compact",
      ...props
    },
    ref
  ) => {
    const atMinimum = typeof min === "number" && quantity <= min
    const atMaximum = typeof max === "number" && quantity >= max

    return (
      <div
        ref={ref}
        role="group"
        aria-label={quantityLabel}
        className={cn("inline-flex items-center gap-1", className)}
        {...props}
      >
        <PublicIconButton
          aria-label={decreaseLabel}
          variant="outline"
          size={size}
          disabled={disabled || decreaseDisabled || atMinimum}
          onClick={onDecrease}
        >
          <Minus className="size-4" />
        </PublicIconButton>
        <output
          aria-label={`${quantityLabel} : ${quantity}`}
          className={cn(
            "public-tabular-nums inline-flex shrink-0 items-center justify-center font-publicBody text-sm font-public-bold text-[var(--text-primary)]",
            size === "compact" ? "min-w-8" : "min-w-9"
          )}
        >
          {quantity}
        </output>
        <PublicIconButton
          aria-label={increaseLabel}
          variant="outline"
          size={size}
          disabled={disabled || increaseDisabled || atMaximum}
          onClick={onIncrease}
        >
          <Plus className="size-4" />
        </PublicIconButton>
      </div>
    )
  }
)
PublicQuantityControls.displayName = "PublicQuantityControls"

export { PublicQuantityControls }
