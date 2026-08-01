import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  canRoleModifyProductAvailability,
  productUnavailableMessage,
  resolveEffectiveProductAvailability,
  resolveOperationalAvailabilityState,
  resolveProductPreparationMode,
  resolvePortionControl,
} from "../src/lib/product-availability.ts"

test("un ancien produit sans état opérationnel reste disponible", () => {
  const product = { isActive: true }
  assert.equal(resolveOperationalAvailabilityState(product), "AVAILABLE")
  assert.equal(resolveEffectiveProductAvailability(product).orderable, true)
  assert.deepEqual(product, { isActive: true })
})

test("les portions sont facultatives et anciennes données compatibles", () => {
  assert.deepEqual(resolvePortionControl({}), { enabled: false, available: null })
  assert.deepEqual(resolvePortionControl({ portionControl: { enabled: true, available: 4 } }), { enabled: true, available: 4 })
})

test("résout les trois états opérationnels officiels", () => {
  for (const [state, orderable] of [["AVAILABLE", true], ["SOLD_OUT", false], ["PAUSED", false]]) {
    assert.equal(resolveEffectiveProductAvailability({
      isActive: true,
      operationalAvailability: { state },
    }).orderable, orderable)
  }
  assert.equal(productUnavailableMessage("Thiéboudienne", "SOLD_OUT"), "Thiéboudienne est épuisé.")
  assert.equal(productUnavailableMessage("Thiéboudienne", "PAUSED"), "Thiéboudienne est temporairement indisponible.")
})

test("la désactivation administrative et les conventions historiques restent bloquantes", () => {
  for (const product of [
    { isActive: false },
    { available: false },
    { isAvailable: false },
    { status: "inactive" },
  ]) {
    assert.equal(resolveEffectiveProductAvailability(product).orderable, false)
  }
})

test("résout une seule fois kitchen, bar et direct", () => {
  assert.equal(resolveProductPreparationMode({ preparationMode: "kitchen" }), "kitchen")
  assert.equal(resolveProductPreparationMode({}, { preparationMode: "bar" }), "bar")
  assert.equal(resolveProductPreparationMode({}, { categoryName: "Boissons fraîches" }), "direct")
})

test("applique les permissions de disponibilité par rôle et destination", () => {
  for (const role of ["owner", "manager"]) {
    for (const preparationMode of ["kitchen", "bar", "direct"]) {
      assert.equal(canRoleModifyProductAvailability({ role, preparationMode }), true)
    }
  }
  assert.equal(canRoleModifyProductAvailability({ role: "kitchen", preparationMode: "kitchen" }), true)
  assert.equal(canRoleModifyProductAvailability({ role: "kitchen", preparationMode: "bar" }), false)
  assert.equal(canRoleModifyProductAvailability({ role: "kitchen", preparationMode: "direct" }), false)
  assert.equal(canRoleModifyProductAvailability({ role: "cashier", preparationMode: "kitchen" }), false)
})

test("le POS n'utilise plus la création Firestore historique", async () => {
  const source = await readFile("src/app/(dashboard)/pos/components/POSClient.tsx", "utf8")
  assert.doesNotMatch(source, /new OrderService\(/)
  assert.doesNotMatch(source, /orderService\.createOrder\(/)
  assert.match(source, /const canonicalCreation = await createCanonicalPosOrder\(/)
})
