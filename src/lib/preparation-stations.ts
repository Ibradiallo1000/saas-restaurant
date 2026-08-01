export const VIRTUAL_PREPARATION_STATIONS = {
  kitchen: { id: "VIRTUAL_KITCHEN", name: "Cuisine principale", code: "KITCHEN", type: "kitchen", isActive: true, acceptsOrders: true, virtual: true },
  bar: { id: "VIRTUAL_BAR", name: "Bar principal", code: "BAR", type: "bar", isActive: true, acceptsOrders: true, virtual: true },
} as const

export type PreparationStation = {
  id: string; name: string; code: string; type: string
  isActive: boolean; acceptsOrders: boolean; virtual?: boolean
}

export function resolveAllowedPreparationStationIds(staff?: { allowedPreparationStationIds?: unknown } | null): string[] {
  const configured = staff?.allowedPreparationStationIds
  if (Array.isArray(configured)) return [...new Set(configured.filter((value): value is string => typeof value === "string" && value.length > 0))]
  return [VIRTUAL_PREPARATION_STATIONS.kitchen.id]
}

export function canAccessPreparationStation(staff: { allowedPreparationStationIds?: unknown } | null | undefined, stationId: string) {
  return resolveAllowedPreparationStationIds(staff).includes(stationId)
}

export function resolvePreparationStation(input: {
  preparationMode: "kitchen" | "bar" | "direct"
  productStationId?: string | null
  categoryStationId?: string | null
  stations?: Map<string, PreparationStation> | PreparationStation[]
}) {
  if (input.preparationMode === "direct") return null
  const stations = input.stations instanceof Map
    ? input.stations
    : new Map((input.stations || []).map((station) => [station.id, station]))
  const explicitId = clean(input.productStationId) || clean(input.categoryStationId)
  if (explicitId) return stations.get(explicitId) || null
  const compatible = [...stations.values()]
    .filter((station) => station.isActive && station.acceptsOrders && station.type === input.preparationMode)
    .sort((a, b) => a.code.localeCompare(b.code))[0]
  return compatible || { ...VIRTUAL_PREPARATION_STATIONS[input.preparationMode] }
}

export function aggregatePreparationStatus(items: Array<{ status?: unknown }>) {
  const statuses = items.filter((item) => item.status !== "cancelled").map((item) => String(item.status || "pending"))
  if (!statuses.length) return "cancelled"
  if (statuses.every((status) => ["served", "picked_up", "completed"].includes(status))) return "served"
  if (statuses.every((status) => status === "ready" || ["served", "picked_up", "completed"].includes(status))) return "ready"
  if (statuses.some((status) => status === "ready" || ["served", "picked_up", "completed"].includes(status))) return "partially_ready"
  if (statuses.some((status) => status === "preparing")) return "preparing"
  return "pending"
}

function clean(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : null }
