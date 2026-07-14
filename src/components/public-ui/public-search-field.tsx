import * as React from "react"
import { Loader2, Search, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { PublicIconButton } from "./public-icon-button"
import { PublicTextField } from "./public-text-field"

export interface PublicSearchFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "type" | "value"> {
  value: string
  onChange: (value: string) => void
  onClear: () => void
  label?: string
  inputRef?: React.Ref<HTMLInputElement>
  resultCount?: number
  loading?: boolean
}

function assignRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") ref(value)
  else if (ref) ref.current = value
}

const PublicSearchField = React.forwardRef<HTMLInputElement, PublicSearchFieldProps>(
  ({
    autoFocus,
    className,
    disabled,
    inputRef,
    label = "Rechercher dans le menu",
    loading = false,
    onChange,
    onClear,
    placeholder = "Rechercher un plat...",
    resultCount,
    value,
    ...props
  }, forwardedRef) => {
    const localRef = React.useRef<HTMLInputElement | null>(null)
    const setInputRef = React.useCallback((node: HTMLInputElement | null) => {
      localRef.current = node
      assignRef(inputRef, node)
      assignRef(forwardedRef, node)
    }, [forwardedRef, inputRef])

    const clear = () => {
      onClear()
      localRef.current?.focus({ preventScroll: true })
    }

    const helpText = loading
      ? "Recherche en cours"
      : typeof resultCount === "number"
        ? `${resultCount} résultat${resultCount > 1 ? "s" : ""}`
        : undefined

    return (
      <PublicTextField
        {...props}
        ref={setInputRef}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        label={label}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        aria-busy={loading || undefined}
        helpText={helpText}
        leftIcon={loading
          ? <Loader2 className="animate-spin motion-reduce:animate-none" />
          : <Search />}
        rightAction={value ? (
          <PublicIconButton
            aria-label="Effacer la recherche"
            variant="ghost"
            size="compact"
            onClick={clear}
            disabled={disabled}
          >
            <X />
          </PublicIconButton>
        ) : undefined}
        fieldSize="standard"
        containerClassName={cn("[&>label]:sr-only", className)}
        className="rounded-[var(--radius-public-lg)] border-[var(--border-public-subtle)]"
      />
    )
  }
)
PublicSearchField.displayName = "PublicSearchField"

export { PublicSearchField }
