export type ProductReviewsPolicy = "inherit" | "enabled" | "disabled"

export function normalizeProductReviewsPolicy(value: unknown): ProductReviewsPolicy {
  return value === "enabled" || value === "disabled" || value === "inherit" ? value : "inherit"
}

export function resolveProductReviewsEnabled({
  categoryReviewsEnabled,
  productReviewsPolicy,
}: {
  categoryReviewsEnabled: unknown
  productReviewsPolicy: unknown
}): boolean | null {
  const policy = normalizeProductReviewsPolicy(productReviewsPolicy)
  if (policy === "enabled") return true
  if (policy === "disabled") return false
  return typeof categoryReviewsEnabled === "boolean" ? categoryReviewsEnabled : null
}

export function policyFromLegacyReviewsEnabled(value: unknown): ProductReviewsPolicy {
  return value === true ? "enabled" : value === false ? "disabled" : "inherit"
}
