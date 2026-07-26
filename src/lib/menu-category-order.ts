export function getCategoryDisplayOrder(category: unknown, fallbackIndex = 0) {
  if (!category || typeof category !== "object") return fallbackIndex
  const record = category as Record<string, unknown>
  const candidates = [record.displayOrder, record.order, record.sortOrder]
  for (const value of candidates) {
    if (typeof value === "number" && Number.isFinite(value)) return value
  }
  return fallbackIndex
}

export function sortMenuCategories<T extends { id?: string; name?: string }>(categories: T[]) {
  return [...categories].sort((a, b) => {
    const orderDiff = getCategoryDisplayOrder(a) - getCategoryDisplayOrder(b)
    if (orderDiff !== 0) return orderDiff
    const nameDiff = String(a.name || "").localeCompare(String(b.name || ""), "fr", { sensitivity: "base" })
    if (nameDiff !== 0) return nameDiff
    return String(a.id || "").localeCompare(String(b.id || ""))
  })
}
