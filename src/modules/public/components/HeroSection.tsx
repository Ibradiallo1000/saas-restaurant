"use client"

import { Clock, Star } from "lucide-react"
import { getOptimizedImage } from "@/lib/image"

export default function HeroSection({ restaurant }: { restaurant: any }) {
  const coverImage =
    restaurant?.coverImage ||
    restaurant?.coverImageUrl ||
    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1200"

  const isOpen = restaurant?.isOpen !== false && restaurant?.status !== "closed"

  const serviceTime =
    restaurant?.serviceTime ||
    restaurant?.deliveryTime ||
    restaurant?.estimatedTime ||
    "25-35 min"

  const rating = Number(restaurant?.rating || restaurant?.averageRating || 4.8)

  return (
    <section className="relative h-[180px] w-full overflow-hidden sm:h-[260px] lg:h-[340px]">

      {/* IMAGE */}
      <img
        src={getOptimizedImage(coverImage, 1200)}
        alt="Image de couverture"
        className="h-full w-full object-cover object-center"
      />

      {/* OVERLAY PREMIUM */}
      <div className="absolute inset-0">

        {/* overlay principal */}
        <div className="absolute inset-0 bg-black/40" />

        {/* gradient haut (pour header) */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/20 to-transparent" />

        {/* gradient bas (lisibilité infos) */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
      </div>

      {/* INFOS */}
      <div className="absolute bottom-5 left-4 right-4 mx-auto max-w-6xl sm:bottom-8 sm:px-6 lg:px-8">

        <div className="flex flex-wrap gap-2 sm:gap-3">

          {/* STATUS */}
          <div className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md sm:px-4 sm:py-2 sm:text-sm">
            <span
              className={`h-2 w-2 rounded-full ${
                isOpen
                  ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.8)]"
                  : "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]"
              }`}
            />
            {isOpen ? "Ouvert" : "Fermé"}
          </div>

          {/* TIME */}
          <div className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md sm:px-4 sm:py-2 sm:text-sm">
            <Clock className="h-3 w-3 text-white/80" />
            {serviceTime}
          </div>

          {/* RATING */}
          <div className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md sm:px-4 sm:py-2 sm:text-sm">
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            {Number.isFinite(rating) ? rating.toFixed(1) : "4.8"}
          </div>

        </div>

      </div>
    </section>
  )
}
