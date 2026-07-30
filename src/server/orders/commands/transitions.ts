import { OrderCommandError } from "./errors.ts"
import type {
  CancelOrderItemQuantityInput,
  CommandMutationPlan,
  ConfirmOrderPaymentInput,
  MarkOrderItemReadyInput,
  MarkOrderItemServedInput,
  MarkOrderItemPreparingInput,
  OrderCommandState,
  OrderItemSnapshot,
} from "./types.ts"

function checkedItem(state: OrderCommandState, expectedVersion: number) {
  const item = state.item
  if (!item) throw new OrderCommandError("ORDER_ITEM_NOT_FOUND", "Ligne introuvable.")
  if (item.version !== expectedVersion) {
    throw new OrderCommandError(
      "CONCURRENT_MODIFICATION",
      `Version attendue ${expectedVersion}, version courante ${item.version}.`,
      true
    )
  }
  if (item.status === "cancelled") {
    throw new OrderCommandError("ITEM_CANCELLED", "Cette ligne est annulée.")
  }
  return item
}

function itemState(item: OrderItemSnapshot) {
  return {
    status: item.status,
    quantity: item.quantity,
    servedQuantity: item.servedQuantity,
    cancelledQuantity: item.cancelledQuantity,
    version: item.version,
  }
}

export function planPreparing(
  state: OrderCommandState,
  input: MarkOrderItemPreparingInput
): CommandMutationPlan {
  const item = checkedItem(state, input.expectedVersion)
  if (item.status !== "pending") {
    throw new OrderCommandError("INVALID_TRANSITION", `${item.status} ne peut pas passer à preparing.`)
  }
  const after = { ...itemState(item), status: "preparing", version: item.version + 1 }
  return itemPlan("MarkOrderItemPreparing", itemState(item), after)
}

export function planReady(
  state: OrderCommandState,
  input: MarkOrderItemReadyInput
): CommandMutationPlan {
  const item = checkedItem(state, input.expectedVersion)
  if (item.status !== "pending" && item.status !== "preparing") {
    throw new OrderCommandError("INVALID_TRANSITION", `${item.status} ne peut pas passer à ready.`)
  }
  const after = { ...itemState(item), status: "ready", version: item.version + 1 }
  return itemPlan("MarkOrderItemReady", itemState(item), after)
}

export function planServed(
  state: OrderCommandState,
  input: MarkOrderItemServedInput
): CommandMutationPlan {
  const item = checkedItem(state, input.expectedVersion)
  if (item.status === "served") {
    throw new OrderCommandError("ITEM_ALREADY_SERVED", "Cette ligne est déjà entièrement servie.")
  }
  const legacyDirect = item.preparationMode === "direct" && item.status === "pending"
  if (item.status !== "ready" && !legacyDirect) {
    throw new OrderCommandError("INVALID_TRANSITION", `${item.status} ne peut pas être servi.`)
  }
  const activeQuantity = item.quantity - item.cancelledQuantity
  const remaining = activeQuantity - item.servedQuantity
  if (input.quantityToServe > remaining) {
    throw new OrderCommandError(
      "QUANTITY_EXCEEDS_REMAINING",
      "La quantité servie dépasse la quantité restante."
    )
  }
  const servedQuantity = item.servedQuantity + input.quantityToServe
  const status = servedQuantity === activeQuantity ? "served" : "ready"
  const before = itemState(item)
  const after = {
    ...before,
    status,
    servedQuantity,
    version: item.version + 1,
  }
  const plan = itemPlan("MarkOrderItemServed", before, after)
  plan.stock = {
    orderItemId: item.id,
    productId: item.productId,
    servedQuantityBefore: item.servedQuantity,
    servedQuantityAfter: servedQuantity,
  }
  return plan
}

export function planCancellation(
  state: OrderCommandState,
  input: CancelOrderItemQuantityInput
): CommandMutationPlan {
  const item = checkedItem(state, input.expectedVersion)
  if (state.order.paymentStatus === "paid") {
    throw new OrderCommandError(
      "PAID_ORDER_REQUIRES_REFUND",
      "Une ligne payée nécessite un remboursement."
    )
  }
  const remaining = item.quantity - item.servedQuantity - item.cancelledQuantity
  if (input.quantityToCancel > remaining) {
    throw new OrderCommandError(
      "QUANTITY_EXCEEDS_REMAINING",
      "La quantité annulée dépasse la quantité annulable."
    )
  }
  const cancelledQuantity = item.cancelledQuantity + input.quantityToCancel
  const activeQuantity = item.quantity - cancelledQuantity
  const status =
    activeQuantity === 0
      ? "cancelled"
      : item.servedQuantity === activeQuantity
        ? "served"
        : item.status
  const before = itemState(item)
  const after = {
    ...before,
    status,
    cancelledQuantity,
    version: item.version + 1,
    cancellationReason: input.reason,
  }
  return itemPlan("CancelOrderItemQuantity", before, after)
}

export function planPayment(
  state: OrderCommandState,
  input: ConfirmOrderPaymentInput
): CommandMutationPlan {
  const order = state.order
  if (order.paymentVersion !== input.expectedPaymentVersion) {
    throw new OrderCommandError(
      "CONCURRENT_MODIFICATION",
      `Version paiement attendue ${input.expectedPaymentVersion}, courante ${order.paymentVersion}.`,
      true
    )
  }
  if (order.paymentStatus === "paid") {
    throw new OrderCommandError("PAYMENT_ALREADY_CONFIRMED", "Le paiement est déjà confirmé.")
  }
  if (order.hasUnaggregatedCancellation) {
    throw new OrderCommandError(
      "FINANCIAL_RECALCULATION_REQUIRED",
      "Une annulation doit être agrégée avant le paiement."
    )
  }
  const due = Number(order.totalAmount || order.total)
  if (input.expectedAmount !== due) {
    throw new OrderCommandError("PAYMENT_AMOUNT_MISMATCH", "Le montant de la commande a changé.")
  }
  if (input.receivedAmount < due) {
    throw new OrderCommandError("PARTIAL_PAYMENT_UNSUPPORTED", "Le paiement partiel n'est pas supporté.")
  }
  if (input.method === "mobile_money" && input.receivedAmount !== due) {
    throw new OrderCommandError("PAYMENT_AMOUNT_MISMATCH", "Le montant Mobile Money doit être exact.")
  }
  const nextVersion = order.paymentVersion + 1
  const before = {
    paymentStatus: order.paymentStatus,
    paymentVersion: order.paymentVersion,
    totalAmount: due,
  }
  const after = {
    paymentStatus: "paid",
    paymentVersion: nextVersion,
    paidAmount: due,
    paymentMethod: input.method,
  }
  return {
    commandName: "ConfirmOrderPayment",
    orderUpdate: after,
    itemUpdate: null,
    paymentLedger: {
      amount: due,
      receivedAmount: input.receivedAmount,
      changeDue: input.receivedAmount - due,
      method: input.method,
      provider: input.provider,
      externalReference: input.externalReference,
      cashSessionId: input.cashSessionId,
    },
    stock: null,
    before,
    after,
    result: { version: nextVersion },
  }
}

function itemPlan(
  commandName: CommandMutationPlan["commandName"],
  before: Record<string, unknown>,
  after: Record<string, unknown>
): CommandMutationPlan {
  return {
    commandName,
    orderUpdate: null,
    itemUpdate: after,
    paymentLedger: null,
    stock: null,
    before,
    after,
    result: { version: Number(after.version) },
  }
}
