"use client"

import { useParams } from "next/navigation"

import PublicPage from "@/modules/public/PublicPage"
import { CartProvider } from "@/modules/public/cart/CartContext"

export default function PublicOrderingPage() {
  const params = useParams()
  const slug = params.slug as string

  return (
    <CartProvider>
      <PublicPage slug={slug} />
    </CartProvider>
  )
}
