"use client"

import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

type PageHeaderProps = {
  icon: LucideIcon
  title: string
  subtitle?: string
  action?: ReactNode
}

export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  action,
}: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h1
          className="flex items-center gap-3 text-4xl font-black italic uppercase tracking-tighter"
          style={{ color: "var(--color-primary)" }}
        >
          <Icon className="h-10 w-10" />
          {title}
        </h1>
        {subtitle ? (
          <p className="text-muted-foreground font-medium">{subtitle}</p>
        ) : null}
      </div>

      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  )
}
