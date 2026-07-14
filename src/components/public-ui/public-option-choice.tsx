"use client"

import * as React from "react"
import { Check, Circle } from "lucide-react"

import { cn } from "@/lib/utils"
import { PublicPrice } from "./public-price"

export type PublicOptionChoiceControlType = "radio" | "checkbox"
export type PublicOptionChoicePresentation = "card" | "row" | "chip"

export interface PublicOptionChoiceProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "checked" | "disabled" | "required" | "onChange" | "className"> {
  label: React.ReactNode
  description?: React.ReactNode
  price?: number | string | null
  selected?: boolean
  disabled?: boolean
  required?: boolean
  controlType: PublicOptionChoiceControlType
  presentation?: PublicOptionChoicePresentation
  onSelect?: (event: React.ChangeEvent<HTMLInputElement>) => void
  icon?: React.ReactNode
  imageUrl?: string
  badge?: React.ReactNode
  className?: string
}

const PublicOptionChoice = React.forwardRef<HTMLInputElement, PublicOptionChoiceProps>(
  (
    {
      badge,
      className,
      controlType,
      description,
      disabled = false,
      icon,
      imageUrl,
      label,
      onSelect,
      presentation = "row",
      price,
      required = false,
      selected = false,
      ...props
    },
    ref
  ) => {
    const [imageFailed, setImageFailed] = React.useState(false)
    React.useEffect(() => setImageFailed(false), [imageUrl])

    return (
      <label
        className={cn(
          "relative flex cursor-pointer items-center gap-3 border text-left font-publicBody outline-none transition-[background-color,border-color,box-shadow] duration-150 focus-within:ring-2 focus-within:ring-[var(--focus-ring)] focus-within:ring-offset-2 focus-within:ring-offset-[var(--surface-public-elevated)] motion-reduce:transition-none",
          presentation === "card" && "min-h-14 w-full rounded-[var(--radius-public-lg)] p-3",
          presentation === "row" && "min-h-[52px] w-full rounded-[var(--radius-public-md)] px-3 py-2",
          presentation === "chip" && "min-h-10 w-fit rounded-[var(--radius-public-full)] px-3 py-2",
          selected
            ? "border-[var(--brand-primary)] bg-[var(--brand-primary-soft)]"
            : "border-[var(--border-public-control)] bg-[var(--surface-public-card)] hover:border-[var(--border-public-control)]",
          disabled && "cursor-not-allowed opacity-55",
          className
        )}
      >
        <input
          ref={ref}
          type={controlType}
          checked={selected}
          disabled={disabled}
          required={required}
          onChange={onSelect}
          className="peer sr-only"
          {...props}
        />

        <span
          aria-hidden="true"
          className={cn(
            "flex size-5 shrink-0 items-center justify-center border bg-[var(--surface-public-card)] text-[var(--action-primary-fg)]",
            controlType === "radio" ? "rounded-[var(--radius-public-full)]" : "rounded-[var(--radius-public-sm)]",
            selected && "border-[var(--brand-primary)] bg-[var(--brand-primary)]"
          )}
        >
          {selected && (controlType === "radio" ? <Circle className="size-2 fill-current" /> : <Check className="size-3.5" />)}
        </span>

        {imageUrl && !imageFailed ? (
          <img
            src={imageUrl}
            alt=""
            className="size-10 shrink-0 rounded-[var(--radius-public-md)] object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : icon ? (
          <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center text-[var(--text-secondary)] [&_svg]:size-5">
            {icon}
          </span>
        ) : null}

        <span className="min-w-0 flex-1">
          <span className="block break-words text-sm font-public-bold leading-5 text-[var(--text-primary)]">{label}</span>
          {description && <span className="block text-xs leading-4 text-[var(--text-secondary)]">{description}</span>}
        </span>

        {badge && <span className="shrink-0 text-xs font-public-semibold text-[var(--text-secondary)]">{badge}</span>}
        {price !== undefined && price !== null && price !== "" && (
          <PublicPrice value={price} role="card" className="shrink-0 whitespace-nowrap text-xs" />
        )}
      </label>
    )
  }
)
PublicOptionChoice.displayName = "PublicOptionChoice"

export { PublicOptionChoice }
