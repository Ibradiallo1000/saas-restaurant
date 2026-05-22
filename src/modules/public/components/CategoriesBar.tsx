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
      <div className="flex items-center justify-between px-4 mb-3">
        <h2 className="text-lg font-black text-foreground">
          Catégories
        </h2>

        <button className="text-sm font-bold text-[var(--color-primary)]">
          Voir tout
        </button>
      </div>

      {/* LIST */}
      <div
        ref={containerRef}
        className="flex gap-3 overflow-x-auto px-4 py-2 no-scrollbar"
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
                p-2 rounded-2xl border transition-all duration-200
                ${
                  isActive
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 shadow-sm scale-[1.02]"
                    : "border-border bg-card"
                }
              `}
            >
              {/* IMAGE */}
              <div className="h-14 w-14 rounded-full overflow-hidden">
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
                  text-xs font-semibold mt-1 text-center max-w-[70px] line-clamp-2
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