"use client"

import { Utensils } from "lucide-react"

export default function PublicSectionTitle({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--public-orange)]/15 bg-[#fffaf3] text-[var(--public-orange)] shadow-[0_8px_22px_rgba(249,115,22,0.10)] dark:bg-slate-900/70">
        <Utensils className="h-5 w-5 stroke-[2]" />
      </span>
      <h2 className="min-w-0 truncate text-[1.7rem] font-semibold leading-none tracking-[0.0125em] text-[var(--public-text-main)] sm:text-[2.05rem]">
        {title}
      </h2>
    </div>
  )
}
