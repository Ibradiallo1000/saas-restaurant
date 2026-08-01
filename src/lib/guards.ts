import type { AppRouteRole, RestaurantUserRole } from "@/types"

const PUBLIC_PREFIXES = ["/", "/login", "/public", "/r", "/order"]

export function isPublicRoute(pathname: string) {
  if (pathname === "/") return true
  return PUBLIC_PREFIXES.some((prefix) => prefix !== "/" && pathname.startsWith(prefix))
}

export function getRoleHomePath(role: AppRouteRole | null) {
  switch (role) {
    case "owner":
      return "/owner"
    case "manager":
      return "/manager/dashboard"
    case "cashier":
      return "/pos"
    case "kitchen":
      return "/kitchen"
    default:
      return "/login"
  }
}

export function canAccessOwner(role: AppRouteRole | null) {
  return role === "owner" || role === "super_admin"
}

export function canAccessManager(role: AppRouteRole | null) {
  return role === "manager" || role === "super_admin"
}

export function isRouteAllowedForRole(pathname: string, role: AppRouteRole | null) {
  if (isPublicRoute(pathname)) return true

  switch (role) {
    case "super_admin":
      return true
    case "owner":
      return (
        pathname.startsWith("/owner") ||
        pathname.startsWith("/preparation") ||
        pathname.startsWith("/settings") ||
        pathname.startsWith("/menu") ||
        pathname.startsWith("/tables") ||
        pathname.startsWith("/images") ||
        pathname.startsWith("/dashboard/images") ||
        pathname.startsWith("/dashboard/tables") ||
        pathname.startsWith("/settings/payments")
      )
    case "manager":
      return (
        pathname === "/manager" ||
        pathname.startsWith("/manager/dashboard") ||
        pathname.startsWith("/manager/commandes") ||
        pathname.startsWith("/manager/caisse") ||
        pathname.startsWith("/manager/pos-stations") ||
        pathname.startsWith("/manager/preparation-stations") ||
        pathname.startsWith("/preparation") ||
        pathname.startsWith("/manager/menu") ||
        pathname.startsWith("/manager/availability") ||
        pathname.startsWith("/manager/tables") ||
        pathname.startsWith("/manager/images") ||
        pathname.startsWith("/manager/hours") ||
        pathname.startsWith("/manager/stock") ||
        pathname.startsWith("/manager/inventory") ||
        pathname.startsWith("/manager/expenses") ||
        pathname.startsWith("/manager/depenses") ||
        pathname.startsWith("/manager/suppliers") ||
        pathname.startsWith("/manager/treasury") ||
        pathname.startsWith("/manager/tresorerie")
      )
    case "cashier":
      return pathname.startsWith("/pos")
    case "kitchen":
      return pathname.startsWith("/kitchen") || pathname.startsWith("/preparation")
    default:
      return false
  }
}

export function normalizeActiveRole(
  roles: RestaurantUserRole[],
  activeRole: unknown
): RestaurantUserRole | null {
  if (typeof activeRole === "string" && roles.includes(activeRole as RestaurantUserRole)) {
    return activeRole as RestaurantUserRole
  }

  return roles[0] ?? null
}
