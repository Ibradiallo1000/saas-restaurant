import { randomUUID } from "node:crypto"

import type { NextRequest } from "next/server"

import { getAdminAuth, getAdminFirestore } from "@/server/firebase-admin"
import { FirestoreAtomicOrderCommandStore } from "@/server/orders/commands"
import { resolveStaffPrincipal } from "@/server/orders/create/security"
import { handleKitchenCommandRequest } from "@/server/orders/kitchen-command/handler"
import { handlePosCommandRequest, POS_COMMANDS } from "@/server/orders/pos-command/handler"
import { verifyOrderAppCheckToken } from "@/server/orders/verify-app-check"

export const runtime = "nodejs"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ restaurantId: string; orderId: string }> }
) {
  const params = await context.params
  const body = await request.clone().json().catch(() => null)
  const handler =
    body && POS_COMMANDS.includes(body.command)
      ? handlePosCommandRequest
      : handleKitchenCommandRequest
  return handler(request, params, {
    store: new FirestoreAtomicOrderCommandStore(getAdminFirestore()),
    verifyIdToken: (token) => getAdminAuth().verifyIdToken(token, true),
    resolveStaffPrincipal,
    verifyAppCheck: verifyOrderAppCheckToken,
    requestId: randomUUID,
    log: console,
  })
}
