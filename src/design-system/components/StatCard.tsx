"use client"

import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { Card } from "./Card"

type StatCardProps = {
  icon: LucideIcon
  title: string
  value: ReactNode
  description?: ReactNode
}

export function StatCard({
  icon: Icon,
  title,
  value,
  description,
}: StatCardProps) {
  return (
    <Card className="min-w-0 overflow-hidden p-3 sm:p-5">
      <div className="mb-3 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--color-primary)" }} />
        <span className="min-w-0 break-words text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          {title}
        </span>
      </div>
      <div
        className="min-w-0 max-w-full overflow-hidden whitespace-nowrap text-xl font-black italic tracking-tighter sm:text-2xl"
        style={{ color: "var(--color-primary)" }}
      >
        {value}
      </div>
      {description ? (
        <p className="mt-1 break-words text-[10px] font-medium text-muted-foreground">
          {description}
        </p>
      ) : null}
    </Card>
  )
}
