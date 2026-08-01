"use client"

import { useSearchParams } from "next/navigation"
import { AlertTriangle, Banknote, Boxes, ImageIcon, LayoutDashboard, MenuSquare, Package, ReceiptText, Settings, ShoppingCart, Star, Table2, Truck, Wallet, type LucideIcon } from "lucide-react"

import { NavigationTile, PageHeader, ResponsiveTileGrid } from "@/design-system/components"
import {
  preserveOwnerTimeParams,
  type OwnerNavigationIcon,
  type OwnerNavigationItem,
} from "@/config/owner-navigation"

export function OwnerNavigationHub({
  title,
  subtitle,
  items,
}: {
  title: string
  subtitle?: string
  items: OwnerNavigationItem[]
}) {
  const searchParams = useSearchParams()

  return (
    <main className="space-y-5 pb-24 md:space-y-6 md:pb-8">
      <PageHeader title={title} subtitle={subtitle} density="compact" />
      <ResponsiveTileGrid role="navigation" aria-label={`Accès ${title.toLowerCase()}`} desktopColumns={5}>
        {items.map((item) => (
          <NavigationTile
            key={item.id}
            variant={getNavigationVariant(item.id)}
            href={preserveOwnerTimeParams(item.href, searchParams)}
            title={item.label}
            icon={renderNavigationIcon(item.icon)}
          />
        ))}
      </ResponsiveTileGrid>
    </main>
  )
}

function getNavigationVariant(id: string) {
  if (id === "orders" || id === "activity") return "activity" as const
  if (id === "cash") return "finance" as const
  if (id === "treasury" || id === "movements") return "info" as const
  if (id === "stock" || id === "articles" || id === "supplies") return "stock" as const
  if (id === "stock-alerts") return "danger" as const
  if (id === "expenses" || id === "suppliers") return "warning" as const
  return "neutral" as const
}

const ICONS: Record<OwnerNavigationIcon, LucideIcon> = {
  activity: ReceiptText,
  articles: Boxes,
  cash: Wallet,
  dashboard: LayoutDashboard,
  expenses: ReceiptText,
  images: ImageIcon,
  menu: MenuSquare,
  movements: ReceiptText,
  orders: ShoppingCart,
  reviews: Star,
  settings: Settings,
  stock: Package,
  "stock-alerts": AlertTriangle,
  suppliers: Truck,
  supplies: ShoppingCart,
  tables: Table2,
  treasury: Banknote,
}

function renderNavigationIcon(name: OwnerNavigationIcon) {
  const Icon = ICONS[name]
  return <Icon />
}
