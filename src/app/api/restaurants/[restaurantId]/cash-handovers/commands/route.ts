import { randomUUID } from "node:crypto"

import type { NextRequest } from "next/server"

import { CASH_HANDOVER_STATUSES, CashHandoverValidationError } from "@/lib/finance/cash-handover-domain"
import { getAdminAuth, getAdminFirestore } from "@/server/firebase-admin"
import { FirestoreCashHandover } from "@/server/finance/firestore-cash-handover"
import { FinancialLedgerError } from "@/server/finance/firestore-payment-ledger"
import { resolveStaffPrincipal } from "@/server/orders/create/security"

export const runtime = "nodejs"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ restaurantId: string }> }
) {
  const requestId = randomUUID()
  try {
    const { restaurantId } = await context.params
    const decoded = await getAdminAuth().verifyIdToken(bearerToken(request), true)
    const principal = await resolveStaffPrincipal(restaurantId, decoded)
    if (principal.kind !== "staff") {
      return failure("FORBIDDEN", "Accès personnel obligatoire.", 403, requestId)
    }
    const body = await request.json().catch(() => null)
    if (!isRecord(body)) {
      return failure("INVALID_PAYLOAD", "Contenu JSON invalide.", 400, requestId)
    }
    const service = new FirestoreCashHandover(getAdminFirestore())
    let result
    if (body.command === "SUBMIT_HANDOVER") {
      result = await service.submit({
        restaurantId,
        sessionId: requiredString(body.sessionId, "sessionId"),
        cashierId: principal.uid,
        declaredAmount: amount(body.declaredAmount),
        note: optionalString(body.note),
        idempotencyKey: requiredString(body.idempotencyKey, "idempotencyKey"),
      })
    } else if (body.command === "ENSURE_HANDOVER_FOR_REVIEW") {
      if (!principal.roles.some((role) => role === "manager" || role === "owner")) {
        return failure("FORBIDDEN", "Validation manager obligatoire.", 403, requestId)
      }
      result = await service.ensureForManagerReview({
        restaurantId,
        sessionId: requiredString(body.sessionId, "sessionId"),
        managerId: principal.uid,
        idempotencyKey: requiredString(body.idempotencyKey, "idempotencyKey"),
      })
    } else if (body.command === "REVIEW_HANDOVER") {
      if (!principal.roles.some((role) => role === "manager" || role === "owner")) {
        return failure("FORBIDDEN", "Validation manager obligatoire.", 403, requestId)
      }
      const decision = requiredString(body.decision, "decision")
      if (
        !CASH_HANDOVER_STATUSES.includes(decision as never) ||
        decision === "submitted"
      ) {
        return failure("INVALID_PAYLOAD", "Décision de remise invalide.", 400, requestId)
      }
      result = await service.review({
        restaurantId,
        handoverId: requiredString(body.handoverId, "handoverId"),
        managerId: principal.uid,
        managerRole: principal.roles.includes("owner") ? "owner" : "manager",
        decision: decision as "under_review" | "validated" | "correction_required" | "rejected",
        receivedAmount: body.receivedAmount === undefined ? undefined : amount(body.receivedAmount),
        note: optionalString(body.note),
        idempotencyKey: requiredString(body.idempotencyKey, "idempotencyKey"),
      })
    } else {
      return failure("FORBIDDEN_COMMAND", "Commande de remise interdite.", 403, requestId)
    }
    console.info("CASH_HANDOVER_COMMAND_COMMITTED", {
      requestId,
      restaurantId,
      command: body.command,
      actorId: principal.uid,
      result,
    })
    return Response.json({ ok: true, result, requestId })
  } catch (error) {
    const api = apiError(error)
    console.error("CASH_HANDOVER_COMMAND_REJECTED", { requestId, code: api.code, error })
    return failure(api.code, api.message, api.status, requestId)
  }
}

function bearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") || ""
  if (!authorization.startsWith("Bearer ")) {
    throw new ApiError("UNAUTHENTICATED", "Authentification obligatoire.", 401)
  }
  return requiredString(authorization.slice(7), "token")
}

function amount(value: unknown) {
  const result = Math.round(Number(value))
  if (!Number.isFinite(result) || result < 0) {
    throw new ApiError("INVALID_PAYLOAD", "Montant invalide.", 400)
  }
  return result
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new ApiError("INVALID_PAYLOAD", `${field} est invalide.`, 400)
  }
  return value.trim()
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value : null
}

function apiError(error: unknown) {
  if (error instanceof ApiError) return error
  if (error instanceof CashHandoverValidationError) {
    return new ApiError(error.code, error.message, 409)
  }
  if (error instanceof FinancialLedgerError) {
    const status =
      error.code.endsWith("_NOT_FOUND") ? 404 :
        error.code === "CASH_SESSION_OWNERSHIP_MISMATCH" ? 403 : 409
    return new ApiError(error.code, error.message, status)
  }
  return new ApiError("INTERNAL_ERROR", "La commande de remise a échoué.", 500)
}

function failure(code: string, message: string, status: number, requestId: string) {
  return Response.json(
    { ok: false, error: { code, message, retryable: false }, requestId },
    { status }
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

class ApiError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) {
    super(message)
  }
}
