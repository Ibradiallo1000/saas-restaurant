"use client"

import { Utensils } from "lucide-react"

export default function PublicSectionTitle({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--brand-primary)]/15 bg-[var(--brand-primary-soft)] text-[var(--brand-primary)] shadow-[0_5px_14px_rgba(15,23,42,0.06)] dark:bg-slate-900/70 sm:h-8 sm:w-8">
        <Utensils className="h-3.5 w-3.5 stroke-[2] sm:h-4 sm:w-4" />
      </span>
      <h2 className="min-w-0 truncate text-lg font-semibold leading-none tracking-[0.0125em] text-[var(--public-text-main)] sm:text-xl">
        {title}
      </h2>
    </div>
  )
}
