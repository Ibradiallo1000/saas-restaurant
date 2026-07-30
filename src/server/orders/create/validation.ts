import { z } from "zod"

import { CanonicalOrderError } from "./errors.ts"
import { ORDER_CREATION_POLICIES } from "./policies.ts"
import {
  CREATE_ORDER_CHANNELS,
  CREATE_ORDER_SERVICE_MODES,
  type CreateOrderRequest,
  type OrderPrincipal,
} from "./types.ts"

const safeId = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/)
const boundedText = (max: number) => z.string().trim().max(max)

const optionSchema = z.object({
  optionName: boundedText(120).min(1),
  choiceName: boundedText(120).min(1),
}).strict()

const lineSchema = z.object({
  clientLineId: safeId,
  productId: safeId,
  quantity: z.number().int().positive().max(ORDER_CREATION_POLICIES.maxStaffQuantity),
  options: z.array(optionSchema).max(50).optional().default([]),
  instructions: boundedText(ORDER_CREATION_POLICIES.maxInstructionsLength).nullable().optional().default(null),
}).strict()

const requestSchema = z.object({
  schemaVersion: z.literal(ORDER_CREATION_POLICIES.schemaVersion),
  channel: z.enum(CREATE_ORDER_CHANNELS),
  serviceMode: z.enum(CREATE_ORDER_SERVICE_MODES),
  clientRequestId: safeId,
  items: z.array(lineSchema).min(1).max(ORDER_CREATION_POLICIES.maxLines),
  tableContext: z.object({
    tableId: safeId,
    tableSessionId: safeId,
    capability: z.string().min(16).max(4096).nullable().optional().default(null),
  }).strict().nullable().optional().default(null),
  customer: z.object({
    name: boundedText(ORDER_CREATION_POLICIES.maxCustomerNameLength).nullable().optional().default(null),
    phone: boundedText(ORDER_CREATION_POLICIES.maxPhoneLength).nullable().optional().default(null),
  }).strict().nullable().optional().default(null),
  delivery: z.object({
    address: boundedText(ORDER_CREATION_POLICIES.maxAddressLength).min(1),
    zoneId: safeId.nullable().optional().default(null),
    instructions: boundedText(ORDER_CREATION_POLICIES.maxInstructionsLength).nullable().optional().default(null),
  }).strict().nullable().optional().default(null),
  cashSessionId: safeId.nullable().optional().default(null),
  notes: boundedText(ORDER_CREATION_POLICIES.maxNotesLength).nullable().optional().default(null),
}).strict()

export function parseCreateOrderRequest(value: unknown): CreateOrderRequest {
  const parsed = requestSchema.safeParse(value)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join(".") || "request"] = issue.message
    }
    throw new CanonicalOrderError(
      "INVALID_COMMAND",
      "La commande est invalide.",
      fieldErrors
    )
  }

  const request = parsed.data as CreateOrderRequest
  assertUniqueClientLineIds(request)
  assertChannelCoherence(request)
  return request
}

export function validateRequestForPrincipal(
  request: CreateOrderRequest,
  principal: OrderPrincipal
) {
  const maximum =
    principal.kind === "staff"
      ? ORDER_CREATION_POLICIES.maxStaffQuantity
      : ORDER_CREATION_POLICIES.maxPublicQuantity

  request.items.forEach((item, index) => {
    if (item.quantity > maximum) {
      throw new CanonicalOrderError(
        "INVALID_COMMAND",
        `La quantité maximale autorisée est ${maximum}.`,
        { [`items.${index}.quantity`]: `Maximum ${maximum}` }
      )
    }
  })

  if (
    principal.kind === "staff" &&
    !principal.roles.some((role) => ORDER_CREATION_POLICIES.allowedStaffRoles.has(role))
  ) {
    throw new CanonicalOrderError("FORBIDDEN", "Ce rôle ne peut pas créer de commande.")
  }
}

export function validateIdempotencyKey(value: string | null) {
  const key = value?.trim() ?? ""
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(key)) {
    throw new CanonicalOrderError(
      "INVALID_COMMAND",
      "La clé d'idempotence est invalide.",
      { idempotencyKey: "16 à 128 caractères alphanumériques, _ ou -." }
    )
  }
  return key
}

function assertUniqueClientLineIds(request: CreateOrderRequest) {
  const ids = new Set<string>()
  request.items.forEach((item, index) => {
    if (ids.has(item.clientLineId)) {
      throw new CanonicalOrderError(
        "INVALID_COMMAND",
        "Chaque ligne doit avoir un identifiant client unique.",
        { [`items.${index}.clientLineId`]: "Identifiant dupliqué." }
      )
    }
    ids.add(item.clientLineId)
  })
}

function assertChannelCoherence(request: CreateOrderRequest) {
  const expectedMode = {
    qr_table: "dine_in",
    public_takeaway: "takeaway",
    public_delivery: "delivery",
  } as const
  if (request.channel !== "pos" && request.serviceMode !== expectedMode[request.channel]) {
    throw new CanonicalOrderError("INVALID_COMMAND", "Le canal et le mode de service sont incompatibles.")
  }
  if (request.serviceMode === "dine_in" && !request.tableContext) {
    throw new CanonicalOrderError("INVALID_COMMAND", "Une session de table est obligatoire.")
  }
  if (request.serviceMode !== "dine_in" && request.tableContext) {
    throw new CanonicalOrderError("INVALID_COMMAND", "Le contexte table est interdit pour ce mode.")
  }
  if (request.serviceMode === "delivery" && !request.delivery) {
    throw new CanonicalOrderError("INVALID_COMMAND", "Une adresse de livraison est obligatoire.")
  }
  if (request.serviceMode !== "delivery" && request.delivery) {
    throw new CanonicalOrderError("INVALID_COMMAND", "Les informations de livraison sont interdites.")
  }
}
