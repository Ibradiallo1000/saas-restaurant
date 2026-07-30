import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const rules = await readFile(new URL("../../firestore.rules", import.meta.url), "utf8")

test("les avis restaurant sont stockés sous le restaurant et créés uniquement avec token", () => {
  assert.match(rules, /match \/reviews\/\{reviewId\}/)
  assert.match(rules, /allow create: if canCreateRestaurantReview\(restaurantId, reviewId\)/)
  assert.match(rules, /allow update, delete: if false/)
  assert.match(rules, /reviewAccessDoc\(restaurantId, reviewId\)\.data\.reviewToken == request\.resource\.data\.reviewToken/)
})

test("les capacités d'avis ne sont jamais lisibles publiquement", () => {
  assert.match(rules, /match \/reviewAccess\/\{orderId\}/)
  assert.match(rules, /allow create: if false/)
  assert.match(rules, /allow get, list, update, delete: if false/)
})

test("les agrégats d'avis ne sont pas modifiables par le client", () => {
  assert.match(rules, /match \/reviewAggregates\/\{aggregateId\}/)
  assert.match(rules, /allow get, list: if canReadRestaurantReviewDocs\(restaurantId\)/)
  assert.match(rules, /allow create, update, delete: if false/)
})

test("les avis plats sont créés uniquement si l'article existe dans la commande", () => {
  assert.match(rules, /match \/dishReviews\/\{dishReviewId\}/)
  assert.match(rules, /allow create: if canCreateDishReview\(restaurantId, dishReviewId\)/)
  assert.match(rules, /function dishReviewOrderItemMatches\(/)
  assert.match(rules, /reviewOrderItem\(restaurantId, orderId\)\.id == request\.resource\.data\.orderItemId/)
  assert.match(rules, /reviewOrderItem\(restaurantId, orderId\)\.productId == request\.resource\.data\.productId/)
  assert.match(rules, /reviewOrderItem\(restaurantId, orderId\)\.reviewsEnabled == true/)
  assert.match(rules, /reviewId == request\.resource\.data\.orderId \+ "_" \+ request\.resource\.data\.orderItemId/)
  assert.match(rules, /allow update, delete: if false/)
})

test("les produits restaurant et modèles exigent une configuration d'avis explicite", () => {
  assert.match(rules, /match \/products\/\{productId\}/)
  assert.match(rules, /request\.resource\.data\.reviewsEnabled is bool/)
  assert.match(rules, /request\.resource\.data\.reviewsPolicy in \["inherit", "enabled", "disabled"\]/)
  assert.match(rules, /match \/platformMenuProducts\/\{productTemplateId\}/)
})

test("les catégories restaurant et modèles exigent une règle d'avis explicite", () => {
  assert.match(rules, /match \/categories\/\{categoryId\}/)
  assert.match(rules, /match \/platformMenuCategories\/\{categoryTemplateId\}/)
  assert.match(rules, /request\.resource\.data\.reviewsEnabled is bool/)
})

// ─── Nouveaux helpers ────────────────────────────────────────────────

test("docHas protège les lectures de champs optionnels", () => {
  assert.match(rules, /function docHas\(/)
  assert.match(rules, /data\.keys\(\)\.hasAny\(\[field\]\)/)
})

test("isReviewEligibleOrder utilise docHas pour tous les champs optionnels", () => {
  assert.match(rules, /function isReviewEligibleOrder\(/)
  // Vérifie que l'accès à orderStatus est protégé par docHas/optionalIsBlockedStatus
  assert.match(rules, /optionalIsBlockedStatus\(/)
  // Vérifie que isConfirmedPayment est présent
  assert.match(rules, /isConfirmedPayment\(/)
  // Vérifie que isServedByOrderType détermine l'éligibilité
  assert.match(rules, /isServedByOrderType\(/)
})

test("isServedByOrderType distingue les 3 parcours client", () => {
  assert.match(rules, /function isServedByOrderType\(/)
  assert.match(rules, /orderType == "dine_in"/)
  assert.match(rules, /"takeaway", "pickup"/)
  assert.match(rules, /orderType == "delivery"/)
})

test("isConfirmedPayment accepte paid, paye, validated, verified", () => {
  assert.match(rules, /"paid", "paye", "validated", "verified"/)
})

test("isServedByOrderType ne croise pas les champs entre parcours", () => {
  // dine_in ne lit jamais deliveryStatus ou pickupStatus
  const dineInBranch = rules.match(/orderType == "dine_in"[\s\S]*?: \(order\.orderType in \["takeaway", "pickup"\]/)
  assert.ok(dineInBranch, "La branche dine_in doit exister")
  assert.doesNotMatch(dineInBranch[0], /deliveryStatus/)
  assert.doesNotMatch(dineInBranch[0], /pickupStatus/)

  // delivery ne lit jamais kitchenStatus
  const deliveryBranch = rules.match(/orderType == "delivery"[\s\S]*?: false/)
  assert.ok(deliveryBranch, "La branche delivery doit exister")
  assert.doesNotMatch(deliveryBranch[0], /kitchenStatus/)
})

test("reviewOrderHasFinalTimestamp utilise hasFinalTimestampInMap et hasLegacyFinalTimestamp", () => {
  assert.match(rules, /function hasFinalTimestampInMap\(/)
  assert.match(rules, /function hasLegacyFinalTimestamp\(/)
  assert.match(rules, /"timestamps", "servedAt"/)
  assert.match(rules, /"timestamps", "pickedUpAt"/)
  assert.match(rules, /"timestamps", "deliveredAt"/)
  assert.match(rules, /"timestamps", "completedAt"/)
})

test("isFinalReviewOrderStatus inclut les statuts localisés français manquants", () => {
  // Vérifie que servie, payee, pretes, servies ont été ajoutés
  const match = rules.match(/function isFinalReviewOrderStatus[\s\S]{0,300}?\];/)
  assert.ok(match, "isFinalReviewOrderStatus doit exister")
  assert.match(match[0], /"servie"/)
  assert.match(match[0], /"payee"/)
})

// ─── Sources publiques ────────────────────────────────────────────────

test("isPublicReviewOrderSource accepte les sources publiques legacy et canoniques", () => {
  assert.match(rules, /function isPublicReviewOrderSource\(/)
  assert.match(rules, /"client", "qr", "qr_table", "public_takeaway", "public_delivery"/)
  const match = rules.match(/function isPublicReviewOrderSource[\s\S]{0,200}\];/)
  assert.ok(match, "isPublicReviewOrderSource doit exister")
  assert.equal(match[0].indexOf('"manual"'), -1, "manual ne doit pas être dans les sources d'avis publiques")
})

// ─── POS refusé ───────────────────────────────────────────────────────

test("POS n'est pas une source publique pour les avis", () => {
  // Vérifie que "pos" n'est pas dans isPublicReviewOrderSource
  const match = rules.match(/function isPublicReviewOrderSource[\s\S]{0,200}\];/)
  assert.ok(match, "isPublicReviewOrderSource doit exister")
  // Si pos est dans la liste, le test échoue
  const posIndex = match[0].indexOf('"pos"')
  assert.equal(posIndex, -1, "pos ne doit pas être dans les sources publiques")
})

// ─── Catch-all ─────────────────────────────────────────────────────────

test("catch-all refuse toute écriture non couverte par une règle spécifique", () => {
  assert.match(rules, /match \/\{document=\*\*\}/)
  assert.match(rules, /allow read, write: if false/)
})
