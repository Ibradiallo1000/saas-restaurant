import { randomUUID } from "node:crypto"

import { FieldValue, type Firestore } from "firebase-admin/firestore"

export interface CreateRestaurantInput {
  name: string
  email: string
  slug: string
  userId: string
  requestId?: string
}

export interface CreateRestaurantResult {
  success: true
  companyId: string
  restaurantId: string
}

export interface CreateRestaurantOptions {
  actorId?: string
}

export class OnboardingError extends Error {
  constructor(message: string, readonly statusCode = 400) {
    super(message)
    this.name = "OnboardingError"
  }
}

const COLLECTIONS = {
  companies: "companies",
  restaurants: "restaurants",
  restaurantSlugs: "restaurantSlugs",
  subscriptions: "subscriptions",
  users: "users",
  staff: "staff",
  userEmails: "userEmails",
  auditLogs: "audit_logs",
} as const

const OWNER_ROLE = "owner" as const

export async function createRestaurantOnboarding(
  db: Firestore,
  input: CreateRestaurantInput,
  options: CreateRestaurantOptions = {}
): Promise<CreateRestaurantResult> {
  const payload = normalizeInput(input)
  const companyId = randomUUID()
  const restaurantId = randomUUID()

  await db.runTransaction(async (transaction) => {
    const companyRef = db.collection(COLLECTIONS.companies).doc(companyId)
    const rootRestaurantRef = db.collection(COLLECTIONS.restaurants).doc(restaurantId)
    const companyRestaurantRef = companyRef.collection(COLLECTIONS.restaurants).doc(restaurantId)
    const rootSubscriptionRef = db.collection(COLLECTIONS.subscriptions).doc(restaurantId)
    const companySubscriptionRef = companyRef.collection("subscription").doc("current")
    const userRef = db.collection(COLLECTIONS.users).doc(payload.userId)
    const rootStaffRef = rootRestaurantRef.collection(COLLECTIONS.staff).doc(payload.userId)
    const companyRestaurantUserRef = companyRestaurantRef.collection(COLLECTIONS.users).doc(payload.userId)
    const slugRef = db.collection(COLLECTIONS.restaurantSlugs).doc(payload.slug)
    const emailRef = db.collection(COLLECTIONS.userEmails).doc(payload.email)
    const auditLogRef = db.collection(COLLECTIONS.auditLogs).doc(randomUUID())
    const requestRef = payload.requestId ? db.collection("requests").doc(payload.requestId) : null

    const [slugSnap, userSnap, emailSnap, requestSnap] = await Promise.all([
      transaction.get(slugRef),
      transaction.get(userRef),
      transaction.get(emailRef),
      requestRef ? transaction.get(requestRef) : Promise.resolve(null),
    ])

    if (slugSnap.exists) {
      throw new OnboardingError("Slug deja utilise.", 400)
    }

    if (userSnap.exists) {
      throw new OnboardingError("Cet utilisateur existe deja dans Firestore.", 400)
    }

    if (emailSnap.exists) {
      throw new OnboardingError("Cet email est deja associe a un utilisateur.", 400)
    }

    if (requestRef && !requestSnap?.exists) {
      throw new OnboardingError("Demande introuvable.", 400)
    }

    if (requestSnap?.exists) {
      const requestData = requestSnap.data()
      if (requestData?.processed === true || requestData?.status !== "pending") {
        throw new OnboardingError("Cette demande a deja ete traitee.", 400)
      }
    }

    const createdAt = FieldValue.serverTimestamp()
    const restaurant = {
      id: restaurantId,
      companyId,
      name: payload.name,
      slug: payload.slug,
      email: payload.email,
      country: "ML",
      currency: "XOF",
      status: "active",
      source: "admin",
      createdAt,
    }
    const subscription = {
      id: restaurantId,
      restaurantId,
      companyId,
      plan: "custom",
      status: "lifetime",
      isManual: true,
      createdAt,
    }
    const ownerUser = {
      id: payload.userId,
      companyId,
      restaurantId,
      email: payload.email,
      role: OWNER_ROLE,
      roles: [OWNER_ROLE],
      activeRole: OWNER_ROLE,
      createdAt,
    }
    const staffUser = {
      id: payload.userId,
      userId: payload.userId,
      companyId,
      restaurantId,
      email: payload.email,
      role: OWNER_ROLE,
      roles: [OWNER_ROLE],
      activeRole: OWNER_ROLE,
      active: true,
      status: "active",
      createdAt,
      updatedAt: createdAt,
    }
    const nestedRestaurantUser = {
      id: payload.userId,
      name: payload.email.split("@")[0],
      email: payload.email,
      roles: [OWNER_ROLE],
      activeRole: OWNER_ROLE,
      isActive: true,
      createdAt,
    }

    transaction.set(slugRef, {
      slug: payload.slug,
      restaurantId,
      companyId,
      createdAt,
    })

    transaction.set(companyRef, {
      id: companyId,
      name: payload.name,
      email: payload.email,
      source: "admin",
      createdAt,
    })

    transaction.set(rootRestaurantRef, restaurant)
    transaction.set(companyRestaurantRef, restaurant)
    transaction.set(rootSubscriptionRef, subscription)
    transaction.set(companySubscriptionRef, {
      ...subscription,
      currentPeriodEnd: null,
      modules: {
        kitchen: true,
        inventory: true,
        analytics: true,
        multiBranch: false,
      },
    })
    transaction.set(userRef, ownerUser)
    transaction.set(rootStaffRef, staffUser)
    transaction.set(companyRestaurantUserRef, nestedRestaurantUser)
    transaction.set(emailRef, {
      uid: payload.userId,
      email: payload.email,
      restaurantId,
      companyId,
      createdAt,
    })
    transaction.set(auditLogRef, {
      action: "CREATE_RESTAURANT",
      actorId: options.actorId ?? "system",
      targetId: restaurantId,
      metadata: {
        companyId,
        restaurantId,
        ownerId: payload.userId,
        email: payload.email,
        slug: payload.slug,
        requestId: payload.requestId ?? null,
        source: "admin",
        subscriptionStatus: "lifetime",
        subscriptionPlan: "custom",
      },
      createdAt,
    })

    if (requestRef) {
      transaction.update(requestRef, {
        status: "approved",
        processed: true,
        restaurantId,
        companyId,
        processedAt: createdAt,
      })
    }
  })

  return {
    success: true,
    companyId,
    restaurantId,
  }
}

function normalizeInput(input: CreateRestaurantInput): CreateRestaurantInput {
  if (!input || typeof input !== "object") {
    throw new OnboardingError("Payload invalide.", 400)
  }

  const name = typeof input.name === "string" ? input.name.trim() : ""
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : ""
  const slug = typeof input.slug === "string" ? slugify(input.slug) : ""
  const userId = typeof input.userId === "string" ? input.userId.trim() : ""
  const requestId = typeof input.requestId === "string" ? input.requestId.trim() : ""

  if (!name) {
    throw new OnboardingError("Le nom du restaurant est requis.", 400)
  }

  if (!isValidEmail(email)) {
    throw new OnboardingError("Email invalide.", 400)
  }

  if (!slug) {
    throw new OnboardingError("Slug invalide.", 400)
  }

  if (!userId) {
    throw new OnboardingError("userId manquant.", 400)
  }

  if (userId.includes("/")) {
    throw new OnboardingError("userId invalide.", 400)
  }

  return {
    name,
    email,
    slug,
    userId,
    ...(requestId ? { requestId } : {}),
  }
}

function isValidEmail(email: string): boolean {
  return /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(email)
}

function slugify(value: string): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
