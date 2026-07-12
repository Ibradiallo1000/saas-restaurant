"use client"

import * as React from "react"

import { getOptimizedImage } from "@/lib/image"
import PublicSectionTitle from "./PublicSectionTitle"

export default function CategoriesBar({
  categories,
  activeId,
  onSelect,
}: {
  categories: { id: string; name: string; imageUrl?: string }[]
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
      const offset =
        activeEl.offsetLeft -
        container.clientWidth / 2 +
        activeEl.clientWidth / 2

      container.scrollTo({
        left: offset,
        behavior: "smooth",
      })
    }
  }, [activeId])

  return (
    <div className="mb-2">
      <div className="mb-2 flex items-center justify-between px-4 sm:px-6 lg:px-8">
        <PublicSectionTitle title="Catégories" />
      </div>

      <div
        ref={containerRef}
        className="no-scrollbar flex gap-2.5 overflow-x-auto px-4 py-1.5 sm:gap-3 sm:px-6 lg:px-8"
        style={{ overflowY: "visible" }}
      >
        {categories.map((cat) => {
          const isActive = activeId === cat.id
          const image = getOptimizedImage(cat.imageUrl || "", 200)

          return (
            <button
              key={cat.id}
              data-active={isActive}
              onClick={() => onSelect(cat.id)}
              className={`
                relative z-10 flex h-[108px] w-[78px] shrink-0 flex-col items-center justify-center gap-1.5
                rounded-[1.05rem] border px-2 py-2 text-center transition-all duration-200 ease-out sm:h-[116px] sm:w-[86px]
                ${
                  isActive
                    ? "scale-[1.015] border-[var(--brand-primary)] bg-[var(--brand-primary-soft)] text-[var(--brand-primary)] shadow-[0_8px_18px_rgba(15,23,42,0.09)] dark:shadow-[0_8px_20px_rgba(0,0,0,0.24)]"
                    : "border-[var(--public-card-border)] bg-[var(--bg-card)] text-[var(--public-text-main)] shadow-[0_5px_14px_rgba(15,23,42,0.055)] hover:border-[var(--brand-primary)]/30 dark:shadow-[0_6px_16px_rgba(0,0,0,0.20)]"
                }
              `}
            >
              <div
                className={`h-[56px] w-[56px] shrink-0 overflow-hidden rounded-[0.9rem] bg-[var(--brand-primary-soft)] shadow-inner sm:h-[62px] sm:w-[62px] ${
                  isActive
                    ? "border border-[var(--brand-primary)]/30"
                    : "border border-[var(--public-card-border)]"
                }`}
              >
                {image ? (
                  <img
                    src={image}
                    alt={cat.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-muted" />
                )}
              </div>

              <span
                className={`line-clamp-2 min-h-[30px] w-full text-xs font-black leading-[15px] sm:text-[13px] sm:leading-4 ${
                  isActive
                    ? "text-[var(--brand-primary)]"
                    : "text-[var(--public-text-main)]"
                }`}
              >
                {cat.name}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
