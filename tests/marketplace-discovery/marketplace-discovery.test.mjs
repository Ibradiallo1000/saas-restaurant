import assert from "node:assert/strict"
import test from "node:test"

import {
  assertMarketplaceProjectionFields,
  assertMarketplaceRestaurantCategoryOfferFields,
  buildMarketplaceOfferId,
  buildMarketplaceRestaurantCategoryOfferId,
  buildMarketplaceSearchTokens,
  decodeMarketplaceCursor,
  encodeMarketplaceCursor,
  evaluateMarketplaceDishPublishability,
  normalizeMarketplaceSearch,
  projectMarketplaceDishOffer,
  projectMarketplaceRestaurantCategoryOffer,
  resolveMarketplacePrice,
} from "../../src/lib/marketplace-discovery/marketplace-discovery-core.ts"
import { isMarketplaceDishDiscoveryEnabled } from "../../src/lib/marketplace-discovery/marketplace-discovery-config.ts"

test("le feature flag est désactivé sauf pour la valeur exacte true", () => {
  assert.equal(isMarketplaceDishDiscoveryEnabled({}), false)
  assert.equal(isMarketplaceDishDiscoveryEnabled({ MARKETPLACE_DISH_DISCOVERY_ENABLED: "false" }), false)
  assert.equal(isMarketplaceDishDiscoveryEnabled({ MARKETPLACE_DISH_DISCOVERY_ENABLED: "TRUE" }), false)
  assert.equal(isMarketplaceDishDiscoveryEnabled({ MARKETPLACE_DISH_DISCOVERY_ENABLED: "1" }), false)
  assert.equal(isMarketplaceDishDiscoveryEnabled({ MARKETPLACE_DISH_DISCOVERY_ENABLED: "true" }), true)
})

const restaurant = { id: "rest-1", name: "Chez Oordera", slug: "chez-oordera", status: "active", isActive: true, currency: "XOF", city: "Bamako" }
const product = { id: "prod-1", name: "Poulet d’Ami — grillé", description: "Très bon", basePrice: 4500, isActive: true, categoryId: "grill" }

test("normalise accents, apostrophes, tirets, ponctuation et espaces", () => {
  assert.equal(normalizeMarketplaceSearch("  Crème—d’ Arachide!!  "), "creme d arachide")
  assert.deepEqual(buildMarketplaceSearchTokens("Pizza  Margherita"), ["pizza margherita", "pizza", "margherita"])
})

test("génère un identifiant déterministe", () => {
  assert.equal(buildMarketplaceOfferId("rest-1", "prod-1"), "rest-1__prod-1")
  assert.equal(buildMarketplaceOfferId("rest-1", "prod-1"), buildMarketplaceOfferId("rest-1", "prod-1"))
  assert.equal(buildMarketplaceRestaurantCategoryOfferId("rest-1", "pizza"), "rest-1__pizza")
})

test("résout prix exact, prix minimum configurable et prix indisponible", () => {
  assert.deepEqual(resolveMarketplacePrice({ id: "p", basePrice: 2000 }), { displayPrice: 2000, priceMode: "exact", hasConfigurator: false })
  assert.deepEqual(resolveMarketplacePrice({ id: "p", basePrice: 2500, variants: [{ price: 2000 }, { price: 3000 }] }), { displayPrice: 2000, priceMode: "from", hasConfigurator: true })
  assert.deepEqual(resolveMarketplacePrice({ id: "p" }), { displayPrice: null, priceMode: "unavailable", hasConfigurator: false })
})

test("projette uniquement la liste blanche publique", () => {
  const projection = projectMarketplaceDishOffer({
    restaurant: { ...restaurant, email: "private@example.com", ownerId: "secret" },
    product: { ...product, costPrice: 1000, recipe: ["secret"] },
    category: { id: "grill", marketplaceCategoryId: "grillades", isActive: true },
    projectedAt: "2026-01-01T00:00:00.000Z",
  })
  assert.equal(projection.normalizedName, "poulet d ami grille")
  assert.equal(projection.displayPrice, 4500)
  assert.equal(projection.discoverable, true)
  assert.equal(projection.reviewsEnabled, false)
  assert.equal(projection.restaurantLogoUrl, null)
  assert.equal(projection.schemaVersion, 1)
  assert.equal("costPrice" in projection, false)
  assert.equal("ownerId" in projection, false)
  assert.doesNotThrow(() => assertMarketplaceProjectionFields(projection))
  assert.throws(() => assertMarketplaceProjectionFields({ ...projection, costPrice: 1000 }), /Unexpected|Forbidden/)
})

test("récupère le vrai logo restaurant depuis les formats connus", () => {
  assert.equal(
    projectMarketplaceDishOffer({ restaurant: { ...restaurant, logoUrl: "https://cdn/logo.png" }, product, category: { id: "grill", marketplaceCategoryId: "grillades", isActive: true }, projectedAt: "2026-01-01T00:00:00.000Z" }).restaurantLogoUrl,
    "https://cdn/logo.png"
  )
  assert.equal(
    projectMarketplaceDishOffer({ restaurant: { ...restaurant, logo: { url: "https://cdn/logo-object.png" } }, product, category: { id: "grill", marketplaceCategoryId: "grillades", isActive: true }, projectedAt: "2026-01-01T00:00:00.000Z" }).restaurantLogoUrl,
    "https://cdn/logo-object.png"
  )
})

