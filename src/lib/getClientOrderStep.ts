type ClientOrderLike = {
  kitchenStatus?: string | null
  status?: string | null
  type?: string | null
  orderType?: string | null
}

export function getClientOrderStep(order: ClientOrderLike) {
  const status = normalizeClientKitchenStatus(order.kitchenStatus ?? order.status)

  switch (status) {
    case "pending":
      return 1
    case "preparing":
      return 2
    case "ready":
      return 3
    case "served":
    case "picked_up":
      return 4
    default:
      return 1
  }
}

export function getClientStatusLabel(order: ClientOrderLike) {
  const status = normalizeClientKitchenStatus(order.kitchenStatus ?? order.status)

  switch (status) {
    case "pending":
      return "Commande reçue"
    case "preparing":
      return "En préparation"
    case "ready":
      return "Prête"
    case "served":
    case "picked_up":
      return getFinalClientStatusLabel(order)
    default:
      return "Commande reçue"
  }
}

function getFinalClientStatusLabel(order: ClientOrderLike) {
  const type = order.type ?? order.orderType
  if (type === "sur_place" || type === "dine_in" || type === "dine-in" || type === "table") {
    return "Servie"
  }
  return "Récupérée"
}

export function normalizeClientKitchenStatus(status: string | null | undefined) {
  switch (status) {
    case "preparing":
    case "preparation":
    case "en_preparation":
      return "preparing"
    case "ready":
    case "prete":
    case "pretes":
      return "ready"
    case "served":
    case "servie":
    case "servies":
    case "terminee":
    case "completed":
      return "served"
    case "picked_up":
    case "recuperee":
      return "picked_up"
    case "pending":
    case "en_attente":
    default:
      return "pending"
  }
}
