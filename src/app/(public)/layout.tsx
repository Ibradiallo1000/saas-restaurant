"use client"

import { CartProvider } from "@/modules/public/cart/CartContext"

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <CartProvider>
      {children}
    </CartProvider>
  )
}