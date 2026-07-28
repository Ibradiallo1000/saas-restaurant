export const CASH_QUICK_AMOUNT_VALUES = [5_000, 10_000, 20_000, 50_000, 100_000] as const

export function sanitizeCashInput(value: string): string {
  return value.replace(/\D/g, "")
}

export function appendCashKey(value: string, key: string): string {
  return sanitizeCashInput(`${value}${key}`)
}

export function removeLastCashDigit(value: string): string {
  return value.slice(0, -1)
}

export function parseCashAmount(value: string): number {
  const amount = Number(sanitizeCashInput(value))
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : 0
}

export function formatCashAmount(value: string | number): string {
  const amount = typeof value === "number" ? value : parseCashAmount(value)
  return amount.toLocaleString("fr-FR").replace(/\u202f/g, " ")
}

export function getCashQuickAmounts(total: number): number[] {
  const normalizedTotal = Math.max(0, Math.round(total))
  return Array.from(
    new Set([normalizedTotal, ...CASH_QUICK_AMOUNT_VALUES].filter((amount) => amount === normalizedTotal || amount >= normalizedTotal))
  )
}

export function isCashPaymentValid(value: string, total: number): boolean {
  return value.trim().length > 0 && parseCashAmount(value) >= total
}