test("désactive la découverte pour restaurant ou produit inactif", () => {
  assert.equal(projectMarketplaceDishOffer({ restaurant: { ...restaurant, status: "suspended" }, product, projectedAt: "2026-01-01T00:00:00.000Z" }).discoverable, false)
  assert.equal(projectMarketplaceDishOffer({ restaurant, product: { ...product, isActive: false }, projectedAt: "2026-01-01T00:00:00.000Z" }).discoverable, false)
  assert.equal(projectMarketplaceDishOffer({ restaurant, product: { ...product, isActive: undefined }, projectedAt: "2026-01-01T00:00:00.000Z" }).discoverable, false)
})

test("applique une règle unique de publication marketplace", () => {
  assert.deepEqual(evaluateMarketplaceDishPublishability({ restaurant, product, category: { id: "grill", marketplaceCategoryId: "grillades", isActive: true } }).reasons, [])
  assert.equal(evaluateMarketplaceDishPublishability({ restaurant, product, category: { id: "grill", marketplaceCategoryId: "grillades", isActive: false } }).discoverable, false)
  assert.equal(evaluateMarketplaceDishPublishability({ restaurant, product, category: null }).discoverable, false)
  assert.equal(evaluateMarketplaceDishPublishability({ restaurant, product: { ...product, categoryId: undefined }, category: null }).discoverable, false)
  assert.equal(evaluateMarketplaceDishPublishability({ restaurant, product: { ...product, categoryId: undefined, marketplaceCategoryId: "grillades" }, category: null }).discoverable, true)
  assert.equal(evaluateMarketplaceDishPublishability({ restaurant, product: { ...product, deletedAt: "2026-01-01" }, category: { id: "grill", marketplaceCategoryId: "grillades", isActive: true } }).discoverable, false)
  assert.equal(evaluateMarketplaceDishPublishability({ restaurant: { ...restaurant, deletedAt: "2026-01-01" }, product, category: { id: "grill", marketplaceCategoryId: "grillades", isActive: true } }).discoverable, false)
  assert.equal(evaluateMarketplaceDishPublishability({ restaurant, product: { ...product, name: "" }, category: { id: "grill", marketplaceCategoryId: "grillades", isActive: true } }).hasMinimumPublicData, false)
})

test("projette le mapping marketplace hérité de la catégorie locale", () => {
  const projection = projectMarketplaceDishOffer({ restaurant, product, category: { id: "grill", marketplaceCategoryId: "grillades", isActive: true }, projectedAt: "2026-01-01T00:00:00.000Z" })
  assert.equal(projection.categoryId, "grill")
  assert.equal(projection.marketplaceCategoryId, "grillades")
})

test("exclut du marketplace un produit sans mapping global", () => {
  const projection = projectMarketplaceDishOffer({ restaurant, product, category: { id: "grill", isActive: true }, projectedAt: "2026-01-01T00:00:00.000Z" })
  assert.equal(projection.marketplaceCategoryId, null)
  assert.equal(projection.discoverable, false)
  assert.equal(projection.quality, "unavailable")
})

test("agrège une projection restaurant par catégorie marketplace", () => {
  const offers = [
    projectMarketplaceDishOffer({
      restaurant: { ...restaurant, logoUrl: "https://cdn/logo.png", cityName: "Bamako", districtName: "Hamdallaye" },
      product: { ...product, id: "p1", categoryId: "local-pizza", name: "Pizza A", basePrice: 5000 },
      category: { id: "local-pizza", marketplaceCategoryId: "pizza", isActive: true },
      projectedAt: "2026-01-01T00:00:00.000Z",
    }),
    projectMarketplaceDishOffer({
      restaurant: { ...restaurant, logoUrl: "https://cdn/logo.png", cityName: "Bamako", districtName: "Hamdallaye" },
      product: { ...product, id: "p2", categoryId: "local-pizza", name: "Pizza B", basePrice: 3500, imageUrl: "https://cdn/pizza.jpg" },
      category: { id: "local-pizza", marketplaceCategoryId: "pizza", isActive: true },
      projectedAt: "2026-01-01T00:00:00.000Z",
    }),
  ]
  const projection = projectMarketplaceRestaurantCategoryOffer({
    restaurantId: "rest-1",
    marketplaceCategoryId: "pizza",
    offers,
    updatedAt: "2026-01-01T00:00:00.000Z",
  })
  assert.equal(projection.restaurantId, "rest-1")
  assert.equal(projection.restaurantSlug, "chez-oordera")
  assert.equal(projection.restaurantLogoUrl, "https://cdn/logo.png")
  assert.equal(projection.marketplaceCategoryId, "pizza")
  assert.equal(projection.localCategoryId, "local-pizza")
  assert.equal(projection.productCount, 2)
  assert.equal(projection.minimumPrice, 3500)
  assert.equal(projection.representativeImageUrl, "https://cdn/pizza.jpg")
  assert.equal(projection.cityName, "Bamako")
  assert.equal(projection.districtName, "Hamdallaye")
  assert.equal(projection.discoverable, true)
  assert.doesNotThrow(() => assertMarketplaceRestaurantCategoryOfferFields(projection))
  assert.throws(() => assertMarketplaceRestaurantCategoryOfferFields({ ...projection, phone: "secret" }), /Unexpected|Forbidden/)
})

test("encode et valide un curseur stable", () => {
  const cursor = { sortValue: "pizza", offerId: "r__p" }
  assert.deepEqual(decodeMarketplaceCursor(encodeMarketplaceCursor(cursor)), cursor)
  assert.throws(() => decodeMarketplaceCursor("e30"), /Invalid/)
})
