import type { SelectedCartOption } from "@/modules/restaurant/types"

export type ProductComponentRecipeLine = {
  inventoryItemId: string
  quantity: number
}

export type ProductComponentOption = {
  name: string
  price?: number
  multiplier?: number
  recipe?: ProductComponentRecipeLine[]
}

export type ProductComponent = {
  id: string
  type: "base" | "variant" | "addon"
  recipe?: ProductComponentRecipeLine[]
  options?: ProductComponentOption[]
}

export type ProductConsumptionLine = {
  inventoryItemId: string
  quantity: number
}

export function assertValidComponentMultiplier(value: unknown) {
  const multiplier = Number(value ?? 1)
  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    throw new Error("Le multiplicateur doit être supérieur à 0.")
  }
  if (multiplier > 5) {
    throw new Error("Le multiplicateur ne peut pas dépasser 5.")
  }
  return multiplier
}

export function buildComponentsFromLegacy(product: any): ProductComponent[] {
  const components: ProductComponent[] = []

  const baseRecipe = normalizeRecipe(product?.recipe)
  if (baseRecipe.length) {
    components.push({
      id: "base",
      type: "base",
      recipe: baseRecipe,
    })
  }

  if (Array.isArray(product?.variants) && product.variants.length) {
    components.push({
      id: "variant",
      type: "variant",
      options: product.variants
        .map((variant: any) => ({
          name: String(variant?.name || variant?.label || "").trim(),
          price: normalizeNumber(variant?.price),
          multiplier: normalizeMultiplier(variant?.multiplier),
        }))
        .filter((option: ProductComponentOption) => option.name),
    })
  }

  if (Array.isArray(product?.options) && product.options.length) {
    const variantOptions: ProductComponentOption[] = []
    const addonOptions: ProductComponentOption[] = []

    for (const optionGroup of product.options) {
      const groupName = String(optionGroup?.name || "").trim()
      const choices = getOptionChoices(optionGroup)
      if (!groupName || choices.length === 0) continue

      for (const choice of choices) {
        const componentOption = {
          name: String(choice?.name || choice?.label || "").trim(),
          price: normalizeNumber(choice?.price),
          multiplier: normalizeMultiplier(choice?.multiplier),
          recipe: normalizeRecipe(choice?.recipe),
        }
        if (!componentOption.name) continue

        if (isVariantGroup(groupName, optionGroup)) {
          variantOptions.push(componentOption)
        } else {
          addonOptions.push(componentOption)
        }
      }
    }

    if (variantOptions.length) {
      components.push({
        id: "variant",
        type: "variant",
        options: variantOptions,
      })
    }

    if (addonOptions.length) {
      components.push({
        id: "addon",
        type: "addon",
        options: addonOptions,
      })
    }
  }

  return components
}

export function getProductComponents(product: any): ProductComponent[] {
  return Array.isArray(product?.components) && product.components.length
    ? normalizeComponents(product.components)
    : buildComponentsFromLegacy(product)
}

export function computeConsumption(orderItem: any, product = orderItem?.product): ProductConsumptionLine[] {
  const components = getProductComponents(product)
  const selectedOptions = normalizeSelectedOptions(orderItem)
  const consumption = new Map<string, number>()
  const variantComponent = components.find((component) => component.type === "variant")
  const selectedVariant = orderItem?.variant?.name
    ? String(orderItem.variant.name)
    : selectedOptions.find((selected) => 
        normalizeName(selected.optionName) === "variante" || 
        normalizeName(selected.optionName) === "taille"
      )?.choiceName
  const multiplier =
    variantComponent?.options?.find((option) => normalizeName(option.name) === normalizeName(selectedVariant))?.multiplier ?? 1

  for (const component of components) {
    if (component.type === "base") {
      for (const ingredient of component.recipe || []) {
        addConsumption(consumption, ingredient.inventoryItemId, ingredient.quantity * multiplier)
      }
    }

    if (component.type === "addon") {
      for (const selected of selectedOptions) {
        const option = component.options?.find(
          (current) => normalizeName(current.name) === normalizeName(selected.choiceName)
        )
        if (!option?.recipe?.length) continue

        for (const ingredient of option.recipe) {
          addConsumption(consumption, ingredient.inventoryItemId, ingredient.quantity * multiplier)
        }
      }
    }
  }

  return Array.from(consumption.entries()).map(([inventoryItemId, quantity]) => ({
    inventoryItemId,
    quantity,
  }))
}

export function computeEstimatedCost(
  product: any,
  inventoryItems: any[] = [],
  selection: any = {}
) {
  const selectedOrderItem = Array.isArray(selection)
    ? { selectedOptions: selection }
    : {
        selectedOptions: selection?.selectedOptions,
        variant: selection?.variant,
        addons: selection?.addons,
      }
  const consumption = computeConsumption(selectedOrderItem, product)

  return consumption.reduce((total, line) => {
    const inventoryItem = inventoryItems.find((item) => item.id === line.inventoryItemId)
    const costPerUnit = normalizeNumber(inventoryItem?.costPerUnit)
    return total + line.quantity * costPerUnit
  }, 0)
}

