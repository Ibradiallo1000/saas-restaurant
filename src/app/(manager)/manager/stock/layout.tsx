import type { ReactNode } from "react"
import { SectionNavigation } from "@/design-system/components"

const STOCK_SECTIONS = [
  { label: "Articles", href: "/manager/stock" },
  { label: "Contrôles", href: "/manager/stock/controls" },
  { label: "Réapprovisionnement", href: "/manager/stock/replenishment" },
  { label: "Historique", href: "/manager/stock/history" },
  { label: "Chronologie", href: "/manager/stock/timeline" },
  { label: "Rapports", href: "/manager/stock/reports" },
]

export default function ManagerStockLayout({ children }: { children: ReactNode }) {
  return <div className="space-y-4"><SectionNavigation parentHref="/manager/stock" parentLabel="Stock" items={STOCK_SECTIONS} showBack={false} />{children}</div>
}
