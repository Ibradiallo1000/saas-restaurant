"use client"

import * as React from "react"
import { X, Minus, Plus, Trash2 } from "lucide-react"

import type { CartItem } from "@/modules/restaurant/types"
import { useCart } from "../cart/CartContext"
import CheckoutModal from "./CheckoutModal"

export default function CartDrawer({ open, onClose, restaurantId }: any) {
  const { items, total, updateQty, removeItem } = useCart()
  const [checkoutOpen, setCheckoutOpen] = React.useState(false)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">

      {/* BACKDROP */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* DRAWER */}
      <div className="absolute bottom-0 left-0 right-0 bg-background text-foreground rounded-t-3xl max-h-[85vh] flex flex-col overflow-hidden">

        {/* 🔥 HEADER FIXE */}
        <div className="flex items-center justify-between px-4 py-4 border-b bg-background sticky top-0 z-10">
          <h2 className="text-lg font-black">
            Panier ({items.length})
          </h2>

          <button
            onClick={onClose}
            className="h-9 w-9 rounded-full bg-muted flex items-center justify-center"
          >
            <X size={18} />
          </button>
        </div>

        {/* 🔥 LISTE PRODUITS */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">

          {items.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">
              Panier vide
            </p>
          ) : (
            items.map((item: CartItem) => (
              <div
                key={item.id}
                className="bg-card text-card-foreground rounded-xl p-3 flex flex-col gap-2"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black truncate">
                      {item.name}
                    </p>

                    {item.selections &&
                      Object.entries(item.selections).map(([option, values]) => (
                        <p key={option} className="text-[10px] text-muted-foreground truncate">
                          {values.join(", ")}
                        </p>
                      ))}
                  </div>

                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-red-500"
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
            ))
          )}
        </div>

        {/* 🔥 FOOTER FIXE */}
        {items.length > 0 && (
          <div className="border-t p-4 bg-background space-y-3">

            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-muted-foreground">
                Total
              </span>
              <span className="text-xl font-black text-[var(--color-primary)]">
                {total.toLocaleString()} FCFA
              </span>
            </div>

            <button
              onClick={() => setCheckoutOpen(true)}
              className="w-full h-12 rounded-xl bg-[var(--color-primary)] text-white font-black shadow-lg active:scale-95"
            >
              Commander maintenant
            </button>

          </div>
        )}

      </div>

      <CheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        restaurantId={restaurantId}
      />
    </div>
  )
}
