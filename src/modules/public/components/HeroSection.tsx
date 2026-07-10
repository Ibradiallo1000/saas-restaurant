"use client"

import { Clock, MapPin, Star } from "lucide-react"
import { getOptimizedImage } from "@/lib/image"
import type { RestaurantTableRecord } from "@/services/table-session.service"

export default function HeroSection({
  restaurant,
  table,
}: {
  restaurant: any
  table?: RestaurantTableRecord | null
}) {
  const coverImage =
    restaurant?.coverImage ||
    restaurant?.coverImageUrl ||
    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1200"

  const isOpen = restaurant?.isOpen !== false && restaurant?.status !== "closed"

  const serviceTime =
    restaurant?.serviceTime ||
    restaurant?.deliveryTime ||
    restaurant?.estimatedTime

  const rawRating = restaurant?.rating || restaurant?.averageRating
  const rating = rawRating !== undefined && rawRating !== null ? Number(rawRating) : null

  return (
    <section className="relative h-[120px] w-full overflow-hidden sm:h-[190px] lg:h-[245px]">

      {/* IMAGE */}
      <img
        src={getOptimizedImage(coverImage, 1200)}
        alt="Image de couverture"
        className="h-full w-full object-cover object-center"
      />

      {/* OVERLAY PREMIUM */}
      <div className="absolute inset-0">

        {/* overlay principal */}
        <div className="absolute inset-0 bg-black/38" />

        {/* gradient haut (pour header) */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/25 to-transparent" />

        {/* gradient bas (lisibilité infos) */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/78 via-black/18 to-transparent" />

        {/* accent chaud discret */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_88%,rgb(var(--brand-primary-rgb)/0.28),transparent_32rem)]" />
      </div>

      {/* INFOS */}
      <div className="absolute bottom-3 left-4 right-4 mx-auto max-w-6xl sm:bottom-5 sm:px-6 lg:px-8">

        <div className="flex flex-wrap gap-1.5 sm:gap-2.5">

          {/* STATUS */}
          <div className="flex items-center gap-1.5 rounded-full border border-white/25 bg-white/[0.14] px-2.5 py-1.5 text-xs font-black text-white shadow-lg shadow-black/10 backdrop-blur-md sm:px-3.5 sm:py-1.5 sm:text-sm">
            <span
              className={`h-2 w-2 rounded-full ${
                isOpen
                  ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.8)]"
                  : "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]"
              }`}
            />
            {isOpen ? "Ouvert" : "Fermé"}
          </div>

          {/* TABLE */}
          {table ? (
            <div className="flex items-center gap-1.5 rounded-full border border-white/25 bg-white/[0.14] px-2.5 py-1.5 text-xs font-black text-white shadow-lg shadow-black/10 backdrop-blur-md sm:px-3.5 sm:py-1.5 sm:text-sm">
              <MapPin className="h-3 w-3 text-white/80" />
              {table.name || table.id}
            </div>
          ) : null}

          {/* TIME */}
          {serviceTime ? (
            <div className="flex items-center gap-1.5 rounded-full border border-white/25 bg-white/[0.14] px-2.5 py-1.5 text-xs font-black text-white shadow-lg shadow-black/10 backdrop-blur-md sm:px-3.5 sm:py-1.5 sm:text-sm">
              <Clock className="h-3 w-3 text-white/80" />
              {serviceTime}
            </div>
          ) : null}

          {/* RATING */}
          {rating !== null && Number.isFinite(rating) ? (
            <div className="flex items-center gap-1.5 rounded-full border border-white/25 bg-white/[0.14] px-2.5 py-1.5 text-xs font-black text-white shadow-lg shadow-black/10 backdrop-blur-md sm:px-3.5 sm:py-1.5 sm:text-sm">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              {rating.toFixed(1)}
            </div>
          ) : null}

        </div>

      </div>
    </section>
  )
}
