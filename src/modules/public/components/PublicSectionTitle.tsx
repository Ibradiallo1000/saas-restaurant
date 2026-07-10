"use client"

import { Utensils } from "lucide-react"

export default function PublicSectionTitle({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--brand-primary)]/15 bg-[var(--brand-primary-soft)] text-[var(--brand-primary)] shadow-[0_8px_22px_rgba(15,23,42,0.08)] dark:bg-slate-900/70 sm:h-9 sm:w-9">
        <Utensils className="h-4 w-4 stroke-[2] sm:h-[18px] sm:w-[18px]" />
      </span>
      <h2 className="min-w-0 truncate text-xl font-semibold leading-none tracking-[0.0125em] text-[var(--public-text-main)] sm:text-2xl">
        {title}
      </h2>
    </div>
  )
}
