"use client"

import { Clock, Star } from "lucide-react"

import { getOptimizedImage } from "@/lib/image"

export default function HeroSection({ restaurant }: { restaurant: any }) {
  const coverImage =
    restaurant?.coverImage ||
    restaurant?.coverImageUrl ||
    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1200"
  const isOpen = restaurant?.isOpen !== false && restaurant?.status !== "closed"
  const serviceTime = restaurant?.serviceTime || restaurant?.deliveryTime || restaurant?.estimatedTime || "25-35 min"
  const rating = Number(restaurant?.rating || restaurant?.averageRating || 4.8)

  return (
    <section className="relative h-[120px] w-full overflow-hidden bg-gray-900">
      <img
        src={getOptimizedImage(coverImage, 1200)}
        alt="Image de couverture"
        width={1200}
        height={400}
        className="h-full w-full object-cover object-top"
      />

      <div className="absolute inset-0 bg-gradient-to-t from-[color:color-mix(in_srgb,var(--bg-main)_82%,transparent)] via-[color:color-mix(in_srgb,var(--bg-main)_28%,transparent)] to-transparent" />

      <div className="absolute bottom-3 left-4 right-4">
        <div className="flex flex-wrap items-center gap-2 text-[12px] font-bold text-white/90">
          <span className={`h-2 w-2 rounded-full ${isOpen ? "bg-green-500" : "bg-red-500"}`} />
          {isOpen ? "Ouvert" : "Ferme"}
          <span className="text-white/50">|</span>
          <Clock className="h-3 w-3" />
          {serviceTime}
          <span className="text-white/50">|</span>
          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
          {Number.isFinite(rating) ? rating.toFixed(1) : "4.8"}
        </div>
      </div>
    </section>
  )
}
