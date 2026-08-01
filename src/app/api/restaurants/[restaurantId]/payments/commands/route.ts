import { randomUUID } from "node:crypto"

import type { NextRequest } from "next/server"

import { getAdminAuth, getAdminFirestore } from "@/server/firebase-admin"
import {
  FinancialLedgerError,
  FirestorePaymentLedger,
} from "@/server/finance/firestore-payment-ledger"
import { resolveStaffPrincipal } from "@/server/orders/create/security"

export const runtime = "nodejs"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ restaurantId: string }> }
) {
  const requestId = randomUUID()
  try {
    const { restaurantId } = await context.params
    const token = bearerToken(request)
    const decoded = await getAdminAuth().verifyIdToken(token, true)
    const principal = await resolveStaffPrincipal(restaurantId, decoded)
    if (principal.kind !== "staff") {
      return failure("FORBIDDEN", "Accès personnel obligatoire.", 403, requestId)
    }
    const body = await request.json().catch(() => null)
    if (!isRecord(body)) {
      return failure("INVALID_PAYLOAD", "Contenu JSON invalide.", 400, requestId)
    }
    const ledger = new FirestorePaymentLedger(getAdminFirestore())
    let result

    if (body.command === "REFUND_PAYMENT") {
      result = await ledger.refundPayment({
        restaurantId,
        paymentId: requiredString(body.paymentId, "paymentId"),
        cashierId: principal.uid,
        amount: positiveAmount(body.amount),
        reason: requiredString(body.reason, "reason"),
        idempotencyKey: requiredString(body.idempotencyKey, "idempotencyKey"),
      })
    } else if (body.command === "VOID_PAYMENT") {
      result = await ledger.voidPayment({
        restaurantId,
        paymentId: requiredString(body.paymentId, "paymentId"),
        cashierId: principal.uid,
        reason: requiredString(body.reason, "reason"),
      })
    } else if (body.command === "RECONCILE_SESSION") {
      if (!principal.roles.some((role) => role === "manager" || role === "owner")) {
        return failure(
          "FORBIDDEN",
          "La réconciliation est réservée au manager.",
          403,
          requestId
        )
      }
      result = await ledger.reconcileSession({
        restaurantId,
        sessionId: requiredString(body.sessionId, "sessionId"),
        actorId: principal.uid,
        repair: body.repair === true,
      })
    } else {
      return failure("FORBIDDEN_COMMAND", "Commande financière interdite.", 403, requestId)
    }

    console.info("FINANCIAL_LEDGER_COMMAND_COMMITTED", {
      requestId,
      restaurantId,
      command: body.command,
      actorId: principal.uid,
      repaired: "repaired" in result ? result.repaired : undefined,
      replayed: "replayed" in result ? result.replayed : undefined,
    })
    return Response.json({ ok: true, result, requestId })
  } catch (error) {
    const api = financialApiError(error)
    console.error("FINANCIAL_LEDGER_COMMAND_REJECTED", {
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
  const token = authorization.slice(7).trim()
  if (!token) throw new ApiError("UNAUTHENTICATED", "Authentification obligatoire.", 401)
  return token
}

function financialApiError(error: unknown) {
  if (error instanceof ApiError) return error
  if (error instanceof FinancialLedgerError) {
    const status =
      error.code === "PAYMENT_NOT_FOUND" || error.code === "CASH_SESSION_NOT_FOUND"
        ? 404
        : error.code === "CASH_SESSION_OWNERSHIP_MISMATCH"
          ? 403
          : 409
    return new ApiError(error.code, error.message, status)
  }
  return new ApiError("INTERNAL_ERROR", "La commande financière a échoué.", 500)
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new ApiError("INVALID_PAYLOAD", `${field} est invalide.`, 400)
  }
  return value.trim()
}

function positiveAmount(value: unknown) {
  const amount = Math.round(Number(value))
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError("INVALID_PAYLOAD", "amount est invalide.", 400)
  }
  return amount
}

function failure(
  code: string,
  message: string,
  status: number,
  requestId: string
) {
  return Response.json(
    { ok: false, error: { code, message, retryable: false }, requestId },
    { status }
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

class ApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, message: string, status: number) {
    super(message)
    this.code = code
    this.status = status
  }
}
