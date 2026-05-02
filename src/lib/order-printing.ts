type PrintableRestaurant = {
  name?: string
  logoUrl?: string
  logo?: string
}

type PrintableOrder = {
  id: string
  table?: string
  tableNumber?: string
  tableId?: string | null
  items: Array<{
    name?: string
    nameSnapshot?: string
    quantity: number
    total?: number
    unitPrice?: number
    price?: number
    priceSnapshot?: number
  }>
  total?: number
  totalAmount?: number
  paymentMethod?: string | null
  paymentStatus?: string | null
  createdAt?: {
    toDate?: () => Date
  } | Date | number | string | null
}

export function printOrder(order: PrintableOrder, restaurant?: PrintableRestaurant | null) {
  if (typeof window === "undefined") return

  const win = window.open("", "_blank", "width=420,height=640")
  if (!win) return

  win.document.write(buildOrderPrintHtml(order, restaurant))
  win.document.close()
  win.focus()
  win.print()
}

export function printKitchenTicket(order: PrintableOrder, restaurant?: PrintableRestaurant | null) {
  printOrder(order, restaurant)
}

export function printCustomerReceipt(order: PrintableOrder, restaurant?: PrintableRestaurant | null) {
  printOrder(order, restaurant)
}

function buildOrderPrintHtml(order: PrintableOrder, restaurant?: PrintableRestaurant | null) {
  const restaurantName = escapeHtml(restaurant?.name || "Restaurant")
  const logoUrl = getLogoUrl(restaurant)
  const table = order.table ?? order.tableNumber ?? order.tableId ?? ""
  const location = escapeHtml(table ? `Table ${table}` : "A emporter")
  const shortOrderId = escapeHtml(order.id.slice(-6))
  const printedAt = formatDateTime(getOrderDate(order))
  const paymentMethod = escapeHtml(formatPaymentMethod(order.paymentMethod))
  const items = order.items
    .map(
      (item) => `
        <tr>
          <td class="item-name">${escapeHtml(item.name ?? item.nameSnapshot ?? "Article")}</td>
          <td class="qty">${item.quantity}x</td>
          <td class="amount">${formatAmount(item.total ?? Number(item.unitPrice ?? item.price ?? item.priceSnapshot ?? 0) * item.quantity)}</td>
        </tr>
      `
    )
    .join("")

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Ticket ${escapeHtml(order.id.slice(-6))}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; margin: 0; padding: 18px; color: #111; background: #fff; }
          .ticket { max-width: 320px; margin: 0 auto; }
          .header { text-align: center; }
          .logo { display: block; width: 54px; height: 54px; margin: 0 auto 8px; border-radius: 12px; object-fit: cover; }
          h1 { margin: 0 0 6px; font-size: 21px; font-weight: 800; line-height: 1.15; text-align: center; }
          .meta { margin: 0; text-align: center; font-size: 12px; line-height: 1.45; color: #555; }
          .line { border-top: 1px dashed #999; margin: 14px 0; }
          .details { display: grid; gap: 5px; font-size: 12px; }
          .row { display: flex; justify-content: space-between; gap: 12px; }
          .label { color: #555; }
          .value { font-weight: 700; text-align: right; }
          table { width: 100%; border-collapse: collapse; font-family: "Courier New", monospace; font-size: 12px; }
          td { padding: 6px 0; vertical-align: top; }
          .item-name { padding-right: 8px; overflow-wrap: anywhere; }
          .qty { width: 38px; text-align: center; white-space: nowrap; }
          .amount { width: 96px; text-align: right; white-space: nowrap; }
          .total { display: flex; justify-content: space-between; gap: 12px; font-size: 18px; font-weight: 800; }
          .footer { margin-top: 14px; text-align: center; font-size: 11px; color: #555; }
          @media print {
            body { padding: 0; }
            .ticket { max-width: none; }
          }
        </style>
      </head>
      <body>
        <div class="ticket">
          <div class="header">
            ${logoUrl ? `<img class="logo" src="${escapeHtml(logoUrl)}" alt="${restaurantName}" />` : ""}
            <h1>${restaurantName}</h1>
            <p class="meta">Ticket de commande</p>
          </div>

          <div class="line"></div>

          <div class="details">
            <div class="row"><span class="label">Table</span><span class="value">${location}</span></div>
            <div class="row"><span class="label">Commande</span><span class="value">#${shortOrderId}</span></div>
            <div class="row"><span class="label">Date</span><span class="value">${printedAt}</span></div>
            <div class="row"><span class="label">Paiement</span><span class="value">${paymentMethod}</span></div>
          </div>

          <div class="line"></div>
          <table>${items}</table>
          <div class="line"></div>
          <div class="total"><span>Total</span><span>${formatAmount(order.total ?? order.totalAmount ?? 0)}</span></div>
          <div class="footer">Merci pour votre visite</div>
        </div>
      </body>
    </html>
  `
}

function formatAmount(value: number) {
  return `${Number(value || 0).toLocaleString()} FCFA`
}

function formatPaymentMethod(method: string | null | undefined) {
  if (method === "cash") return "Espèces"
  if (method === "mobile" || method === "mobile_money") return "Mobile Money"
  return "Non renseigné"
}

function getLogoUrl(restaurant?: PrintableRestaurant | null) {
  return restaurant?.logoUrl || restaurant?.logo || ""
}

function getOrderDate(order: PrintableOrder) {
  const createdAt = order.createdAt

  if (createdAt && typeof createdAt === "object" && "toDate" in createdAt && createdAt.toDate) {
    return createdAt.toDate()
  }

  if (createdAt instanceof Date) return createdAt
  if (typeof createdAt === "number" || typeof createdAt === "string") return new Date(createdAt)

  return new Date()
}

function formatDateTime(date: Date) {
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}
