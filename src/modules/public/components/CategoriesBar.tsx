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
    <div className="mb-4">
      <div className="mb-3 flex items-center justify-between px-4 sm:px-6 lg:px-8">
        <PublicSectionTitle title="Catégories" />
      </div>

      <div
        ref={containerRef}
        className="no-scrollbar flex gap-4 overflow-x-auto px-4 py-2.5 sm:px-6 lg:px-8"
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
                relative z-10 flex h-[58px] min-w-[135px] shrink-0 items-center gap-3
                rounded-full border bg-white px-2.5 py-2 pr-4 transition-all duration-200 ease-out
                ${
                  isActive
                    ? "scale-[1.01] border-[var(--brand-primary)] bg-[var(--brand-primary-soft)] text-[var(--brand-primary)] shadow-[0_12px_26px_rgba(15,23,42,0.10)]"
                    : "border-slate-200 text-slate-900 shadow-[0_8px_22px_rgba(15,23,42,0.07)] hover:border-[var(--brand-primary)]/30 hover:shadow-[0_10px_26px_rgba(15,23,42,0.09)]"
                }
              `}
            >
              <div
                className={`h-[42px] w-[42px] shrink-0 overflow-hidden rounded-full bg-[var(--brand-primary-soft)] shadow-inner ${
                  isActive
                    ? "border border-[var(--brand-primary)]/30"
                    : "border border-slate-100"
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
                className={`whitespace-nowrap text-[15px] font-semibold leading-none ${
                  isActive
                    ? "text-[var(--brand-primary)]"
                    : "text-slate-900"
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
