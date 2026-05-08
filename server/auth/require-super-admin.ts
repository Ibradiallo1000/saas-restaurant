import { getAdminAuth, getAdminFirestore } from "../firebase-admin"
import { OnboardingError, type CreateRestaurantInput } from "../services/create-restaurant.service"

export async function requireSuperAdmin(authorizationHeader: unknown): Promise<string> {
  const token = getBearerToken(authorizationHeader)

  if (!token) {
    throw new OnboardingError("Missing bearer token.", 401)
  }

  const decodedToken = await getAdminAuth().verifyIdToken(token).catch(() => null)

  if (!decodedToken) {
    throw new OnboardingError("Invalid token.", 401)
  }

  const userSnap = await getAdminFirestore().collection("users").doc(decodedToken.uid).get()

  if (userSnap.data()?.role !== "super_admin") {
    throw new OnboardingError("Forbidden.", 403)
  }

  return decodedToken.uid
}

export async function assertOwnerAuthUserMatches(input: CreateRestaurantInput): Promise<void> {
  const email = typeof input?.email === "string" ? input.email.trim().toLowerCase() : ""
  const userId = typeof input?.userId === "string" ? input.userId.trim() : ""

  if (!userId) {
    throw new OnboardingError("userId manquant.", 400)
  }

  const authUser = await getAdminAuth()
    .getUser(userId)
    .catch(() => null)

  if (!authUser) {
    throw new OnboardingError("Utilisateur Firebase Auth introuvable.", 400)
  }

  if (authUser.email && authUser.email.toLowerCase() !== email) {
    throw new OnboardingError("L'email ne correspond pas au userId Firebase Auth.", 400)
  }
}

function getBearerToken(authorizationHeader: unknown): string | null {
  const authorization = Array.isArray(authorizationHeader)
    ? authorizationHeader[0]
    : typeof authorizationHeader === "string"
      ? authorizationHeader
      : null

  return authorization?.startsWith("Bearer ") ? authorization.slice(7) : null
}
