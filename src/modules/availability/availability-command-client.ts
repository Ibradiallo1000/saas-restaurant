import type { User } from "firebase/auth"
import type { AvailabilityCommand } from "@/server/availability/availability-service"

export async function executeAvailabilityCommandClient(input: {
  user: User
  restaurantId: string
  command: AvailabilityCommand
}) {
  const token = await input.user.getIdToken()
  const response = await fetch(`/api/restaurants/${encodeURIComponent(input.restaurantId)}/availability/commands`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(input.command),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || "Impossible de modifier la disponibilité.")
  return payload
}
