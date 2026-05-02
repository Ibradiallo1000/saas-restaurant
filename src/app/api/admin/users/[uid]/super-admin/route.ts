import { NextRequest, NextResponse } from "next/server"

import { requireSuperAdmin } from "@/server/auth/api-auth"
import { getAdminFirestore } from "@/server/firebase-admin"
import { writeAuditLog } from "@/server/audit-log"
import { writeCaughtErrorLog } from "@/server/error-log"

export const runtime = "nodejs"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ uid: string }> }
) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return auth.response

  try {
    const { uid } = await context.params
    await getAdminFirestore().collection("users").doc(uid).set(
      {
        role: "super_admin",
      },
      { merge: true }
    )
    await writeAuditLog({
      action: "SET_SUPER_ADMIN",
      actorId: auth.decodedToken.uid,
      targetId: uid,
      metadata: {
        route: "/api/admin/users/[uid]/super-admin",
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("SET_SUPER_ADMIN failed", error)
    await writeCaughtErrorLog(error, {
      route: "/api/admin/users/[uid]/super-admin",
      actorId: auth.decodedToken.uid,
    })
    return NextResponse.json({ error: "Set super admin failed." }, { status: 500 })
  }
}
