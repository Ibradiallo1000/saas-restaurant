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
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          {title}
        </span>
        <Icon className="h-4 w-4" style={{ color: "var(--color-primary)" }} />
      </div>
      <div
        className="text-2xl font-black italic tracking-tighter"
        style={{ color: "var(--color-primary)" }}
      >
        {value}
      </div>
      {description ? (
        <p className="text-[10px] font-medium text-muted-foreground">
          {description}
        </p>
      ) : null}
    </Card>
  )
}
