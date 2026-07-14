import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const publicPriceVariants = cva("public-tabular-nums inline-flex items-baseline gap-1 font-publicBody text-[var(--text-primary)]", {
  variants: {
    role: {
      card: "text-public-price-sm font-public-bold",
      standard: "text-public-md font-public-bold",
      total: "text-public-price-lg font-public-extrabold",
    },
  },
  defaultVariants: { role: "standard" },
})

export interface PublicPriceProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "prefix" | "role">, VariantProps<typeof publicPriceVariants> {
  value?: number | string | null
  prefix?: React.ReactNode
  suffix?: React.ReactNode
  currency?: string
  locale?: string
  unavailableLabel?: string
}

const PublicPrice = React.forwardRef<HTMLSpanElement, PublicPriceProps>(
  ({ className, value, prefix, suffix, currency, locale = "fr-FR", unavailableLabel = "Prix sur demande", role, ...props }, ref) => {
    const formattedValue = typeof value === "number"
      ? new Intl.NumberFormat(locale, currency ? { style: "currency", currency, maximumFractionDigits: 2 } : { maximumFractionDigits: 2 }).format(value)
      : value?.trim() || unavailableLabel

    return (
      <span ref={ref} className={cn(publicPriceVariants({ role }), className)} {...props}>
        {prefix && <span className="text-[var(--text-secondary)]">{prefix}</span>}
        <span>{formattedValue}</span>
        {suffix && <span>{suffix}</span>}
      </span>
    )
  }
)
PublicPrice.displayName = "PublicPrice"

export { PublicPrice, publicPriceVariants }
