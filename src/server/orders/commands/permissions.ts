import { OrderCommandError } from "./errors.ts"
import type {
  OrderCommandActor,
  OrderCommandName,
  OrderItemSnapshot,
  SourceChannel,
} from "./types.ts"

export function assertPermission(input: {
  commandName: OrderCommandName
  actor: OrderCommandActor
  sourceChannel: SourceChannel
  item: OrderItemSnapshot | null
}) {
  const { commandName, actor, sourceChannel, item } = input
  if (actor.role === "owner" || actor.role === "manager") return

  if (commandName === "MarkOrderItemPreparing") {
    if (
      actor.role === "kitchen" &&
      sourceChannel === "kitchen" &&
      item?.preparationMode === "kitchen"
    ) return
    if (
      actor.role === "cashier" &&
      sourceChannel === "pos" &&
      item?.preparationMode === "bar"
    ) return
  }
  if (commandName === "MarkOrderItemReady") {
    if (
      actor.role === "kitchen" &&
      sourceChannel === "kitchen" &&
      item?.preparationMode === "kitchen"
    ) return
    if (
      actor.role === "cashier" &&
      sourceChannel === "pos" &&
      item?.preparationMode === "bar"
    ) return
  }
  if (
    (commandName === "MarkOrderItemsPreparing" || commandName === "MarkOrderItemsReady") &&
    actor.role === "kitchen" &&
    sourceChannel === "kitchen"
  ) return
  if (
    commandName === "MarkOrderItemServed" &&
    sourceChannel === "pos" &&
    (actor.role === "cashier" || actor.role === "server")
  ) return
  if (
    commandName === "ServeOrderItems" &&
    sourceChannel === "pos" &&
    (actor.role === "cashier" || actor.role === "server")
  ) return
  if (
    commandName === "HandOffOrderItems" &&
    sourceChannel === "pos" &&
    (actor.role === "cashier" || actor.role === "server")
  ) return
  if (
    commandName === "ConfirmOrderPayment" &&
    sourceChannel === "pos" &&
    actor.role === "cashier"
  ) return
  if (actor.role === "system" && sourceChannel === "system") return

  throw new OrderCommandError(
    "FORBIDDEN_ACTOR",
    `${actor.role} ne peut pas exécuter ${commandName} depuis ${sourceChannel}.`
  )
}
