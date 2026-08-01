"use client"

import * as React from "react"
import {
  Banknote,
  BarChart3,
  Bell,
  Building2,
  Clock,
  CreditCard,
  FileText,
  ImageIcon,
  LayoutDashboard,
  Library,
  MenuSquare,
  Package,
  ReceiptText,
  Settings,
  ShoppingBag,
  Store,
  Table2,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"

export interface PageHeaderProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  icon?: LucideIcon | null
  title: React.ReactNode
  subtitle?: React.ReactNode
  action?: React.ReactNode
  back?: React.ReactNode
  breadcrumb?: React.ReactNode
  eyebrow?: React.ReactNode
  meta?: React.ReactNode
  headingAs?: "h1" | "h2"
  density?: "compact" | "dense" | "default" | "comfortable"
}

export const PageHeader = React.forwardRef<HTMLElement, PageHeaderProps>(
  (
    {
      icon,
      title,
      subtitle,
      action,
      back,
      breadcrumb,
      eyebrow,
      meta,
      headingAs: Heading = "h1",
      density = "dense",
      className,
      ...props
    },
    ref
  ) => {
    const Icon = icon === undefined ? resolvePageIcon(title) : icon

    return (
      <header
        ref={ref}
        className={cn(
          "flex flex-col sm:flex-row sm:items-start sm:justify-between",
          density === "compact" ? "gap-1.5" : density === "dense" ? "gap-2" : density === "comfortable" ? "gap-5" : "gap-3",
          className
        )}
        {...props}
      >
        <div className="flex min-w-0 items-start gap-2.5 sm:gap-3">
          {Icon ? <Icon
            className="mt-0.5 h-6 w-6 shrink-0 text-primary sm:h-7 sm:w-7"
            aria-hidden="true"
          /> : null}
          <div className="min-w-0">
            {back ? <div className="mb-1">{back}</div> : null}
            {breadcrumb ? <nav className="mb-1 text-xs text-muted-foreground" aria-label="Fil d’Ariane">{breadcrumb}</nav> : null}
            {eyebrow ? (
              <div className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {eyebrow}
              </div>
            ) : null}
            <Heading className="text-xl font-bold leading-tight tracking-tight text-foreground min-[390px]:text-2xl md:text-[1.75rem]">
              {title}
            </Heading>
            {subtitle ? (
              <p className="mt-1 max-w-3xl text-sm font-medium leading-relaxed text-muted-foreground">
                {subtitle}
              </p>
            ) : null}
            {meta ? (
              <div className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {meta}
              </div>
            ) : null}
          </div>
        </div>

        {action ? (
          <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            {action}
          </div>
        ) : null}
      </header>
    )
  }
)
PageHeader.displayName = "PageHeader"

function resolvePageIcon(title: React.ReactNode): LucideIcon {
  const value = typeof title === "string" ? title.toLocaleLowerCase("fr") : ""

  if (value.includes("tableau") || value.includes("dashboard")) return LayoutDashboard
  if (value.includes("commande")) return ReceiptText
  if (value.includes("caisse")) return Wallet
  if (value.includes("trésor") || value.includes("rapport")) return BarChart3
  if (value.includes("dépense")) return Banknote
  if (value.includes("menu") || value.includes("catégorie")) return MenuSquare
  if (value.includes("table")) return Table2
  if (value.includes("image") || value.includes("média")) return ImageIcon
  if (value.includes("inventaire") || value.includes("stock")) return Package
  if (value.includes("horaire")) return Clock
  if (value.includes("fournisseur")) return ShoppingBag
  if (value.includes("restaurant") || value.includes("établissement")) return Store
  if (value.includes("utilisateur") || value.includes("client")) return Users
  if (value.includes("abonnement") || value.includes("plan")) return CreditCard
  if (value.includes("paiement")) return CreditCard
  if (value.includes("bibliothèque")) return Library
  if (value.includes("demande") || value.includes("audit")) return FileText
  if (value.includes("configuration") || value.includes("paramètre")) return Settings
  if (value.includes("notification") || value.includes("avis")) return Bell
  if (value.includes("administration") || value.includes("super admin")) return Building2
  return LayoutDashboard
}
