import {
  Apple,
  Baby,
  BadgePercent,
  Banana,
  Bean,
  Beef,
  Cake,
  CakeSlice,
  Candy,
  Carrot,
  ChefHat,
  Coffee,
  Cookie,
  CookingPot,
  Croissant,
  CupSoda,
  Dessert,
  Donut,
  Drumstick,
  EggFried,
  Fish,
  Flame,
  GlassWater,
  Ham,
  IceCreamBowl,
  Martini,
  Milk,
  Pizza,
  Salad,
  Sandwich,
  Shell,
  Soup,
  Sparkles,
  Torus,
  Utensils,
  UtensilsCrossed,
  Vegan,
  Wheat,
  Wine,
  type LucideIcon,
} from "lucide-react"

export type MarketplaceCategoryIconFamilyKey =
  | "street-food"
  | "meat-grill"
  | "seafood"
  | "african-staples"
  | "main-dishes"
  | "breakfast"
  | "desserts"
  | "drinks"
  | "diet-labels"
  | "restaurant-highlights"

export interface MarketplaceCategoryIconOption {
  key: string
  label: string
  family: MarketplaceCategoryIconFamilyKey
  Icon: LucideIcon
  keywords?: string[]
}

export const MARKETPLACE_CATEGORY_ICON_FAMILY_LABELS: Record<MarketplaceCategoryIconFamilyKey, string> = {
  "street-food": "Street food",
  "meat-grill": "Viandes et grillades",
  seafood: "Poissons et fruits de mer",
  "african-staples": "Afrique et bases",
  "main-dishes": "Plats et accompagnements",
  breakfast: "Petit déjeuner",
  desserts: "Desserts et pâtisserie",
  drinks: "Boissons",
  "diet-labels": "Régimes et préférences",
  "restaurant-highlights": "Mise en avant",
}

