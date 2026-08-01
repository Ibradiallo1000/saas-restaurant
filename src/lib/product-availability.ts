export const OPERATIONAL_AVAILABILITY_STATES = [
  "AVAILABLE",
  "SOLD_OUT",
  "PAUSED",
] as const

export type OperationalAvailabilityState =
  (typeof OPERATIONAL_AVAILABILITY_STATES)[number]

export type ProductOperationalAvailability = {
  state: OperationalAvailabilityState
  reason?: string | null
  updatedAt?: unknown
  updatedBy?: string | null
  scope?: "MANUAL" | "CURRENT_SERVICE"
  serviceId?: string | null
}

export type ProductPortionControl = {
  enabled: boolean
  available: number
  updatedAt?: unknown
  updatedBy?: string | null
}

export type ProductAvailabilityLike = {
  isActive?: boolean | null
  available?: boolean | null
  isAvailable?: boolean | null
  status?: string | null
  operationalAvailability?: Partial<ProductOperationalAvailability> | null
  portionControl?: Partial<ProductPortionControl> | null
}

export type ProductPreparationLike = {
  preparationMode?: string | null
  categoryName?: string | null
}

export type AvailabilityRole =
  | "owner"
  | "manager"
  | "kitchen"
  | "cashier"
  | "server"
  | string

export type ProductPreparationMode = "kitchen" | "bar" | "direct"

export function resolveOperationalAvailabilityState(
  product: ProductAvailabilityLike
): OperationalAvailabilityState {
  const state = product.operationalAvailability?.state
  return OPERATIONAL_AVAILABILITY_STATES.includes(
    state as OperationalAvailabilityState
  )
    ? (state as OperationalAvailabilityState)
    : "AVAILABLE"
}

export function isProductAdministrativelyActive(
  product: ProductAvailabilityLike
) {
  return (
    product.isActive !== false &&
    product.available !== false &&
    product.isAvailable !== false &&
    product.status !== "inactive"
  )
}

export function resolveEffectiveProductAvailability(
  product: ProductAvailabilityLike
) {
  const operationalState = resolveOperationalAvailabilityState(product)
  return {
    administrativelyActive: isProductAdministrativelyActive(product),
    operationalState,
    orderable:
      isProductAdministrativelyActive(product) &&
      operationalState === "AVAILABLE",
  }
}

export function resolveProductPreparationMode(
  product: ProductPreparationLike,
  category?: ProductPreparationLike | null
): ProductPreparationMode {
  const explicit = product.preparationMode ?? category?.preparationMode
  if (explicit === "kitchen" || explicit === "bar" || explicit === "direct") {
    return explicit
  }

  const name = String(product.categoryName ?? category?.categoryName ?? "")
    .toLocaleLowerCase("fr")
  if (name.includes("boisson") || name.includes("eau") || name.includes("soda")) {
    return "direct"
  }
  if (["jus", "cocktail", "café", "cafe", "thé", "the", "bar"].some((key) => name.includes(key))) {
    return "bar"
  }
  return "kitchen"
}

export function canRoleModifyProductAvailability(input: {
  role: AvailabilityRole | null | undefined
  preparationMode: ProductPreparationMode
}) {
  if (input.role === "owner" || input.role === "manager") return true
  return input.role === "kitchen" && input.preparationMode === "kitchen"
}

export function productUnavailableMessage(
  productName: string,
  state: OperationalAvailabilityState
) {
  if (state === "SOLD_OUT") return `${productName} est épuisé.`
  if (state === "PAUSED") return `${productName} est temporairement indisponible.`
  return `${productName} n'est plus disponible.`
}

export function resolvePortionControl(product: ProductAvailabilityLike) {
  const enabled = product.portionControl?.enabled === true
  const available = Number(product.portionControl?.available)
  return {
    enabled,
    available: enabled && Number.isSafeInteger(available) && available >= 0 ? available : null,
  }
}
