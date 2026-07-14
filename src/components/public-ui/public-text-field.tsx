import * as React from "react"

import { cn } from "@/lib/utils"

export interface PublicTextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label: string
  helpText?: string
  error?: string
  leftIcon?: React.ReactNode
  rightAction?: React.ReactNode
  fieldSize?: "standard" | "comfortable"
  containerClassName?: string
}

const PublicTextField = React.forwardRef<HTMLInputElement, PublicTextFieldProps>(
  ({ className, containerClassName, disabled, error, fieldSize = "standard", helpText, id, label, leftIcon, required, rightAction, ...props }, ref) => {
    const generatedId = React.useId()
    const inputId = id ?? `public-field-${generatedId}`
    const helpId = helpText ? `${inputId}-help` : undefined
    const errorId = error ? `${inputId}-error` : undefined
    const describedBy = [props["aria-describedby"], helpId, errorId].filter(Boolean).join(" ") || undefined

    return (
      <div className={cn("grid gap-[var(--space-2)] font-publicBody", containerClassName)}>
        <label htmlFor={inputId} className="text-public-sm font-public-semibold text-[var(--text-primary)]">
          {label}{required && <span aria-hidden="true" className="ml-1 text-[var(--danger)]">*</span>}
        </label>
        <div className="relative">
          {leftIcon && <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[var(--text-muted)] [&_svg]:size-5">{leftIcon}</span>}
          <input
            {...props}
            ref={ref}
            id={inputId}
            required={required}
            disabled={disabled}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={describedBy}
            className={cn(
              "w-full rounded-[var(--radius-public-md)] border border-[var(--border-public-control)] bg-[var(--surface-public-card)] px-4 font-publicBody text-public-sm text-[var(--text-primary)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--text-muted)] focus-visible:border-[var(--focus-ring)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--focus-ring)_28%,transparent)] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
              fieldSize === "standard" ? "h-12" : "h-[52px]",
              leftIcon && "pl-11", rightAction && "pr-12",
              error && "border-[var(--danger)] focus-visible:border-[var(--danger)] focus-visible:ring-[color:color-mix(in_srgb,var(--danger)_25%,transparent)]",
              className
            )}
          />
          {rightAction && <span className="absolute inset-y-0 right-1 flex items-center">{rightAction}</span>}
        </div>
        {helpText && <p id={helpId} className="text-public-xs text-[var(--text-muted)]">{helpText}</p>}
        {error && <p id={errorId} className="text-public-xs font-public-semibold text-[var(--danger)]">{error}</p>}
      </div>
    )
  }
)
PublicTextField.displayName = "PublicTextField"

export { PublicTextField }
