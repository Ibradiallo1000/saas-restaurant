import { NextRequest, NextResponse } from "next/server"
import { FieldValue, type DocumentData } from "firebase-admin/firestore"

import { getAdminFirestore } from "@/server/firebase-admin"
import { requireFirebaseUser } from "@/server/auth/api-auth"
import { writeCaughtErrorLog } from "@/server/error-log"
import { DEFAULT_GRACE_DAYS, SUBSCRIPTION_STATUS } from "@/lib/constants"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const auth = await requireFirebaseUser(request)
  if (!auth.ok) return auth.response
  const decodedToken = auth.decodedToken

  const companyId = request.nextUrl.searchParams.get("companyId")
  const restaurantId = request.nextUrl.searchParams.get("restaurantId")

  try {
    const db = getAdminFirestore()
    const userDoc = await db.collection("users").doc(decodedToken.uid).get()
    const userData = userDoc.data()

    if (userData?.role === "super_admin") {
      return NextResponse.json({ allowed: true, status: "active" })
    }

    if (!restaurantId) {
      return NextResponse.json({ allowed: false, reason: "missing-restaurant" }, { status: 400 })
    }

    if (companyId && restaurantId) {
      const nestedUser = await db
        .collection("companies")
        .doc(companyId)
        .collection("restaurants")
        .doc(restaurantId)
        .collection("users")
        .doc(decodedToken.uid)
        .get()

      if (!nestedUser.exists || nestedUser.data()?.isActive !== true) {
        return NextResponse.json({ allowed: false, reason: "restaurant-mismatch" }, { status: 403 })
      }

      const nestedSubscription = await getCompanySubscription(companyId)

      if (!nestedSubscription) {
        return NextResponse.json({ allowed: false, reason: "missing-subscription" })
      }

      return await evaluateSubscriptionAccess({
        restaurantId,
        subscriptionId: "current",
        subscription: nestedSubscription,
        companyId,
      })
    }

    const userRestaurantId = userData?.restaurantId

    if (userRestaurantId !== restaurantId) {
      return NextResponse.json({ allowed: false, reason: "restaurant-mismatch" }, { status: 403 })
    }

    const subscriptionRecord = await getRestaurantSubscription(restaurantId)

    if (!subscriptionRecord) {
      return NextResponse.json({ allowed: false, reason: "missing-subscription" })
    }

    return await evaluateSubscriptionAccess({
      restaurantId,
      subscriptionId: subscriptionRecord.id,
      subscription: subscriptionRecord.data,
    })
  } catch (error) {
    await writeCaughtErrorLog(error, {
      route: "/api/subscriptions/access",
      actorId: decodedToken.uid,
      companyId,
      restaurantId,
    })
    return NextResponse.json({ allowed: false, reason: "subscription-check-failed" }, { status: 500 })
  }
}

async function evaluateSubscriptionAccess({
  restaurantId,
  subscriptionId,
  subscription,
  companyId,
}: {
  restaurantId: string
  subscriptionId: string
  subscription: DocumentData
  companyId?: string
}) {
    const trialEndsAtMs = subscription.trialEndsAt?.toDate?.().getTime()
    const currentPeriodEndMs = subscription.currentPeriodEnd?.toDate?.().getTime()
    const graceEndsAtMs = subscription.graceEndsAt?.toDate?.().getTime()
    const now = Date.now()

    if (subscription.status === SUBSCRIPTION_STATUS.LIFETIME) {
      return NextResponse.json({
        allowed: true,
        status: subscription.status,
        reason: "lifetime-access",
      })
    }

    if (subscription.status === SUBSCRIPTION_STATUS.TRIAL) {
      const allowed = typeof trialEndsAtMs === "number" && trialEndsAtMs > now

      if (!allowed) {
        await suspendSubscription(restaurantId, subscriptionId, companyId)

        return NextResponse.json({
          allowed: false,
          status: SUBSCRIPTION_STATUS.SUSPENDED,
          reason: "trial-expired",
        })
      }

      return NextResponse.json({
        allowed: true,
        status: subscription.status,
        trialEndsAt: subscription.trialEndsAt?.toDate?.().toISOString?.() ?? null,
      })
    }

    if (subscription.status === SUBSCRIPTION_STATUS.ACTIVE) {
      if (typeof currentPeriodEndMs !== "number") {
        await suspendSubscription(restaurantId, subscriptionId, companyId)

        return NextResponse.json({
          allowed: false,
          status: SUBSCRIPTION_STATUS.SUSPENDED,
          reason: "missing-current-period",
        })
      }

      if (currentPeriodEndMs > now) {
        return NextResponse.json({
          allowed: true,
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd?.toDate?.().toISOString?.() ?? null,
        })
      }

      const graceEndsAt = subscription.graceEndsAt?.toDate?.() ?? addDays(new Date(), DEFAULT_GRACE_DAYS)
      const stillInGrace = graceEndsAt.getTime() > now

      if (stillInGrace) {
        await moveSubscriptionToGrace(restaurantId, subscriptionId, graceEndsAt, companyId)

        return NextResponse.json({
          allowed: true,
          status: SUBSCRIPTION_STATUS.GRACE,
          graceEndsAt: graceEndsAt.toISOString(),
          reason: "period-ended-grace-started",
        })
      }

      await suspendSubscription(restaurantId, subscriptionId, companyId)

      return NextResponse.json({
        allowed: false,
        status: SUBSCRIPTION_STATUS.SUSPENDED,
        reason: "period-ended",
      })
    }

    if (subscription.status === SUBSCRIPTION_STATUS.GRACE) {
      const allowed = typeof graceEndsAtMs === "number" && graceEndsAtMs > now

      if (!allowed) {
        await suspendSubscription(restaurantId, subscriptionId, companyId)

        return NextResponse.json({
          allowed: false,
          status: SUBSCRIPTION_STATUS.SUSPENDED,
          reason: "grace-ended",
        })
      }

      return NextResponse.json({
        allowed: true,
        status: subscription.status,
        graceEndsAt: subscription.graceEndsAt?.toDate?.().toISOString?.() ?? null,
      })
    }

    return NextResponse.json({
      allowed: false,
      status: subscription.status,
      reason: "subscription-suspended",
      trialEndsAt: subscription.trialEndsAt?.toDate?.().toISOString?.() ?? null,
      currentPeriodEnd: subscription.currentPeriodEnd?.toDate?.().toISOString?.() ?? null,
      graceEndsAt: subscription.graceEndsAt?.toDate?.().toISOString?.() ?? null,
      currentPeriodEnded: typeof currentPeriodEndMs === "number" ? currentPeriodEndMs < now : false,
    })
}

