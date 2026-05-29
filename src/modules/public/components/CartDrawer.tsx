"use client"

import * as React from "react"
import { X, Minus, Plus, Trash2 } from "lucide-react"

import type { CartItem } from "@/modules/restaurant/types"
import { groupCartLinesByBundle } from "@/lib/linked-option-groups"
import { useCart } from "../cart/CartContext"
import CheckoutQRModal from "./CheckoutQRModal"
import CheckoutPublicModal from "./CheckoutPublicModal"

export default function CartDrawer({ open, onClose, restaurantId, tableContext, activeTableSession, activeOrderId }: any) {
  const { items, total, updateQty, removeItem } = useCart()
  const [checkoutOpen, setCheckoutOpen] = React.useState(false)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">

      {/* BACKDROP */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />

      {/* DRAWER */}
      <div className="absolute bottom-0 left-0 right-0 flex max-h-[88vh] flex-col overflow-hidden rounded-t-[2rem] bg-background text-foreground shadow-[0_-20px_40px_rgba(0,0,0,0.15)] ring-1 ring-white/10 animate-in slide-in-from-bottom duration-300 ease-out sm:left-1/2 sm:right-auto sm:max-h-[86vh] sm:w-[min(34rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:rounded-[2rem] sm:bottom-4">

        {/* 🔥 HEADER FIXE */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/50 bg-background/95 px-5 py-4 backdrop-blur-md sm:px-6">
          <h2 className="text-xl font-black sm:text-2xl">
            Commande ({items.length})
          </h2>

          <button
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted/50 text-foreground active:scale-95 hover:bg-muted transition-all duration-300"
          >
            <X size={18} />
          </button>
        </div>

        {/* 🔥 LISTE PRODUITS */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 sm:px-6">

          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <div className="h-16 w-16 mb-4 rounded-full bg-muted flex items-center justify-center">
                <Trash2 className="h-6 w-6 opacity-50" />
              </div>
              <p className="text-sm font-semibold">Votre commande est vide</p>
            </div>
          ) : (
            groupCartLinesByBundle(items).map((group) => (
              <div key={group.bundleId || group.lines[0]?.id} className="space-y-2">
                {group.lines.map((item: CartItem, index) => (
              <div
                key={item.id}
                className="group flex flex-col gap-3 rounded-2xl border border-border/50 bg-card p-4 text-card-foreground shadow-sm"
                style={item.bundleId && !item.isBundleMain ? { marginLeft: "1rem", opacity: 0.95 } : undefined}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black truncate">
                      {item.bundleId && !item.isBundleMain ? `+ ${item.name}` : item.name}
                    </p>
                    {item.linkedGroupTitle ? (
                      <p className="text-[10px] text-muted-foreground">{item.linkedGroupTitle}</p>
                    ) : null}

                    {item.selections &&
                      Object.entries(item.selections).map(([option, values]) => (
                        <p key={option} className="text-[10px] text-muted-foreground truncate">
                          {values.join(", ")}
                        </p>
                      ))}

                    {item.selectedOptions?.map((option, index) => (
                      <p
                        key={`${item.id}-selected-option-${index}`}
                        className="truncate text-[10px] font-semibold text-muted-foreground"
                      >
                        {option.optionName}: {option.choiceName}
                        {option.price > 0 ? ` +${option.price.toLocaleString()} FCFA` : ""}
                      </p>
                    ))}
                  </div>

                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-red-500"
                    style={{ visibility: index === 0 || !group.bundleId ? "visible" : "hidden" }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* 🔥 CONTROLES */}
                <div className="flex items-center justify-between">

                  {/* QUANTITY */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQty(item.id, item.quantity - 1)}
                      className="h-7 w-7 rounded-full bg-muted flex items-center justify-center"
                    >
                      <Minus size={12} />
                    </button>

                    <span className="text-sm font-black">
                      {item.quantity}
                    </span>

                    <button
                      onClick={() => updateQty(item.id, item.quantity + 1)}
                      className="h-7 w-7 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center"
                    >
                      <Plus size={12} />
                    </button>
                  </div>

                  {/* 🔥 PRIX */}
                  <div className="text-sm font-black text-[var(--color-primary)]">
                    {item.total.toLocaleString()} FCFA
                  </div>
                </div>
              </div>
                ))}
              </div>
            ))
          )}
        </div>

        {/* 🔥 FOOTER FIXE */}
        {items.length > 0 && (
          <div className="space-y-4 border-t border-border/50 bg-background/95 px-5 py-6 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] backdrop-blur-md sm:px-6">

            <div className="flex justify-between items-end">
              <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                Total à payer
              </span>
              <span className="text-2xl font-black text-[var(--color-primary)]">
                {total.toLocaleString()} FCFA
              </span>
            </div>

            <button
              onClick={() => setCheckoutOpen(true)}
              className="w-full h-14 rounded-2xl bg-[var(--color-primary)] text-white text-base font-black uppercase tracking-wide shadow-[0_8px_24px_var(--color-primary)]/30 hover:shadow-[0_12px_32px_var(--color-primary)]/40 hover:brightness-110 active:scale-[0.98] transition-all duration-300"
            >
              Continuer
            </button>

          </div>
        )}

      </div>

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
    </div>
  )
}
