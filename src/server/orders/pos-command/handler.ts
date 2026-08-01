import type { DecodedIdToken } from "firebase-admin/auth"

import { OrderAggregateError } from "../aggregate/errors.ts"
import {
  cancelOrderItemQuantity,
  confirmOrderPayment,
  handOffOrderItems,
  markOrderItemServed,
  serveOrderItems,
  OrderCommandError,
} from "../commands/index.ts"
import type {
  ActorRole,
  AtomicOrderCommandPort,
  OrderCommandActor,
} from "../commands/types.ts"

export const POS_COMMANDS = [
  "MARK_ORDER_ITEM_SERVED",
  "SERVE_ORDER_ITEMS",
  "HAND_OFF_ORDER_ITEMS",
  "CANCEL_ORDER_ITEM_QUANTITY",
  "CONFIRM_ORDER_PAYMENT",
] as const

type PosCommand = (typeof POS_COMMANDS)[number]
type StaffPrincipal = { kind: "staff" | "public"; uid: string; roles: string[] }

export interface PosCommandHandlerDependencies {
  store: AtomicOrderCommandPort
  verifyIdToken(token: string): Promise<DecodedIdToken>
  resolveStaffPrincipal(restaurantId: string, token: DecodedIdToken): Promise<StaffPrincipal>
  requestId(): string
  log: Pick<Console, "info" | "error">
}

export async function handlePosCommandRequest(
  request: Request,
  params: { restaurantId: string; orderId: string },
  dependencies: PosCommandHandlerDependencies
) {
  const requestId = dependencies.requestId()
  try {
    const identity = await authenticate(request, params.restaurantId, dependencies)
    const body = await parseBody(request)
    const role = resolveActorRole(identity.roles)
    const actor: OrderCommandActor = {
      id: identity.uid,
      role,
      restaurantId: params.restaurantId,
    }
    const base = {
      restaurantId: params.restaurantId,
      orderId: params.orderId,
      actor,
      sourceChannel: "pos" as const,
      idempotencyKey: requiredString(body.idempotencyKey, "idempotencyKey"),
    }
    let result
    if (body.command === "MARK_ORDER_ITEM_SERVED") {
      result = await markOrderItemServed({ store: dependencies.store }, {
        ...base,
        orderItemId: requiredString(body.orderItemId, "orderItemId"),
        expectedVersion: positiveInteger(body.expectedVersion, "expectedVersion"),
        quantityToServe: positiveInteger(body.quantityToServe, "quantityToServe"),
      })
    } else if (body.command === "SERVE_ORDER_ITEMS") {
      result = await serveOrderItems({ store: dependencies.store }, {
        ...base,
        expectedItems: expectedItems(body.expectedItems),
      })
    } else if (body.command === "HAND_OFF_ORDER_ITEMS") {
      result = await handOffOrderItems({ store: dependencies.store }, {
        ...base,
        expectedItems: expectedItems(body.expectedItems),
        cashSessionId: requiredString(body.cashSessionId, "cashSessionId"),
      })
    } else if (body.command === "CANCEL_ORDER_ITEM_QUANTITY") {
      result = await cancelOrderItemQuantity({ store: dependencies.store }, {
        ...base,
        orderItemId: requiredString(body.orderItemId, "orderItemId"),
        expectedVersion: positiveInteger(body.expectedVersion, "expectedVersion"),
        quantityToCancel: positiveInteger(body.quantityToCancel, "quantityToCancel"),
        reason: nullableString(body.reason),
      })
    } else {
      result = await confirmOrderPayment({ store: dependencies.store }, {
        ...base,
        expectedPaymentVersion: positiveInteger(
          body.expectedPaymentVersion,
          "expectedPaymentVersion"
        ),
        expectedAmount: positiveNumber(body.expectedAmount, "expectedAmount"),
        receivedAmount: positiveNumber(body.receivedAmount, "receivedAmount"),
        method: body.method === "cash" ? "cash" : body.method === "mobile_money"
          ? "mobile_money"
          : invalid("method"),
        provider: nullableString(body.provider),
        externalReference: nullableString(body.externalReference),
        cashSessionId: requiredString(body.cashSessionId, "cashSessionId"),
      })
    }
    dependencies.log.info("POS_ORDER_COMMAND_COMMITTED", {
      requestId,
      restaurantId: params.restaurantId,
      orderId: params.orderId,
      command: body.command,
      replayed: result.replayed,
    })
    return json({ ok: true, command: body.command, result, requestId }, 200)
  } catch (error) {
    const api = toApiError(error)
    dependencies.log.error("POS_ORDER_COMMAND_REJECTED", {
      requestId,
      code: api.code,
    })
    return json({
      ok: false,
      error: { code: api.code, message: api.message, retryable: api.retryable },
      requestId,
    }, api.status)
  }
}

