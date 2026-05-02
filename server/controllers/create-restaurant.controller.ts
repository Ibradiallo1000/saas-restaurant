import { requireSuperAdmin, assertOwnerAuthUserMatches } from "../auth/require-super-admin"
import { getAdminFirestore } from "../firebase-admin"
import {
  createRestaurantOnboarding,
  OnboardingError,
  type CreateRestaurantInput,
} from "../services/create-restaurant.service"

interface HttpRequest {
  body?: unknown
  headers: Record<string, unknown>
}

interface HttpResponse {
  status: (statusCode: number) => HttpResponse
  json: (body: unknown) => void
}

export async function createRestaurantController(request: HttpRequest, response: HttpResponse) {
  try {
    const actorId = await requireSuperAdmin(request.headers.authorization)
    const input = request.body as CreateRestaurantInput

    await assertOwnerAuthUserMatches(input)

    const result = await createRestaurantOnboarding(getAdminFirestore(), input, { actorId })

    response.status(201).json(result)
  } catch (error) {
    if (error instanceof OnboardingError) {
      response.status(error.statusCode).json({ error: error.message })
      return
    }

    console.error("CREATE_RESTAURANT_FAILED", error)
    response.status(500).json({ error: "Creation restaurant impossible." })
  }
}
