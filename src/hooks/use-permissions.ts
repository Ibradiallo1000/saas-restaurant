"use client"

import { hasPermission, ROLE_PERMISSIONS, type Permission } from "@/lib/permissions"
import { useCurrentUser } from "@/hooks/use-current-user"

export function usePermissions() {
  const { activeRole } = useCurrentUser()
  const permissions = activeRole ? ROLE_PERMISSIONS[activeRole] : []

  return {
    permissions,
    can: (permission: Permission) => hasPermission(activeRole, permission),
  }
}
