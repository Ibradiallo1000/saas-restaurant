import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const publicPageShellVariants = cva("relative min-h-screen w-full overflow-x-clip font-publicBody text-[var(--text-primary)]", {
  variants: {
    background: {
      public: "public-menu-page",
      neutral: "app-background",
      transparent: "bg-transparent",
    },
  },
  defaultVariants: { background: "public" },
})

const widthClasses = {
  catalog: "max-w-[var(--public-max-marketing)]",
  list: "max-w-[var(--public-max-list)]",
  transaction: "max-w-[var(--public-max-transaction)]",
  marketing: "max-w-[var(--public-max-marketing)]",
  full: "max-w-none",
} as const

type PublicPageShellElement = "main" | "section" | "div"
type PublicPageShellBottomReserve = "none" | "navigation" | "sticky" | number

export interface PublicPageShellProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "color">,
    VariantProps<typeof publicPageShellVariants> {
  as?: PublicPageShellElement
  width?: keyof typeof widthClasses
  reserveHeader?: boolean
  headerHeight?: number | string
  includeTopSafeArea?: boolean
  bottomReserve?: PublicPageShellBottomReserve
  bottomSafety?: number
  includeBottomSafeArea?: boolean
  innerContainer?: boolean
  withGutters?: boolean
  contentClassName?: string
}

type ShellStyle = React.CSSProperties & {
  "--public-shell-header-height"?: string
  "--public-shell-bottom-height"?: string
  "--public-shell-bottom-safety"?: string
  "--public-shell-safe-top"?: string
  "--public-shell-safe-bottom"?: string
}

const PublicPageShell = React.forwardRef<HTMLElement, PublicPageShellProps>(
  ({
    as: Component = "main",
    background,
    bottomReserve = "none",
    bottomSafety = 16,
    children,
    className,
    contentClassName,
    headerHeight = "var(--public-header-height)",
    includeBottomSafeArea = true,
    includeTopSafeArea = true,
    innerContainer = true,
    reserveHeader = true,
    style,
    width = "catalog",
    withGutters = true,
    ...props
  }, ref) => {
    const bottomHeight = bottomReserve === "navigation"
      ? "var(--public-navigation-height)"
      : bottomReserve === "sticky"
        ? "var(--public-sticky-action-height)"
        : typeof bottomReserve === "number"
          ? `${bottomReserve}px`
          : "0px"

    const shellStyle: ShellStyle = {
      "--public-shell-header-height": reserveHeader
        ? typeof headerHeight === "number" ? `${headerHeight}px` : headerHeight
        : "0px",
      "--public-shell-bottom-height": bottomHeight,
      "--public-shell-bottom-safety": bottomReserve === "none" ? "0px" : `${bottomSafety}px`,
      "--public-shell-safe-top": includeTopSafeArea ? "var(--safe-top)" : "0px",
      "--public-shell-safe-bottom": includeBottomSafeArea ? "var(--safe-bottom)" : "0px",
      ...style,
    }

    const content = innerContainer ? (
      <div
        className={cn(
          "relative z-[1] mx-auto w-full",
          widthClasses[width],
          withGutters && "[padding-left:calc(var(--public-gutter-x)+var(--safe-left))] [padding-right:calc(var(--public-gutter-x)+var(--safe-right))]",
          contentClassName
        )}
      >
        {children}
      </div>
    ) : children

    return (
      <Component
        ref={ref as React.Ref<never>}
        className={cn(
          publicPageShellVariants({ background }),
          "pt-[calc(var(--public-shell-header-height)+var(--public-shell-safe-top))] pb-[calc(var(--public-shell-bottom-height)+var(--public-shell-bottom-safety)+var(--public-shell-safe-bottom))]",
          className
        )}
        style={shellStyle}
        {...props}
      >
        {content}
      </Component>
    )
  }
)
PublicPageShell.displayName = "PublicPageShell"

export { PublicPageShell, publicPageShellVariants }
