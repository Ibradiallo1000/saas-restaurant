import { CanonicalOrderError } from "./errors.ts"
import type {
  CreateOrderLineInput,
  ProductAuthority,
  ProductOptionAuthority,
} from "./types.ts"

export interface ResolvedLinePrice {
  unitPrice: number
  subtotal: number
  selectedOptions: Array<{
    optionName: string
    choiceName: string
    price: number
  }>
}

export function resolveCanonicalLinePrice(
  product: ProductAuthority,
  line: CreateOrderLineInput
): ResolvedLinePrice {
  assertMoney(product.price, "prix du produit")
  const selections = new Map<string, CreateOrderLineInput["options"][number]>()

  for (const selection of line.options) {
    const optionKey = normalizeName(selection.optionName)
    if (selections.has(optionKey)) {
      throw new CanonicalOrderError(
        "INVALID_OPTION",
        `L'option ${selection.optionName} est sélectionnée plusieurs fois.`
      )
    }
    selections.set(optionKey, selection)
  }

  const selectedOptions = line.options.map((selection) => {
    const option = findUniqueOption(product.options, selection.optionName)
    const choice = findUniqueChoice(option, selection.choiceName)
    if (!choice.active) {
      throw new CanonicalOrderError("INVALID_OPTION", `Le choix ${choice.name} n'est plus disponible.`)
    }
    assertMoney(choice.price, `prix de l'option ${choice.name}`)
    return {
      optionName: option.name,
      choiceName: choice.name,
      price: choice.price,
    }
  })

  for (const option of product.options) {
    if (option.required && !selections.has(normalizeName(option.name))) {
      throw new CanonicalOrderError("INVALID_OPTION", `L'option ${option.name} est obligatoire.`)
    }
  }

  const unitPrice = roundMoney(
    product.price + selectedOptions.reduce((total, option) => total + option.price, 0)
  )
  return {
    unitPrice,
    subtotal: roundMoney(unitPrice * line.quantity),
    selectedOptions,
  }
}

export function calculateOrderTotals(input: {
  lineSubtotal: number
  taxRate: number
  pricesIncludeTax: boolean
  deliveryFee?: number
}) {
  assertRate(input.taxRate)
  const deliveryFee = roundMoney(input.deliveryFee ?? 0)
  assertMoney(deliveryFee, "frais de livraison")

  const taxAmount =
    input.taxRate === 0
      ? 0
      : input.pricesIncludeTax
        ? roundMoney(input.lineSubtotal - input.lineSubtotal / (1 + input.taxRate))
        : roundMoney(input.lineSubtotal * input.taxRate)

  const total = roundMoney(
    input.lineSubtotal + (input.pricesIncludeTax ? 0 : taxAmount) + deliveryFee
  )
  return {
    subtotal: roundMoney(input.lineSubtotal),
    taxAmount,
    deliveryFee,
    total,
  }
}

function findUniqueOption(options: ProductOptionAuthority[], name: string) {
  const matches = options.filter((option) => normalizeName(option.name) === normalizeName(name))
  if (matches.length !== 1) {
    throw new CanonicalOrderError(
      "INVALID_OPTION",
      matches.length === 0 ? `Option inconnue : ${name}.` : `Option ambiguë : ${name}.`
    )
  }
  return matches[0]
}

function findUniqueChoice(option: ProductOptionAuthority, name: string) {
  const matches = option.choices.filter((choice) => normalizeName(choice.name) === normalizeName(name))
  if (matches.length !== 1) {
    throw new CanonicalOrderError(
      "INVALID_OPTION",
      matches.length === 0 ? `Choix inconnu : ${name}.` : `Choix ambigu : ${name}.`
    )
  }
  return matches[0]
}

function normalizeName(value: string) {
  return value.trim().toLocaleLowerCase("fr")
}

function assertMoney(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new CanonicalOrderError("INVALID_COMMAND", `Configuration invalide : ${label}.`)
  }
}

function assertRate(value: number) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new CanonicalOrderError("INVALID_COMMAND", "Le taux de taxe est invalide.")
  }
}

function roundMoney(value: number) {
  const rounded = Math.round(value)
  if (!Number.isSafeInteger(rounded) || rounded < 0) {
    throw new CanonicalOrderError("INVALID_COMMAND", "Le montant calculé est invalide.")
  }
  return rounded
}
