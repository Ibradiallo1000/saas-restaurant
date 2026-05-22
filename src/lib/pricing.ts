export function getDisplayPrice(product: any) {
  // prix simple
  if (product?.basePrice && product.basePrice > 0) {
    return product.basePrice
  }

  // options required uniquement
  if (Array.isArray(product?.options)) {
    const requiredOptions = product.options.filter(
      (opt: any) => opt.required === true
    )

    const prices: number[] = []

    requiredOptions.forEach((opt: any) => {
      if (Array.isArray(opt.choices)) {
        opt.choices.forEach((choice: any) => {
          if (choice.price > 0) {
            prices.push(choice.price)
          }
        })
      }
    })

    if (prices.length > 0) {
      return Math.min(...prices)
    }
  }

  return 0
}

export function formatPrice(product: any) {
  const price = getDisplayPrice(product)

  if (price <= 0) return ""

  const hasOptions =
    Array.isArray(product?.options) && product.options.length > 0

  return hasOptions
    ? `À partir de ${price.toLocaleString()} FCFA`
    : `${price.toLocaleString()} FCFA`
}