import * as React from "react"
import { getMarketplaceCategoryIcon } from "@/lib/marketplace-category-icons"
import { cn } from "@/lib/utils"
import type { MarketplaceCategoryPresentation } from "./marketplace-foundations"

export interface MarketplaceCategoryRailProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onSelect"> {
  categories: MarketplaceCategoryPresentation[]
  onSelect: (category: MarketplaceCategoryPresentation) => void
  label?: string
  itemsPerPage?: number
}

export const MarketplaceCategoryRail = React.forwardRef<HTMLDivElement, MarketplaceCategoryRailProps>(
  ({ 
    categories, 
    className, 
    label = "Catégories alimentaires", 
    onSelect, 
    itemsPerPage = 5, // Augmenté à 5 car les cartes sont plus compactes
    ...props 
  }, ref) => {
    const containerRef = React.useRef<HTMLDivElement>(null)
    const [scrollState, setScrollState] = React.useState({
      canScrollLeft: false,
      canScrollRight: false,
      scrollProgress: 0,
    })
    const [isDragging, setIsDragging] = React.useState(false)
    const [startX, setStartX] = React.useState(0)
    const [scrollLeft, setScrollLeft] = React.useState(0)

    const updateScrollState = React.useCallback(() => {
      const container = containerRef.current
      if (!container) return

      const { scrollLeft, scrollWidth, clientWidth } = container
      const maxScroll = scrollWidth - clientWidth
      const canScrollLeft = scrollLeft > 1
      const canScrollRight = scrollLeft < maxScroll - 1
      const scrollProgress = maxScroll > 0 ? scrollLeft / maxScroll : 0

      setScrollState({
        canScrollLeft,
        canScrollRight,
        scrollProgress,
      })
    }, [])

    React.useEffect(() => {
      const container = containerRef.current
      if (!container) return

      const handleScroll = () => updateScrollState()
      const handleResize = () => updateScrollState()

      container.addEventListener("scroll", handleScroll, { passive: true })
      window.addEventListener("resize", handleResize, { passive: true })

      updateScrollState()

      return () => {
        container.removeEventListener("scroll", handleScroll)
        window.removeEventListener("resize", handleResize)
      }
    }, [updateScrollState])

    const activeIndex = React.useMemo(() => {
      const container = containerRef.current
      if (!container || !categories.length) return 0

      const progress = container.scrollLeft / Math.max(1, container.scrollWidth - container.clientWidth)
      const maxPage = Math.max(0, Math.ceil(categories.length / itemsPerPage) - 1)

      return Math.round(progress * maxPage)
    }, [scrollState.scrollProgress, categories.length, itemsPerPage])

    const handleMouseDown = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      const container = containerRef.current
      if (!container) return

      setIsDragging(true)
      setStartX(e.pageX - container.offsetLeft)
      setScrollLeft(container.scrollLeft)
      container.style.cursor = "grabbing"
      container.style.userSelect = "none"
    }, [])

    const handleMouseMove = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      if (!isDragging) return
      const container = containerRef.current
      if (!container) return

      const x = e.pageX - container.offsetLeft
      const walk = (x - startX) * 1.5
      container.scrollLeft = scrollLeft - walk
    }, [isDragging, startX, scrollLeft])

    const handleMouseUp = React.useCallback(() => {
      const container = containerRef.current
      if (!container) return

      setIsDragging(false)
      container.style.cursor = "grab"
      container.style.userSelect = ""
    }, [])

    const handleMouseLeave = React.useCallback(() => {
      if (isDragging) {
        const container = containerRef.current
        if (container) {
          container.style.cursor = "grab"
          container.style.userSelect = ""
        }
        setIsDragging(false)
      }
    }, [isDragging])

    const scrollToPage = React.useCallback((pageIndex: number) => {
      const container = containerRef.current
      if (!container) return

      const targetIndex = pageIndex * itemsPerPage
      const elements = container.querySelectorAll<HTMLElement>("[data-category-index]")
      const targetElement = elements[targetIndex]
      
      if (targetElement) {
        const containerRect = container.getBoundingClientRect()
        const targetRect = targetElement.getBoundingClientRect()
        const scrollOffset = targetRect.left - containerRect.left + container.scrollLeft - 8

        container.scrollTo({
          left: scrollOffset,
          behavior: "smooth",
        })
      }
    }, [itemsPerPage])

    const handleKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
      const container = containerRef.current
      if (!container) return

      if (e.key === "ArrowRight") {
        e.preventDefault()
        container.scrollBy({ left: 200, behavior: "smooth" })
      } else if (e.key === "ArrowLeft") {
        e.preventDefault()
        container.scrollBy({ left: -200, behavior: "smooth" })
      } else if (e.key === "Home") {
        e.preventDefault()
        container.scrollTo({ left: 0, behavior: "smooth" })
      } else if (e.key === "End") {
        e.preventDefault()
        container.scrollTo({ left: container.scrollWidth, behavior: "smooth" })
      }
    }, [])

    if (!categories || categories.length === 0) {
      return null
    }

    const showIndicators = categories.length > itemsPerPage
    const totalPages = Math.ceil(categories.length / itemsPerPage)

    return (
      <div className="space-y-2.5">
        {/* Rail container */}
        <div
          ref={containerRef}
          aria-label={label}
          className={cn(
            "marketplace-rail flex gap-2.5 overflow-x-auto pb-1 cursor-grab scrollbar-hide",
            className
          )}
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          {...props}
        >
          {categories.map((category, index) => {
            const Icon = getMarketplaceCategoryIcon(category.iconKey)
            const isActive = category.active || false

            return (
              <button
                key={category.id}
                type="button"
                aria-pressed={isActive}
                disabled={category.disabled}
                data-category-index={index}
                onClick={() => onSelect(category)}
                className={cn(
                  // ✅ Taille réduite : 5.2rem au lieu de 6rem
                  "marketplace-reduced-motion group flex min-h-[5.2rem] min-w-[5.2rem] shrink-0 flex-col items-center justify-center",
                  // ✅ Espacements réduits
                  "gap-1.5 rounded-[var(--radius-public-2xl)] border border-[var(--marketplace-border-subtle)]",
                  "bg-[var(--marketplace-surface-card)] px-2.5 py-2.5 text-center",
                  // ✅ Texte plus petit
                  "text-[12px] font-public-bold text-[var(--text-secondary)]",
                  "shadow-[var(--shadow-public-xs)] outline-none",
                  "transition-[border-color,background-color,color,box-shadow,transform]",
                  "focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  "hover:border-[var(--brand-primary)]/30 hover:bg-[var(--marketplace-category-active-bg)]/50 hover:shadow-[var(--shadow-public-sm)]",
                  isActive && "border-[var(--brand-primary)] bg-[var(--marketplace-category-active-bg)] text-[var(--brand-primary)] shadow-[var(--shadow-public-sm)]",
                  "active:scale-[0.97] motion-reduce:transform-none"
                )}
              >
                {/* ✅ Icône plus petite : size-9 au lieu de size-11 */}
                <span className="flex size-9 items-center justify-center overflow-hidden rounded-full bg-[var(--marketplace-category-icon-bg)] text-[var(--brand-primary)] ring-1 ring-[var(--brand-primary)]/10">
                  {category.imageUrl ? (
                    <img src={category.imageUrl} alt="" className="size-full object-cover" />
                  ) : (
                    // ✅ Icône plus petite : size-4 au lieu de size-5
                    category.icon ?? <Icon aria-hidden="true" className="size-4" />
                  )}
                </span>
                <span className="max-w-20 line-clamp-2 leading-4">{category.label}</span>
              </button>
            )
          })}
        </div>

        {/* Indicateurs de pages */}
        {showIndicators && (
          <div className="flex items-center justify-center gap-1.5 py-0.5">
            {Array.from({ length: totalPages }).map((_, pageIndex) => {
              const isActive = pageIndex === activeIndex

              return (
                <button
                  key={`indicator-${pageIndex}`}
                  type="button"
                  aria-label={`Page ${pageIndex + 1} sur ${totalPages}`}
                  aria-selected={isActive}
                  onClick={() => scrollToPage(pageIndex)}
                  className={cn(
                    "rounded-full transition-all duration-300 ease-out",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2",
                    isActive
                      ? "h-2 w-6 bg-[var(--brand-primary)] shadow-[0_2px_8px_rgb(var(--brand-primary-rgb)/0.30)]"
                      : "h-1.5 w-1.5 bg-[var(--text-muted)]/30 hover:bg-[var(--text-muted)]/50"
                  )}
                />
              )
            })}
          </div>
        )}
      </div>
    )
  }
)

MarketplaceCategoryRail.displayName = "MarketplaceCategoryRail"