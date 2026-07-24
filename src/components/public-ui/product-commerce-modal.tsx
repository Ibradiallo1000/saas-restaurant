"use client"

import * as React from "react"
import { ImageOff } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  PublicModal,
  type PublicModalProps,
} from "./public-modal"
import { PublicPrice } from "./public-price"

export interface ProductCommerceModalProps
  extends Omit<
    PublicModalProps,
    | "title"
    | "description"
    | "children"
    | "footer"
    | "maxWidth"
    | "headerContent"
  > {
  title: React.ReactNode
  description?: React.ReactNode
  imageUrl?: string
  imageAlt?: string
  imageFallback?: React.ReactNode
  price?: number | string | null
  pricePrefix?: React.ReactNode
  priceSuffix?: React.ReactNode
  priceFallback?: string
  children?: React.ReactNode
  footer?: React.ReactNode
  loading?: boolean
  disabled?: boolean
}

export function ProductCommerceModal({
  children,
  className,
  closeLabel = "Fermer",
  contentClassName,
  description,
  disabled = false,
  footer,
  footerClassName,
  imageAlt,
  imageFallback,
  imageUrl,
  loading = false,
  onOpenChange,
  open,
  price,
  priceFallback = "Prix sur demande",
  pricePrefix,
  priceSuffix,
  title,
  ...props
}: ProductCommerceModalProps) {
  const [imageFailed, setImageFailed] = React.useState(false)

  React.useEffect(() => {
    setImageFailed(false)
  }, [imageUrl])

  const showImage = Boolean(imageUrl) && !imageFailed

  return (
    <PublicModal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      closeLabel={closeLabel}
      closeButtonClassName="bg-[var(--surface-public-elevated)] text-[var(--text-primary)] shadow-[var(--shadow-public-sm)] backdrop-blur hover:bg-[var(--surface-public-elevated)]"
      maxWidth="lg"
      className={cn(
        "max-h-[min(94dvh,840px)]",
        className
      )}
      headerClassName="p-0 pr-0"
      contentClassName={cn(
        "px-[var(--space-4)] py-[var(--space-4)] sm:px-[var(--space-5)]",
        contentClassName
      )}
      footerClassName={cn(
        "sticky bottom-0",
        footerClassName
      )}
      headerContent={
        <div className="relative">
          <div className="flex h-[180px] w-full items-center justify-center overflow-hidden bg-[var(--surface-public-muted)] text-[var(--text-muted)] sm:h-[200px]">
            {showImage ? (
              <img
                src={imageUrl}
                alt={
                  imageAlt ??
                  (typeof title === "string" ? title : "")
                }
                className="size-full object-cover"
                onError={() => setImageFailed(true)}
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex size-full items-center justify-center"
              >
                {imageFallback ?? (
                  <ImageOff className="size-10 opacity-60" />
                )}
              </span>
            )}
          </div>

          <div className="space-y-1.5 px-[var(--space-4)] py-[var(--space-4)] pr-16 sm:px-[var(--space-5)] sm:pr-16">
            <div className="line-clamp-2 break-words font-publicDisplay text-[22px] font-public-extrabold leading-7 text-[var(--text-primary)] sm:text-[28px] sm:leading-[34px]">
              {title}
            </div>

            <PublicPrice
              value={price}
              prefix={pricePrefix}
              suffix={priceSuffix}
              unavailableLabel={priceFallback}
              role="standard"
              className="font-public-bold text-primary"
            />

            {description ? (
              <div className="text-sm leading-5 text-[var(--text-secondary)]">
                {description}
              </div>
            ) : null}
          </div>
        </div>
      }
      footer={footer}
      {...props}
    >
      <div
        aria-busy={loading || undefined}
        aria-disabled={disabled || undefined}
      >
        {children}
      </div>
    </PublicModal>
  )
}