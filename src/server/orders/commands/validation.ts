import { OrderCommandError } from "./errors.ts"
import type {
  AnyOrderCommandInput,
  ConfirmOrderPaymentInput,
  HandOffOrderItemsInput,
  ItemCommandBase,
  MarkOrderItemsTransitionInput,
  OrderCommandBase,
} from "./types.ts"

const SAFE_ID = /^[A-Za-z0-9_-]{1,160}$/

export function validateBase(input: OrderCommandBase) {
  for (const [field, value] of [
    ["restaurantId", input.restaurantId],
    ["orderId", input.orderId],
    ["actor.id", input.actor?.id],
  ] as const) {
    if (!SAFE_ID.test(String(value ?? ""))) {
      throw new OrderCommandError("INVALID_COMMAND", `${field} est invalide.`)
    }
  }
  if (input.actor.restaurantId !== input.restaurantId) {
    throw new OrderCommandError("RESTAURANT_MISMATCH", "L'acteur appartient à un autre restaurant.")
  }
  if (
    typeof input.idempotencyKey !== "string" ||
    input.idempotencyKey.trim().length < 8 ||
    input.idempotencyKey.length > 200
  ) {
    throw new OrderCommandError("INVALID_COMMAND", "Clé d'idempotence invalide.")
  }
}

export function validateItemBase(input: ItemCommandBase) {
  validateBase(input)
  if (!SAFE_ID.test(input.orderItemId)) {
    throw new OrderCommandError("INVALID_COMMAND", "orderItemId est invalide.")
  }
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) {
    throw new OrderCommandError("INVALID_COMMAND", "expectedVersion est invalide.")
  }
}

export function validatePositiveQuantity(value: number) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new OrderCommandError("INVALID_QUANTITY", "La quantité doit être un entier positif.")
  }
}

export function validateHandOff(input: HandOffOrderItemsInput) {
  validateBase(input)
  if (!SAFE_ID.test(input.cashSessionId)) {
    throw new OrderCommandError("INVALID_COMMAND", "La session de caisse est invalide.")
  }
  if (!Array.isArray(input.expectedItems) || input.expectedItems.length === 0 || input.expectedItems.length > 100) {
    throw new OrderCommandError("INVALID_COMMAND", "La liste des lignes à remettre est invalide.")
  }
  for (const item of input.expectedItems) {
    if (!SAFE_ID.test(item?.orderItemId ?? "") || !Number.isInteger(item?.expectedVersion) || item.expectedVersion < 1) {
      throw new OrderCommandError("INVALID_COMMAND", "Une version de ligne est invalide.")
    }
  }
}

export function validateItemsTransition(input: MarkOrderItemsTransitionInput) {
  validateBase(input)
  if (!Array.isArray(input.expectedItems) || input.expectedItems.length === 0 || input.expectedItems.length > 100) {
    throw new OrderCommandError("INVALID_COMMAND", "La liste des lignes Cuisine est invalide.")
  }
  const ids = new Set<string>()
  for (const item of input.expectedItems) {
    if (
      !SAFE_ID.test(item?.orderItemId ?? "") ||
      !Number.isInteger(item?.expectedVersion) ||
      item.expectedVersion < 1 ||
      ids.has(item.orderItemId)
    ) {
      throw new OrderCommandError("INVALID_COMMAND", "Une ligne Cuisine ou sa version est invalide.")
    }
    ids.add(item.orderItemId)
  }
}

export function validatePayment(input: ConfirmOrderPaymentInput) {
  validateBase(input)
  if (!Number.isInteger(input.expectedPaymentVersion) || input.expectedPaymentVersion < 1) {
    throw new OrderCommandError("INVALID_COMMAND", "expectedPaymentVersion est invalide.")
  }
  if (!Number.isFinite(input.expectedAmount) || input.expectedAmount <= 0) {
    throw new OrderCommandError("INVALID_COMMAND", "Le montant attendu est invalide.")
  }
  if (!Number.isFinite(input.receivedAmount) || input.receivedAmount <= 0) {
    throw new OrderCommandError("INVALID_COMMAND", "Le montant reçu est invalide.")
  }
  if (!SAFE_ID.test(input.cashSessionId)) {
    throw new OrderCommandError("INVALID_COMMAND", "La session de caisse est invalide.")
  }
  if (input.method === "mobile_money" && !input.provider?.trim()) {
    throw new OrderCommandError("INVALID_COMMAND", "Le fournisseur Mobile Money est obligatoire.")
  }
}

export function commandHashPayload(input: AnyOrderCommandInput) {
  const { idempotencyKey: _key, actor, ...payload } = input
  return { ...payload, actorId: actor.id, actorRole: actor.role }
}
