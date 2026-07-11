"use client"

import * as React from "react"
import { Grid3X3, Store } from "lucide-react"

import { getOptimizedImage } from "@/lib/image"
import { cn } from "@/lib/utils"

type CategorySidebarProps = {
  categories: any[]
  selectedCategoryId: string | null
  onSelectCategory: (categoryId: string | null) => void
}

export default function CategorySidebar({
  categories,
  selectedCategoryId,
  onSelectCategory,
}: CategorySidebarProps) {
  return (
    <aside className="h-full overflow-hidden rounded-[1.35rem] border bg-card/95 shadow-[0_18px_45px_rgba(15,23,42,0.07)] backdrop-blur">
      <div className="border-b px-4 py-3">
        <p className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">Catégories</p>
      </div>

      <div className="h-[calc(100%-45px)] overflow-y-auto p-2.5">
        <CategoryButton
          active={!selectedCategoryId}
          icon={<Grid3X3 className="h-5 w-5" />}
          label="Tous"
          onClick={() => onSelectCategory(null)}
        />

        <div className="mt-1 space-y-1">
          {categories.map((category: any) => (
            <CategoryButton
              key={category.id}
              active={selectedCategoryId === category.id}
              imageUrl={category.imageUrl}
              icon={<Store className="h-5 w-5" />}
              label={category.name || "Catégorie"}
              onClick={() => onSelectCategory(category.id)}
            />
          ))}
        </div>
      </div>
    </aside>
  )
}

function CategoryButton({
  active,
  icon,
  imageUrl,
  label,
  onClick,
}: {
  active: boolean
  icon: React.ReactNode
  imageUrl?: string | null
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-12 w-full items-center gap-3 rounded-full border px-2.5 text-left text-sm font-black transition-all active:scale-[0.99]",
        active
          ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white shadow-[0_12px_26px_rgba(15,23,42,0.14)]"
          : "border-transparent text-foreground hover:border-[var(--brand-primary)]/20 hover:bg-[var(--brand-primary-soft)] hover:text-[var(--brand-primary)]"
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full",
          active ? "bg-white/20 ring-1 ring-white/25" : "bg-muted text-muted-foreground"
        )}
      >
        {imageUrl ? (
          <img
            src={getOptimizedImage(imageUrl, 96)}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          icon
        )}
      </span>
      <span className="min-w-0 truncate leading-none">{label}</span>
    </button>
  )
}
