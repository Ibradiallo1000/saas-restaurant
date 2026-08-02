import { OrderCommandError } from "./errors.ts"
import type {
  CancelOrderItemQuantityInput,
  CommandMutationPlan,
  ConfirmOrderPaymentInput,
  HandOffOrderItemsInput,
  MarkOrderItemReadyInput,
  MarkOrderItemServedInput,
  MarkOrderItemPreparingInput,
  MarkOrderItemsTransitionInput,
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

const PREPAYMENT_SERVICE_MODES = new Set(["delivery", "takeaway", "pickup"])

export function requiresPrepayment(order: OrderCommandState["order"]) {
  const serviceMode = String(order.serviceMode || order.orderType || "").trim().toLowerCase()
  return PREPAYMENT_SERVICE_MODES.has(serviceMode)
}

function assertOperationalPaymentAllowed(state: OrderCommandState) {
  if (requiresPrepayment(state.order) && state.order.paymentStatus !== "paid") {
    throw new OrderCommandError(
      "PREPAYMENT_REQUIRED_BEFORE_PREPARATION",
      "Le paiement doit être confirmé avant de traiter cette commande."
    )
  }
}

export function planPreparing(
  state: OrderCommandState,
  input: MarkOrderItemPreparingInput
): CommandMutationPlan {
  assertOperationalPaymentAllowed(state)
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
  assertOperationalPaymentAllowed(state)
  const item = checkedItem(state, input.expectedVersion)
  if (item.status !== "pending" && item.status !== "preparing") {
    throw new OrderCommandError("INVALID_TRANSITION", `${item.status} ne peut pas passer à ready.`)
  }
  const after = { ...itemState(item), status: "ready", version: item.version + 1 }
  return itemPlan("MarkOrderItemReady", itemState(item), after)
}

export function planItemsPreparing(
  state: OrderCommandState,
  input: MarkOrderItemsTransitionInput
): CommandMutationPlan {
  return planItemsTransition(state, input, "preparing")
}

export function planItemsReady(
  state: OrderCommandState,
  input: MarkOrderItemsTransitionInput
): CommandMutationPlan {
  return planItemsTransition(state, input, "ready")
}

function planItemsTransition(
  state: OrderCommandState,
  input: MarkOrderItemsTransitionInput,
  targetStatus: "preparing" | "ready"
): CommandMutationPlan {
  assertOperationalPaymentAllowed(state)
  const expected = new Map(input.expectedItems.map((item) => [item.orderItemId, item.expectedVersion]))
  const selected = state.items.filter((item) => expected.has(item.id))
  if (selected.length !== expected.size) {
    throw new OrderCommandError("ORDER_ITEM_NOT_FOUND", "Une ligne Cuisine est introuvable.")
  }
  const itemUpdates = selected.map((item) => {
    if (item.preparationMode !== "kitchen") {
      throw new OrderCommandError("FORBIDDEN_ACTOR", "Seules les lignes Cuisine peuvent être traitées ici.")
    }
    if (item.version !== expected.get(item.id)) {
      throw new OrderCommandError(
        "CONCURRENT_MODIFICATION",
        `Version attendue ${expected.get(item.id)}, version courante ${item.version}.`,
        true
      )
    }
    const allowed = targetStatus === "preparing"
      ? item.status === "pending"
      : item.status === "pending" || item.status === "preparing"
    if (!allowed) {
      throw new OrderCommandError("INVALID_TRANSITION", `${item.status} ne peut pas passer à ${targetStatus}.`)
    }
    return {
      orderItemId: item.id,
      update: { ...itemState(item), status: targetStatus, version: item.version + 1 },
    }
  })
  const commandName = targetStatus === "preparing"
    ? "MarkOrderItemsPreparing"
    : "MarkOrderItemsReady"
  return {
    commandName,
    orderUpdate: null,
    itemUpdate: null,
    itemUpdates,
    paymentLedger: null,
    stock: null,
    before: { items: selected.map(itemState) },
    after: { items: itemUpdates.map((entry) => entry.update) },
    result: { version: Math.max(...itemUpdates.map((entry) => Number(entry.update.version))) },
  }
}

export function planServed(
  state: OrderCommandState,
  input: MarkOrderItemServedInput
): CommandMutationPlan {
  assertOperationalPaymentAllowed(state)
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

export function planHandOff(
  state: OrderCommandState,
  input: HandOffOrderItemsInput
): CommandMutationPlan {
  assertOperationalPaymentAllowed(state)
  if (!requiresPrepayment(state.order)) {
    throw new OrderCommandError(
      "INVALID_TRANSITION",
      "La remise groupée est réservée aux commandes Livraison et À emporter."
    )
  }

  const activeItems = state.items.filter((item) => item.status !== "cancelled" && item.status !== "served")
  const expected = new Map(input.expectedItems.map((item) => [item.orderItemId, item.expectedVersion]))
  if (
    activeItems.length === 0 ||
    expected.size !== input.expectedItems.length ||
    expected.size !== activeItems.length ||
    activeItems.some((item) => !expected.has(item.id))
  ) {
    throw new OrderCommandError(
      "ORDER_NOT_READY_FOR_HANDOFF",
      "Toutes les lignes actives de la commande doivent être remises ensemble."
    )
  }

  const plans = activeItems.map((item) => {
    const expectedVersion = expected.get(item.id)
    if (expectedVersion !== item.version) {
      throw new OrderCommandError(
        "CONCURRENT_MODIFICATION",
        `Version attendue ${expectedVersion}, version courante ${item.version}.`,
        true
      )
    }
    if (
      (item.preparationMode === "kitchen" || item.preparationMode === "bar") &&
      item.status !== "ready"
    ) {
      throw new OrderCommandError(
        "ORDER_NOT_READY_FOR_HANDOFF",
        "Toutes les préparations Cuisine et Bar doivent être prêtes avant la remise."
      )
    }
    if (item.preparationMode === "direct" && item.status !== "pending" && item.status !== "ready") {
      throw new OrderCommandError(
        "ORDER_NOT_READY_FOR_HANDOFF",
        "Une ligne Service direct n’est pas dans un état remettables."
      )
    }
    const activeQuantity = item.quantity - item.cancelledQuantity
    return planServed(
      { ...state, item },
      {
        ...input,
        orderItemId: item.id,
        expectedVersion: item.version,
        quantityToServe: activeQuantity - item.servedQuantity,
      }
    )
  })

  return {
    commandName: "HandOffOrderItems",
    orderUpdate: {
      completedCashSessionId: input.cashSessionId,
      ...(state.order.handledCashSessionId
        ? {}
        : { handledCashSessionId: input.cashSessionId }),
    },
    itemUpdate: null,
    itemUpdates: plans.map((plan, index) => ({
      orderItemId: activeItems[index].id,
      update: plan.itemUpdate!,
    })),
    paymentLedger: null,
    stock: null,
    stocks: plans.flatMap((plan) => plan.stock ? [plan.stock] : []),
    before: {
      items: activeItems.map((item) => ({ id: item.id, ...itemState(item) })),
    },
    after: {
      items: plans.map((plan, index) => ({
        id: activeItems[index].id,
        ...plan.itemUpdate,
      })),
    },
    result: { version: Math.max(...activeItems.map((item) => item.version + 1)) },
  }
}

export function planServeOrderItems(
  state: OrderCommandState,
  input: MarkOrderItemsTransitionInput
): CommandMutationPlan {
  const serviceMode = String(state.order.serviceMode || state.order.orderType)
    .trim().toLowerCase().replaceAll("-", "_")
  if (serviceMode !== "dine_in") {
    throw new OrderCommandError(
      "INVALID_TRANSITION",
      "Le service groupé est réservé aux commandes Sur place."
    )
  }
  const activeItems = state.items.filter((item) => item.status !== "cancelled" && item.status !== "served")
  const expected = new Map(input.expectedItems.map((item) => [item.orderItemId, item.expectedVersion]))
  if (!activeItems.length || expected.size !== activeItems.length || activeItems.some((item) => !expected.has(item.id))) {
    throw new OrderCommandError("ORDER_NOT_READY_FOR_SERVICE", "Toutes les lignes actives doivent être servies ensemble.")
  }
  const plans = activeItems.map((item) => {
    if (expected.get(item.id) !== item.version) {
      throw new OrderCommandError("CONCURRENT_MODIFICATION", "La commande a changé. Actualisez puis réessayez.", true)
    }
    if ((item.preparationMode === "kitchen" || item.preparationMode === "bar") && item.status !== "ready") {
      throw new OrderCommandError("ORDER_NOT_READY_FOR_SERVICE", "Toutes les préparations doivent être prêtes avant le service groupé.")
    }
    if (item.preparationMode === "direct" && !["pending", "ready"].includes(item.status)) {
      throw new OrderCommandError("ORDER_NOT_READY_FOR_SERVICE", "Une ligne Service direct ne peut pas être servie.")
    }
    const activeQuantity = item.quantity - item.cancelledQuantity
    return planServed({ ...state, item }, {
      ...input,
      orderItemId: item.id,
      expectedVersion: item.version,
      quantityToServe: activeQuantity - item.servedQuantity,
    })
  })
  return {
    commandName: "ServeOrderItems",
    orderUpdate: null,
    itemUpdate: null,
    itemUpdates: plans.map((plan, index) => ({ orderItemId: activeItems[index].id, update: plan.itemUpdate! })),
    paymentLedger: null,
    stock: null,
    stocks: plans.flatMap((plan) => plan.stock ? [plan.stock] : []),
    before: { items: activeItems.map((item) => ({ id: item.id, ...itemState(item) })) },
    after: { items: plans.map((plan, index) => ({ id: activeItems[index].id, ...plan.itemUpdate })) },
    result: { version: Math.max(...activeItems.map((item) => item.version + 1)) },
  }
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
  const normalizedServiceMode = String(order.serviceMode || order.orderType)
    .trim()
    .toLowerCase()
    .replaceAll("-", "_")
  const isPosDineInOrder = order.source === "pos" && normalizedServiceMode === "dine_in"
  const activeItems = state.items.filter(
    (item) => item.quantity - item.cancelledQuantity > 0
  )
  const isFullyServed =
    activeItems.length > 0 &&
    activeItems.every((item) => {
      const activeQuantity = item.quantity - item.cancelledQuantity
      return item.status === "served" && item.servedQuantity === activeQuantity
    })
  if (isPosDineInOrder && !isFullyServed) {
    throw new OrderCommandError(
      "POS_DINE_IN_PAYMENT_REQUIRES_SERVED_ORDER",
      "La commande Sur place doit être entièrement servie avant l'encaissement."
    )
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
  const paymentConfirmedAfterPreparationStarted = state.items.some(
    (item) => item.status === "preparing" || item.status === "ready"
  )
  const nextVersion = order.paymentVersion + 1
  const before = {
    paymentStatus: order.paymentStatus,
    paymentVersion: order.paymentVersion,
    totalAmount: due,
    paymentConfirmedAfterPreparationStarted,
  }
  const orderUpdate = {
    paymentStatus: "paid",
    paymentVersion: nextVersion,
    paidAmount: due,
    paymentMethod: input.method,
    paymentCashSessionId: input.cashSessionId,
  }
  const after = {
    ...orderUpdate,
    paymentConfirmedAfterPreparationStarted,
  }
  return {
    commandName: "ConfirmOrderPayment",
    orderUpdate,
    itemUpdate: null,
    paymentLedger: {
      amount: due,
      receivedAmount: input.receivedAmount,
      changeDue: input.receivedAmount - due,
      method: input.method,
      provider: input.provider,
      paymentAccountId: input.paymentAccountId ?? null,
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
