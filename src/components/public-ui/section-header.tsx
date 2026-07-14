import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const sectionHeaderVariants = cva("flex min-w-0 items-start justify-between gap-3 font-publicBody", {
  variants: {
    variant: {
      default: "text-[var(--text-primary)]",
      catalog: "text-[var(--text-primary)]",
      subtle: "text-[var(--text-secondary)]",
    },
  },
  defaultVariants: { variant: "default" },
})

const sectionHeaderTitleVariants = cva("min-w-0 break-words font-public-bold", {
  variants: {
    size: {
      sm: "text-public-heading-3 sm:text-xl sm:leading-7",
      md: "text-public-heading-3 sm:text-public-heading-2",
    },
  },
  defaultVariants: { size: "md" },
})

export interface SectionHeaderProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title">,
    VariantProps<typeof sectionHeaderVariants>,
    VariantProps<typeof sectionHeaderTitleVariants> {
  title: React.ReactNode
  description?: React.ReactNode
  icon?: React.ReactNode
  action?: React.ReactNode
  headingAs?: "h2" | "h3" | "div"
  titleClassName?: string
}

const SectionHeader = React.forwardRef<HTMLDivElement, SectionHeaderProps>(
  ({
    action,
    className,
    description,
    headingAs: Heading = "h2",
    icon,
    size,
    title,
    titleClassName,
    variant,
    ...props
  }, ref) => (
    <div ref={ref} className={cn(sectionHeaderVariants({ variant }), className)} {...props}>
      <div className="flex min-w-0 items-start gap-2">
        {icon && (
          <span
            aria-hidden="true"
            className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-public-full)] border border-[var(--border-public-subtle)] bg-[var(--brand-primary-soft)] text-[var(--brand-primary)] shadow-[var(--shadow-public-xs)] sm:size-[30px] [&_svg]:size-3.5 sm:[&_svg]:size-4"
          >
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <Heading className={cn(sectionHeaderTitleVariants({ size }), titleClassName)}>{title}</Heading>
          {description && (
            <p className="mt-1 text-public-sm font-public-regular text-[var(--text-secondary)]">
              {description}
            </p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
)
SectionHeader.displayName = "SectionHeader"

export { SectionHeader, sectionHeaderVariants, sectionHeaderTitleVariants }
