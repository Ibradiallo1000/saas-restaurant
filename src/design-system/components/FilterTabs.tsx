"use client"

type FilterTab<T extends string> = {
  value: T
  label: string
  count?: number
}

type FilterTabsProps<T extends string> = {
  tabs: Array<FilterTab<T>>
  value: T
  onChange: (value: T) => void
}

export function FilterTabs<T extends string>({
  tabs,
  value,
  onChange,
}: FilterTabsProps<T>) {
  return (
    <div className="flex gap-2 flex-wrap pb-2">
      {tabs.map((tab) => {
        const isActive = value === tab.value

        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={`
              flex items-center rounded-full transition-all duration-200
              ${isActive 
                ? "px-4 py-2 bg-[var(--color-primary)] text-white font-semibold shadow-sm" 
                : "px-4 py-2 bg-muted text-muted-foreground hover:bg-muted/80"
              }
            `}
          >
            <span className="text-sm">{tab.label}</span>
            {typeof tab.count === "number" ? (
              <span className="ml-2 text-xs opacity-70 font-medium">
                ({tab.count})
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
