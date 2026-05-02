"use client"

import { Clock } from "lucide-react"
import { getOptimizedImage } from "@/lib/image"

export default function HeroSection({ restaurant }: { restaurant: any }) {
  const name = restaurant?.name || "Restaurant"
  const coverImage =
    restaurant?.coverImage ||
    restaurant?.coverImageUrl ||
    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1200"

  return (
    <section className="relative h-[120px] w-full overflow-hidden bg-gray-900">
      <img
        src={getOptimizedImage(coverImage, 1200)}
        alt={`${name} cover`}
        width={1200}
        height={400}
        className="h-full w-full object-cover object-top"
      />

      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/40" />

      <div className="absolute bottom-3 left-4 right-4">
        <h1 className="text-xl font-black leading-tight text-white drop-shadow-md">
          {name}
        </h1>

        <div className="mt-1 flex items-center gap-2 text-[12px] font-bold text-white/90">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          Ouvert
          <span className="text-white/50">•</span>
          <Clock className="h-3 w-3" />
          25-35 min
        </div>
      </div>
    </section>
  )
}
