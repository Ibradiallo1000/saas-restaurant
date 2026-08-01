export type OwnerNavigationItem = {
  id: string
  label: string
  href: string
  icon: OwnerNavigationIcon
}

export type OwnerNavigationSection = {
  label: "Vue d’ensemble" | "Activité" | "Finances" | "Stock" | "Configuration"
  items: OwnerNavigationItem[]
}

export type OwnerNavigationIcon =
  | "activity"
  | "articles"
  | "cash"
  | "dashboard"
  | "expenses"
  | "images"
  | "menu"
  | "movements"
  | "orders"
  | "reviews"
  | "settings"
  | "stock"
  | "stock-alerts"
  | "suppliers"
  | "supplies"
  | "tables"
  | "treasury"

export const OWNER_SIDEBAR_SECTIONS: OwnerNavigationSection[] = [
  {
    label: "Vue d’ensemble",
    items: [{ id: "overview", label: "Vue d’ensemble", href: "/owner", icon: "dashboard" }],
  },
  {
    label: "Activité",
    items: [
      { id: "orders", label: "Commandes", href: "/owner/commandes", icon: "orders" },
      { id: "cash", label: "Caisse", href: "/owner/caisse", icon: "cash" },
      { id: "reviews", label: "Avis clients", href: "/owner/avis", icon: "reviews" },
    ],
  },
  {
    label: "Finances",
    items: [
      { id: "treasury", label: "Trésorerie", href: "/owner/tresorerie", icon: "treasury" },
      { id: "expenses", label: "Dépenses", href: "/owner/depenses", icon: "expenses" },
      { id: "supplies", label: "Achats et approvisionnements", href: "/owner/stock/supplies", icon: "supplies" },
      { id: "suppliers", label: "Fournisseurs", href: "/owner/stock/suppliers", icon: "suppliers" },
    ],
  },
  {
    label: "Stock",
    items: [
      { id: "stock", label: "Synthèse du stock", href: "/owner/stock", icon: "stock" },
      { id: "articles", label: "Articles", href: "/owner/stock/articles", icon: "articles" },
      { id: "stock-alerts", label: "Alertes", href: "/owner/stock/alerts", icon: "stock-alerts" },
      { id: "movements", label: "Mouvements", href: "/owner/stock/movements", icon: "movements" },
    ],
  },
  {
    label: "Configuration",
    items: [
      { id: "menu", label: "Menu", href: "/menu", icon: "menu" },
      { id: "tables", label: "Tables et QR codes", href: "/tables", icon: "tables" },
      { id: "media", label: "Médias", href: "/images", icon: "images" },
      { id: "settings", label: "Paramètres", href: "/settings", icon: "settings" },
    ],
  },
]

export const OWNER_MOBILE_PRIMARY_ITEMS: OwnerNavigationItem[] = [
  { id: "home", label: "Accueil", href: "/owner", icon: "dashboard" },
  { id: "activity", label: "Activité", href: "/owner/activite", icon: "activity" },
  { id: "finances", label: "Finances", href: "/owner/finances", icon: "treasury" },
  { id: "stock", label: "Stock", href: "/owner/stock", icon: "stock" },
]

export const OWNER_MORE_SECTIONS: OwnerNavigationSection[] = [
  {
    label: "Configuration",
    items: OWNER_SIDEBAR_SECTIONS.find((section) => section.label === "Configuration")?.items ?? [],
  },
]

const OWNER_ACTIVITY_PATHS = ["/owner/activite", "/owner/commandes", "/owner/avis"]
const OWNER_FINANCE_PATHS = [
  "/owner/finances",
  "/owner/caisse",
  "/owner/tresorerie",
  "/owner/depenses",
  "/owner/stock/supplies",
  "/owner/stock/suppliers",
]
const OWNER_STOCK_PATHS = [
  "/owner/stock",
  "/owner/stock/articles",
  "/owner/stock/alerts",
  "/owner/stock/movements",
]
const OWNER_MORE_PATHS = ["/menu", "/tables", "/images", "/settings"]

export type OwnerMobileDestination = "home" | "activity" | "finances" | "stock" | "more" | null

export function getOwnerMobileDestination(pathname: string): OwnerMobileDestination {
  const path = normalizePath(pathname)
  if (path === "/owner") return "home"
  if (OWNER_ACTIVITY_PATHS.some((candidate) => isPathWithin(path, candidate))) return "activity"
  if (OWNER_FINANCE_PATHS.some((candidate) => isPathWithin(path, candidate))) return "finances"
  if (OWNER_STOCK_PATHS.some((candidate) => isPathWithin(path, candidate))) return "stock"
  if (OWNER_MORE_PATHS.some((candidate) => isPathWithin(path, candidate))) return "more"
  return null
}

export function preserveOwnerTimeParams(href: string, searchParams: URLSearchParams | null) {
  if (!href.startsWith("/owner")) return href

  const target = new URLSearchParams()
  for (const key of ["range", "start", "end"]) {
    const value = searchParams?.get(key)
    if (value) target.set(key, value)
  }

  const query = target.toString()
  return query ? `${href}?${query}` : href
}

function isPathWithin(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

function normalizePath(pathname: string) {
  const path = pathname.split("?")[0] || "/"
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path
}
