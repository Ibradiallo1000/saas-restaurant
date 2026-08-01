import { randomUUID } from "node:crypto"
import type { DocumentReference, Firestore, Transaction } from "firebase-admin/firestore"
import { Timestamp } from "firebase-admin/firestore"

import {
  canRoleModifyProductAvailability,
  resolveOperationalAvailabilityState,
  resolveProductPreparationMode,
  type OperationalAvailabilityState,
} from "../../lib/product-availability.ts"

export type AvailabilityActor = {
  uid: string
  role: string
  origin: "KITCHEN" | "MANAGER" | "OWNER"
}

export type AvailabilityCommand =
  | { type: "START_SERVICE" }
  | { type: "SET_AVAILABILITY"; productId: string; state: OperationalAvailabilityState; reason?: string | null; scope?: "MANUAL" | "CURRENT_SERVICE" }
  | { type: "BULK_AVAILABLE"; productIds: string[] }
  | { type: "CONFIGURE_PORTIONS"; productId: string; enabled: boolean; available: number }
  | { type: "ADD_PORTIONS"; productId: string; quantity: number }

export class AvailabilityCommandError extends Error {
  readonly code: "FORBIDDEN" | "INVALID_COMMAND" | "PRODUCT_NOT_FOUND"

  constructor(code: "FORBIDDEN" | "INVALID_COMMAND" | "PRODUCT_NOT_FOUND", message: string) {
    super(message)
    this.code = code
  }
}

export async function executeAvailabilityCommand(input: {
  db: Firestore
  restaurantId: string
  actor: AvailabilityActor
  command: AvailabilityCommand
}) {
  if (input.command.type === "START_SERVICE") return startService(input)
  if (input.command.type === "BULK_AVAILABLE") {
    const ids = [...new Set(input.command.productIds)].slice(0, 100)
    if (!ids.length) throw new AvailabilityCommandError("INVALID_COMMAND", "Aucun produit sélectionné.")
    await Promise.all(ids.map((productId) => executeAvailabilityCommand({
      ...input,
      command: { type: "SET_AVAILABILITY", productId, state: "AVAILABLE", reason: "Reprise groupée", scope: "MANUAL" },
    })))
    return { ok: true, updatedCount: ids.length }
  }
  return input.db.runTransaction(async (transaction) => {
    const service = await readCurrentService(transaction, input.db, input.restaurantId)
    if (input.command.type === "SET_AVAILABILITY") {
      await setProductAvailability(transaction, input as any, service?.serviceId ?? null)
      return { ok: true, updatedCount: 1, service }
    }
    await updatePortions(transaction, input as any, service?.serviceId ?? null)
    return { ok: true, updatedCount: 1, service }
  })
}

async function startService(input: { db: Firestore; restaurantId: string; actor: AvailabilityActor }) {
  if (!['owner', 'manager', 'kitchen'].includes(input.actor.role)) throw new AvailabilityCommandError("FORBIDDEN", "Rôle non autorisé.")
  const serviceId = randomUUID()
  const ref = input.db.collection("restaurants").doc(input.restaurantId).collection("availabilityServiceState").doc("current")
  await input.db.runTransaction(async (transaction) => {
    const previous = await transaction.get(ref)
    transaction.set(ref, {
      restaurantId: input.restaurantId,
      serviceId,
      startedAt: Timestamp.now(),
      startedBy: input.actor.uid,
      startedByRole: input.actor.role,
      previousServiceId: previous.data()?.serviceId ?? null,
      version: Number(previous.data()?.version ?? 0) + 1,
    })
  })
  return { ok: true, service: { serviceId } }
}

async function readCurrentService(transaction: Transaction, db: Firestore, restaurantId: string) {
  const reference: DocumentReference = db.collection("restaurants").doc(restaurantId).collection("availabilityServiceState").doc("current")
  const snapshot = await transaction.get(reference)
  return snapshot.exists ? snapshot.data() as any : null
}

