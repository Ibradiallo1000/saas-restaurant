"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight, Building2, MapPin } from "lucide-react"

import { getOptimizedImage } from "@/lib/image"
import { cn } from "@/lib/utils"
import { PublicBadge } from "./public-badge"

export interface PublicRestaurantCardProps extends React.HTMLAttributes<HTMLElement> {
  name: string
  slug: string
  logoUrl?: string | null
  coverUrl?: string | null
  description?: string | null
  location?: string | null
  cuisineTypes?: string[]
  isOpen?: boolean | null
  services?: string[]
  onOpen?: () => void
  href?: string
}

const PublicRestaurantCard = React.forwardRef<HTMLElement, PublicRestaurantCardProps>(
  ({ className, coverUrl, cuisineTypes = [], description, href, isOpen, location, logoUrl, name, onOpen, services = [], slug, ...props }, ref) => {
    const [coverFailed, setCoverFailed] = React.useState(false)
    const [logoFailed, setLogoFailed] = React.useState(false)
    const target = href || `/${slug}`
    const summary = description?.trim() || cuisineTypes.filter(Boolean).join(" · ")

    return (
      <article ref={ref} className={cn("group relative overflow-hidden rounded-[var(--radius-public-xl)] border border-[var(--border-public-subtle)] bg-[var(--surface-public-card)] font-publicBody text-[var(--text-primary)] shadow-[var(--shadow-public-sm)]", className)} {...props}>
        <Link href={target} onClick={onOpen} className="block rounded-[var(--radius-public-xl)] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]" aria-label={`Voir le menu de ${name}`}>
          <div className="relative aspect-video overflow-hidden bg-[var(--surface-public-muted)]">
            {coverUrl && !coverFailed ? <img src={getOptimizedImage(coverUrl, 720)} alt="" className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100" onError={() => setCoverFailed(true)} /> : <div className="flex size-full items-center justify-center text-[var(--text-muted)]"><Building2 className="size-10" aria-hidden="true" /></div>}
            {typeof isOpen === "boolean" ? <PublicBadge className="absolute left-3 top-3" label={isOpen ? "Ouvert" : "Fermé"} variant={isOpen ? "success" : "neutral"} /> : null}
          </div>
          <div className="relative p-[var(--space-4)] pt-8">
            <div className="absolute -top-7 left-4 flex size-14 items-center justify-center overflow-hidden rounded-[var(--radius-public-lg)] border-2 border-[var(--surface-public-card)] bg-[var(--surface-public-elevated)] shadow-[var(--shadow-public-xs)]">
              {logoUrl && !logoFailed ? <img src={getOptimizedImage(logoUrl, 112)} alt={`Logo de ${name}`} className="size-full object-cover" onError={() => setLogoFailed(true)} /> : <span className="text-public-lg font-public-extrabold text-[var(--brand-primary)]" aria-hidden="true">{name.trim().slice(0, 1).toUpperCase()}</span>}
            </div>
            <h2 className="line-clamp-2 text-public-lg font-public-extrabold leading-6">{name}</h2>
            {summary ? <p className="mt-1 line-clamp-2 min-h-10 text-public-sm leading-5 text-[var(--text-secondary)]">{summary}</p> : null}
            {location ? <p className="mt-3 flex items-center gap-1.5 text-public-xs font-public-semibold text-[var(--text-muted)]"><MapPin className="size-3.5" aria-hidden="true" />{location}</p> : null}
            {services.length ? <div className="mt-3 flex flex-wrap gap-1.5">{services.map((service) => <PublicBadge key={service} label={service} variant="neutral" size="sm" />)}</div> : null}
            <span className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-public-lg)] bg-[var(--action-primary-bg)] px-5 text-public-sm font-public-bold text-[var(--action-primary-fg)]">Voir le menu <ArrowRight className="size-4" aria-hidden="true" /></span>
          </div>
        </Link>
      </article>
    )
  }
)
PublicRestaurantCard.displayName = "PublicRestaurantCard"

export { PublicRestaurantCard }
