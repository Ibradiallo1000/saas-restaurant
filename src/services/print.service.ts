export type PrintType = "kitchen" | "client" | "z-report"

export type PrintableRestaurant = {
  name?: string
}

export type PrintableOrderItem = {
  name?: string
  nameSnapshot?: string
  quantity: number
  total?: number
  unitPrice?: number
  price?: number
  priceSnapshot?: number
  selectedOptions?: Array<{
    optionName?: string
    choiceName?: string
    price?: number
  }>
  supplements?: Array<{ name?: string; quantity?: number } | string>
  supplementNames?: string[]
  notes?: string
  note?: string
}

export type PrintableOrder = {
  id: string
  table?: string
  tableNumber?: string
  tableId?: string | null
  orderType?: string | null
  items: PrintableOrderItem[]
  total?: number
  totalAmount?: number
  paymentMethod?: string | null
  paymentStatus?: string | null
  printedKitchen?: boolean | null
  printedClient?: boolean | null
  notes?: string
  customerNote?: string
  customerNotes?: string
  createdAt?: {
    toDate?: () => Date
  } | Date | number | string | null
}

export type PrintableZReport = {
  id?: string
  restaurantName?: string
  cashierName?: string | null
  openedAt?: PrintableOrder["createdAt"]
  closedAt?: PrintableOrder["createdAt"]
  totalSales: number
  totalCash: number
  totalMobile: number
  totalOrders: number
}

type PrintPayload = PrintableOrder | PrintableZReport
const PRINT_QUEUE_DELAY_MS = 500
let printQueue: Promise<unknown> = Promise.resolve()

export const printService = {
  print(
    payload: PrintPayload,
    type: PrintType,
    options?: { restaurant?: PrintableRestaurant | null }
  ) {
    if (typeof window === "undefined") {
      return Promise.resolve(false)
    }

    const queuedPrint = printQueue
      .catch(() => undefined)
      .then(() => printNow(payload, type, options))
      .then(async (printed) => {
        await delay(PRINT_QUEUE_DELAY_MS)
        return printed
      })

    printQueue = queuedPrint
    return queuedPrint
  },
}

function printNow(
  payload: PrintPayload,
  type: PrintType,
  options?: { restaurant?: PrintableRestaurant | null }
) {
    const html = buildPrintHtml(payload, type, options?.restaurant)
    const iframe = document.createElement("iframe")
    iframe.setAttribute("aria-hidden", "true")
    iframe.style.position = "fixed"
    iframe.style.right = "0"
    iframe.style.bottom = "0"
    iframe.style.width = "0"
    iframe.style.height = "0"
    iframe.style.border = "0"
    iframe.style.opacity = "0"
    iframe.style.pointerEvents = "none"
    document.body.appendChild(iframe)

    const doc = iframe.contentWindow?.document
    if (!doc) {
      iframe.remove()
      return Promise.resolve(false)
    }

    doc.open()
    doc.write(html)
    doc.close()

    return new Promise<boolean>((resolve) => {
      window.setTimeout(() => {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
        resolve(true)

        window.setTimeout(() => {
          if (document.body.contains(iframe)) {
            iframe.remove()
          }
        }, 10000)
      }, 50)
    })
}

function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms))
}

function buildPrintHtml(
  payload: PrintPayload,
  type: PrintType,
  restaurant?: PrintableRestaurant | null
) {
  if (type === "z-report") return buildZReportHtml(payload as PrintableZReport)
  if (type === "kitchen") return buildKitchenTicketHtml(payload as PrintableOrder)
  return buildCustomerReceiptHtml(payload as PrintableOrder, restaurant)
}

function buildCustomerReceiptHtml(order: PrintableOrder, restaurant?: PrintableRestaurant | null) {
  const restaurantName = escapeHtml(restaurant?.name || "Restaurant")
  const printedAt = formatDateTime(getDate(order.createdAt))
  const shortOrderId = escapeHtml(order.id.slice(-6).toUpperCase())
  const paymentMethod = escapeHtml(formatPaymentMethod(order.paymentMethod))
  const total = order.total ?? order.totalAmount ?? 0

  const items = (order.items || [])
    .map((item) => {
      const itemTotal = item.total ?? Number(item.unitPrice ?? item.price ?? item.priceSnapshot ?? 0) * item.quantity
      return `
        <div class="row">
          <span>${item.quantity}x ${escapeHtml(item.name ?? item.nameSnapshot ?? "Article")}</span>
          <span>${formatAmount(itemTotal)}</span>
        </div>
      `
    })
    .join("")

  return wrapTicketHtml(`
    <div class="center bold title">${restaurantName}</div>
    <div class="center">${printedAt}</div>
    <div class="center">Commande #${shortOrderId}</div>
    <div class="line"></div>
    ${items}
    <div class="line"></div>
    <div class="row bold total">
      <span>TOTAL</span>
      <span>${formatAmount(total)}</span>
    </div>
    <div class="line"></div>
    <div class="center">Paiement: ${paymentMethod}</div>
    <div class="center space-top">Merci de votre visite</div>
  `)
}

