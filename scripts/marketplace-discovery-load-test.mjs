#!/usr/bin/env node
import { performance } from "node:perf_hooks"

import { projectMarketplaceDishOffer } from "../src/lib/marketplace-discovery/marketplace-discovery-core.ts"

const restaurantVolumes = [10, 100, 500, 1000]
const productsPerRestaurant = Math.max(1, Math.min(Number(process.argv.find((value) => value.startsWith("--products="))?.split("=")[1]) || 40, 100))
const results = []

for (const restaurantCount of restaurantVolumes) {
  const started = performance.now()
  let bytes = 0
  let projected = 0
  for (let restaurantIndex = 0; restaurantIndex < restaurantCount; restaurantIndex += 1) {
    const restaurant = { id: `r-${restaurantIndex}`, name: `Restaurant ${restaurantIndex}`, slug: `restaurant-${restaurantIndex}`, status: "active", isActive: true, currency: "XOF", city: "Bamako" }
    for (let productIndex = 0; productIndex < productsPerRestaurant; productIndex += 1) {
      const projection = projectMarketplaceDishOffer({ restaurant, product: { id: `p-${productIndex}`, name: `Plat ${productIndex}`, description: "Fixture locale", basePrice: 1000 + productIndex, isActive: true }, projectedAt: "2026-01-01T00:00:00.000Z" })
      bytes += Buffer.byteLength(JSON.stringify(projection))
      projected += 1
    }
  }
  results.push({ restaurantCount, productsPerRestaurant, projected, durationMs: Number((performance.now() - started).toFixed(2)), averageDocumentBytes: Math.round(bytes / projected), totalProjectionBytes: bytes })
}

console.log(JSON.stringify({ event: "marketplace_local_projection_load_test", environment: "local-fixtures", results }, null, 2))
