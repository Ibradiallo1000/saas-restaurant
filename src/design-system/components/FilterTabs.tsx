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
    <div className="flex gap-3 overflow-x-auto pb-2">
      {tabs.map((tab) => {
        const isActive = value === tab.value

        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className="flex h-11 shrink-0 items-center gap-3 rounded-xl px-4 text-sm font-black uppercase shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            style={{
              backgroundColor: isActive ? "var(--color-primary)" : "#ffffff",
              color: isActive ? "#ffffff" : "var(--color-secondary)",
              boxShadow: isActive
                ? "0 10px 20px rgba(0,0,0,0.12)"
                : "0 1px 3px rgba(0,0,0,0.08)",
            }}
          >
            <span>{tab.label}</span>
            {typeof tab.count === "number" ? (
              <span
                className="rounded-full px-2.5 py-1 text-xs font-black"
                style={{
                  backgroundColor: isActive ? "#ffffff" : "rgba(0,0,0,0.05)",
                  color: isActive ? "var(--color-secondary)" : "inherit",
                }}
              >
                {tab.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
