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
  | "tables"
  | "payments"
  | "cashValidation"
  | "operations"

export const rolePermissions = {
  owner: {
    canViewAll: true,
    canManageStaff: true,
    canConfigure: true,
    canEditMenu: true,
    canAccessOperations: false,
    canValidateCash: false,
    canCreateOrder: false,
    canProcessPayment: false,
    canManagePreparation: false,
  },
  manager: {
    canViewAll: true,
    canManageOrders: true,
    canEditMenu: true,
    canValidateCash: true,
    canAccessOperations: true,
    canManageStaff: false,
    canConfigure: false,
    canCreateOrder: false,
    canProcessPayment: false,
    canManagePreparation: true,
  },
  cashier: {
    canViewOwnSales: true,
    canCreateOrder: true,
    canProcessPayment: true,
    canViewAll: false,
    canManageStaff: false,
    canConfigure: false,
    canEditMenu: false,
    canAccessOperations: false,
    canValidateCash: false,
    canManagePreparation: false,
  },
  kitchen: {
    canManagePreparation: true,
    canViewAll: false,
    canManageStaff: false,
    canConfigure: false,
    canEditMenu: false,
    canAccessOperations: false,
    canValidateCash: false,
    canCreateOrder: false,
    canProcessPayment: false,
  },
  server: {
    canManagePreparation: false,
    canViewAll: false,
    canManageStaff: false,
    canConfigure: false,
    canEditMenu: false,
    canAccessOperations: false,
    canValidateCash: false,
    canCreateOrder: false,
    canProcessPayment: false,
  },
} as const

export const ROLE_PERMISSIONS: Record<RestaurantUserRole, Permission[]> = {
  owner: ["dashboard", "staff", "menu", "reports", "settings", "tables", "payments"],
  manager: ["dashboard", "orders", "kitchen", "inventory", "operations", "cashValidation", "menu"],
  cashier: ["pos"],
  kitchen: ["kitchen"],
  server: ["pos", "orders"],
}

export function canRole(role: RestaurantUserRole | null, capability: keyof typeof rolePermissions.owner) {
  if (!role || !(role in rolePermissions)) return false
  return Boolean(rolePermissions[role as keyof typeof rolePermissions][capability])
}

export function hasPermission(role: RestaurantUserRole | null, permission: Permission) {
  if (!role) return false
  return ROLE_PERMISSIONS[role].includes(permission)
}
