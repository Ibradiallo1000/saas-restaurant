export type OrderTypeKey = "dine_in" | "pickup" | "delivery"

export type OrderStepKey =
  | "pending"
  | "preparing"
  | "ready"
  | "served"
  | "picked_up"

export type OrderStep = {
  key: OrderStepKey
  label: string
}

export const ORDER_STEPS: Record<OrderTypeKey, OrderStep[]> = {
  dine_in: [
    { key: "pending", label: "Commande reçue" },
    { key: "preparing", label: "En préparation" },
    { key: "ready", label: "Prête" },
    { key: "served", label: "Servie" },
  ],
  pickup: [
    { key: "pending", label: "Commande reçue" },
    { key: "preparing", label: "En préparation" },
    { key: "ready", label: "Prête" },
    { key: "picked_up", label: "Récupérée" },
  ],
  delivery: [
    { key: "pending", label: "Commande reçue" },
    { key: "preparing", label: "En préparation" },
    { key: "ready", label: "En cours de livraison" },
    { key: "picked_up", label: "Livrée / récupérée" },
  ],
}

