import assert from "node:assert/strict"
import test from "node:test"

import {
  normalizeProductReviewsPolicy,
  policyFromLegacyReviewsEnabled,
  resolveProductReviewsEnabled,
} from "../../src/lib/product-review-policy.ts"

test("résout les avis produit depuis la catégorie et les exceptions", () => {
  assert.equal(resolveProductReviewsEnabled({ categoryReviewsEnabled: true, productReviewsPolicy: "inherit" }), true)
  assert.equal(resolveProductReviewsEnabled({ categoryReviewsEnabled: false, productReviewsPolicy: "inherit" }), false)
  assert.equal(resolveProductReviewsEnabled({ categoryReviewsEnabled: false, productReviewsPolicy: "enabled" }), true)
  assert.equal(resolveProductReviewsEnabled({ categoryReviewsEnabled: true, productReviewsPolicy: "disabled" }), false)
})

test("ne résout jamais inherit sans catégorie configurée", () => {
  assert.equal(resolveProductReviewsEnabled({ categoryReviewsEnabled: null, productReviewsPolicy: "inherit" }), null)
  assert.equal(resolveProductReviewsEnabled({ categoryReviewsEnabled: undefined, productReviewsPolicy: "inherit" }), null)
})

test("normalise les politiques produit et convertit le legacy sans inversion", () => {
  assert.equal(normalizeProductReviewsPolicy("enabled"), "enabled")
  assert.equal(normalizeProductReviewsPolicy("disabled"), "disabled")
  assert.equal(normalizeProductReviewsPolicy("legacy"), "inherit")
  assert.equal(policyFromLegacyReviewsEnabled(true), "enabled")
  assert.equal(policyFromLegacyReviewsEnabled(false), "disabled")
  assert.equal(policyFromLegacyReviewsEnabled(undefined), "inherit")
})

test("recalcule inherit lors d'un changement de catégorie et préserve les exceptions", () => {
  assert.equal(resolveProductReviewsEnabled({ categoryReviewsEnabled: true, productReviewsPolicy: "inherit" }), true)
  assert.equal(resolveProductReviewsEnabled({ categoryReviewsEnabled: false, productReviewsPolicy: "inherit" }), false)
  assert.equal(resolveProductReviewsEnabled({ categoryReviewsEnabled: false, productReviewsPolicy: "enabled" }), true)
  assert.equal(resolveProductReviewsEnabled({ categoryReviewsEnabled: true, productReviewsPolicy: "disabled" }), false)
})

test("refuse un produit sans catégorie lorsque la politique hérite", () => {
  assert.equal(resolveProductReviewsEnabled({ categoryReviewsEnabled: undefined, productReviewsPolicy: "inherit" }), null)
  assert.equal(resolveProductReviewsEnabled({ categoryReviewsEnabled: undefined, productReviewsPolicy: "enabled" }), true)
  assert.equal(resolveProductReviewsEnabled({ categoryReviewsEnabled: undefined, productReviewsPolicy: "disabled" }), false)
})
