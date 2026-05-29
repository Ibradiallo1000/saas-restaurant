import { buildSelectionOptionsFromComponents } from "@/lib/product-components"
import type { SelectedCartOption } from "@/modules/restaurant/types"

export type ProductConfigGroup = {
  name: string
  multiple?: boolean
  required?: boolean
  choices: Array<{ name: string; price?: number }>
}

export function getProductConfigGroups(product: any): ProductConfigGroup[] {
  const groups: ProductConfigGroup[] = []

  if (Array.isArray(product?.sizes) && product.sizes.length > 0) {
    groups.push({
      name: "Taille",
      choices: product.sizes.map((size: any) => ({
        name: size.name || size.label || size.size || "Taille",
        price: Number(size.price ?? 0),
      })),
    })
  }

  if (Array.isArray(product?.variants) && product.variants.length > 0) {
    groups.push({
      name: "Variante",
      choices: product.variants.map((variant: any) => ({
        name: variant.name || variant.label || "Variante",
        price: Number(variant.price ?? 0),
      })),
    })
  }

  if (Array.isArray(product?.options)) {
    product.options.forEach((option: any) => {
      if (!Array.isArray(option?.choices) || option.choices.length === 0) return
      groups.push({
        name: option.name || "Option",
        required: option.required === true,
        multiple: Boolean(option.multiple),
        choices: option.choices.map((choice: any) => ({
          name: choice.name || choice.label || "Choix",
          price: Number(choice.price ?? 0),
        })),
      })
    })
  }

  if (groups.length === 0) {
    buildSelectionOptionsFromComponents(product).forEach((option: any) => {
      groups.push({
        name: option.name,
        required: option.required === true,
        multiple: Boolean(option.multiple),
        choices: option.choices || [],
      })
    })
  }

  return groups
}

export function getDefaultConfigSelections(product: any): Record<string, SelectedCartOption> {
  const defaultSize = product?.sizes?.[0] || null

  if (!defaultSize) return {}

  return {
    Taille: {
      optionName: "Taille",
      choiceName: defaultSize.name || defaultSize.label || defaultSize.size || "Taille",
      price: Number(defaultSize.price ?? 0),
    },
  }
}
