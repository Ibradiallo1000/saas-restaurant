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
    <div className="mb-5">

      {/* HEADER */}
      <div className="mb-3 flex items-center justify-between px-4 sm:px-6 lg:px-8">
        <PublicSectionTitle title="Catégories" />

        <button className="hidden text-sm font-bold text-[var(--public-orange)] sm:inline-flex">
          Voir tout
        </button>
      </div>

      {/* LIST */}
      <div
        ref={containerRef}
        className="no-scrollbar flex gap-3 overflow-x-auto px-4 py-2.5 sm:gap-4 sm:px-6 lg:px-8"
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
                relative z-10 flex flex-col items-center shrink-0
                min-w-[98px] rounded-[1.5rem] border p-2 transition-all duration-200 sm:min-w-[112px] sm:p-2.5
                ${
                  isActive
                    ? "scale-[1.03] border-[var(--public-orange)] bg-gradient-to-br from-[#fb923c] to-[#f97316] text-white shadow-[0_18px_38px_rgba(249,115,22,0.26)]"
                    : "border-[var(--public-orange)]/25 bg-[var(--public-card-bg)] text-[var(--public-text-main)] shadow-[0_10px_28px_rgba(15,23,42,0.06)] hover:border-[var(--public-orange)]/45"
                }
                backdrop-blur-xl
              `}
            >
              {/* IMAGE */}
              <div
                className={`h-[76px] w-[76px] overflow-hidden rounded-full bg-[var(--public-orange-soft)] shadow-inner sm:h-20 sm:w-20 ${
                  isActive
                    ? "border-2 border-white"
                    : "border border-[var(--public-orange)]/15"
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

              {/* LABEL */}
              <span
                className={`
                  mt-2.5 max-w-[82px] text-center text-[13px] font-black leading-tight line-clamp-2 sm:max-w-[94px] sm:text-sm
                  ${
                    isActive
                      ? "text-white"
                      : "text-[var(--public-text-main)]"
                  }
                `}
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
