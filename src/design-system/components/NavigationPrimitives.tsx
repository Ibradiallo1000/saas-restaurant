"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { semanticHoverClasses, semanticIconClasses, semanticSurfaceClasses, type DashboardSemanticVariant } from "@/components/dashboard-ui/semantic-variants"

type Density = "compact" | "dense" | "default" | "comfortable"

export interface NavigationTileProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title: React.ReactNode
  icon: React.ReactNode
  href?: string
  value?: React.ReactNode
  indicator?: React.ReactNode
  badge?: React.ReactNode
  description?: React.ReactNode
  active?: boolean
  disabled?: boolean
  showArrow?: boolean
  density?: Density
  variant?: DashboardSemanticVariant
}

export function NavigationTile({ title, icon, href, value, indicator, badge, description, active = false, disabled = false, showArrow = true, density = "dense", variant = "neutral", className, ...props }: NavigationTileProps) {
  const navigable = Boolean(href) && !disabled
  const content = <article className={cn("flex h-full min-h-20 min-w-0 items-start gap-2.5 rounded-xl border transition-colors", semanticSurfaceClasses[variant], density === "compact" ? "p-2.5" : density === "dense" ? "p-3" : density === "comfortable" ? "p-5" : "p-4", navigable && semanticHoverClasses[variant], active && "border-primary ring-1 ring-primary/25", disabled && "opacity-60", className)} data-variant={variant} aria-current={active ? "page" : undefined} {...props}>
    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full [&_svg]:size-4", semanticIconClasses[variant])} aria-hidden="true">{icon}</span>
    <span className="flex min-w-0 flex-1 flex-col self-stretch">
      <span className="flex min-w-0 items-start justify-between gap-1.5">
        <span className="min-w-0 text-sm font-semibold leading-tight">{title}</span>
        {badge}
      </span>
      {value !== undefined ? <span className="mt-2 break-words text-lg font-bold leading-tight tabular-nums min-[390px]:text-xl">{value}</span> : null}
      {description ? <span className="mt-1 line-clamp-2 text-xs text-muted-foreground">{description}</span> : null}
      {indicator ? <span className="mt-auto pt-2 text-xs text-muted-foreground">{indicator}</span> : null}
    </span>
    {navigable && showArrow ? <ChevronRight className="mt-2 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" /> : null}
  </article>

  if (!navigable) return content
  return <Link href={href!} aria-label={typeof title === "string" ? `Ouvrir ${title}` : undefined} className="group block min-h-11 min-w-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">{content}</Link>
}

export interface ResponsiveTileGridProps extends React.HTMLAttributes<HTMLDivElement> {
  density?: Density
  desktopColumns?: 4 | 5 | 6
}

export function ResponsiveTileGrid({ density = "dense", desktopColumns = 4, className, ...props }: ResponsiveTileGridProps) {
  return <div className={cn("grid grid-cols-2", density === "compact" ? "gap-2" : density === "dense" ? "gap-2.5" : density === "comfortable" ? "gap-4" : "gap-3", "md:grid-cols-3 lg:grid-cols-4", desktopColumns === 5 && "xl:grid-cols-5", desktopColumns === 6 && "xl:grid-cols-5 2xl:grid-cols-6", className)} {...props} />
}

export function BackLink({ href, label, className }: { href: string; label: string; className?: string }) {
  const router = useRouter()
  const onClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (typeof window === "undefined") return
    const referrer = document.referrer ? new URL(document.referrer) : null
    if (referrer?.origin === window.location.origin && window.history.length > 1) {
      event.preventDefault()
      router.back()
    }
  }
  return <Link href={href} onClick={onClick} className={cn("inline-flex min-h-11 items-center gap-1.5 rounded-md py-2 pr-2 text-sm font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}><ArrowLeft className="size-4" aria-hidden="true" />{label}</Link>
}

export type SectionNavigationItem = { label: string; href: string; matchQuery?: { key: string; value?: string } }

export function SectionNavigation({ parentHref, parentLabel, items, showBack = true, className }: { parentHref: string; parentLabel: string; items: SectionNavigationItem[]; showBack?: boolean; className?: string }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  return <div className={cn("space-y-1", className)}>{showBack ? <BackLink href={parentHref} label={parentLabel} /> : null}<nav aria-label={`Navigation ${parentLabel}`} className="-mx-1 overflow-x-auto px-1 pb-1"><ul className="flex min-w-max gap-1">{items.map((item) => { const queryValue = item.matchQuery ? searchParams?.get(item.matchQuery.key) : null; const queryMatches = item.matchQuery ? (item.matchQuery.value === undefined ? !queryValue : queryValue === item.matchQuery.value) : true; const active = pathname === item.href.split("?")[0] && queryMatches; return <li key={item.href}><Link href={item.href} aria-current={active ? "page" : undefined} className={cn("inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active && "bg-primary text-primary-foreground hover:bg-primary")}>{item.label}<span className="sr-only">{active ? " (page actuelle)" : ""}</span></Link></li> })}</ul></nav></div>
}
