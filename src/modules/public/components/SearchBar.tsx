"use client"

import { Search } from "lucide-react"

export default function SearchBar({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="px-4">
      <div className="relative">

        {/* INPUT */}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Rechercher un plat..."
          className="h-14 w-full rounded-2xl border bg-card pl-4 pr-12 text-sm font-semibold text-card-foreground shadow-sm outline-none transition-all placeholder:text-muted-foreground focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10"
        />

        {/* ICON ACTION */}
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-xl bg-[var(--color-primary)] text-white flex items-center justify-center shadow-md active:scale-95 transition"
        >
          <Search className="h-5 w-5" />
        </button>

      </div>
    </div>
  )
}
