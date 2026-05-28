"use client"

import * as React from "react"
import { getOptimizedImage } from "@/lib/image"

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
    <div className="mb-6">

      {/* HEADER */}
      <div className="mb-3 flex items-center justify-between px-4 sm:px-6 lg:px-8">
        <h2 className="text-lg font-black text-foreground sm:text-xl">
          Catégories
        </h2>

        <button className="hidden text-sm font-bold text-[var(--color-primary)] sm:inline-flex">
          Voir tout
        </button>
      </div>

      {/* LIST */}
      <div
        ref={containerRef}
        className="no-scrollbar flex gap-3 overflow-x-auto px-4 py-2 sm:px-6 lg:px-8"
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
                min-w-[86px] rounded-2xl border p-2 transition-all duration-200 sm:min-w-[104px] sm:p-3
                ${
                  isActive
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 shadow-sm scale-[1.02]"
                    : "border-border bg-card"
                }
              `}
            >
              {/* IMAGE */}
              <div className="h-14 w-14 overflow-hidden rounded-full sm:h-16 sm:w-16">
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
                  mt-1 max-w-[74px] text-center text-xs font-semibold leading-tight line-clamp-2 sm:max-w-[88px]
                  ${
                    isActive
                      ? "text-[var(--color-primary)]"
                      : "text-muted-foreground"
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
