import { NextRequest } from "next/server"

import { getAdminAuth, getAdminFirestore } from "@/server/firebase-admin"
import { FirestoreCashSessionOpen } from "@/server/finance/firestore-cash-session-open"
import { FinancialLedgerError } from "@/server/finance/firestore-payment-ledger"
import { resolveStaffPrincipal } from "@/server/orders/create/security"

export async function POST(request: NextRequest, context: { params: Promise<{ restaurantId: string }> }) {
  try {
    const { restaurantId } = await context.params
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || ""
    if (!token) return failure("UNAUTHENTICATED", "Authentification obligatoire.", 401)
    const decoded = await getAdminAuth().verifyIdToken(token, true)
    const principal = await resolveStaffPrincipal(restaurantId, decoded)
    if (principal.kind !== "staff") return failure("FORBIDDEN", "Accès personnel obligatoire.", 403)
    const body = await request.json().catch(() => null)
    if (!body || body.command !== "OPEN_SESSION") return failure("INVALID_COMMAND", "Commande invalide.", 400)
    const actorRole = ["owner", "manager", "cashier"].find((role) => principal.roles.includes(role))
    if (!actorRole) return failure("FORBIDDEN", "Rôle caisse obligatoire.", 403)
    const cashierId = typeof body.cashierId === "string" && body.cashierId.trim() ? body.cashierId.trim() : principal.uid
    const result = await new FirestoreCashSessionOpen(getAdminFirestore()).open({
      restaurantId,
      cashierId,
      requestedBy: principal.uid,
      requestedByRole: actorRole,
      posStationId: typeof body.posStationId === "string" ? body.posStationId : null,
      legacySessionId: typeof body.legacySessionId === "string" ? body.legacySessionId : null,
      deviceInstanceId: typeof body.deviceInstanceId === "string" ? body.deviceInstanceId : null,
    })
    return Response.json({ ok: true, result })
  } catch (error) {
    if (error instanceof FinancialLedgerError) {
      const status = error.code === "FORBIDDEN" || error.code === "POS_STATION_FORBIDDEN" ? 403 : error.code.includes("NOT_FOUND") ? 404 : 409
      console.error("CASH_SESSION_OPEN_BUSINESS_ERROR", { code: error.code, message: error.message, restaurantId: (await context.params)?.restaurantId })
      return failure(error.code, error.message, status)
    }
    const metadata = error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { value: String(error) }
    console.error("CASH_SESSION_OPEN_FAILED", metadata)
    const cause = error instanceof Error ? error.message : String(error)
    return failure("INTERNAL_ERROR", cause, 500)
  }
}

function failure(code: string, message: string, status: number) {
  return Response.json({ ok: false, error: { code, message } }, { status })
}