function buildKitchenTicketHtml(order: PrintableOrder) {
  const printedAt = formatDateTime(getDate(order.createdAt))
  const shortOrderId = escapeHtml(order.id.slice(-6).toUpperCase())
  const table = order.table ?? order.tableNumber ?? order.tableId ?? ""
  const location = escapeHtml(table ? `Table ${table}` : "A emporter")
  const orderNote = order.notes || order.customerNote || order.customerNotes

  const items = (order.items || [])
    .map((item) => `
      <div class="item">
        <div><span class="bold">${item.quantity}x</span> ${escapeHtml(item.name ?? item.nameSnapshot ?? "Article")}</div>
        ${formatItemOptions(item)}
        ${formatItemNote(item)}
      </div>
    `)
    .join("")

  return wrapTicketHtml(`
    <div class="center bold kitchen-title">CUISINE</div>
    <div class="line"></div>
    <div class="row bold order-line">
      <span>#${shortOrderId}</span>
      <span>${location}</span>
    </div>
    <div class="center">${printedAt}</div>
    <div class="line"></div>
    ${items}
    ${orderNote ? `<div class="line"></div><div class="bold">NOTE</div><div>${escapeHtml(orderNote)}</div>` : ""}
    <div class="line"></div>
  `)
}

function buildZReportHtml(report: PrintableZReport) {
  return wrapTicketHtml(`
    <div class="center bold title">TICKET Z</div>
    <div class="center">${escapeHtml(report.restaurantName || "Restaurant")}</div>
    <div class="line"></div>
    <div class="row"><span>Ouverture</span><span>${formatDateTime(getDate(report.openedAt))}</span></div>
    <div class="row"><span>Cloture</span><span>${formatDateTime(getDate(report.closedAt))}</span></div>
    ${report.cashierName ? `<div class="row"><span>Caissier</span><span>${escapeHtml(report.cashierName)}</span></div>` : ""}
    <div class="line"></div>
    <div class="row"><span>Commandes</span><span>${report.totalOrders}</span></div>
    <div class="row"><span>Cash</span><span>${formatAmount(report.totalCash)}</span></div>
    <div class="row"><span>Mobile Money</span><span>${formatAmount(report.totalMobile)}</span></div>
    <div class="line"></div>
    <div class="row bold total"><span>Total ventes</span><span>${formatAmount(report.totalSales)}</span></div>
    <div class="line"></div>
  `)
}

function wrapTicketHtml(content: string) {
  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; }
          body {
            color: #000;
            background: #fff;
            font-family: monospace;
            font-size: 14px;
            line-height: 1.25;
            margin: 0;
            padding: 10px;
            width: 80mm;
          }
          .center { text-align: center; }
          .bold { font-weight: 700; }
          .title { font-size: 18px; margin-bottom: 8px; }
          .kitchen-title { font-size: 20px; }
          .line { border-top: 1px dashed #000; margin: 8px 0; }
          .row { display: flex; justify-content: space-between; gap: 8px; }
          .row span:first-child { flex: 1; }
          .total { font-size: 16px; }
          .order-line { font-size: 18px; }
          .item { margin-bottom: 8px; font-size: 16px; }
          .sub { margin-left: 14px; font-size: 12px; }
          .space-top { margin-top: 12px; }
        </style>
      </head>
      <body>${content}</body>
    </html>
  `
}

function formatItemOptions(item: PrintableOrderItem) {
  const selectedOptions = item.selectedOptions ?? []
  const supplements = item.supplements ?? item.supplementNames ?? []
  const options = [
    ...selectedOptions.map((option) => `${option.optionName || "Option"}: ${option.choiceName || ""}`),
    ...supplements.map((supplement) =>
      typeof supplement === "string"
        ? supplement
        : `${supplement.quantity ? `${supplement.quantity}x ` : ""}${supplement.name || ""}`
    ),
  ].filter(Boolean)

  if (!options.length) return ""

  return `<div class="sub">${options.map(escapeHtml).join(" / ")}</div>`
}

function formatItemNote(item: PrintableOrderItem) {
  const note = item.notes || item.note
  return note ? `<div class="sub">Note: ${escapeHtml(note)}</div>` : ""
}

function formatAmount(value: number) {
  return `${Number(value || 0).toLocaleString()} FCFA`
}

function formatPaymentMethod(method: string | null | undefined) {
  if (method === "cash") return "Especes"
  if (method === "mobile" || method === "mobile_money") return "Mobile Money"
  return method || "Non renseigne"
}

function getDate(value: PrintableOrder["createdAt"]) {
  if (value && typeof value === "object" && "toDate" in value && value.toDate) {
    return value.toDate()
  }

  if (value instanceof Date) return value
  if (typeof value === "number" || typeof value === "string") return new Date(value)

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
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}
