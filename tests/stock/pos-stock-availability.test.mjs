import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  buildPosStockAvailabilityMap,
  getPosStockPresentation,
} from "../../src/modules/stock/pos-stock-availability.ts"

const cocaProduct = {
  id: "Gh864Z7Ee6CxALMhciHv",
  stockArticleId: "CzX3cVJV3mFRd6HwqvWW",
}
const cocaArticle = {
  id: "CzX3cVJV3mFRd6HwqvWW",
  baseUnit: "unit",
  lowStockThreshold: 10,
  trackingMode: "AUTOMATIC_SIMPLE",
  status: "active",
}
const cocaAssociation = {
  productId: cocaProduct.id,
  articleId: cocaArticle.id,
  status: "active",
}

function availability(quantity, products = [cocaProduct]) {
  return buildPosStockAvailabilityMap({
    products,
    associations: [cocaAssociation],
    articles: [cocaArticle],
    balances: [
      {
        id: cocaArticle.id,
        articleId: cocaArticle.id,
        quantity,
        unit: "unit",
      },
    ],
  })
}

test("Coca Cola affiche la quantité issue de stockBalancesV2, puis 20 → 17", () => {
  const before = availability(20).get(cocaProduct.id)
  const after = availability(17).get(cocaProduct.id)

  assert.equal(before?.quantity, 20)
  assert.deepEqual(getPosStockPresentation(before), {
    availability: "available",
    label: "20 pièces disponibles",
    disabled: false,
  })
  assert.equal(after?.quantity, 17)
  assert.equal(getPosStockPresentation(after).label, "17 pièces disponibles")
})

test("le seuil réel de l'article déclenche l'état stock faible", () => {
  const stock = availability(6).get(cocaProduct.id)

  assert.equal(stock?.threshold, 10)
  assert.deepEqual(getPosStockPresentation(stock), {
    availability: "limited",
    label: "Stock faible : 6 pièces",
    disabled: false,
  })
})

test("un stock nul désactive le produit", () => {
  assert.deepEqual(getPosStockPresentation(availability(0).get(cocaProduct.id)), {
    availability: "unavailable",
    label: "Rupture de stock",
    disabled: true,
  })
})

test("un produit non associé reste vendable et affiche Stock non suivi", () => {
  const product = { id: "untracked-product" }
  const stock = availability(20, [product]).get(product.id)

  assert.equal(stock, undefined)
  assert.deepEqual(getPosStockPresentation(stock), {
    availability: "unknown",
    label: "Stock non suivi",
    disabled: false,
  })
})

test("une association groupée permet de lier un produit sans dupliquer la quantité", () => {
  const product = { id: cocaProduct.id }
  const stock = availability(20, [product]).get(product.id)

  assert.equal(stock?.articleId, cocaArticle.id)
  assert.equal(stock?.quantity, 20)
})

test("le hook POS utilise trois collections groupées et aucune lecture N+1 ou V1", async () => {
  const hookSource = await readFile(
    new URL("../../src/modules/stock/use-pos-stock-availability.ts", import.meta.url),
    "utf8"
  )
  const mapperSource = await readFile(
    new URL("../../src/modules/stock/pos-stock-availability.ts", import.meta.url),
    "utf8"
  )

  assert.match(hookSource, /useInventoryReferential\(validRestaurantId\)/)
  assert.match(hookSource, /stockAutomaticAssociationsV2/)
  assert.doesNotMatch(hookSource, /getDoc\s*\(/)
  assert.doesNotMatch(hookSource, /inventoryItems/)
  assert.doesNotMatch(mapperSource, /product\.stock\b/)
  assert.doesNotMatch(mapperSource, /stockEstimated/)
})
