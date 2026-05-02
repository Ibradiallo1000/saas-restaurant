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
      return "/manager"
    case "cashier":
      return "/pos"
    case "kitchen":
      return "/kitchen"
    default:
      return "/login"
  }
}

export function isRouteAllowedForRole(pathname: string, role: AppRouteRole | null) {
  if (isPublicRoute(pathname)) return true

  switch (role) {
    case "super_admin":
    case "owner":
      return (
        pathname.startsWith("/owner") ||
        pathname.startsWith("/manager") ||
        pathname.startsWith("/pos") ||
        pathname.startsWith("/kitchen")
      )
    case "manager":
      return (
        pathname.startsWith("/manager") ||
        pathname.startsWith("/pos") ||
        pathname.startsWith("/kitchen")
      )
    case "cashier":
      return pathname.startsWith("/pos")
    case "kitchen":
      return pathname.startsWith("/kitchen")
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
