"use client"

import * as React from "react"
import { Trash2 } from "lucide-react"

import { PublicButton, PublicCartLine, PublicEmptyState, PublicPrice, PublicSheet } from "@/components/public-ui"
import type { CartItem } from "@/modules/restaurant/types"
import { groupCartLinesByBundle } from "@/lib/linked-option-groups"
import { getOptimizedImage } from "@/lib/image"
import { useCart } from "../cart/CartContext"
import CheckoutQRModal from "./CheckoutQRModal"
import CheckoutPublicModal from "./CheckoutPublicModal"

export default function CartDrawer({
  open,
  onClose,
  restaurantId,
  tableContext,
  activeOrderId,
}: any) {
  const { items, total, updateQty, removeItem } = useCart()
  const [checkoutOpen, setCheckoutOpen] = React.useState(false)

  return (
    <>
      <PublicSheet
        open={open}
        onOpenChange={(nextOpen) => { if (!nextOpen) onClose() }}
        title="Panier"
        description={`${items.length} article${items.length > 1 ? "s" : ""}`}
        closeLabel="Fermer le panier"
        maxWidth="lg"
        contentClassName="space-y-3"
        footer={items.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-end justify-between gap-4">
              <span className="text-xs font-public-bold uppercase tracking-wide text-[var(--text-secondary)]">
                Total à payer
              </span>
              <PublicPrice
                value={`${total.toLocaleString()} FCFA`}
                role="total"
                className="shrink-0 whitespace-nowrap text-[var(--brand-primary)]"
              />
            </div>

            <PublicButton
              type="button"
              size="action"
              fullWidth
              onClick={() => setCheckoutOpen(true)}
            >
              Continuer
            </PublicButton>
          </div>
        ) : undefined}
      >
        {items.length === 0 ? (
          <PublicEmptyState
            title="Votre panier est vide"
            description="Ajoutez un produit depuis le menu pour commencer votre commande."
            icon={<Trash2 />}
          />
        ) : (
            groupCartLinesByBundle(items).map((group) => (
              <div key={group.bundleId || group.lines[0]?.id} className="space-y-2">
                {group.lines.map((item: CartItem, index) => (
                  <PublicCartLine
                    key={item.id}
                    name={item.bundleId && !item.isBundleMain ? `+ ${item.name}` : item.name}
                    description={item.linkedGroupTitle}
                    imageUrl={item.imageUrl ? getOptimizedImage(item.imageUrl, 160) : undefined}
                    imageAlt={item.name}
                    options={
                      <>
                        {item.selections && Object.entries(item.selections).map(([option, values]) => (
                          <p key={option}>{values.join(", ")}</p>
                        ))}
                        {item.selectedOptions?.map((option, optionIndex) => (
                          <p key={`${item.id}-selected-option-${optionIndex}`}>
                            {option.optionName}: {option.choiceName}
                            {option.price > 0 ? ` +${option.price.toLocaleString()} FCFA` : ""}
                          </p>
                        ))}
                      </>
                    }
                    quantity={item.quantity}
                    linePrice={`${item.total.toLocaleString()} FCFA`}
                    onDecrease={() => updateQty(item.id, item.quantity - 1)}
                    onIncrease={() => updateQty(item.id, item.quantity + 1)}
                    onRemove={index === 0 || !group.bundleId ? () => removeItem(item.id) : undefined}
                    removeLabel={`Supprimer ${item.name} du panier`}
                    linked={Boolean(item.bundleId && !item.isBundleMain)}
                    bundleRole={!item.bundleId ? "standalone" : item.isBundleMain ? "parent" : "child"}
                  />
                ))}
              </div>
            ))
        )}
      </PublicSheet>

      {tableContext ? (
        <CheckoutQRModal
          open={checkoutOpen}
          onClose={() => setCheckoutOpen(false)}
          restaurantId={restaurantId}
          tableContext={tableContext}
          activeOrderId={activeOrderId}
        />
      ) : (
        <CheckoutPublicModal
          open={checkoutOpen}
          onClose={() => setCheckoutOpen(false)}
          restaurantId={restaurantId}
          restaurantFeatures={{ takeaway: true, delivery: true }}
        />
      )}
    </>
  )
}
