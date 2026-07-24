import * as React from "react"

import { PublicSheet } from "@/components/public-ui"
import type { MarketplaceDishPresentation, MarketplaceOfferPresentation } from "./marketplace-foundations"
import { MarketplaceFeedback } from "./marketplace-feedback"
import { MarketplaceOfferCard } from "./marketplace-offer-card"

export interface MarketplaceOfferSelectorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dish: MarketplaceDishPresentation
  offers: MarketplaceOfferPresentation[]
  onSelect: (offer: MarketplaceOfferPresentation) => void
  emptyTitle?: string
  emptyDescription?: string
}

export function MarketplaceOfferSelector({
  dish, emptyDescription = "Aucune offre active n’est disponible pour ce plat.",
  emptyTitle = "Aucun restaurant disponible", offers, onOpenChange, onSelect, open,
}: MarketplaceOfferSelectorProps) {
  return (
    <PublicSheet
      open={open}
      onOpenChange={onOpenChange}
      title={dish.name}
      description={dish.offerCountLabel ?? "Choisissez le restaurant qui propose ce plat."}
      contentClassName="bg-[var(--marketplace-surface-sheet)]"
    >
      {offers.length ? (
        <div className="marketplace-list">
          {offers.map((offer) => <MarketplaceOfferCard key={offer.id} offer={offer} onSelect={onSelect} />)}
        </div>
      ) : <MarketplaceFeedback state="empty" title={emptyTitle} description={emptyDescription} />}
    </PublicSheet>
  )
}