async function authenticate(
  request: Request,
  restaurantId: string,
  dependencies: PosCommandHandlerDependencies
) {
  const authorization = request.headers.get("authorization")
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : ""
  if (!token) throw new BoundaryError("UNAUTHENTICATED", "Authentification obligatoire.", 401)
  let decoded
  try {
    decoded = await dependencies.verifyIdToken(token)
  } catch {
    throw new BoundaryError("UNAUTHENTICATED", "Authentification invalide.", 401)
  }
  const principal = await dependencies.resolveStaffPrincipal(restaurantId, decoded)
  if (principal.kind !== "staff") {
    throw new BoundaryError("FORBIDDEN", "Accès personnel obligatoire.", 403)
  }
  return principal
}

function resolveActorRole(roles: readonly string[]): ActorRole {
  for (const role of ["cashier", "server", "manager", "owner"] as const) {
    if (roles.includes(role)) return role
  }
  throw new BoundaryError("FORBIDDEN", "Rôle POS non autorisé.", 403)
}

async function parseBody(request: Request) {
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    throw new BoundaryError("INVALID_PAYLOAD", "Contenu JSON obligatoire.", 400)
  }
  let body: unknown
  try {
    body = JSON.parse(await request.text())
  } catch {
    throw new BoundaryError("INVALID_PAYLOAD", "JSON invalide.", 400)
  }
  if (!isRecord(body) || !POS_COMMANDS.includes(body.command as PosCommand)) {
    throw new BoundaryError("FORBIDDEN_COMMAND", "Commande POS interdite.", 403)
  }
  return body as Record<string, unknown> & { command: PosCommand }
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) invalid(field)
  return value.trim()
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function expectedItems(value: unknown) {
  if (!Array.isArray(value)) invalid("expectedItems")
  return value.map((item) => {
    if (!isRecord(item)) invalid("expectedItems")
    return {
      orderItemId: requiredString(item.orderItemId, "expectedItems.orderItemId"),
      expectedVersion: positiveInteger(item.expectedVersion, "expectedItems.expectedVersion"),
    }
  })
}

function positiveInteger(value: unknown, field: string) {
  if (!Number.isInteger(value) || Number(value) < 1) invalid(field)
  return Number(value)
}

function positiveNumber(value: unknown, field: string) {
  if (!Number.isFinite(value) || Number(value) <= 0) invalid(field)
  return Number(value)
}

function invalid(field: string): never {
  throw new BoundaryError("INVALID_PAYLOAD", `${field} est invalide.`, 400)
}

class BoundaryError extends Error {
  readonly code: string
  readonly status: number
  readonly retryable: boolean

  constructor(
    code: string,
    message: string,
    status: number,
    retryable = false
  ) {
    super(message)
    this.code = code
    this.status = status
    this.retryable = retryable
  }
}

function toApiError(error: unknown) {
  if (error instanceof BoundaryError) return error
  if (error instanceof OrderCommandError) {
    return new BoundaryError(error.code, error.message, error.status, error.retryable)
  }
  if (error instanceof OrderAggregateError) {
    return new BoundaryError(error.code, error.message, 409)
  }
  return new BoundaryError("INTERNAL_ERROR", "La commande POS a échoué.", 500, true)
}

function json(value: unknown, status: number) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
