import type { DecodedIdToken } from "firebase-admin/auth"

import { OrderAggregateError } from "../aggregate/errors.ts"
import {
  markOrderItemPreparing,
  markOrderItemReady,
  OrderCommandError,
} from "../commands/index.ts"
import type {
  AtomicOrderCommandPort,
  CanonicalCommandResult,
  OrderCommandActor,
} from "../commands/types.ts"

export const KITCHEN_COMMANDS = [
  "MARK_ORDER_ITEM_PREPARING",
  "MARK_ORDER_ITEM_READY",
] as const

export type KitchenCommand = (typeof KITCHEN_COMMANDS)[number]

interface KitchenCommandRequest {
  command: KitchenCommand
  orderItemId: string
  idempotencyKey: string
  expectedVersion: number
}

interface StaffPrincipal {
  kind: "staff" | "public"
  uid: string
  roles: string[]
}

export interface KitchenCommandHandlerDependencies {
  store: AtomicOrderCommandPort
  verifyIdToken(token: string): Promise<DecodedIdToken>
  resolveStaffPrincipal(restaurantId: string, token: DecodedIdToken): Promise<StaffPrincipal>
  verifyAppCheck(token: string): Promise<void>
  requestId(): string
  log: Pick<Console, "info" | "warn" | "error">
}

export async function handleKitchenCommandRequest(
  request: Request,
  params: { restaurantId: string; orderId: string },
  dependencies: KitchenCommandHandlerDependencies
): Promise<Response> {
  const requestId = dependencies.requestId()
  const startedAt = Date.now()
  try {
    const identity = await authenticate(request, params.restaurantId, dependencies)
    await observeAppCheck(request, params, identity.uid, dependencies)
    const body = parseKitchenCommandRequest(await parseJson(request))
    const actor: OrderCommandActor = {
      id: identity.uid,
      role: "kitchen",
      restaurantId: params.restaurantId,
    }
    const input = {
      restaurantId: params.restaurantId,
      orderId: params.orderId,
      orderItemId: body.orderItemId,
      idempotencyKey: body.idempotencyKey,
      expectedVersion: body.expectedVersion,
      actor,
      sourceChannel: "kitchen" as const,
    }
    const result = body.command === "MARK_ORDER_ITEM_PREPARING"
      ? await markOrderItemPreparing({ store: dependencies.store }, input)
      : await markOrderItemReady({ store: dependencies.store }, input)

    dependencies.log.info("KITCHEN_ORDER_COMMAND_COMMITTED", {
      requestId,
      restaurantId: params.restaurantId,
      orderId: params.orderId,
      orderItemId: body.orderItemId,
      command: body.command,
      replayed: result.replayed,
      durationMs: Date.now() - startedAt,
    })
    return json({
      ok: true,
      command: body.command,
      orderId: params.orderId,
      orderItemId: body.orderItemId,
      result,
      requestId,
    }, 200)
  } catch (error) {
    const apiError = toApiError(error)
    dependencies.log.error("KITCHEN_ORDER_COMMAND_REJECTED", {
      requestId,
      code: apiError.code,
      retryable: apiError.retryable,
      durationMs: Date.now() - startedAt,
    })
    return json({
      ok: false,
      error: {
        code: apiError.code,
        message: apiError.message,
        retryable: apiError.retryable,
      },
      requestId,
    }, apiError.status)
  }
}

async function authenticate(
  request: Request,
  restaurantId: string,
  dependencies: KitchenCommandHandlerDependencies
) {
  const authorization = request.headers.get("authorization")
  const rawToken = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : ""
  if (!rawToken) throw new KitchenBoundaryError("UNAUTHENTICATED", "Authentification obligatoire.", 401)
  let token: DecodedIdToken
  try {
    token = await dependencies.verifyIdToken(rawToken)
  } catch {
    throw new KitchenBoundaryError("UNAUTHENTICATED", "Authentification invalide.", 401)
  }
  let principal: StaffPrincipal
  try {
    principal = await dependencies.resolveStaffPrincipal(restaurantId, token)
  } catch (error) {
    if (isCodedError(error) && error.code === "FORBIDDEN") {
      throw new KitchenBoundaryError("FORBIDDEN", "Accès refusé à ce restaurant.", 403)
    }
    throw error
  }
  if (principal.kind !== "staff" || !principal.roles.includes("kitchen")) {
    throw new KitchenBoundaryError("FORBIDDEN", "Le rôle Cuisine est obligatoire.", 403)
  }
  return principal
}

