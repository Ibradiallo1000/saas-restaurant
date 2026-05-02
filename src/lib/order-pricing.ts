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
      (selectedOption) => selectedOption.optionName === option.name
    )

    if (!hasSelection) {
      throw new Error(`Option obligatoire manquante: ${option.name}`)
    }
  })

  const optionsTotal = selectedOptions.reduce((sum, selectedOption) => {
    const option = productOptions.find(
      (productOption: any) => productOption?.name === selectedOption.optionName
    )

    if (!option) {
      throw new Error(`Option inconnue: ${selectedOption.optionName}`)
    }

    const choices = Array.isArray(option.choices) ? option.choices : []
    const choice = choices.find(
      (productChoice: any) => productChoice?.name === selectedOption.choiceName
    )

    if (!choice) {
      throw new Error(`Choix inconnu: ${selectedOption.choiceName}`)
    }

    return sum + Number(choice.price ?? 0)
  }, 0)

  return Math.round(basePrice + optionsTotal)
}
