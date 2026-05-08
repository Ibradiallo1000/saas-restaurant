import type { RestaurantUserRole } from "@/types"

export type Permission =
  | "dashboard"
  | "staff"
  | "menu"
  | "reports"
  | "settings"
  | "orders"
  | "kitchen"
  | "inventory"
  | "pos"

export const ROLE_PERMISSIONS: Record<RestaurantUserRole, Permission[]> = {
  owner: ["dashboard", "staff", "menu", "reports", "settings"],
  manager: ["dashboard", "orders", "kitchen", "inventory", "staff"],
  cashier: ["pos"],
  kitchen: ["kitchen"],
}

export function hasPermission(role: RestaurantUserRole | null, permission: Permission) {
  if (!role) return false
  return ROLE_PERMISSIONS[role].includes(permission)
}
