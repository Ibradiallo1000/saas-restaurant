import assert from "node:assert/strict"
import test from "node:test"

import {
  buildMarketplaceIntentKey,
  buildMarketplaceOfferHref,
  claimMarketplaceIntent,
  parseMarketplaceCategoryIntent,
  parseMarketplaceProductIntent,
  resolveMarketplaceProduct,
  sanitizeMarketplaceCategoryId,
  sanitizeMarketplaceProductId,
} from "../../src/lib/marketplace-offer-navigation.ts"

test("construit une URL ciblée encodée sans écraser les paramètres transactionnels", () => {
  assert.equal(buildMarketplaceOfferHref({ restaurantSlug: "chez-oordera", productId: "prod_1", preserve: { table: "T 1", mode: "dine_in" } }), "/chez-oordera?table=T+1&mode=dine_in&product=prod_1&source=marketplace")
})

test("retombe sur le menu si le productId est absent ou invalide", () => {
  assert.equal(buildMarketplaceOfferHref({ restaurantSlug: "chez-oordera", productId: null }), "/chez-oordera")
  assert.equal(buildMarketplaceOfferHref({ restaurantSlug: "chez-oordera", productId: "bad/id" }), "/chez-oordera")
})

test("construit et parse une URL marketplace filtrée par catégorie locale", () => {
  assert.equal(buildMarketplaceOfferHref({ restaurantSlug: "chez-oordera", categoryId: "cat-pizza" }), "/chez-oordera?category=cat-pizza&source=marketplace")
  assert.deepEqual(parseMarketplaceCategoryIntent({ source: "marketplace", category: "cat-pizza" }), { source: "marketplace", categoryId: "cat-pizza" })
  assert.equal(sanitizeMarketplaceCategoryId("bad/id"), "")
})

test("refuse slug et intention invalides", () => {
  assert.equal(buildMarketplaceOfferHref({ restaurantSlug: "../admin", productId: "p1" }), "/")
  assert.equal(parseMarketplaceProductIntent({ source: "marketplace", product: "bad/id" }), null)
  assert.equal(parseMarketplaceProductIntent({ source: "other", product: "p1" }), null)
})

test("parse une intention Marketplace valide et encode sa clé stable", () => {
  assert.deepEqual(parseMarketplaceProductIntent({ source: "marketplace", product: "p-1" }), { source: "marketplace", productId: "p-1" })
  assert.equal(buildMarketplaceIntentKey("chez-oordera", "p-1"), "chez-oordera::p-1")
  assert.equal(sanitizeMarketplaceProductId("p-1"), "p-1")
})

test("une intention marquée ne se rouvre pas, un nouveau produit reste traitable", () => {
  const handled = new Set()
  const first = buildMarketplaceIntentKey("chez-oordera", "p-1")
  const next = buildMarketplaceIntentKey("chez-oordera", "p-2")
  assert.equal(claimMarketplaceIntent(handled, first), true)
  assert.equal(claimMarketplaceIntent(handled, first), false)
  assert.equal(claimMarketplaceIntent(handled, next), true)
})

test("résout le produit réel par identifiant et préfère la liste chargée", () => {
  const current = { id: "p-1", name: "Nom actuel", price: 2500, isActive: true }
  const staleTarget = { id: "p-1", name: "Ancien nom", price: 2000, isActive: true }
  const result = resolveMarketplaceProduct({ productId: "p-1", loadedProducts: [current], targetedProduct: staleTarget })
  assert.equal(result.status, "found")
  assert.equal(result.source, "menu")
  assert.equal(result.product.price, 2500)
  assert.equal(result.product.name, "Nom actuel")
})

test("résout une lecture ciblée hors des 50 et rejette absent ou désactivé", () => {
  assert.equal(resolveMarketplaceProduct({ productId: "p-51", loadedProducts: [], targetedProduct: { id: "p-51", price: 3000, isActive: true } }).source, "targeted")
  assert.equal(resolveMarketplaceProduct({ productId: "missing", loadedProducts: [] }).status, "missing")
  assert.equal(resolveMarketplaceProduct({ productId: "off", loadedProducts: [], targetedProduct: { id: "off", isActive: false } }).status, "inactive")
})
