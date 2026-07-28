import type {
  ActorId,
  CausationId,
  CommandId,
  CorrelationId,
  EventId,
  IdempotencyKey,
  IsoDateTime,
  RestaurantId,
} from "../value-objects"

export interface CommandMetadata {
  readonly commandId: CommandId
  readonly restaurantId: RestaurantId
  readonly actorId: ActorId
  readonly requestedAt: IsoDateTime
  readonly correlationId: CorrelationId
  readonly causationId?: CausationId
  readonly idempotencyKey?: IdempotencyKey
  readonly contractVersion: 1
}

export interface BusinessCommand<TName extends string, TPayload> {
  readonly name: TName
  readonly metadata: CommandMetadata
  readonly payload: TPayload
}

export interface EventMetadata {
  readonly eventId: EventId
  readonly restaurantId: RestaurantId
  readonly occurredAt: IsoDateTime
  readonly recordedAt: IsoDateTime
  readonly correlationId: CorrelationId
  readonly causationId?: CausationId
  readonly actorId?: ActorId
  readonly contractVersion: 1
}

export interface BusinessEvent<TName extends string, TPayload> {
  readonly name: TName
  readonly metadata: EventMetadata
  readonly payload: TPayload
}
