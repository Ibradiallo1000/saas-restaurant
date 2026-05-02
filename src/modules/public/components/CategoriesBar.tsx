"use client"

export default function CategoriesBar({
  categories,
  activeId,
  onSelect,
}: {
  categories: { id: string; name: string }[]
  activeId: string
  onSelect: (id: string) => void
}) {
  return (
    <div className="sticky top-[96px] bg-background/95 border-b">

      <div className="flex gap-2 overflow-x-auto px-4 py-3 no-scrollbar">

        {categories.map((cat) => {
          const isActive = activeId === cat.id

          return (
            <button
              key={cat.id}
              onClick={() => onSelect(cat.id)}
              className={`
                px-4 py-2 rounded-full text-sm whitespace-nowrap transition-all
                ${
                  isActive
                    ? "bg-[var(--color-primary)] text-white shadow-md scale-[1.02]"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }
              `}
            >
              {cat.name}
            </button>
          )
        })}

      </div>
    </div>
  )
}
