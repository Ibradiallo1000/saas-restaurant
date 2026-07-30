import type {
  DocumentData,
  DocumentReference,
  Firestore,
  Transaction,
} from "firebase-admin/firestore"

import { CanonicalOrderError } from "./errors.ts"
import { ORDER_CREATION_POLICIES } from "./policies.ts"
import {
  ORDER_COMMAND_IDEMPOTENCY_COLLECTION,
  sha256,
} from "../common/idempotency.ts"
import type {
  AtomicCreateInput,
  AtomicOrderCreationPort,
  CategoryAuthority,
  CreateCanonicalOrderResult,
  OrderCreationAuthorities,
  PreparationMode,
  ProductAuthority,
  ProductOptionAuthority,
  RestaurantAuthority,
  TableSessionAuthority,
} from "./types.ts"

export class FirestoreAtomicOrderCreationStore implements AtomicOrderCreationPort {
  constructor(private readonly db: Firestore) {}

  async create(
    input: AtomicCreateInput,
    build: Parameters<AtomicOrderCreationPort["create"]>[1]
  ): Promise<CreateCanonicalOrderResult> {
    const restaurantRef = this.db.collection("restaurants").doc(input.restaurantId)
    const ordersRef = restaurantRef.collection("orders")
    const orderRef = ordersRef.doc()
    const orderItemRefs = input.request.items.map(() => orderRef.collection("orderItems").doc())
    const proofId = createStableProofId(input)
    const proofRef = restaurantRef
      .collection(ORDER_COMMAND_IDEMPOTENCY_COLLECTION)
      .doc(proofId)

    return this.db.runTransaction(async (transaction) => {
      const proofSnapshot = await transaction.get(proofRef)
      if (proofSnapshot.exists) {
        return replayExisting(proofSnapshot.data(), input)
      }

      const authorities = await loadAuthorities({
        transaction,
        restaurantRef,
        input,
      })
      const now = new Date()
      const plan = build({
        authorities,
        orderId: orderRef.id,
        orderItemIds: orderItemRefs.map((reference) => reference.id),
        now,
      })
      const response = createResponse(plan, authorities, input, false)
      const { idempotencyKey: _idempotencyKey, ...persistedResponse } = response
      const expiresAt = new Date(
        now.getTime() + ORDER_CREATION_POLICIES.idempotencyRetentionDays * 24 * 60 * 60 * 1000
      )

      transaction.create(orderRef, plan.parent)
      plan.items.forEach((item, index) => {
        transaction.create(orderItemRefs[index], item)
      })
      transaction.create(proofRef, {
        commandName: "CreateOrder",
        restaurantId: input.restaurantId,
        principalId: input.principal.uid,
        principalKind: input.principal.kind,
        channel: input.request.channel,
        idempotencyKeyHash: hash(input.idempotencyKey),
        requestHash: input.requestHash,
        orderId: plan.orderId,
        response: persistedResponse,
        schemaVersion: 1,
        createdAt: now,
        expiresAt,
      })

      if (input.request.tableContext) {
        const tableSessionRef = restaurantRef
          .collection("tableSessions")
          .doc(input.request.tableContext.tableSessionId)
        transaction.update(tableSessionRef, {
          lastActivityAt: now,
          updatedAt: now,
        })
      }
      return response
    })
  }
}

async function loadAuthorities(input: {
  transaction: Transaction
  restaurantRef: DocumentReference
  input: AtomicCreateInput
}): Promise<OrderCreationAuthorities> {
  const productIds = [...new Set(input.input.request.items.map((item) => item.productId))]
  const productRefs = productIds.map((id) => input.restaurantRef.collection("products").doc(id))
  const restaurantSnapshot = await input.transaction.get(input.restaurantRef)
  if (!restaurantSnapshot.exists) {
    throw new CanonicalOrderError("RESTAURANT_NOT_FOUND", "Restaurant introuvable.")
  }
  const productSnapshots = await Promise.all(
    productRefs.map((reference) => input.transaction.get(reference))
  )
  const products = new Map<string, ProductAuthority>()
  const categoryIds = new Set<string>()

  productSnapshots.forEach((snapshot, index) => {
    if (!snapshot.exists) {
      throw new CanonicalOrderError("PRODUCT_NOT_FOUND", `Produit introuvable : ${productIds[index]}.`)
    }
    const product = toProductAuthority(snapshot.id, snapshot.data() ?? {})
    products.set(product.id, product)
    if (product.categoryId) categoryIds.add(product.categoryId)
  })

  const categoryRefs = [...categoryIds].map((id) =>
    input.restaurantRef.collection("categories").doc(id)
  )
  const categorySnapshots = await Promise.all(
    categoryRefs.map((reference) => input.transaction.get(reference))
  )
  const categories = new Map<string, CategoryAuthority>()
  categorySnapshots.forEach((snapshot) => {
    if (snapshot.exists) {
      categories.set(snapshot.id, toCategoryAuthority(snapshot.id, snapshot.data() ?? {}))
    }
  })

  let tableSession: TableSessionAuthority | null = null
  if (input.input.request.tableContext) {
    const sessionSnapshot = await input.transaction.get(
      input.restaurantRef
        .collection("tableSessions")
        .doc(input.input.request.tableContext.tableSessionId)
    )
    if (sessionSnapshot.exists) {
      tableSession = toTableSessionAuthority(sessionSnapshot.id, sessionSnapshot.data() ?? {})
    }
  }

  return {
    restaurant: toRestaurantAuthority(
      input.restaurantRef.id,
      restaurantSnapshot.data() ?? {}
    ),
    products,
    categories,
    tableSession,
  }
}

