import type {
  AtomicOrderCommandPort,
  CancelOrderItemQuantityInput,
  CanonicalCommandResult,
  ConfirmOrderPaymentInput,
  MarkOrderItemPreparingInput,
  MarkOrderItemReadyInput,
  MarkOrderItemServedInput,
  OrderCommandName,
} from "./types.ts"
import { assertPermission } from "./permissions.ts"
import {
  planCancellation,
  planPayment,
  planPreparing,
  planReady,
  planServed,
} from "./transitions.ts"
import {
  validateBase,
  validateItemBase,
  validatePayment,
  validatePositiveQuantity,
} from "./validation.ts"

export interface OrderCommandDependencies {
  store: AtomicOrderCommandPort
}

export function markOrderItemPreparing(
  dependencies: OrderCommandDependencies,
  input: MarkOrderItemPreparingInput
): Promise<CanonicalCommandResult> {
  validateItemBase(input)
  return execute(dependencies, "MarkOrderItemPreparing", input, planPreparing)
}

export function markOrderItemReady(
  dependencies: OrderCommandDependencies,
  input: MarkOrderItemReadyInput
): Promise<CanonicalCommandResult> {
  validateItemBase(input)
  return execute(dependencies, "MarkOrderItemReady", input, planReady)
}

export function markOrderItemServed(
  dependencies: OrderCommandDependencies,
  input: MarkOrderItemServedInput
): Promise<CanonicalCommandResult> {
  validateItemBase(input)
  validatePositiveQuantity(input.quantityToServe)
  return execute(dependencies, "MarkOrderItemServed", input, planServed)
}

export function cancelOrderItemQuantity(
  dependencies: OrderCommandDependencies,
  input: CancelOrderItemQuantityInput
): Promise<CanonicalCommandResult> {
  validateItemBase(input)
  validatePositiveQuantity(input.quantityToCancel)
  return execute(dependencies, "CancelOrderItemQuantity", input, planCancellation)
}

export function confirmOrderPayment(
  dependencies: OrderCommandDependencies,
  input: ConfirmOrderPaymentInput
): Promise<CanonicalCommandResult> {
  validatePayment(input)
  return execute(dependencies, "ConfirmOrderPayment", input, planPayment)
}

function execute<T extends Parameters<AtomicOrderCommandPort["execute"]>[1]>(
  dependencies: OrderCommandDependencies,
  commandName: OrderCommandName,
  input: T,
  transition: (
    state: Parameters<Parameters<AtomicOrderCommandPort["execute"]>[2]>[0],
    input: T
  ) => ReturnType<Parameters<AtomicOrderCommandPort["execute"]>[2]>
) {
  validateBase(input)
  return dependencies.store.execute(commandName, input, (state) => {
    assertPermission({
      commandName,
      actor: input.actor,
      sourceChannel: input.sourceChannel,
      item: state.item,
    })
    return transition(state, input)
  })
}
