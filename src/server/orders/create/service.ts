import { buildCanonicalOrder } from "./builder.ts"
import { commandRequestHash } from "../common/idempotency.ts"
import type {
  AtomicOrderCreationPort,
  CreateCanonicalOrderResult,
  OrderPrincipal,
} from "./types.ts"
import {
  parseCreateOrderRequest,
  validateIdempotencyKey,
  validateRequestForPrincipal,
} from "./validation.ts"

export interface CreateCanonicalOrderDependencies {
  store: AtomicOrderCreationPort
}

export async function createCanonicalOrder(
  dependencies: CreateCanonicalOrderDependencies,
  input: {
    restaurantId: string
    body: unknown
    principal: OrderPrincipal
    idempotencyKey: string | null
  }
): Promise<CreateCanonicalOrderResult> {
  const request = parseCreateOrderRequest(input.body)
  const idempotencyKey = validateIdempotencyKey(input.idempotencyKey)
  validateRequestForPrincipal(request, input.principal)
  const requestHash = hashCreateOrderRequest(request)

  return dependencies.store.create(
    {
      restaurantId: input.restaurantId,
      request,
      principal: input.principal,
      idempotencyKey,
      requestHash,
    },
    ({ authorities, orderId, orderItemIds, now }) =>
      buildCanonicalOrder({
        restaurantId: input.restaurantId,
        request,
        principal: input.principal,
        authorities,
        orderId,
        orderItemIds,
        now,
      })
  )
}

export function hashCreateOrderRequest(
  request: ReturnType<typeof parseCreateOrderRequest>
) {
  const canonical = {
    schemaVersion: request.schemaVersion,
    channel: request.channel,
    serviceMode: request.serviceMode,
    items: request.items,
    tableContext: request.tableContext
      ? {
          tableId: request.tableContext.tableId,
          tableSessionId: request.tableContext.tableSessionId,
        }
      : null,
    customer: request.customer,
    delivery: request.delivery,
    cashSessionId: request.cashSessionId,
    notes: request.notes,
  }
  return commandRequestHash(canonical)
}