function replayExisting(
  data: DocumentData | undefined,
  input: AtomicCreateInput
): CreateCanonicalOrderResult {
  if (!data || data.requestHash !== input.requestHash) {
    throw new CanonicalOrderError(
      "IDEMPOTENCY_CONFLICT",
      "Cette clé d'idempotence a déjà été utilisée pour une autre commande."
    )
  }
  if (
    data.restaurantId !== input.restaurantId ||
    data.principalId !== input.principal.uid ||
    data.channel !== input.request.channel ||
    !data.response
  ) {
    throw new CanonicalOrderError(
      "IDEMPOTENCY_CORRUPTED",
      "La preuve d'idempotence est incohérente."
    )
  }
  return {
    ...(data.response as Omit<CreateCanonicalOrderResult, "idempotencyKey">),
    idempotencyKey: input.idempotencyKey,
    replayed: true,
  }
}

function createResponse(
  plan: ReturnType<Parameters<AtomicOrderCreationPort["create"]>[1]>,
  authorities: OrderCreationAuthorities,
  input: AtomicCreateInput,
  replayed: boolean
): CreateCanonicalOrderResult {
  return {
    ok: true,
    orderId: plan.orderId,
    displayId: plan.displayId,
    schemaVersion: 1,
    channel: input.request.channel,
    serviceMode: input.request.serviceMode,
    orderStatus: plan.parent.orderStatus,
    paymentStatus: "unpaid",
    total: plan.parent.total,
    currency: authorities.restaurant.currency,
    orderItemIds: plan.items.map((item) => item.orderItemId),
    idempotencyKey: input.idempotencyKey,
    replayed,
    createdAt: plan.parent.createdAt.toISOString(),
  }
}

function createStableProofId(input: AtomicCreateInput) {
  return hash([
    input.restaurantId,
    "CreateOrder",
    input.principal.kind,
    input.principal.uid,
    input.request.channel,
    input.request.tableContext?.tableSessionId ?? "",
    input.idempotencyKey,
  ].join(":"))
}

function hash(value: string) {
  return sha256(value)
}

function toRestaurantAuthority(id: string, data: DocumentData): RestaurantAuthority {
  const rawTaxRate = numberOr(data.taxRate, 0)
  const taxRate = rawTaxRate > 1 ? rawTaxRate / 100 : rawTaxRate
  return {
    id,
    name: stringOr(data.name, id),
    active: !["suspended", "inactive", "closed"].includes(stringOr(data.status, "active")),
    currency: stringOr(data.currency, "FCFA"),
    taxRate,
    pricesIncludeTax: data.pricesIncludeTax === true,
    deliveryFee: numberOr(data.deliveryFee, 0),
    publicOrderingOpen: data.publicOrderingOpen !== false,
  }
}

function toProductAuthority(id: string, data: DocumentData): ProductAuthority {
  return {
    id,
    name: stringOr(data.name, id),
    price: moneyFrom(data),
    active: data.isActive !== false && data.available !== false && data.status !== "inactive",
    categoryId: nullableString(data.categoryId),
    preparationMode: preparationModeOrNull(data.preparationMode),
    options: Array.isArray(data.options) ? data.options.map(toProductOptionAuthority) : [],
    reviewsEnabled: data.reviewsEnabled === true,
  }
}

function toProductOptionAuthority(data: unknown): ProductOptionAuthority {
  const value = isRecord(data) ? data : {}
  const rawChoices = Array.isArray(value.choices)
    ? value.choices
    : Array.isArray(value.options)
      ? value.options
      : []
  return {
    name: stringOr(value.name, ""),
    required: value.required === true,
    choices: rawChoices.map((choice) => {
      const entry = isRecord(choice) ? choice : {}
      return {
        name: stringOr(entry.name ?? entry.label, ""),
        price: numberOr(entry.price, 0),
        active: entry.active !== false && entry.isActive !== false,
      }
    }),
  }
}

function toCategoryAuthority(id: string, data: DocumentData): CategoryAuthority {
  return {
    id,
    name: stringOr(data.name, id),
    active: data.isActive !== false && data.active !== false,
    preparationMode: preparationModeOrNull(data.preparationMode),
  }
}

function toTableSessionAuthority(id: string, data: DocumentData): TableSessionAuthority {
  return {
    id,
    tableId: stringOr(data.tableId, ""),
    zoneId: nullableString(data.zoneId),
    active: data.status === "active" && data.closedAt == null,
  }
}

function moneyFrom(data: DocumentData) {
  return numberOr(data.unitPrice ?? data.basePrice ?? data.price, Number.NaN)
}

function preparationModeOrNull(value: unknown): PreparationMode | null {
  return value === "kitchen" || value === "bar" || value === "direct" ? value : null
}

function stringOr(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function numberOr(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}
