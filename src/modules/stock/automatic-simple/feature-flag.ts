import type { AutomaticActivationConfiguration } from "./domain/models"

export function getAutomaticSimpleFeatureConfiguration(): AutomaticActivationConfiguration {
  return {
    enabled: process.env.NEXT_PUBLIC_STOCK_AUTOMATIC_SIMPLE_ENABLED === "true",
    restaurantAllowlist: split(process.env.NEXT_PUBLIC_STOCK_AUTOMATIC_SIMPLE_RESTAURANTS),
    articleAllowlist: split(process.env.NEXT_PUBLIC_STOCK_AUTOMATIC_SIMPLE_ARTICLES),
  }
}

function split(value: string | undefined) {
  return String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean)
}
