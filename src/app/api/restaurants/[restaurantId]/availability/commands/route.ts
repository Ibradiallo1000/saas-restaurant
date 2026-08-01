import { NextRequest, NextResponse } from "next/server"

import { requireFirebaseUser } from "@/server/auth/api-auth"
import { getAdminFirestore } from "@/server/firebase-admin"
import {
  AvailabilityCommandError,
  executeAvailabilityCommand,
  type AvailabilityActor,
  type AvailabilityCommand,
} from "@/server/availability/availability-service"

export async function POST(request: NextRequest, context: { params: Promise<{ restaurantId: string }> }) {
  const auth = await requireFirebaseUser(request)
  if (!auth.ok) return auth.response
  const { restaurantId } = await context.params
  const db = getAdminFirestore()
  const actor = await resolveActor(db, restaurantId, auth.decodedToken.uid)
  if (!actor) return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  const command = await request.json().catch(() => null) as AvailabilityCommand | null
  if (!command || typeof command.type !== "string") return NextResponse.json({ error: "Invalid command." }, { status: 400 })
  try {
    const result = await executeAvailabilityCommand({ db, restaurantId, actor, command })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof AvailabilityCommandError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.code === "FORBIDDEN" ? 403 : error.code === "PRODUCT_NOT_FOUND" ? 404 : 422 })
    }
    console.error("AVAILABILITY_COMMAND_FAILED", error)
    return NextResponse.json({ error: "Availability command failed." }, { status: 500 })
  }
}

async function resolveActor(db: FirebaseFirestore.Firestore, restaurantId: string, uid: string): Promise<AvailabilityActor | null> {
  const [userSnapshot, staffSnapshot] = await Promise.all([
    db.collection("users").doc(uid).get(),
    db.collection("restaurants").doc(restaurantId).collection("staff").doc(uid).get(),
  ])
  const user = userSnapshot.data() ?? {}
  const staff = staffSnapshot.data() ?? {}
  const role = String(staff.role || (user.restaurantId === restaurantId ? user.role : ""))
  if (!['owner', 'manager', 'kitchen'].includes(role)) return null
  return { uid, role, origin: role === "kitchen" ? "KITCHEN" : role === "owner" ? "OWNER" : "MANAGER" }
}
