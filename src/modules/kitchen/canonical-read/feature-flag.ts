export type KitchenCanonicalReadMode = "legacy" | "canonical" | "compare"

export interface KitchenCanonicalReadFlag {
  mode: KitchenCanonicalReadMode
  restaurantAllowlist: readonly string[]
}

export function getKitchenCanonicalReadFlag(): KitchenCanonicalReadFlag {
  const requestedMode = process.env.NEXT_PUBLIC_KITCHEN_CANONICAL_READ_MODE
  const mode: KitchenCanonicalReadMode =
    requestedMode === "legacy" || requestedMode === "compare"
      ? requestedMode
      : "canonical"
  return {
    mode,
    restaurantAllowlist: String(
      process.env.NEXT_PUBLIC_KITCHEN_CANONICAL_READ_RESTAURANTS ?? ""
    )
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  }
}

export function resolveKitchenCanonicalReadMode(
  restaurantId: string,
  flag = getKitchenCanonicalReadFlag()
): KitchenCanonicalReadMode {
  if (!restaurantId) return "legacy"
  if (
    flag.restaurantAllowlist.length > 0 &&
    !flag.restaurantAllowlist.includes(restaurantId)
  ) return "legacy"
  return flag.mode
}