async function observeAppCheck(
  request: Request,
  params: { restaurantId: string; orderId: string },
  uid: string,
  dependencies: KitchenCommandHandlerDependencies
) {
  const token = request.headers.get("x-firebase-appcheck")
  if (!token) {
    dependencies.log.warn("KITCHEN_COMMAND_APP_CHECK_MISSING", {
      restaurantId: params.restaurantId,
      orderId: params.orderId,
      uid,
      enforcement: "observe",
    })
    return
  }
  try {
    await dependencies.verifyAppCheck(token)
  } catch {
    dependencies.log.warn("KITCHEN_COMMAND_APP_CHECK_INVALID", {
      restaurantId: params.restaurantId,
      orderId: params.orderId,
      uid,
      enforcement: "observe",
    })
  }
}

async function parseJson(request: Request) {
  const contentType = request.headers.get("content-type") ?? ""
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new KitchenBoundaryError("INVALID_PAYLOAD", "Le contenu doit être au format JSON.", 400)
  }
  try {
    return JSON.parse(await request.text())
  } catch {
    throw new KitchenBoundaryError("INVALID_PAYLOAD", "Le contenu JSON est invalide.", 400)
  }
}

function parseKitchenCommandRequest(value: unknown): KitchenCommandRequest {
  if (!isRecord(value)) {
    throw new KitchenBoundaryError("INVALID_PAYLOAD", "Le payload est invalide.", 400)
  }
  const allowed = new Set(["command", "orderItemId", "idempotencyKey", "expectedVersion"])
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw new KitchenBoundaryError(
      "INVALID_PAYLOAD",
      "Le payload contient un champ interdit.",
      400
    )
  }
  if (typeof value.command !== "string" || !KITCHEN_COMMANDS.includes(value.command as KitchenCommand)) {
    throw new KitchenBoundaryError("FORBIDDEN_COMMAND", "Cette commande est interdite depuis Cuisine.", 403)
  }
  if (typeof value.orderItemId !== "string" || !value.orderItemId.trim()) {
    throw new KitchenBoundaryError("INVALID_PAYLOAD", "orderItemId est obligatoire.", 400)
  }
  if (
    typeof value.idempotencyKey !== "string" ||
    value.idempotencyKey.trim().length < 8 ||
    value.idempotencyKey.length > 200
  ) {
    throw new KitchenBoundaryError("INVALID_PAYLOAD", "idempotencyKey est invalide.", 400)
  }
  if (!Number.isInteger(value.expectedVersion) || Number(value.expectedVersion) < 1) {
    throw new KitchenBoundaryError("INVALID_PAYLOAD", "expectedVersion est invalide.", 400)
  }
  return {
    command: value.command as KitchenCommand,
    orderItemId: value.orderItemId.trim(),
    idempotencyKey: value.idempotencyKey.trim(),
    expectedVersion: Number(value.expectedVersion),
  }
}

class KitchenBoundaryError extends Error {
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

function toApiError(error: unknown): KitchenBoundaryError {
  if (error instanceof KitchenBoundaryError) return error
  if (error instanceof OrderCommandError) {
    const status = error.code === "INVALID_COMMAND" ? 400 : error.status
    return new KitchenBoundaryError(error.code, error.message, status, error.retryable)
  }
  if (error instanceof OrderAggregateError) {
    const status = error.code === "LEGACY_ORDER_READ_ONLY" ? 409 : 409
    return new KitchenBoundaryError(error.code, error.message, status)
  }
  return new KitchenBoundaryError(
    "INTERNAL_ERROR",
    "La commande Cuisine n’a pas pu être exécutée.",
    500,
    true
  )
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

function isCodedError(value: unknown): value is { code: string } {
  return isRecord(value) && typeof value.code === "string"
}
