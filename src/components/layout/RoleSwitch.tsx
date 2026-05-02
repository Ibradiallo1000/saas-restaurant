"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCurrentUser } from "@/hooks/use-current-user"
import type { RestaurantUserRole } from "@/types"

const ROLE_LABELS: Record<RestaurantUserRole, string> = {
  owner: "Owner",
  manager: "Manager",
  cashier: "Caisse",
  kitchen: "Cuisine",
}

export function RoleSwitch() {
  const { roles, activeRole, setActiveRole } = useCurrentUser()

  if (!activeRole || roles.length <= 1) return null

  return (
    <Select value={activeRole} onValueChange={(role) => setActiveRole(role as RestaurantUserRole)}>
      <SelectTrigger className="h-10 w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {roles.map((role) => (
          <SelectItem key={role} value={role}>
            {ROLE_LABELS[role]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
