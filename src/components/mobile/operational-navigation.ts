import {
  Banknote,
  ClipboardList,
  ImageIcon,
  LayoutDashboard,
  LogOut,
  MenuSquare,
  Package,
  ReceiptText,
  Settings,
  Star,
  Table2,
  User,
  Wallet,
} from "lucide-react"
import type { ComponentType } from "react"

import { ROLES } from "@/lib/constants"
import {
  getBottomNavByRole,
  getDrawerItemsByRole,
  type NavigationItemId,
} from "@/config/navigation.config"

export type OperationalNavItem = {
  id: string
  label: string
  href: string
  icon: ComponentType<{ className?: string }>
  badge?: number
}

export type OperationalDrawerItem =
  | {
      type: "profile"
      id: "profile"
      label: "Profil"
      icon: ComponentType<{ className?: string }>
    }
  | {
      type: "logout"
      id: "logout"
      label: "Deconnexion"
      icon: ComponentType<{ className?: string }>
    }
  | {
      type: "link"
      id: string
      label: string
      href: string
      icon: ComponentType<{ className?: string }>
    }

export type OperationalNavSection = {
  label: string
  items: OperationalDrawerItem[]
}

export type OperationalNavigationConfig = {
  bottomItems: OperationalNavItem[]
  drawerSections: OperationalNavSection[]
}

const bottomNavItemMap: Record<NavigationItemId, OperationalNavItem | null> = {
  analytics: { id: "analytics", label: "Dashboard", href: "/manager/dashboard", icon: LayoutDashboard },
  commandes: { id: "orders", label: "Commandes", href: "/manager/commandes", icon: ClipboardList },
  caisse: { id: "cash", label: "Caisse", href: "/manager/caisse", icon: Wallet },
  cuisine: null,
  plus: null,
  profil: null,
  parametres: null,
  tresorerie: null,
  depenses: null,
  avis: null,
  menu: null,
  tables: null,
  images: null,
  inventaire: null,
  deconnexion: null,
}

const drawerItemMap: Record<NavigationItemId, OperationalDrawerItem | null> = {
  profil: { type: "profile", id: "profile", label: "Profil", icon: User },
  parametres: { type: "link", id: "settings", label: "Paramètres", href: "/settings", icon: Settings },
  tresorerie: { type: "link", id: "treasury", label: "Trésorerie", href: "/manager/tresorerie", icon: Banknote },
  depenses: { type: "link", id: "expenses", label: "Dépenses", href: "/manager/depenses", icon: ReceiptText },
  avis: { type: "link", id: "reviews", label: "Voix du client", href: "/owner/avis", icon: Star },
  menu: { type: "link", id: "menu", label: "Menu", href: "/menu", icon: MenuSquare },
  tables: { type: "link", id: "tables", label: "Tables", href: "/tables", icon: Table2 },
  images: { type: "link", id: "images", label: "Images", href: "/images", icon: ImageIcon },
  inventaire: { type: "link", id: "inventory", label: "Inventaire", href: "/manager/inventory", icon: Package },
  deconnexion: { type: "logout", id: "logout", label: "Deconnexion", icon: LogOut },
  analytics: null,
  commandes: null,
  caisse: null,
  cuisine: null,
  plus: null,
}

export function getNavigationByRole(role: string | null | undefined): OperationalNavigationConfig {
  const isOwner = role === ROLES.OWNER
  const bottomItems = getBottomNavByRole(role)
    .map((id) => bottomNavItemMap[id])
    .filter((item): item is OperationalNavItem => Boolean(item))
    .map((item) => ({
      ...item,
      href: item.id === "analytics" && isOwner ? "/owner" : item.href,
    }))
  const drawerItems = getDrawerItemsByRole(role)
    .map((id) => drawerItemMap[id])
    .filter((item): item is OperationalDrawerItem => Boolean(item))
    .map((item) => {
      if (item.type === "link" && !isOwner) {
        if (item.id === "menu") return { ...item, href: "/manager/menu" }
        if (item.id === "tables") return { ...item, href: "/manager/tables" }
        if (item.id === "images") return { ...item, href: "/manager/images" }
      }
      return item
    })

  return {
    bottomItems,
    drawerSections: groupDrawerItems(drawerItems),
  }
}

function groupDrawerItems(items: OperationalDrawerItem[]): OperationalNavSection[] {
  const accountItems = items.filter((item) => item.type === "profile" || item.id === "settings" || item.type === "logout")
  const operationItems = items.filter((item) => item.id === "treasury" || item.id === "expenses" || item.id === "reviews")
  const configItems = items.filter((item) => ["menu", "tables", "images", "inventory"].includes(item.id))

  return [
    accountItems.length ? { label: "Compte", items: accountItems } : null,
    operationItems.length ? { label: "Operation", items: operationItems } : null,
    configItems.length ? { label: "Configuration", items: configItems } : null,
  ].filter((section): section is OperationalNavSection => Boolean(section))
}
