import { randomUUID } from "node:crypto"

import { NextRequest, NextResponse } from "next/server"

import { getAdminFirestore } from "@/server/firebase-admin"
import {
  asCanonicalOrderError,
  CanonicalOrderError,
  createCanonicalOrder,
} from "@/server/orders/create"
import { FirestoreAtomicOrderCreationStore } from "@/server/orders/create/firestore-store"
import { resolveOrderPrincipal } from "@/server/orders/create/security"

export const runtime = "nodejs"

const MAX_BODY_BYTES = 128 * 1024

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ restaurantId: string }> }
) {
  const requestId = randomUUID()
  const startedAt = Date.now()
  try {
    assertBodySize(request)
    const { restaurantId } = await context.params
    const body = await parseJson(request)
    const principal = await resolveOrderPrincipal({ request, restaurantId, body })
    const result = await createCanonicalOrder(
      { store: new FirestoreAtomicOrderCreationStore(getAdminFirestore()) },
      {
        restaurantId,
        body,
        principal,
        idempotencyKey: request.headers.get("idempotency-key"),
      }
    )
    console.info("ORDER_CREATE_COMMITTED", {
      requestId,
      restaurantId,
      channel: result.channel,
      orderId: result.orderId,
      replayed: result.replayed,
      durationMs: Date.now() - startedAt,
    })
    return NextResponse.json(
      { ...result, requestId },
      { status: result.replayed ? 200 : 201 }
    )
  } catch (error) {
    const canonical = asCanonicalOrderError(error)
    console.error("ORDER_CREATE_REJECTED", {
      requestId,
      code: canonical.code,
      retryable: canonical.retryable,
      durationMs: Date.now() - startedAt,
    })
    return NextResponse.json(
      {
        ok: false,
        code: canonical.code,
        message: canonical.message,
        requestId,
        fieldErrors: canonical.fieldErrors,
        retryable: canonical.retryable,
      },
      { status: canonical.status }
    )
  }
}

function assertBodySize(request: NextRequest) {
  const length = Number(request.headers.get("content-length") ?? 0)
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
    throw new CanonicalOrderError("PAYLOAD_TOO_LARGE", "La requête est trop volumineuse.")
  }
  const contentType = request.headers.get("content-type") ?? ""
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new CanonicalOrderError("INVALID_JSON", "Le contenu doit être au format JSON.")
  }
}

async function parseJson(request: NextRequest) {
  try {
    const text = await request.text()
    if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) {
      throw new CanonicalOrderError("PAYLOAD_TOO_LARGE", "La requête est trop volumineuse.")
    }
    return JSON.parse(text)
  } catch (error) {
    if (error instanceof CanonicalOrderError) throw error
    throw new CanonicalOrderError("INVALID_JSON", "Le contenu JSON est invalide.")
  }
}
