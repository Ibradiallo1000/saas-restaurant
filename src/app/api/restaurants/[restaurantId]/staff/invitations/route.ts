import { NextRequest, NextResponse } from "next/server"
import type { Firestore } from "firebase-admin/firestore"

import { getAdminAuth, getAdminFirestore } from "@/server/firebase-admin"
import { requireFirebaseUser } from "@/server/auth/api-auth"

export const runtime = "nodejs"

const ALLOWED_ROLES = new Set(["owner", "manager", "cashier", "kitchen", "server"])

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ restaurantId: string }> }
) {
  try {
    const auth = await requireFirebaseUser(request)
    if (!auth.ok) return auth.response

    const { restaurantId } = await context.params
    const body = (await request.json()) as {
      email?: string
      role?: string
      nomComplet?: string
      telephone?: string
    }
    const email = body.email?.trim().toLowerCase()
    const role = body.role?.trim().toLowerCase()
    const nomComplet = body.nomComplet?.trim()
    const telephone = body.telephone?.trim()

    if (!restaurantId || !nomComplet || !telephone || !role || !ALLOWED_ROLES.has(role)) {
      return NextResponse.json({ error: "Invitation staff invalide." }, { status: 400 })
    }

    const db = getAdminFirestore()
    const canInvite = await canManageStaff(db, restaurantId, auth.decodedToken.uid)

    if (!canInvite) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    }

    const adminAuth = getAdminAuth()
    let userRecord
    let inviteLink: string | null = null

    if (email) {
      try {
        userRecord = await adminAuth.getUserByEmail(email)
      } catch (error: any) {
        if (error?.code !== "auth/user-not-found") throw error
        userRecord = await adminAuth.createUser({ email, emailVerified: false })
      }
    }

    const staffRef = email && userRecord
      ? db.collection("restaurants").doc(restaurantId).collection("staff").doc(userRecord.uid)
      : db.collection("restaurants").doc(restaurantId).collection("staff").doc()
    const uid = userRecord?.uid ?? staffRef.id
    const now = new Date()
    if (email) {
      inviteLink = await adminAuth.generatePasswordResetLink(email)
    }

    const batch = db.batch()

    if (email) {
      const rootUserRef = db.collection("users").doc(uid)
      batch.set(
        rootUserRef,
        {
          id: uid,
          email,
          nomComplet,
          telephone,
          role,
          restaurantId,
          active: true,
          actif: true,
          status: "invited",
          inviteLink,
          invitedAt: now,
          updatedAt: now,
        },
        { merge: true }
      )
    }

    batch.set(
      staffRef,
      {
        id: uid,
        email: email || null,
        nomComplet,
        telephone,
        role,
        restaurantId,
        active: true,
        actif: true,
        status: email ? "invited" : "active",
        inviteLink,
        invitedAt: now,
        updatedAt: now,
      },
      { merge: true }
    )

    await batch.commit()

    return NextResponse.json({ uid, inviteLink })
  } catch (error: any) {
    console.error("STAFF_INVITATION_FAILED", error)
    return NextResponse.json(
      { error: getInvitationErrorMessage(error) },
      { status: 500 }
    )
  }
}

async function canManageStaff(db: Firestore, restaurantId: string, uid: string) {
  const [rootUserSnap, staffSnap, restaurantSnap] = await Promise.all([
    db.collection("users").doc(uid).get(),
    db.collection("restaurants").doc(restaurantId).collection("staff").doc(uid).get(),
    db.collection("restaurants").doc(restaurantId).get(),
  ])

  const rootUser = rootUserSnap.data()
  if (rootUser?.role === "super_admin" || rootUser?.role === "admin") return true
  if (rootUser?.restaurantId === restaurantId && ["owner", "manager"].includes(rootUser?.role)) return true

  const staff = staffSnap.data()
  if (["owner", "manager"].includes(staff?.role)) return true

  return restaurantSnap.data()?.ownerId === uid
}

function getInvitationErrorMessage(error: any) {
  if (error?.code === "auth/invalid-email") return "Email invalide."
  if (error?.code === "auth/email-already-exists") return "Cet email existe deja dans Firebase Auth."
  if (error?.message?.includes("Could not load the default credentials")) {
    return "Configuration Firebase Admin manquante."
  }

  return "Impossible de generer l'invitation staff."
}