export function hasComplexConsumption(product: any) {
  return getProductComponents(product).some((component) => {
    if (component.type === "variant") {
      return (component.options || []).some((option) => normalizeMultiplier(option.multiplier) !== 1)
    }
    if (component.type === "addon") {
      return (component.options || []).some((option) => Boolean(option.recipe?.length))
    }
    return false
  })
}

export function hasTrackedConsumption(product: any) {
  return getProductComponents(product).some((component) => {
    if (component.type === "base") return Boolean(component.recipe?.length)
    return (component.options || []).some((option) => Boolean(option.recipe?.length))
  })
}

export function buildSelectionOptionsFromComponents(product: any) {
  return getProductComponents(product)
    .filter((component) => component.type === "variant" || component.type === "addon")
    .map((component) => ({
      name: component.type === "variant" ? "Variante" : "Suppléments",
      required: component.type === "variant",
      multiple: component.type === "addon",
      choices: (component.options || []).map((option) => ({
        name: option.name,
        price: Number(option.price || 0),
        multiplier: option.multiplier,
        recipe: option.recipe || [],
      })),
    }))
    .filter((option) => option.choices.length > 0)
}

function normalizeComponents(value: unknown): ProductComponent[] {
  if (!Array.isArray(value)) return []
  return value
    .map((component: any) => ({
      id: String(component?.id || component?.type || "").trim(),
      type: component?.type,
      recipe: normalizeRecipe(component?.recipe),
      options: Array.isArray(component?.options)
        ? component.options
            .map((option: any) => ({
              name: String(option?.name || "").trim(),
              price: normalizeNumber(option?.price),
              multiplier: normalizeMultiplier(option?.multiplier),
              recipe: normalizeRecipe(option?.recipe),
            }))
            .filter((option: ProductComponentOption) => option.name)
        : [],
    }))
    .filter((component) => component.id && ["base", "variant", "addon"].includes(component.type))
}

function normalizeRecipe(value: unknown): ProductComponentRecipeLine[] {
  if (!Array.isArray(value)) return []
  return value
    .map((line: any) => ({
      inventoryItemId: String(line?.inventoryItemId || line?.itemId || line?.ingredientId || "").trim(),
      quantity: normalizeNumber(line?.quantity ?? line?.qty),
    }))
    .filter((line) => line.inventoryItemId && line.quantity > 0)
}

function normalizeSelectedOptions(orderItem: any): SelectedCartOption[] {
  const selections: SelectedCartOption[] = []

  if (Array.isArray(orderItem?.selectedOptions)) {
    selections.push(...orderItem.selectedOptions)
  }

  if (orderItem?.variant?.name) {
    const hasVariant = selections.some(
      (s) => normalizeName(s.optionName) === "variante" || normalizeName(s.optionName) === "taille"
    )
    if (!hasVariant) {
      selections.push({
        optionName: "Variante",
        choiceName: orderItem.variant.name,
        price: normalizeNumber(orderItem.variant.price),
      })
    }
  }

  if (Array.isArray(orderItem?.addons)) {
    for (const addon of orderItem.addons) {
      if (!addon?.name) continue
      const hasAddon = selections.some((s) => normalizeName(s.choiceName) === normalizeName(addon.name))
      if (!hasAddon) {
        selections.push({
          optionName: "Suppléments",
          choiceName: addon.name,
          price: normalizeNumber(addon.price),
        })
      }
    }
  }

  return selections
}

function findSelectedComponentOption(component: ProductComponent, selectedOptions: SelectedCartOption[]) {
  return component.options?.find((option) =>
    selectedOptions.some((selected) => normalizeName(selected.choiceName) === normalizeName(option.name))
  )
}

function addConsumption(map: Map<string, number>, inventoryItemId: string, quantity: number) {
  if (!inventoryItemId || quantity <= 0) return
  map.set(inventoryItemId, (map.get(inventoryItemId) || 0) + quantity)
}

function getOptionChoices(option: any) {
  if (Array.isArray(option?.choices)) return option.choices
  if (Array.isArray(option?.options)) return option.options
  return []
}

function isVariantGroup(groupName: string, optionGroup: any) {
  const normalized = normalizeName(groupName)
  return !optionGroup?.multiple && (normalized === "taille" || normalized === "variante")
}

function normalizeMultiplier(value: unknown) {
  const multiplier = Number(value || 1)
  if (!Number.isFinite(multiplier)) return 1
  return Math.min(5, Math.max(0.1, multiplier))
}

function normalizeNumber(value: unknown) {
  const amount = Number(value || 0)
  return Number.isFinite(amount) && amount > 0 ? amount : 0
}

function normalizeName(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
}
