"use client"

import * as React from "react"
import { Utensils } from "lucide-react"

import { PublicCategoryCard, SectionHeader } from "@/components/public-ui"
import { getOptimizedImage } from "@/lib/image"
import { getMarketplaceCategoryIcon } from "@/lib/marketplace-category-icons"

export default function CategoriesBar({
  categories,
  activeId,
  onSelect,
}: {
  categories: { id: string; name: string; imageUrl?: string; iconKey?: string | null }[]
  activeId: string
  onSelect: (id: string) => void
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const activeEl = containerRef.current?.querySelector(
      `[data-active="true"]`
    ) as HTMLElement | null

    if (activeEl && containerRef.current) {
      const container = containerRef.current
      const isFullyVisible =
        activeEl.offsetLeft >= container.scrollLeft &&
        activeEl.offsetLeft + activeEl.offsetWidth <=
          container.scrollLeft + container.clientWidth

      if (isFullyVisible) return

      const offset =
        activeEl.offsetLeft -
        container.clientWidth / 2 +
        activeEl.clientWidth / 2

      container.scrollTo({
        left: offset,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      })
    }
  }, [activeId])

  return (
    <div className="mb-2">
      <div className="mb-2 flex items-center justify-between px-4 sm:px-6 lg:px-8">
        <SectionHeader
          title="Catégories"
          icon={<Utensils />}
          variant="catalog"
          size="md"
          headingAs="h2"
        />
      </div>

      <div
        ref={containerRef}
        className="no-scrollbar flex gap-2 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden px-4 py-1 sm:gap-3 sm:px-6 lg:px-8"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {categories.map((cat) => {
          const isActive = activeId === cat.id
          const image = getOptimizedImage(cat.imageUrl || "", 200)
          const Icon = getMarketplaceCategoryIcon(cat.iconKey)

          return (
            <PublicCategoryCard
              key={cat.id}
              data-active={isActive}
              label={cat.name}
              imageUrl={image || undefined}
              imageAlt={cat.name}
              fallback={<Icon className="size-5 text-[var(--brand-primary)]" />}
              active={isActive}
              onSelect={() => onSelect(cat.id)}
            />
          )
        })}
      </div>
    </div>
  )
}
