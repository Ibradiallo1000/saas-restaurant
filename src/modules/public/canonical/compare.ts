export type PublicOrderProjection = {
  lineCount: number
  lines: Array<{ productId: string; quantity: number }>
  total: number
  serviceMode: string
  tableId: string | null
  status: string
}

export function comparePublicOrderProjections(
  canonical: PublicOrderProjection,
  legacy: PublicOrderProjection
) {
  const differences: string[] = []
  if (canonical.lineCount !== legacy.lineCount) differences.push("lineCount")
  if (canonical.total !== legacy.total) differences.push("total")
  if (canonical.serviceMode !== legacy.serviceMode) differences.push("serviceMode")
  if (canonical.tableId !== legacy.tableId) differences.push("tableId")
  if (canonical.status !== legacy.status) differences.push("status")
  if (JSON.stringify(canonical.lines) !== JSON.stringify(legacy.lines)) differences.push("lines")
  return { equal: differences.length === 0, differences }
}
