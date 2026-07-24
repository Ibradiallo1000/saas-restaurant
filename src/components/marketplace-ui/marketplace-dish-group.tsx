import * as React from "react"

import { cn } from "@/lib/utils"
import type { MarketplaceDishPresentation, MarketplaceOfferPresentation } from "./marketplace-foundations"
import { MarketplaceDishCard } from "./marketplace-dish-card"
import { MarketplaceOfferCard } from "./marketplace-offer-card"

export interface MarketplaceDishGroupProps extends React.HTMLAttributes<HTMLElement> {
  dish: MarketplaceDishPresentation
  offers: MarketplaceOfferPresentation[]
  onSelectDish: (dish: MarketplaceDishPresentation) => void
  onSelectOffer: (offer: MarketplaceOfferPresentation) => void
  offersLabel?: string
}

export const MarketplaceDishGroup = React.forwardRef<HTMLElement, MarketplaceDishGroupProps>(
  ({ className, dish, offers, offersLabel = "Restaurants disponibles", onSelectDish, onSelectOffer, ...props }, ref) => (
    <section ref={ref} aria-label={`Offres pour ${dish.name}`} className={cn("grid min-w-0 gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]", className)} {...props}>
      <div><MarketplaceDishCard dish={dish} onSelect={onSelectDish} /></div>
      <div className="min-w-0">
        <h3 className="mb-3 text-public-sm font-public-bold text-[var(--text-secondary)]">{offersLabel}</h3>
        <div className="marketplace-list">
          {offers.map((offer) => <MarketplaceOfferCard key={offer.id} offer={offer} onSelect={onSelectOffer} />)}
        </div>
      </div>
    </section>
  )
)
MarketplaceDishGroup.displayName = "MarketplaceDishGroup"
