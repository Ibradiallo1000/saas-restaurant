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
      className="flex min-w-0 flex-col items-center rounded-[1.5rem] border border-[var(--public-card-border)] bg-[var(--public-card-bg)] p-3 text-center shadow-[0_14px_35px_rgba(15,23,42,0.08)] backdrop-blur-xl transition active:scale-95"
    >
      <div className="relative h-24 w-24 overflow-hidden rounded-full border-4 border-[var(--brand-primary)]/70 bg-[var(--brand-primary-soft)] shadow-sm">
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

      <p className="mt-2 max-w-28 px-1 text-xs font-black leading-tight text-[var(--public-text-main)]">
        {category.name}
      </p>
    </button>
  )
}
