import { ROLES } from "@/lib/constants"

export type NavigationRole = "owner" | "manager" | "cuisine" | "caisse"

export type NavigationItemId =
  | "analytics"
  | "activite"
  | "commandes"
  | "caisse"
  | "cuisine"
  | "finances"
  | "plus"
  | "profil"
  | "parametres"
  | "tresorerie"
  | "depenses"
  | "avis"
  | "menu"
  | "tables"
  | "images"
  | "inventaire"
  | "fournisseurs"
  | "horaires"
  | "stock"
  | "deconnexion"

export const roleConfig: Record<
  NavigationRole,
  {
    bottomNav: NavigationItemId[]
    drawer: NavigationItemId[]
  }
> = {
  owner: {
    bottomNav: ["analytics", "activite", "finances", "stock", "plus"],
    drawer: ["menu", "tables", "images", "parametres", "profil", "deconnexion"],
  },
  manager: {
    bottomNav: ["analytics", "commandes", "caisse", "stock", "plus"],
    drawer: ["tables", "depenses", "tresorerie", "fournisseurs", "horaires", "menu", "images", "profil", "deconnexion"],
  },
  cuisine: {
    bottomNav: ["cuisine"],
    drawer: [],
  },
  caisse: {
    bottomNav: ["caisse"],
    drawer: [],
  },
}

export function getNavigationRole(role: string | null | undefined): NavigationRole {
  if (role === ROLES.OWNER) return "owner"
  if (role === ROLES.MANAGER) return "manager"
  if (role === ROLES.KITCHEN) return "cuisine"
  if (role === ROLES.CASHIER) return "caisse"
  return "manager"
}

export function getBottomNavByRole(role: string | null | undefined) {
  return roleConfig[getNavigationRole(role)].bottomNav
}

export function getDrawerItemsByRole(role: string | null | undefined) {
  return roleConfig[getNavigationRole(role)].drawer
}
