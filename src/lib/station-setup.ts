export type StationTemplate<TType extends string = string> = {
  id: string
  name: string
  code: string
  type: TType
  keywords: string[]
  custom?: boolean
}

export const POS_STATION_TEMPLATES: StationTemplate<"pos">[] = [
  { id: "main", name: "Caisse principale", code: "MAIN", type: "pos", keywords: [] },
  { id: "restaurant", name: "Caisse restaurant", code: "RESTO", type: "pos", keywords: ["restaurant", "plat", "repas", "cuisine"] },
  { id: "fast", name: "Caisse fast-food / comptoir", code: "FAST", type: "pos", keywords: ["fast", "burger", "sandwich", "comptoir"] },
  { id: "bar", name: "Caisse bar", code: "BAR", type: "pos", keywords: ["bar", "boisson", "cocktail"] },
  { id: "pastry", name: "Caisse pâtisserie", code: "PAT", type: "pos", keywords: ["pâtisserie", "patisserie", "gâteau", "dessert"] },
  { id: "bakery", name: "Caisse boulangerie", code: "BOUL", type: "pos", keywords: ["boulangerie", "pain", "viennoiserie"] },
  { id: "takeaway", name: "Caisse livraison / à emporter", code: "TAKE", type: "pos", keywords: ["livraison", "emporter"] },
  { id: "custom", name: "Poste personnalisé", code: "POSTE", type: "pos", keywords: [], custom: true },
]

export const PREPARATION_STATION_TEMPLATES: StationTemplate<"kitchen" | "bar">[] = [
  { id: "kitchen", name: "Cuisine principale", code: "KITCHEN", type: "kitchen", keywords: ["plat", "cuisine", "repas"] },
  { id: "fast", name: "Comptoir rapide / fast-food", code: "FAST", type: "kitchen", keywords: ["fast", "burger", "sandwich", "comptoir"] },
  { id: "bar", name: "Bar", code: "BAR", type: "bar", keywords: ["bar", "boisson", "cocktail"] },
  { id: "pastry", name: "Pâtisserie", code: "PAT", type: "kitchen", keywords: ["pâtisserie", "patisserie", "gâteau", "dessert"] },
  { id: "bakery", name: "Boulangerie", code: "BOUL", type: "kitchen", keywords: ["boulangerie", "pain", "viennoiserie"] },
  { id: "grill", name: "Grillades", code: "GRILL", type: "kitchen", keywords: ["grill", "braisé", "viande"] },
  { id: "pizza", name: "Pizza", code: "PIZZA", type: "kitchen", keywords: ["pizza"] },
  { id: "custom", name: "Poste personnalisé", code: "POSTE", type: "kitchen", keywords: [], custom: true },
]

export const QUICK_STATION_SCENARIOS = [
  { id: "simple", name: "Restaurant simple", description: "Une caisse et une cuisine", pos: ["main"], preparation: ["kitchen"] },
  { id: "bar", name: "Restaurant avec bar", description: "Caisse principale, cuisine et bar", pos: ["main", "bar"], preparation: ["kitchen", "bar"] },
  { id: "fast", name: "Restaurant avec comptoir fast-food", description: "Caisse principale et comptoir rapide", pos: ["main", "fast"], preparation: ["kitchen", "fast"] },
  { id: "pastry", name: "Restaurant avec pâtisserie", description: "Caisse principale, cuisine et pâtisserie", pos: ["main", "pastry"], preparation: ["kitchen", "pastry"] },
] as const

export function uniqueStationCode(requested: string, existingCodes: readonly string[]) {
  const base = requested.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "") || "POSTE"
  const existing = new Set(existingCodes.map((code) => code.trim().toUpperCase()))
  if (!existing.has(base)) return base
  let suffix = 2
  while (existing.has(`${base}${suffix}`)) suffix += 1
  return `${base}${suffix}`
}

export function suggestCategoryIds(
  template: Pick<StationTemplate, "keywords">,
  categories: readonly { id: string; name?: string }[]
) {
  if (!template.keywords.length) return []
  return categories
    .filter((category) => {
      const name = String(category.name || "").toLocaleLowerCase("fr")
      return template.keywords.some((keyword) => name.includes(keyword.toLocaleLowerCase("fr")))
    })
    .map((category) => category.id)
}

export function preparationTypeLabel(type: string) {
  if (type === "bar") return "Bar"
  if (type === "direct") return "Produit remis directement"
  return "Cuisine"
}
