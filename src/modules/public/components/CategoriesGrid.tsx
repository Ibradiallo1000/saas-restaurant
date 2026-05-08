"use client"

import * as React from "react"
import { ChefHat } from "lucide-react"

export default function CategoriesGrid({
  categories,
  onSelect,
}: {
  categories: any[]
  onSelect: (category: any) => void
}) {
  return (
    <div className="grid grid-cols-3 gap-4 px-4">
      {categories.map((category) => {
        return (
          <button
            key={category.id}
            onClick={() => onSelect(category)}
            className="flex flex-col items-center text-center active:scale-95 transition"
          >
            {/* IMAGE CERCLE (PLUS GRANDE) */}
            <div className="relative h-24 w-24 rounded-full overflow-hidden border-4 border-[var(--color-primary)] shadow-sm">
              {category.imageUrl ? (
                <img
                  src={category.imageUrl}
                  alt={category.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
                  <ChefHat className="h-8 w-8" />
                </div>
              )}
            </div>

            {/* NOM (PLUS VISIBLE) */}
            <p className="mt-2 text-sm font-bold leading-tight text-gray-800 dark:text-white">
              {category.name}
            </p>
          </button>
        )
      })}
    </div>
  )
}