import { randomUUID } from "node:crypto"

import type { NextRequest } from "next/server"

import { getAdminAuth, getAdminFirestore } from "@/server/firebase-admin"
import {
  CashSessionCloseValidationError,
  FirestoreCashSessionClose,
} from "@/server/finance/firestore-cash-session-close"
import { FinancialLedgerError } from "@/server/finance/firestore-payment-ledger"
import { resolveStaffPrincipal } from "@/server/orders/create/security"

export const runtime = "nodejs"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ restaurantId: string; sessionId: string }> }
) {
  const requestId = randomUUID()
  try {
    const { restaurantId, sessionId } = await context.params
    const decoded = await getAdminAuth().verifyIdToken(bearerToken(request), true)
    const principal = await resolveStaffPrincipal(restaurantId, decoded)
    if (principal.kind !== "staff") {
      return failure("FORBIDDEN", "Accès personnel obligatoire.", 403, requestId)
    }
    const body = await request.json().catch(() => null)
    if (!isRecord(body) || body.command !== "CLOSE_SESSION") {
      return failure("FORBIDDEN_COMMAND", "Commande de session interdite.", 403, requestId)
    }
    const result = await new FirestoreCashSessionClose(getAdminFirestore()).close({
      restaurantId,
      sessionId,
      cashierId: principal.uid,
      countedPhysicalCash: amount(body.countedPhysicalCash),
      retainedFloat: amount(body.retainedFloat),
      idempotencyKey: requiredString(body.idempotencyKey, "idempotencyKey"),
    })
    console.info("CASH_SESSION_CLOSE_V2_COMMITTED", {
      requestId,
      restaurantId,
      sessionId,
      actorId: principal.uid,
      replayed: result.replayed,
      close: result.close,
    })
    return Response.json({ ok: true, result, requestId })
  } catch (error) {
    const api = apiError(error)
    console.error("CASH_SESSION_CLOSE_V2_REJECTED", {
      requestId,
      code: api.code,
      error,
    })
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
    throw new ApiError("INVALID_PAYLOAD", "Montant de clôture invalide.", 400)
  }
  return result
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new ApiError("INVALID_PAYLOAD", `${field} est invalide.`, 400)
  }
  return value.trim()
}

function apiError(error: unknown) {
  if (error instanceof ApiError) return error
  if (error instanceof CashSessionCloseValidationError) {
    return new ApiError(error.code, error.message, 409)
  }
  if (error instanceof FinancialLedgerError) {
    const status =
      error.code === "CASH_SESSION_NOT_FOUND"
        ? 404
        : error.code === "CASH_SESSION_OWNERSHIP_MISMATCH"
          ? 403
          : 409
    return new ApiError(error.code, error.message, status)
  }
  return new ApiError("INTERNAL_ERROR", "La clôture de caisse a échoué.", 500)
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
  constructor(
    readonly code: string,
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}
