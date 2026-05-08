import { NextRequest, NextResponse } from "next/server"

import { getAdminAuth } from "@/server/firebase-admin"
import { requireSuperAdmin } from "@/server/auth/api-auth"
import { writeCaughtErrorLog } from "@/server/error-log"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return auth.response

  try {
    const body = (await request.json()) as { email?: string }
    const email = body.email?.trim().toLowerCase()

    if (!email) {
      return NextResponse.json({ error: "Missing email." }, { status: 400 })
    }

    const setupLink = await getAdminAuth().generatePasswordResetLink(email)

    return NextResponse.json({ setupLink })
  } catch (error) {
    console.error("INVITATION_LINK failed", error)
    await writeCaughtErrorLog(error, {
      route: "/api/admin/invitations",
      actorId: auth.decodedToken.uid,
    })
    return NextResponse.json({ error: "Invitation failed." }, { status: 500 })
  }
}
