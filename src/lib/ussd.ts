export function buildUssdTelHref(code: string | null | undefined) {
  const cleanCode = String(code || "").trim().replace(/\s+/g, "")
  if (!cleanCode) return ""

  return `tel:${cleanCode.replace(/#/g, "%23")}`
}
