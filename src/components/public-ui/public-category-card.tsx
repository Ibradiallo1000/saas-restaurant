"use client"

import * as React from "react"
import { ImageOff } from "lucide-react"

import { cn } from "@/lib/utils"

export interface PublicCategoryCardProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
  label: string
  imageUrl?: string
  imageAlt?: string
  active?: boolean
  onSelect?: () => void
  fallback?: React.ReactNode
  buttonRef?: React.Ref<HTMLButtonElement>
}

function setRefs<T>(...refs: Array<React.Ref<T> | undefined>) {
  return (value: T | null) => {
    refs.forEach((ref) => {
      if (typeof ref === "function") ref(value)
      else if (ref) (ref as React.MutableRefObject<T | null>).current = value
    })
  }
}

const PublicCategoryCard = React.forwardRef<HTMLButtonElement, PublicCategoryCardProps>(
  (
    {
      label,
      imageUrl,
      imageAlt,
      active = false,
      onSelect,
      disabled = false,
      fallback,
      buttonRef,
      className,
      type = "button",
      ...props
    },
    ref
  ) => {
    const [imageFailed, setImageFailed] = React.useState(false)

    React.useEffect(() => setImageFailed(false), [imageUrl])

    const showImage = Boolean(imageUrl) && !imageFailed

    return (
      <button
        ref={setRefs(ref, buttonRef)}
        {...props}
        type={type}
        aria-label={props["aria-label"] ?? label}
        aria-pressed={active}
        disabled={disabled}
        onClick={onSelect}
        className={cn(
          "relative flex h-[100px] w-[76px] shrink-0 flex-col items-center justify-center gap-1.5 overflow-hidden rounded-[var(--radius-public-lg)] border p-2 text-center font-publicBody outline-none transition-[background-color,border-color,color,box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-public-canvas)] disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none sm:h-[108px] sm:w-[84px]",
          active
            ? "border-[var(--brand-primary)] bg-[var(--brand-primary-soft)] text-[var(--brand-primary)] shadow-[var(--shadow-public-xs)]"
            : "border-[var(--border-public-subtle)] bg-[var(--surface-public-card)] text-[var(--text-primary)] shadow-[var(--shadow-public-xs)] hover:border-[var(--border-public-default)] hover:bg-[var(--surface-public-muted)]",
          className
        )}
      >
        <span className="flex size-[52px] shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-public-md)] border border-[var(--border-public-subtle)] bg-[var(--surface-public-muted)] text-[var(--text-muted)] sm:size-[58px]">
          {showImage ? (
            <img
              src={imageUrl}
              alt={imageAlt ?? label}
              className="size-full object-cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <span aria-hidden="true" className="flex size-full items-center justify-center">
              {fallback ?? <ImageOff className="size-5" />}
            </span>
          )}
        </span>

        <span className="line-clamp-2 min-h-8 w-full break-words text-xs font-public-bold leading-4 sm:text-[13px]">
          {label}
        </span>

        {active && (
          <span
            aria-hidden="true"
            className="absolute inset-x-3 bottom-0 h-0.5 rounded-t-[var(--radius-public-full)] bg-[var(--brand-primary)]"
          />
        )}
      </button>
    )
  }
)
PublicCategoryCard.displayName = "PublicCategoryCard"

export { PublicCategoryCard }
