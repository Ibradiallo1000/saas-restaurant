import type { DecodedIdToken } from "firebase-admin/auth"
import { NextRequest, NextResponse } from "next/server"

import { getAdminAuth, getAdminFirestore } from "@/server/firebase-admin"

export type ApiAuthResult =
  | { ok: true; decodedToken: DecodedIdToken }
  | { ok: false; response: NextResponse }

export async function requireFirebaseUser(request: NextRequest): Promise<ApiAuthResult> {
  const authorization = request.headers.get("authorization")
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null

  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Missing bearer token." }, { status: 401 }),
    }
  }

  const decodedToken = await getAdminAuth().verifyIdToken(token).catch((error) => {
    console.error("FIREBASE_TOKEN_VERIFY_FAILED", error)
    return null
  })

  if (!decodedToken) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid token." }, { status: 401 }),
    }
  }

  return { ok: true, decodedToken }
}

export async function requireSuperAdmin(request: NextRequest): Promise<ApiAuthResult> {
  const auth = await requireFirebaseUser(request)

  if (!auth.ok) return auth

  const userDoc = await getAdminFirestore().collection("users").doc(auth.decodedToken.uid).get()
  const role = userDoc.data()?.role

  if (role !== "super_admin") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden." }, { status: 403 }),
    }
  }

  return auth
}
