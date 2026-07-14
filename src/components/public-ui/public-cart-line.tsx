"use client"

import * as React from "react"
import { ChefHat, Trash2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { PublicIconButton } from "./public-icon-button"
import { PublicPrice } from "./public-price"
import { PublicQuantityControls } from "./public-quantity-controls"

export type PublicCartLineBundleRole = "standalone" | "parent" | "child"

export interface PublicCartLineProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "children"> {
  name: string
  description?: React.ReactNode
  imageUrl?: string
  imageAlt?: string
  imageFallback?: React.ReactNode
  options?: React.ReactNode
  quantity: number
  unitPrice?: number | string | null
  linePrice: number | string | null
  pricePrefix?: React.ReactNode
  priceSuffix?: React.ReactNode
  onIncrease: () => void
  onDecrease: () => void
  onRemove?: () => void
  removeLabel?: string
  linked?: boolean
  bundleRole?: PublicCartLineBundleRole
  disabled?: boolean
  quantityControls?: React.ReactNode
}

const PublicCartLine = React.forwardRef<HTMLElement, PublicCartLineProps>(
  (
    {
      bundleRole = "standalone",
      className,
      description,
      disabled = false,
      imageAlt,
      imageFallback,
      imageUrl,
      linePrice,
      linked = false,
      name,
      onDecrease,
      onIncrease,
      onRemove,
      options,
      pricePrefix,
      priceSuffix,
      quantity,
      quantityControls,
      removeLabel,
      unitPrice,
      ...props
    },
    ref
  ) => {
    const [imageFailed, setImageFailed] = React.useState(false)
    React.useEffect(() => setImageFailed(false), [imageUrl])

    const isChild = linked || bundleRole === "child"
    const showImage = Boolean(imageUrl) && !imageFailed

    return (
      <article
        ref={ref}
        className={cn(
          "relative grid w-full grid-cols-[56px_minmax(0,1fr)] gap-2.5 rounded-[var(--radius-public-lg)] border border-[var(--border-public-subtle)] bg-[var(--surface-public-card)] p-3 font-publicBody text-[var(--text-primary)] shadow-[var(--shadow-public-xs)]",
          isChild && "border-l-4 border-l-[var(--border-public-strong)] bg-[var(--surface-public-muted)]",
          disabled && "opacity-60",
          className
        )}
        {...props}
      >
        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-public-md)] bg-[var(--surface-public-muted)] text-[var(--text-muted)]">
          {showImage ? (
            <img
              src={imageUrl}
              alt={imageAlt ?? name}
              className="size-full object-cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <span aria-hidden="true">{imageFallback ?? <ChefHat className="size-5 opacity-60" />}</span>
          )}
        </div>

        <div className="min-w-0">
          {isChild && (
            <p className="mb-0.5 text-xs font-public-semibold leading-4 text-[var(--text-secondary)]">
              Élément lié
            </p>
          )}
          <h3 className="line-clamp-2 break-words text-sm font-public-bold leading-5">{name}</h3>
          {description && <div className="mt-0.5 text-xs leading-4 text-[var(--text-secondary)]">{description}</div>}
          {options && <div className="mt-1 space-y-0.5 text-xs leading-4 text-[var(--text-secondary)]">{options}</div>}
          {unitPrice !== undefined && unitPrice !== null && (
            <PublicPrice value={unitPrice} role="card" className="mt-1 text-xs text-[var(--text-secondary)]" />
          )}
          <PublicPrice
            value={linePrice}
            prefix={pricePrefix}
            suffix={priceSuffix}
            role="card"
            className="mt-1.5 max-w-full text-[var(--text-primary)]"
          />
        </div>

        <div className="col-span-2 flex min-w-0 items-center justify-between gap-2 pt-0.5">
          {quantityControls ?? (
            <PublicQuantityControls
              quantity={quantity}
              onDecrease={onDecrease}
              onIncrease={onIncrease}
              disabled={disabled}
              size="compact"
              decreaseLabel={`Diminuer la quantité de ${name}`}
              increaseLabel={`Augmenter la quantité de ${name}`}
              quantityLabel={`Quantité de ${name}`}
            />
          )}
          {onRemove && (
            <PublicIconButton
              aria-label={removeLabel ?? `Supprimer ${name} du panier`}
              variant="danger"
              size="compact"
              disabled={disabled}
              onClick={onRemove}
            >
              <Trash2 className="size-4" />
            </PublicIconButton>
          )}
        </div>
      </article>
    )
  }
)
PublicCartLine.displayName = "PublicCartLine"

export { PublicCartLine }
