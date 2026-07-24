export const MARKETPLACE_DISCOVERY_FEATURE_FLAG = "MARKETPLACE_DISH_DISCOVERY_ENABLED" as const

export function isMarketplaceDishDiscoveryEnabled(environment: NodeJS.ProcessEnv = process.env): boolean {
  return environment[MARKETPLACE_DISCOVERY_FEATURE_FLAG] === "true"
}
