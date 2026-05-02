"use client"

import { useCurrentUser } from "@/hooks/use-current-user"
import type { FeatureModule } from "@/types"

export function useFeature(module: FeatureModule) {
  const { modules, isSuperAdmin } = useCurrentUser()

  return isSuperAdmin || Boolean(modules[module])
}
