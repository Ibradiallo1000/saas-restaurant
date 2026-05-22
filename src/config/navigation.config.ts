import { ROLES } from "@/lib/constants"

export type NavigationRole = "owner" | "manager" | "cuisine" | "caisse"

export type NavigationItemId =
  | "analytics"
  | "commandes"
  | "caisse"
  | "cuisine"
  | "plus"
  | "profil"
  | "parametres"
  | "tresorerie"
  | "depenses"
  | "menu"
  | "tables"
  | "images"
  | "inventaire"
  | "deconnexion"

export const roleConfig: Record<
  NavigationRole,
  {
    bottomNav: NavigationItemId[]
    drawer: NavigationItemId[]
  }
> = {
  owner: {
    bottomNav: ["analytics", "commandes", "caisse", "cuisine", "plus"],
    drawer: [
      "profil",
      "parametres",
      "tresorerie",
      "depenses",
      "menu",
      "tables",
      "images",
      "deconnexion",
    ],
  },
  manager: {
    bottomNav: ["analytics", "commandes", "caisse", "cuisine", "plus"],
    drawer: ["profil", "menu", "images", "inventaire", "tresorerie", "depenses", "deconnexion"],
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
