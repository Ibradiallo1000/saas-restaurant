import { CanonicalOrderError } from "./create/errors.ts"

export function assertPublicOrderSecurityConfigured(restaurantId: string) {
  // The allowlist selects the public presentation only. Every presentation
  // mode uses the same authenticated server boundary and capability proof.
  void restaurantId

  if (!process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY?.trim()) {
    throw new CanonicalOrderError(
      "APP_CHECK_REQUIRED",
      "App Check n’est pas configuré pour les commandes publiques."
    )
  }
  const secret = process.env.ORDER_QR_CAPABILITY_SECRET ?? ""
  if (secret.length < 32) {
    throw new CanonicalOrderError(
      "INVALID_TABLE_CAPABILITY",
      "Le secret de capacité QR est absent ou trop court."
    )
  }
  return true
}
