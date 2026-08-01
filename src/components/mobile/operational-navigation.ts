import {
  Activity,
  AlertTriangle,
  Banknote,
  ClipboardList,
  ImageIcon,
  LayoutDashboard,
  LogOut,
  MenuSquare,
  Package,
  PackagePlus,
  ReceiptText,
  Settings,
  Star,
  Table2,
  Truck,
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
import {
  OWNER_MOBILE_PRIMARY_ITEMS,
  OWNER_MORE_SECTIONS,
  type OwnerNavigationIcon,
} from "@/config/owner-navigation"

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
      label: string
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
  analytics: { id: "analytics", label: "Accueil", href: "/manager/dashboard", icon: LayoutDashboard },
  activite: null,
  commandes: { id: "orders", label: "Commandes", href: "/manager/commandes", icon: ClipboardList },
  caisse: { id: "cash", label: "Caisse", href: "/manager/caisse", icon: Wallet },
  cuisine: null,
  finances: null,
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
  stock: { id: "stock", label: "Stock", href: "/manager/stock", icon: Package },
  fournisseurs: null,
  horaires: null,
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
  images: { type: "link", id: "images", label: "Médias", href: "/images", icon: ImageIcon },
  inventaire: {
    type: "link",
    id: "inventory",
    label: "Inventaire",
    href: "/manager/inventory",
    icon: Package,
  },
  fournisseurs: { type: "link", id: "suppliers", label: "Fournisseurs", href: "/manager/suppliers", icon: Truck },
  horaires: { type: "link", id: "hours", label: "Horaires", href: "/manager/hours", icon: Activity },
  deconnexion: { type: "logout", id: "logout", label: "Déconnexion", icon: LogOut },
  analytics: null,
  activite: null,
  commandes: null,
  caisse: null,
  cuisine: null,
  finances: null,
  plus: null,
  stock: null,
}

export function getNavigationByRole(role: string | null | undefined): OperationalNavigationConfig {
  if (role === ROLES.OWNER) return getOwnerNavigation()

  const bottomItems = getBottomNavByRole(role)
    .map((id) => bottomNavItemMap[id])
    .filter((item): item is OperationalNavItem => Boolean(item))
  const drawerItems = getDrawerItemsByRole(role)
    .map((id) => drawerItemMap[id])
    .filter((item): item is OperationalDrawerItem => Boolean(item))
    .map((item) => {
      if (item.type === "link" && item.id === "menu") return { ...item, href: "/manager/menu" }
      if (item.type === "link" && item.id === "tables") return { ...item, href: "/manager/tables" }
      if (item.type === "link" && item.id === "images") return { ...item, href: "/manager/images" }
      return item
    })

  return {
    bottomItems,
    drawerSections: groupDrawerItems(drawerItems),
  }
}

function getOwnerNavigation(): OperationalNavigationConfig {
  const bottomItems = OWNER_MOBILE_PRIMARY_ITEMS.map((item) => ({
    id: item.id,
    label: item.label,
    href: item.href,
    icon: ownerMobileIconMap[item.icon],
  }))
  const restaurantItems: OperationalDrawerItem[] = OWNER_MORE_SECTIONS.flatMap((section) =>
    section.items.map((item) => ({
      type: "link" as const,
      id: item.id,
      label: item.label,
      href: item.href,
      icon: ownerMobileIconMap[item.icon],
    }))
  )

  return {
    bottomItems,
    drawerSections: [
      { label: "Gestion du restaurant", items: restaurantItems },
      {
        label: "Compte",
        items: [
          { type: "profile", id: "profile", label: "Profil", icon: User },
          { type: "logout", id: "logout", label: "Déconnexion", icon: LogOut },
        ],
      },
    ],
  }
}

function groupDrawerItems(items: OperationalDrawerItem[]): OperationalNavSection[] {
  const accountItems = items.filter((item) => item.type === "profile" || item.type === "logout")
  const operationItems = items.filter((item) => item.id === "tables")
  const financeItems = items.filter((item) => item.id === "treasury" || item.id === "expenses" || item.id === "suppliers")
  const teamItems = items.filter((item) => item.id === "hours")
  const configItems = items.filter((item) => ["menu", "images"].includes(item.id))

  return [
    operationItems.length ? { label: "Opérations", items: operationItems } : null,
    financeItems.length ? { label: "Finances", items: financeItems } : null,
    teamItems.length ? { label: "Équipe", items: teamItems } : null,
    configItems.length ? { label: "Configuration", items: configItems } : null,
    accountItems.length ? { label: "Compte", items: accountItems } : null,
  ].filter((section): section is OperationalNavSection => Boolean(section))
}

const ownerMobileIconMap: Record<OwnerNavigationIcon, ComponentType<{ className?: string }>> = {
  activity: Activity,
  articles: Package,
  cash: Wallet,
  dashboard: LayoutDashboard,
  expenses: ReceiptText,
  images: ImageIcon,
  menu: MenuSquare,
  movements: ClipboardList,
  orders: ClipboardList,
  reviews: Star,
  settings: Settings,
  stock: Package,
  "stock-alerts": AlertTriangle,
  suppliers: Truck,
  supplies: PackagePlus,
  tables: Table2,
  treasury: Banknote,
}
