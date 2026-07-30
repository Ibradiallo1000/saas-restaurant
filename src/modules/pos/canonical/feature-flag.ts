export type PosCanonicalMode = "legacy" | "canonical" | "compare"

export interface PosCanonicalFlag {
  mode: PosCanonicalMode
  restaurantAllowlist: readonly string[]
}

export function getPosCanonicalFlag(): PosCanonicalFlag {
  const requested = process.env.NEXT_PUBLIC_POS_CANONICAL_MODE
  return {
    mode: requested === "legacy" || requested === "compare" ? requested : "canonical",
    restaurantAllowlist: String(
      process.env.NEXT_PUBLIC_POS_CANONICAL_RESTAURANTS ?? ""
    )
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  }
}

export function resolvePosCanonicalMode(
  restaurantId: string,
  flag = getPosCanonicalFlag()
): PosCanonicalMode {
  if (!restaurantId) return "legacy"
  if (
    flag.restaurantAllowlist.length > 0 &&
    !flag.restaurantAllowlist.includes(restaurantId)
  ) return "legacy"
  return flag.mode
}
