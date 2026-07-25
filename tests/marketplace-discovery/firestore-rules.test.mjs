import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const rules = await readFile(new URL("../../firestore.rules", import.meta.url), "utf8")

// ─── marketplaceDishOffers ────────────────────────────────────────────

test("marketplaceDishOffers — lecture publique conditionnelle (discoverable + schemaVersion)", () => {
  assert.match(rules, /match \/marketplaceDishOffers\/\{offerId\}/)
  assert.match(rules, /allow read: if resource\.data\.discoverable == true/)
  assert.match(rules, /resource\.data\.schemaVersion == 1/)
})

test("marketplaceDishOffers — création par le manager du restaurant avec validation des champs obligatoires", () => {
  assert.match(rules, /allow create: if canManageRestaurantMenu\(request\.resource\.data\.restaurantId\)/)
  assert.match(rules, /request\.resource\.data\.restaurantId is string/)
  assert.match(rules, /request\.resource\.data\.productId is string/)
  assert.match(rules, /request\.resource\.data\.marketplaceCategoryId is string/)
  assert.match(rules, /request\.resource\.data\.discoverable is bool/)
  assert.match(rules, /request\.resource\.data\.schemaVersion == 1/)
})

test("marketplaceDishOffers — mise à jour par le manager avec conservation des champs obligatoires", () => {
  assert.match(rules, /allow update: if canManageRestaurantMenu\(resource\.data\.restaurantId\)/)
  assert.match(rules, /request\.resource\.data\.restaurantId == resource\.data\.restaurantId/)
  assert.match(rules, /request\.resource\.data\.productId is string/)
  assert.match(rules, /request\.resource\.data\.marketplaceCategoryId is string/)
  assert.match(rules, /request\.resource\.data\.discoverable is bool/)
  assert.match(rules, /request\.resource\.data\.schemaVersion == 1/)
})

test("marketplaceDishOffers — suppression par le manager uniquement", () => {
  assert.match(rules, /allow delete: if canManageRestaurantMenu\(resource\.data\.restaurantId\)/)
})

// ─── marketplaceFoodCategories ─────────────────────────────────────────

test("marketplaceFoodCategories — lecture super-admin ou catégorie active de version 1", () => {
  assert.match(rules, /match \/marketplaceFoodCategories\/\{categoryId\}/)
  assert.match(rules, /allow read: if isSuperAdmin\(\)/)
  assert.match(rules, /resource\.data\.active == true/)
  assert.match(rules, /resource\.data\.schemaVersion == 1/)
})

test("marketplaceFoodCategories — écriture réservée au super-admin", () => {
  assert.match(rules, /allow create, update, delete: if isSuperAdmin\(\)/)
})

// ─── marketplaceRestaurantCategoryOffers ───────────────────────────────

test("marketplaceRestaurantCategoryOffers — lecture publique conditionnelle (discoverable + schemaVersion)", () => {
  assert.match(rules, /match \/marketplaceRestaurantCategoryOffers\/\{offerId\}/)
  assert.match(rules, /allow read: if resource\.data\.discoverable == true/)
  assert.match(rules, /resource\.data\.schemaVersion == 1/)
})

test("marketplaceRestaurantCategoryOffers — création par le manager du restaurant avec validation des champs obligatoires", () => {
  assert.match(rules, /allow create: if canManageRestaurantMenu\(request\.resource\.data\.restaurantId\)/)
  assert.match(rules, /request\.resource\.data\.restaurantId is string/)
  assert.match(rules, /request\.resource\.data\.marketplaceCategoryId is string/)
  assert.match(rules, /request\.resource\.data\.discoverable is bool/)
  assert.match(rules, /request\.resource\.data\.schemaVersion == 1/)
})

test("marketplaceRestaurantCategoryOffers — mise à jour par le manager avec conservation des champs obligatoires", () => {
  assert.match(rules, /allow update: if canManageRestaurantMenu\(resource\.data\.restaurantId\)/)
  assert.match(rules, /request\.resource\.data\.restaurantId == resource\.data\.restaurantId/)
  assert.match(rules, /request\.resource\.data\.marketplaceCategoryId is string/)
  assert.match(rules, /request\.resource\.data\.discoverable is bool/)
  assert.match(rules, /request\.resource\.data\.schemaVersion == 1/)
})

test("marketplaceRestaurantCategoryOffers — suppression par le manager uniquement", () => {
  assert.match(rules, /allow delete: if canManageRestaurantMenu\(resource\.data\.restaurantId\)/)
})

// ─── Catch-all — aucune écriture globale anonyme ───────────────────────

test("catch-all refuse toute écriture non couverte par une règle spécifique", () => {
  assert.match(rules, /match \/\{document=\*\*\}/)
  assert.match(rules, /allow read, write: if false/)
})