async function getRestaurantSubscription(restaurantId: string) {
  const db = getAdminFirestore()
  const directDoc = await db.collection("subscriptions").doc(restaurantId).get()

  if (directDoc.exists) {
    return {
      id: directDoc.id,
      data: directDoc.data()!,
    }
  }

  const querySnap = await db
    .collection("subscriptions")
    .where("restaurantId", "==", restaurantId)
    .get()

  if (querySnap.empty) return null

  const latestDoc = querySnap.docs
    .map((doc) => doc.data())
    .map((data, index) => ({ id: querySnap.docs[index].id, data }))
    .sort((first, second) => {
      const firstTime = first.data.createdAt?.toMillis?.() ?? 0
      const secondTime = second.data.createdAt?.toMillis?.() ?? 0
      return secondTime - firstTime
    })[0]

  return latestDoc
}

async function getCompanySubscription(companyId: string) {
  const db = getAdminFirestore()
  const subscriptionDoc = await db
    .collection("companies")
    .doc(companyId)
    .collection("subscription")
    .doc("current")
    .get()

  return subscriptionDoc.exists ? subscriptionDoc.data()! : null
}

async function moveSubscriptionToGrace(
  restaurantId: string,
  subscriptionId: string,
  graceEndsAt: Date,
  companyId?: string
) {
  const db = getAdminFirestore()
  const batch = db.batch()

  if (companyId) {
    batch.update(db.collection("companies").doc(companyId).collection("subscription").doc("current"), {
      status: SUBSCRIPTION_STATUS.GRACE,
      graceEndsAt,
      isManual: true,
      updatedAt: FieldValue.serverTimestamp(),
    })
    batch.update(db.collection("companies").doc(companyId).collection("restaurants").doc(restaurantId), {
      status: "active",
      updatedAt: FieldValue.serverTimestamp(),
    })
    await batch.commit()
    return
  }

  batch.update(db.collection("subscriptions").doc(subscriptionId), {
    status: SUBSCRIPTION_STATUS.GRACE,
    graceEndsAt,
    isManual: true,
    updatedAt: FieldValue.serverTimestamp(),
  })
  batch.update(db.collection("restaurants").doc(restaurantId), {
    status: "active",
    updatedAt: FieldValue.serverTimestamp(),
  })

  await batch.commit()
}

async function suspendSubscription(restaurantId: string, subscriptionId: string, companyId?: string) {
  const db = getAdminFirestore()
  const batch = db.batch()

  if (companyId) {
    batch.update(db.collection("companies").doc(companyId).collection("subscription").doc("current"), {
      status: SUBSCRIPTION_STATUS.SUSPENDED,
      updatedAt: FieldValue.serverTimestamp(),
    })
    batch.update(db.collection("companies").doc(companyId).collection("restaurants").doc(restaurantId), {
      status: "suspended",
      updatedAt: FieldValue.serverTimestamp(),
    })
    await batch.commit()
    return
  }

  batch.update(db.collection("subscriptions").doc(subscriptionId), {
    status: SUBSCRIPTION_STATUS.SUSPENDED,
    updatedAt: FieldValue.serverTimestamp(),
  })
  batch.update(db.collection("restaurants").doc(restaurantId), {
    status: "suspended",
    updatedAt: FieldValue.serverTimestamp(),
  })

  await batch.commit()
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}
