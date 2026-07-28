import type { StockUnit } from "../../core/value-objects"
import type { ArticleTrackingMode } from "./article"

export type ArticleLibraryTemplate = {
  readonly id: string
  readonly name: string
  readonly baseUnit: StockUnit
  readonly trackingMode: ArticleTrackingMode
  readonly lowStockThreshold: number
  readonly outOfStockThreshold: number
}

export type ArticleLibraryGroup = {
  readonly id: string
  readonly name: string
  readonly articles: readonly ArticleLibraryTemplate[]
}

export const ARTICLE_LIBRARY: readonly ArticleLibraryGroup[] = [
  {
    id: "african",
    name: "Restaurant africain",
    articles: [
      template("african-chicken", "Poulet", "unit", "AUTOMATIC_SIMPLE", 5),
      template("african-oil", "Huile", "l", "CONTROLLED", 5),
      template("african-rice", "Riz", "kg", "CONTROLLED", 10),
      template("african-onion", "Oignon", "kg", "CONTROLLED", 5),
    ],
  },
  {
    id: "fast-food",
    name: "Fast-food",
    articles: [
      template("fast-coca", "Coca-Cola", "unit", "AUTOMATIC_SIMPLE", 12),
      template("fast-fries", "Frites", "kg", "CONTROLLED", 5),
      template("fast-steak", "Steak", "unit", "AUTOMATIC_SIMPLE", 10),
      template("fast-bun", "Pain burger", "unit", "AUTOMATIC_SIMPLE", 12),
    ],
  },
  {
    id: "pizzeria",
    name: "Pizzeria",
    articles: [
      template("pizza-flour", "Farine", "kg", "CONTROLLED", 10),
      template("pizza-mozzarella", "Mozzarella", "kg", "CONTROLLED", 5),
      template("pizza-tomato", "Sauce tomate", "l", "CONTROLLED", 5),
    ],
  },
  {
    id: "bar",
    name: "Bar",
    articles: [
      template("bar-coca", "Coca-Cola", "unit", "AUTOMATIC_SIMPLE", 12),
      template("bar-water", "Eau", "unit", "AUTOMATIC_SIMPLE", 12),
      template("bar-beer", "Bière", "unit", "AUTOMATIC_SIMPLE", 12),
    ],
  },
]

function template(
  id: string,
  name: string,
  baseUnit: StockUnit,
  trackingMode: ArticleTrackingMode,
  lowStockThreshold: number
): ArticleLibraryTemplate {
  return {
    id,
    name,
    baseUnit,
    trackingMode,
    lowStockThreshold,
    outOfStockThreshold: 0,
  }
}
