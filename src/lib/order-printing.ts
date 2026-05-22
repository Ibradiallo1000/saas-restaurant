import {
  printService,
  type PrintableOrder,
  type PrintableRestaurant,
} from "@/services/print.service"

export type { PrintableOrder, PrintableRestaurant }

export function printOrder(
  order: PrintableOrder,
  typeOrRestaurant?: "client" | "kitchen" | PrintableRestaurant | null,
  restaurant?: PrintableRestaurant | null
) {
  const type =
    typeOrRestaurant === "kitchen" || typeOrRestaurant === "client"
      ? typeOrRestaurant
      : "client"
  const printableRestaurant =
    typeOrRestaurant === "kitchen" || typeOrRestaurant === "client"
      ? restaurant
      : typeOrRestaurant

  void printService.print(order, type, { restaurant: printableRestaurant })
}

export function printKitchenTicket(
  order: PrintableOrder,
  restaurant?: PrintableRestaurant | null
) {
  void printService.print(order, "kitchen", { restaurant })
}

export function printCustomerReceipt(
  order: PrintableOrder,
  restaurant?: PrintableRestaurant | null
) {
  void printService.print(order, "client", { restaurant })
}