async function setProductAvailability(transaction: Transaction, input: any, currentServiceId: string | null) {
  const { db, restaurantId, actor, command } = input
  const productRef: DocumentReference = db.collection("restaurants").doc(restaurantId).collection("products").doc(command.productId)
  const productSnapshot = await transaction.get(productRef)
  if (!productSnapshot.exists) throw new AvailabilityCommandError("PRODUCT_NOT_FOUND", "Produit introuvable.")
  const product = productSnapshot.data() ?? {}
  const categoryRef: DocumentReference | null = product.categoryId
    ? db.collection("restaurants").doc(restaurantId).collection("categories").doc(product.categoryId)
    : null
  const category = product.categoryId
    ? (await transaction.get(categoryRef!)).data() ?? null
    : null
  const preparationMode = resolveProductPreparationMode(product, category ? { preparationMode: category.preparationMode, categoryName: category.name } : null)
  if (!canRoleModifyProductAvailability({ role: actor.role, preparationMode })) throw new AvailabilityCommandError("FORBIDDEN", "Ce produit ne peut pas être modifié par ce rôle.")
  const oldState = resolveOperationalAvailabilityState(product)
  const now = Timestamp.now()
  const scope = command.scope === "CURRENT_SERVICE" ? "CURRENT_SERVICE" : "MANUAL"
  transaction.update(productRef, {
    operationalAvailability: {
      state: command.state,
      reason: cleanReason(command.reason),
      scope,
      serviceId: scope === "CURRENT_SERVICE" ? currentServiceId : null,
      updatedAt: now,
      updatedBy: actor.uid,
    },
  })
  writeHistory(transaction, db, restaurantId, {
    productId: productSnapshot.id,
    productName: String(product.name || productSnapshot.id),
    preparationMode,
    oldState,
    newState: command.state,
    reason: cleanReason(command.reason),
    actor,
    serviceId: currentServiceId,
    occurredAt: now,
    origin: actor.origin,
  })
}

async function updatePortions(transaction: Transaction, input: any, currentServiceId: string | null) {
  const { db, restaurantId, actor, command } = input
  if (!['owner', 'manager'].includes(actor.role) && command.type === "CONFIGURE_PORTIONS") throw new AvailabilityCommandError("FORBIDDEN", "Configuration réservée au Manager ou Owner.")
  const productRef: DocumentReference = db.collection("restaurants").doc(restaurantId).collection("products").doc(command.productId)
  const snapshot = await transaction.get(productRef)
  if (!snapshot.exists) throw new AvailabilityCommandError("PRODUCT_NOT_FOUND", "Produit introuvable.")
  const data = snapshot.data() ?? {}
  const categoryRef: DocumentReference | null = data.categoryId
    ? db.collection("restaurants").doc(restaurantId).collection("categories").doc(data.categoryId)
    : null
  const category = data.categoryId
    ? (await transaction.get(categoryRef!)).data() ?? null
    : null
  const preparationMode = resolveProductPreparationMode(data, category ? { preparationMode: category.preparationMode, categoryName: category.name } : null)
  if (!canRoleModifyProductAvailability({ role: actor.role, preparationMode })) throw new AvailabilityCommandError("FORBIDDEN", "Ce produit ne peut pas être modifié par ce rôle.")
  const current = data.portionControl ?? {}
  if (command.type === "ADD_PORTIONS" && current.enabled !== true) throw new AvailabilityCommandError("INVALID_COMMAND", "Les portions ne sont pas activées.")
  const delta = command.type === "ADD_PORTIONS" ? positiveInteger(command.quantity) : null
  const available = command.type === "ADD_PORTIONS" ? Number(current.available ?? 0) + delta! : nonNegativeInteger(command.available)
  const enabled = command.type === "ADD_PORTIONS" ? true : command.enabled === true
  const now = Timestamp.now()
  transaction.update(productRef, { portionControl: { enabled, available, updatedAt: now, updatedBy: actor.uid } })
  if (enabled && available > 0 && resolveOperationalAvailabilityState(data) === "SOLD_OUT" && data.operationalAvailability?.reason === "Portions épuisées") {
    transaction.update(productRef, { operationalAvailability: { state: "AVAILABLE", reason: "Portions ajoutées", scope: "MANUAL", serviceId: null, updatedAt: now, updatedBy: actor.uid } })
    writeHistory(transaction, db, restaurantId, { productId: snapshot.id, productName: String(data.name || snapshot.id), preparationMode: String(data.preparationMode || "kitchen"), oldState: "SOLD_OUT", newState: "AVAILABLE", reason: "Portions ajoutées", actor, serviceId: currentServiceId, occurredAt: now, origin: actor.origin })
  }
}

export function writeHistory(transaction: Transaction, db: Firestore, restaurantId: string, data: any) {
  const ref = db.collection("restaurants").doc(restaurantId).collection("availabilityHistory").doc()
  transaction.create(ref, { restaurantId, ...data, createdAt: data.occurredAt ?? Timestamp.now() })
}

function cleanReason(value: unknown) { return typeof value === "string" && value.trim() ? value.trim().slice(0, 240) : null }
function positiveInteger(value: unknown) { const n = Number(value); if (!Number.isSafeInteger(n) || n <= 0) throw new AvailabilityCommandError("INVALID_COMMAND", "Quantité invalide."); return n }
function nonNegativeInteger(value: unknown) { const n = Number(value); if (!Number.isSafeInteger(n) || n < 0) throw new AvailabilityCommandError("INVALID_COMMAND", "Quantité invalide."); return n }
