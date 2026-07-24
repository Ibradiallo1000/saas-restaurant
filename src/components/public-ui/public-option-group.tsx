import * as React from "react"

import { cn } from "@/lib/utils"

export interface PublicOptionGroupProps
  extends Omit<
    React.FieldsetHTMLAttributes<HTMLFieldSetElement>,
    "title"
  > {
  title: React.ReactNode
  icon?: React.ReactNode
  description?: React.ReactNode
  required?: boolean
  min?: number
  max?: number
  selectedCount?: number
  error?: React.ReactNode
  headingAs?: "h3" | "h4" | "div"
}

function selectionHint(
  min?: number,
  max?: number,
  selectedCount?: number
) {
  if (
    typeof selectedCount === "number" &&
    typeof max === "number" &&
    max > 1
  ) {
    return `${selectedCount} sur ${max} sélectionnée${
      selectedCount > 1 ? "s" : ""
    }`
  }

  if (min === 1 && max === 1) {
    return "Choisissez 1 option"
  }

  if (
    typeof min === "number" &&
    min > 0 &&
    typeof max === "number" &&
    max > min
  ) {
    return `Choisissez de ${min} à ${max} options`
  }

  if (typeof min === "number" && min > 0) {
    return `Choisissez au moins ${min} option${
      min > 1 ? "s" : ""
    }`
  }

  if (typeof max === "number" && max > 1) {
    return `Jusqu’à ${max} options`
  }

  return null
}

const PublicOptionGroup = React.forwardRef<
  HTMLFieldSetElement,
  PublicOptionGroupProps
>(
  (
    {
      children,
      className,
      description,
      error,
      headingAs: Heading = "h3",
      icon,
      max,
      min,
      required = false,
      selectedCount,
      title,
      ...props
    },
    ref
  ) => {
    const errorId = React.useId()
    const descriptionId = React.useId()
    const hint = selectionHint(min, max, selectedCount)

    const describedBy =
      [
        description ? descriptionId : null,
        error ? errorId : null,
      ]
        .filter(Boolean)
        .join(" ") || undefined

    return (
      <fieldset
        ref={ref}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className={cn("min-w-0 space-y-3", className)}
        {...props}
      >
        <legend className="sr-only">{title}</legend>

        <div className="space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Heading className="flex min-w-0 items-center gap-2 text-base font-public-bold leading-[22px] text-primary">
              {icon ? (
                <span
                  aria-hidden="true"
                  className="flex shrink-0 items-center justify-center text-primary"
                >
                  {icon}
                </span>
              ) : null}

              <span className="min-w-0 break-words">
                {title}
              </span>
            </Heading>

            <span className="shrink-0 rounded-[var(--radius-public-full)] border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-public-semibold leading-4 text-primary">
              {required ? "Obligatoire" : "Facultatif"}
            </span>
          </div>

          {hint ? (
            <p className="text-xs leading-4 text-[var(--text-muted)]">
              {hint}
            </p>
          ) : null}

          {description ? (
            <p
              id={descriptionId}
              className="text-[13px] leading-5 text-[var(--text-secondary)]"
            >
              {description}
            </p>
          ) : null}
        </div>

        <div>{children}</div>

        {error ? (
          <p
            id={errorId}
            role="alert"
            className="text-xs font-public-semibold leading-[18px] text-[var(--danger)]"
          >
            {error}
          </p>
        ) : null}
      </fieldset>
    )
  }
)

PublicOptionGroup.displayName = "PublicOptionGroup"

export { PublicOptionGroup }