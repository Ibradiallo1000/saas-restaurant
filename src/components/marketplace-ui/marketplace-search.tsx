import * as React from "react"

import { PublicSearchField } from "@/components/public-ui"
import { cn } from "@/lib/utils"
import type { MarketplaceSearchPresentation } from "./marketplace-foundations"

export interface MarketplaceSearchProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  presentation: MarketplaceSearchPresentation
  onChange: (value: string) => void
  onClear: () => void
  inputRef?: React.Ref<HTMLInputElement>
}

export const MarketplaceSearch = React.forwardRef<HTMLDivElement, MarketplaceSearchProps>(
  ({ className, inputRef, onChange, onClear, presentation, ...props }, ref) => (
    <div ref={ref} role="search" className={cn("w-full", className)} {...props}>
      <PublicSearchField
        value={presentation.value}
        label={presentation.label}
        placeholder={presentation.placeholder ?? "Que voulez-vous manger ?"}
        resultCount={presentation.resultCount}
        loading={presentation.loading}
        disabled={presentation.disabled}
        onChange={onChange}
        onClear={onClear}
        inputRef={inputRef}
        className="[&_input]:min-h-[var(--marketplace-search-height)] [&_input]:bg-[var(--marketplace-surface-search)]"
      />
    </div>
  )
)
MarketplaceSearch.displayName = "MarketplaceSearch"