export const MARKETPLACE_CATEGORY_ICON_FAMILIES = [
  {
    key: "street-food",
    options: [
      { key: "burger", label: "Burger", Icon: Ham },
      { key: "hot-dog", label: "Hot-dog", Icon: Sandwich, keywords: ["hotdog"] },
      { key: "kebab", label: "Kebab", Icon: Beef },
      { key: "pizza", label: "Pizza", Icon: Pizza },
      { key: "sandwich", label: "Sandwich", Icon: Sandwich },
      { key: "shawarma", label: "Shawarma", Icon: CookingPot },
      { key: "tacos", label: "Tacos", Icon: Sandwich },
      { key: "wrap", label: "Wrap", Icon: Sandwich },
    ],
  },
  {
    key: "meat-grill",
    options: [
      { key: "barbecue", label: "Barbecue", Icon: Flame },
      { key: "brochettes", label: "Brochettes", Icon: Beef, keywords: ["skewers"] },
      { key: "fried-chicken", label: "Poulet frit", Icon: Drumstick },
      { key: "grill", label: "Grillades", Icon: Flame },
      { key: "meat", label: "Viande", Icon: Beef },
      { key: "roasted-chicken", label: "Poulet rôti", Icon: Drumstick },
      { key: "steak", label: "Steak", Icon: Beef },
      { key: "chicken", label: "Poulet", Icon: Drumstick },
    ],
  },
  {
    key: "seafood",
    options: [
      { key: "calamari", label: "Calamar", Icon: Shell },
      { key: "crab", label: "Crabe", Icon: Shell },
      { key: "lobster", label: "Homard", Icon: Shell },
      { key: "fish", label: "Poisson", Icon: Fish },
      { key: "shrimp", label: "Crevettes", Icon: Shell },
      { key: "seafood", label: "Fruits de mer", Icon: Shell },
    ],
  },
  {
    key: "african-staples",
    options: [
      { key: "alloco", label: "Alloco", Icon: Banana, keywords: ["plantain"] },
      { key: "attieke", label: "Attiéké", Icon: Wheat, keywords: ["attiéké", "manioc"] },
      { key: "couscous", label: "Couscous", Icon: Wheat },
      { key: "african-dishes", label: "Plats africains", Icon: UtensilsCrossed },
      { key: "african-rice", label: "Riz africain", Icon: CookingPot },
      { key: "rice", label: "Riz", Icon: CookingPot },
    ],
  },
  {
    key: "main-dishes",
    options: [
      { key: "sides", label: "Accompagnements", Icon: Utensils },
      { key: "starters", label: "Entrées", Icon: UtensilsCrossed },
      { key: "fries", label: "Frites", Icon: CookingPot },
      { key: "vegetables", label: "Légumes", Icon: Carrot },
      { key: "noodles", label: "Nouilles", Icon: CookingPot },
      { key: "pasta", label: "Pâtes", Icon: UtensilsCrossed },
      { key: "dishes", label: "Plats", Icon: Soup },
      { key: "salad", label: "Salade", Icon: Salad },
      { key: "soup", label: "Soupe", Icon: Soup },
    ],
  },
  {
    key: "breakfast",
    options: [
      { key: "bread", label: "Pain", Icon: Wheat },
      { key: "breakfast", label: "Petit déjeuner", Icon: Coffee },
      { key: "eggs", label: "Œufs", Icon: EggFried, keywords: ["oeufs"] },
      { key: "pancakes", label: "Pancakes", Icon: Dessert },
    ],
  },
  {
    key: "desserts",
    options: [
      { key: "cake", label: "Gâteaux", Icon: CakeSlice, keywords: ["gateaux"] },
      { key: "crepes", label: "Crêpes", Icon: Dessert, keywords: ["crepes"] },
      { key: "desserts", label: "Desserts", Icon: IceCreamBowl },
      { key: "donuts", label: "Donuts", Icon: Donut },
      { key: "ice-cream", label: "Glace", Icon: IceCreamBowl },
      { key: "pastry", label: "Pâtisserie", Icon: Croissant, keywords: ["patisserie"] },
      { key: "waffles", label: "Gaufres", Icon: Dessert },
    ],
  },
  {
    key: "drinks",
    options: [
      { key: "drinks", label: "Boissons", Icon: CupSoda },
      { key: "hot-chocolate", label: "Chocolat chaud", Icon: Milk },
      { key: "cocktails", label: "Cocktails", Icon: Martini },
      { key: "water", label: "Eau", Icon: GlassWater },
      { key: "juice", label: "Jus", Icon: Apple },
      { key: "milkshake", label: "Milkshake", Icon: Milk },
      { key: "smoothies", label: "Smoothies", Icon: CupSoda },
      { key: "soda", label: "Soda", Icon: CupSoda },
      { key: "tea", label: "Thé", Icon: Coffee, keywords: ["the"] },
      { key: "coffee", label: "Café", Icon: Coffee, keywords: ["cafe"] },
    ],
  },
  {
    key: "diet-labels",
    options: [
      { key: "halal", label: "Halal", Icon: Sparkles },
      { key: "kids-menu", label: "Menu enfant", Icon: Baby },
      { key: "spicy", label: "Épicé", Icon: Flame, keywords: ["epice"] },
      { key: "vegan", label: "Vegan", Icon: Vegan },
      { key: "vegetarian", label: "Végétarien", Icon: Bean, keywords: ["vegetarien"] },
    ],
  },
  {
    key: "restaurant-highlights",
    options: [
      { key: "chef-special", label: "Spécialité du chef", Icon: ChefHat },
      { key: "new", label: "Nouveauté", Icon: Sparkles, keywords: ["nouveaute"] },
      { key: "promotion", label: "Promotion", Icon: BadgePercent },
      { key: "snack", label: "Snack", Icon: Cookie },
      { key: "sweet", label: "Sucré", Icon: Candy, keywords: ["sucre"] },
      { key: "wine", label: "Vins", Icon: Wine },
      { key: "generic", label: "Catégorie générique", Icon: Utensils },
      { key: "bagel", label: "Bagel", Icon: Torus },
      { key: "cake-large", label: "Gâteau entier", Icon: Cake },
    ],
  },
] as const satisfies ReadonlyArray<{
  key: MarketplaceCategoryIconFamilyKey
  options: ReadonlyArray<Omit<MarketplaceCategoryIconOption, "family">>
}>

export const MARKETPLACE_CATEGORY_ICON_OPTIONS = MARKETPLACE_CATEGORY_ICON_FAMILIES.flatMap((family) =>
  [...family.options]
    .sort((a, b) => a.label.localeCompare(b.label, "fr"))
    .map((option) => ({ ...option, family: family.key }))
) as MarketplaceCategoryIconOption[]

export type MarketplaceCategoryIconKey = (typeof MARKETPLACE_CATEGORY_ICON_OPTIONS)[number]["key"]

export const DEFAULT_MARKETPLACE_CATEGORY_ICON_KEY = "dishes" as const

const MARKETPLACE_CATEGORY_ICONS = new Map<string, LucideIcon>(
  MARKETPLACE_CATEGORY_ICON_OPTIONS.map((option) => [option.key, option.Icon])
)

const MARKETPLACE_CATEGORY_ICON_KEYS = MARKETPLACE_CATEGORY_ICON_OPTIONS.map((option) => option.key)

export function isMarketplaceCategoryIconKey(value: unknown): value is MarketplaceCategoryIconKey {
  return typeof value === "string" && MARKETPLACE_CATEGORY_ICON_KEYS.includes(value)
}

export function normalizeMarketplaceCategoryIconKey(value: unknown): MarketplaceCategoryIconKey | null {
  return isMarketplaceCategoryIconKey(value) ? value : null
}

export function getMarketplaceCategoryIcon(value: unknown): LucideIcon {
  const iconKey = normalizeMarketplaceCategoryIconKey(value) ?? DEFAULT_MARKETPLACE_CATEGORY_ICON_KEY
  return MARKETPLACE_CATEGORY_ICONS.get(iconKey) ?? Utensils
}
