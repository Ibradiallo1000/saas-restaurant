import type { SelectedCartOption } from "@/modules/restaurant/types"

export function getProductBasePrice(product: any) {
  const price = Number(product?.unitPrice ?? product?.basePrice ?? product?.price ?? 0)
  return Number.isFinite(price) ? price : 0
}

export function getSelectedOptionsKey(selectedOptions: SelectedCartOption[] = []) {
  if (selectedOptions.length === 0) return "base"

  return JSON.stringify(
    selectedOptions
      .map((option) => ({
        optionName: option.optionName,
        choiceName: option.choiceName,
        price: Number(option.price ?? 0),
      }))
      .sort((a, b) => {
        const optionCompare = a.optionName.localeCompare(b.optionName)
        if (optionCompare !== 0) return optionCompare
        return a.choiceName.localeCompare(b.choiceName)
      })
  )
}

export function getConfiguredCartItemId(
  productId: string,
  selectedOptions: SelectedCartOption[] = []
) {
  return `${productId}_${getSelectedOptionsKey(selectedOptions)}`
}

export function recalculateConfiguredUnitPrice(
  product: any,
  selectedOptions: SelectedCartOption[] = []
) {
  const productOptions = Array.isArray(product?.options) ? product.options : []
  const basePrice = getProductBasePrice(product)

  productOptions.forEach((option: any) => {
    if (!option?.required) return

    const hasSelection = selectedOptions.some(
      (selectedOption) => normalizeOptionName(selectedOption.optionName) === normalizeOptionName(option.name)
    )

    if (!hasSelection) {
      throw new Error(`Option obligatoire manquante: ${option.name}`)
    }
  })

  const optionsTotal = selectedOptions.reduce((sum, selectedOption) => {
    const option = productOptions.find(
      (productOption: any) => normalizeOptionName(productOption?.name) === normalizeOptionName(selectedOption.optionName)
    )

    if (!option) {
      if (canTrustSelectedOptionPrice(selectedOption)) {
        return sum + Number(selectedOption.price ?? 0)
      }

      throw new Error(`Option inconnue: ${selectedOption.optionName}`)
    }

    const choices = getOptionChoices(option)
    const choice = choices.find(
      (productChoice: any) => normalizeOptionName(productChoice?.name ?? productChoice?.label) === normalizeOptionName(selectedOption.choiceName)
    )

    if (!choice) {
      throw new Error(`Choix inconnu: ${selectedOption.choiceName}`)
    }

    return sum + Number(choice.price ?? 0)
  }, 0)

  return Math.round(basePrice + optionsTotal)
}

function getOptionChoices(option: any) {
  if (Array.isArray(option?.choices)) return option.choices
  if (Array.isArray(option?.options)) return option.options
  return []
}

function normalizeOptionName(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
}

function isBaseSelection(selectedOption: SelectedCartOption) {
  const optionName = normalizeOptionName(selectedOption.optionName)
  return optionName === "taille" || optionName === "variante"
}

function isSupplementSelection(selectedOption: SelectedCartOption) {
  const optionName = normalizeOptionName(selectedOption.optionName)
  return optionName === "supplement" || optionName === "supplément" || optionName === "supplements" || optionName === "suppléments"
}

function canTrustSelectedOptionPrice(selectedOption: SelectedCartOption) {
  return isBaseSelection(selectedOption) || isSupplementSelection(selectedOption)
}
