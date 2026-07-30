export type QrCanonicalMode = "legacy" | "canonical" | "compare"

export function resolveQrCanonicalMode(
  restaurantId: string | null | undefined,
  environment: Record<string, string | undefined> = process.env
): QrCanonicalMode {
  const configured = environment.NEXT_PUBLIC_QR_CANONICAL_MODE?.trim().toLowerCase()
  const mode: QrCanonicalMode =
    configured === "canonical" || configured === "compare" ? configured : "legacy"
  const allowlist = new Set(
    (environment.NEXT_PUBLIC_QR_CANONICAL_RESTAURANTS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  )

  if (allowlist.size > 0 && (!restaurantId || !allowlist.has(restaurantId))) {
    return "legacy"
  }
  return mode
}

export function qrCanonicalEnabled(mode: QrCanonicalMode) {
  // All public modes share the hardened server boundary. "legacy" now controls
  // presentation only; it must never restore direct Firestore writes.
  return mode === "legacy" || mode === "canonical" || mode === "compare"
}
