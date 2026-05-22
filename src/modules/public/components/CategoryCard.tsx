"use client"

import { ChefHat } from "lucide-react"

type CategoryCardProps = {
  category: any
  onSelect: (category: any) => void
}

export default function CategoryCard({ category, onSelect }: CategoryCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(category)}
      className="flex min-w-0 flex-col items-center text-center transition active:scale-95"
    >
      <div className="relative h-24 w-24 overflow-hidden rounded-full border-4 border-[var(--color-primary)] bg-card shadow-sm">
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

      <p className="mt-2 max-w-28 px-1 text-xs font-bold leading-tight text-gray-800 dark:text-white">
        {category.name}
      </p>
    </button>
  )
}
