/**
 * Tests Emulator du système d'éligibilité aux avis restaurant.
 *
 * Utilise réellement @firebase/rules-unit-testing pour envoyer des écritures
 * au Firestore Emulator et vérifier que les Security Rules s'appliquent correctement.
 *
 * Prérequis :
 *   - Firebase Emulator en cours d'exécution avec Firestore
 *   - Package @firebase/rules-unit-testing installé
 *
 * Usage :
 *   firebase emulators:exec --only firestore "node --test tests/reputation/restaurant-review-emulator.test.mjs"
 *   ou, si l'émulateur tourne déjà :
 *   FIREBASE_FIRESTORE_EMULATOR_HOST=localhost:8080 node --test tests/reputation/restaurant-review-emulator.test.mjs
 */

import { readFile } from "node:fs/promises"
import { after, before, beforeEach, describe, it } from "node:test"

import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing"
import {
  setDoc,
  doc,
  collection,
  writeBatch,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore"

const PROJECT_ID = "demo-oordera-review"
const RESTAURANT_ID = "restaurant-1"
const ORDER_ID = "test-order-1"
const REVIEW_TOKEN = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"

const rulesContent = await readFile(
  new URL("../../firestore.rules", import.meta.url),
  "utf8"
)

let testEnv

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: rulesContent,
      host: "localhost",
      port: 8080,
    },
  })
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})

after(async () => {
  await testEnv.cleanup()
})

async function setupTestData(seedData) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    const batch = writeBatch(db)

    for (const [path, data] of Object.entries(seedData)) {
      const parts = path.split("/")
      let ref = doc(collection(db, parts[0]), parts[1])
      for (let i = 2; i < parts.length; i += 2) {
        ref = doc(collection(ref, parts[i]), parts[i + 1])
      }
      batch.set(ref, data, { merge: false })
    }

    await batch.commit()
  })
}

// ════════════════════════════════════════════════════════════════
// 1. CRÉATION DE REVIEWACCESS
// ════════════════════════════════════════════════════════════════

describe("1. Création de reviewAccess", () => {
  describe("Cas valides — écriture atomique (batch) order + reviewAccess", () => {
    it("QR takeaway public — création atomique réussie", async () => {
      const db = testEnv.unauthenticatedContext().firestore()
      const orderId = "valid-qr-takeaway-1"
      const orderRef = doc(db, "restaurants", RESTAURANT_ID, "orders", orderId)
      const reviewAccessRef = doc(db, "restaurants", RESTAURANT_ID, "reviewAccess", orderId)

      await assertSucceeds(
        (async () => {
          const batch = writeBatch(db)
          batch.set(orderRef, {
            restaurantId: RESTAURANT_ID,
            source: "qr_table",
            orderType: "takeaway",
            items: [],
            total: 1000,
            orderStatus: "pending",
            paymentStatus: "unpaid",
            sessionId: null,
            tableId: null,
            createdAt: serverTimestamp(),
          })
          batch.set(reviewAccessRef, {
            restaurantId: RESTAURANT_ID,
            orderId,
            reviewToken: REVIEW_TOKEN,
            version: 1,
            createdAt: serverTimestamp(),
            expiresAt: null,
          })
          await batch.commit()
        })()
      )
    })

    it("Takeaway public — création atomique réussie", async () => {
      const db = testEnv.unauthenticatedContext().firestore()
      const orderId = "test-takeaway-1"
      const orderRef = doc(db, "restaurants", RESTAURANT_ID, "orders", orderId)
      const reviewAccessRef = doc(db, "restaurants", RESTAURANT_ID, "reviewAccess", orderId)

      await assertSucceeds(
        (async () => {
          const batch = writeBatch(db)
          batch.set(orderRef, {
            restaurantId: RESTAURANT_ID,
            source: "client",
            orderType: "takeaway",
            items: [],
            total: 2000,
            orderStatus: "pending",
            paymentStatus: "unpaid",
            sessionId: null,
            tableId: null,
            createdAt: serverTimestamp(),
          })
          batch.set(reviewAccessRef, {
            restaurantId: RESTAURANT_ID,
            orderId,
            reviewToken: REVIEW_TOKEN,
            version: 1,
            createdAt: serverTimestamp(),
            expiresAt: null,
          })
          await batch.commit()
        })()
      )
    })

    it("Pickup public — création atomique réussie", async () => {
      const db = testEnv.unauthenticatedContext().firestore()
      const orderId = "test-pickup-1"
      const orderRef = doc(db, "restaurants", RESTAURANT_ID, "orders", orderId)
      const reviewAccessRef = doc(db, "restaurants", RESTAURANT_ID, "reviewAccess", orderId)

      await assertSucceeds(
        (async () => {
          const batch = writeBatch(db)
          batch.set(orderRef, {
            restaurantId: RESTAURANT_ID,
            source: "qr",
            orderType: "pickup",
            items: [],
            total: 3000,
            orderStatus: "pending",
            paymentStatus: "unpaid",
            sessionId: null,
            tableId: null,
            createdAt: serverTimestamp(),
          })
          batch.set(reviewAccessRef, {
            restaurantId: RESTAURANT_ID,
            orderId,
            reviewToken: REVIEW_TOKEN,
            version: 1,
            createdAt: serverTimestamp(),
            expiresAt: null,
          })
          await batch.commit()
        })()
      )
    })

    it("Delivery public — création atomique réussie", async () => {
      const db = testEnv.unauthenticatedContext().firestore()
      const orderId = "test-delivery-1"
      const orderRef = doc(db, "restaurants", RESTAURANT_ID, "orders", orderId)
      const reviewAccessRef = doc(db, "restaurants", RESTAURANT_ID, "reviewAccess", orderId)

      await assertSucceeds(
        (async () => {
          const batch = writeBatch(db)
          batch.set(orderRef, {
            restaurantId: RESTAURANT_ID,
            source: "client",
            orderType: "delivery",
            items: [],
            total: 4000,
            orderStatus: "pending",
            paymentStatus: "unpaid",
            sessionId: null,
            tableId: null,
            createdAt: serverTimestamp(),
          })
          batch.set(reviewAccessRef, {
            restaurantId: RESTAURANT_ID,
            orderId,
            reviewToken: REVIEW_TOKEN,
            version: 1,
            createdAt: serverTimestamp(),
            expiresAt: null,
          })
          await batch.commit()
        })()
      )
    })

    it("Manual takeaway non public — création reviewAccess refusée", async () => {
      const db = testEnv.unauthenticatedContext().firestore()
      const orderId = "test-manual-1"
      const orderRef = doc(db, "restaurants", RESTAURANT_ID, "orders", orderId)
      const reviewAccessRef = doc(db, "restaurants", RESTAURANT_ID, "reviewAccess", orderId)

      await assertFails(
        (async () => {
          const batch = writeBatch(db)
          batch.set(orderRef, {
            restaurantId: RESTAURANT_ID,
            source: "manual",
            orderType: "takeaway",
            items: [],
            total: 1500,
            orderStatus: "pending",
            paymentStatus: "unpaid",
            sessionId: null,
            tableId: null,
            createdAt: serverTimestamp(),
          })
          batch.set(reviewAccessRef, {
            restaurantId: RESTAURANT_ID,
            orderId,
            reviewToken: REVIEW_TOKEN,
            version: 1,
            createdAt: serverTimestamp(),
            expiresAt: null,
          })
          await batch.commit()
        })()
      )
    })
  })

  describe("Cas invalides", () => {
    it("Commande POS — refusée", async () => {
      const db = testEnv.unauthenticatedContext().firestore()
      const orderId = "test-pos-1"
      const orderRef = doc(db, "restaurants", RESTAURANT_ID, "orders", orderId)
      const reviewAccessRef = doc(db, "restaurants", RESTAURANT_ID, "reviewAccess", orderId)

      await assertFails(
        (async () => {
          const batch = writeBatch(db)
          batch.set(orderRef, {
            restaurantId: RESTAURANT_ID,
            source: "pos",
            orderType: "dine_in",
            items: [],
            total: 2500,
            orderStatus: "pending",
            createdAt: serverTimestamp(),
          })
          batch.set(reviewAccessRef, {
            restaurantId: RESTAURANT_ID,
            orderId,
            reviewToken: REVIEW_TOKEN,
            version: 1,
            createdAt: serverTimestamp(),
            expiresAt: null,
          })
          await batch.commit()
        })()
      )
    })

    it("Mauvais restaurantId — refusé", async () => {
      const db = testEnv.unauthenticatedContext().firestore()
      const orderId = "test-wrong-restaurant"
      const orderRef = doc(db, "restaurants", RESTAURANT_ID, "orders", orderId)
      const reviewAccessRef = doc(db, "restaurants", RESTAURANT_ID, "reviewAccess", orderId)

      await assertFails(
        (async () => {
          const batch = writeBatch(db)
          batch.set(orderRef, {
            restaurantId: RESTAURANT_ID,
            source: "client",
            orderType: "delivery",
            items: [],
            total: 1000,
            orderStatus: "pending",
            createdAt: serverTimestamp(),
          })
          batch.set(reviewAccessRef, {
            restaurantId: "wrong-restaurant",
            orderId,
            reviewToken: REVIEW_TOKEN,
            version: 1,
            createdAt: serverTimestamp(),
            expiresAt: null,
          })
          await batch.commit()
        })()
      )
    })

    it("Mauvais orderId — refusé", async () => {
      const db = testEnv.unauthenticatedContext().firestore()
      const orderId = "test-wrong-orderid"
      const reviewAccessRef = doc(db, "restaurants", RESTAURANT_ID, "reviewAccess", orderId)

      await assertFails(
        (async () => {
          const batch = writeBatch(db)
          batch.set(doc(db, "restaurants", RESTAURANT_ID, "orders", orderId), {
            restaurantId: RESTAURANT_ID,
            source: "client",
            orderType: "delivery",
            items: [],
            total: 1000,
            orderStatus: "pending",
            createdAt: serverTimestamp(),
          })
          batch.set(reviewAccessRef, {
            restaurantId: RESTAURANT_ID,
            orderId: "different-order-id",
            reviewToken: REVIEW_TOKEN,
            version: 1,
            createdAt: serverTimestamp(),
            expiresAt: null,
          })
          await batch.commit()
        })()
      )
    })

    it("Token invalide (trop court) — refusé", async () => {
      const db = testEnv.unauthenticatedContext().firestore()
      const orderId = "test-short-token"
      const orderRef = doc(db, "restaurants", RESTAURANT_ID, "orders", orderId)
      const reviewAccessRef = doc(db, "restaurants", RESTAURANT_ID, "reviewAccess", orderId)

      await assertFails(
        (async () => {
          const batch = writeBatch(db)
          batch.set(orderRef, {
            restaurantId: RESTAURANT_ID,
            source: "client",
            orderType: "delivery",
            items: [],
            total: 1000,
            orderStatus: "pending",
            createdAt: serverTimestamp(),
          })
          batch.set(reviewAccessRef, {
            restaurantId: RESTAURANT_ID,
            orderId,
            reviewToken: "short",
            version: 1,
            createdAt: serverTimestamp(),
            expiresAt: null,
          })
          await batch.commit()
        })()
      )
    })

    it("Version incorrecte — refusé", async () => {
      const db = testEnv.unauthenticatedContext().firestore()
      const orderId = "test-wrong-version"
      const orderRef = doc(db, "restaurants", RESTAURANT_ID, "orders", orderId)
      const reviewAccessRef = doc(db, "restaurants", RESTAURANT_ID, "reviewAccess", orderId)

      await assertFails(
        (async () => {
          const batch = writeBatch(db)
          batch.set(orderRef, {
            restaurantId: RESTAURANT_ID,
            source: "client",
            orderType: "delivery",
            items: [],
            total: 1000,
            orderStatus: "pending",
            createdAt: serverTimestamp(),
          })
          batch.set(reviewAccessRef, {
            restaurantId: RESTAURANT_ID,
            orderId,
            reviewToken: REVIEW_TOKEN,
            version: 2,
            createdAt: serverTimestamp(),
            expiresAt: null,
          })
          await batch.commit()
        })()
      )
    })

    it("Commande absente — refusé (reviewAccess seul)", async () => {
      const db = testEnv.unauthenticatedContext().firestore()
      const orderId = "test-no-order"
      const reviewAccessRef = doc(db, "restaurants", RESTAURANT_ID, "reviewAccess", orderId)

      await assertFails(
        setDoc(reviewAccessRef, {
          restaurantId: RESTAURANT_ID,
          orderId,
          reviewToken: REVIEW_TOKEN,
          version: 1,
          createdAt: serverTimestamp(),
          expiresAt: null,
        })
      )
    })

    it("Doublon de reviewAccess — refusé", async () => {
      const db = testEnv.unauthenticatedContext().firestore()
      const orderId = "test-duplicate-1"
      const orderRef = doc(db, "restaurants", RESTAURANT_ID, "orders", orderId)
      const reviewAccessRef = doc(db, "restaurants", RESTAURANT_ID, "reviewAccess", orderId)

      await assertSucceeds(
        (async () => {
          const batch = writeBatch(db)
          batch.set(orderRef, {
            restaurantId: RESTAURANT_ID,
            source: "client",
            orderType: "delivery",
            items: [],
            total: 1000,
            orderStatus: "pending",
            paymentStatus: "unpaid",
            sessionId: null,
            tableId: null,
            createdAt: serverTimestamp(),
          })
          batch.set(reviewAccessRef, {
            restaurantId: RESTAURANT_ID,
            orderId,
            reviewToken: REVIEW_TOKEN,
            version: 1,
            createdAt: serverTimestamp(),
            expiresAt: null,
          })
          await batch.commit()
        })()
      )

      await assertFails(
        (async () => {
          const batch = writeBatch(db)
          batch.set(reviewAccessRef, {
            restaurantId: RESTAURANT_ID,
            orderId,
            reviewToken: REVIEW_TOKEN,
            version: 1,
            createdAt: serverTimestamp(),
            expiresAt: null,
          })
          await batch.commit()
        })()
      )
    })
  })
})

// ════════════════════════════════════════════════════════════════
// 2. CRÉATION DE REVIEW
// ════════════════════════════════════════════════════════════════

describe("2. Création de review", () => {
  async function createOrderAndAccess(orderData, reviewAccessData) {
    const orderId = orderData.orderId || ORDER_ID
    const token = reviewAccessData.reviewToken || REVIEW_TOKEN

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore()
      const batch = writeBatch(db)
      batch.set(doc(db, "restaurants", RESTAURANT_ID, "orders", orderId), {
        restaurantId: RESTAURANT_ID,
        source: "client",
        items: [],
        total: 1000,
        orderStatus: "pending",
        paymentStatus: "unpaid",
        sessionId: null,
        tableId: null,
        createdAt: serverTimestamp(),
        ...orderData,
      })
      batch.set(doc(db, "restaurants", RESTAURANT_ID, "reviewAccess", orderId), {
        restaurantId: RESTAURANT_ID,
        orderId,
        reviewToken: token,
        version: 1,
        createdAt: serverTimestamp(),
        expiresAt: null,
        ...reviewAccessData,
      })
      await batch.commit()
    })
  }

  async function tryCreateReview(db, orderId, overrides = {}) {
    const reviewData = {
      restaurantId: RESTAURANT_ID,
      orderId,
      orderType: "dine_in",
      rating: 4,
      wouldRecommend: true,
      comment: "Très bon service !",
      customerDisplayName: "Client",
      customerId: "customer-1",
      customerName: "Client",
      author: { displayName: "Client", customerId: "customer-1" },
      source: "qr_table",
      status: "published",
      reviewToken: REVIEW_TOKEN,
      orderCompletedAt: Timestamp.now(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...overrides,
    }

    return setDoc(
      doc(db, "restaurants", RESTAURANT_ID, "reviews", orderId),
      reviewData
    )
  }

  function dishReviewId(orderId, orderItemId) {
    return `${orderId}_${orderItemId}`
  }

  async function tryCreateDishReview(db, orderId, orderItemId, overrides = {}) {
    const reviewData = {
      restaurantId: RESTAURANT_ID,
      orderId,
      orderType: "delivery",
      orderItemId,
      orderItemIndex: 0,
      productId: "product-burger",
      productName: "Burger Signature",
      productImageUrl: null,
      quantity: 1,
      rating: 5,
      comment: "Très bon plat.",
      customerDisplayName: "Client",
      customerId: "customer-1",
      customerName: "Client",
      source: "pickup_delivery_link",
      status: "published",
      reviewToken: REVIEW_TOKEN,
      orderCompletedAt: Timestamp.now(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...overrides,
    }

    return setDoc(
      doc(db, "restaurants", RESTAURANT_ID, "dishReviews", dishReviewId(orderId, orderItemId)),
      reviewData
    )
  }

  describe("A. QR dine_in valide", () => {
    it("source=qr_table, dine_in, servi, payé — autorisé", async () => {
      const orderId = "test-qr-valid-1"
      await createOrderAndAccess(
        {
          orderId,
          source: "qr_table",
          orderType: "dine_in",
          kitchenStatus: "served",
          orderStatus: "pending",
          paymentStatus: "paid",
          timestamps: { servedAt: Timestamp.now() },
        },
        { orderId }
      )

      const db = testEnv.unauthenticatedContext().firestore()
      await assertSucceeds(tryCreateReview(db, orderId, { source: "qr_table" }))
    })
  })

  describe("B. dine_in non servi", () => {
    it("kitchenStatus=preparing, paymentStatus=paid — refusé", async () => {
      const orderId = "test-dinein-not-served"
      await createOrderAndAccess(
        {
          orderId,
          source: "qr_table",
          orderType: "dine_in",
          kitchenStatus: "preparing",
          orderStatus: "pending",
          paymentStatus: "paid",
        },
        { orderId }
      )

      const db = testEnv.unauthenticatedContext().firestore()
      await assertFails(tryCreateReview(db, orderId, { source: "qr_table" }))
    })
  })

  describe("C. dine_in annulé", () => {
    it("kitchenStatus=cancelled — refusé", async () => {
      const orderId = "test-dinein-cancelled"
      await createOrderAndAccess(
        {
          orderId,
          source: "qr_table",
          orderType: "dine_in",
          kitchenStatus: "cancelled",
          orderStatus: "pending",
          paymentStatus: "paid",
        },
        { orderId }
      )

      const db = testEnv.unauthenticatedContext().firestore()
      await assertFails(tryCreateReview(db, orderId, { source: "qr_table" }))
    })
  })

  describe("D. takeaway récupéré et payé", () => {
    it("takeaway, pickedUpAt, paid — autorisé", async () => {
      const orderId = "test-takeaway-valid"
      await createOrderAndAccess(
        {
          orderId,
          source: "client",
          orderType: "takeaway",
          paymentStatus: "paid",
          timestamps: { pickedUpAt: Timestamp.now() },
        },
        { orderId }
      )

      const db = testEnv.unauthenticatedContext().firestore()
      await assertSucceeds(
        tryCreateReview(db, orderId, { source: "pickup_delivery_link" })
      )
    })
  })

  describe("E. pickup récupéré et payé", () => {
    it("pickup, pickupStatus=picked_up, paid — autorisé", async () => {
      const orderId = "test-pickup-valid"
      await createOrderAndAccess(
        {
          orderId,
          source: "qr",
          orderType: "pickup",
          pickupStatus: "picked_up",
          paymentStatus: "paid",
        },
        { orderId }
      )

      const db = testEnv.unauthenticatedContext().firestore()
      await assertSucceeds(
        tryCreateReview(db, orderId, { source: "pickup_delivery_link" })
      )
    })
  })

  describe("F. delivery livré et payé", () => {
    it("delivery, deliveredAt, verified — autorisé", async () => {
      const orderId = "test-delivery-valid"
      await createOrderAndAccess(
        {
          orderId,
          source: "client",
          orderType: "delivery",
          paymentStatus: "verified",
          timestamps: { deliveredAt: Timestamp.now() },
        },
        { orderId }
      )

      const db = testEnv.unauthenticatedContext().firestore()
      await assertSucceeds(
        tryCreateReview(db, orderId, { source: "pickup_delivery_link" })
      )
    })
  })

  describe("G. POS ou manual refusé", () => {
    it("source=pos — refusé", async () => {
      const orderId = "test-pos-review"
      await createOrderAndAccess(
        {
          orderId,
          source: "pos",
          orderType: "dine_in",
          kitchenStatus: "served",
          paymentStatus: "paid",
          timestamps: { servedAt: Timestamp.now() },
        },
        { orderId }
      )

      const db = testEnv.unauthenticatedContext().firestore()
      await assertFails(tryCreateReview(db, orderId, { source: "qr_table" }))
    })

    it("source=manual — refusé", async () => {
      const orderId = "test-manual-review"
      await createOrderAndAccess(
        {
          orderId,
          source: "manual",
          orderType: "takeaway",
          paymentStatus: "paid",
          timestamps: { pickedUpAt: Timestamp.now() },
        },
        { orderId }
      )

      const db = testEnv.unauthenticatedContext().firestore()
      await assertFails(
        tryCreateReview(db, orderId, { source: "pickup_delivery_link" })
      )
    })
  })

  describe("H. Paiement non confirmé", () => {
    it("paymentStatus=unpaid — refusé", async () => {
      const orderId = "test-unpaid"
      await createOrderAndAccess(
        {
          orderId,
          source: "client",
          orderType: "takeaway",
          paymentStatus: "unpaid",
          timestamps: { pickedUpAt: Timestamp.now() },
        },
        { orderId }
      )

      const db = testEnv.unauthenticatedContext().firestore()
      await assertFails(
        tryCreateReview(db, orderId, { source: "pickup_delivery_link" })
      )
    })

    it("paymentStatus=pending_cash — refusé", async () => {
      const orderId = "test-pending-cash"
      await createOrderAndAccess(
        {
          orderId,
          source: "client",
          orderType: "takeaway",
          paymentStatus: "pending_cash",
          timestamps: { pickedUpAt: Timestamp.now() },
        },
        { orderId }
      )

      const db = testEnv.unauthenticatedContext().firestore()
      await assertFails(
        tryCreateReview(db, orderId, { source: "pickup_delivery_link" })
      )
    })

    it("paymentStatus=pending_mobile — refusé", async () => {
      const orderId = "test-pending-mobile"
      await createOrderAndAccess(
        {
          orderId,
          source: "client",
          orderType: "takeaway",
          paymentStatus: "pending_mobile",
          timestamps: { pickedUpAt: Timestamp.now() },
        },
        { orderId }
      )

      const db = testEnv.unauthenticatedContext().firestore()
      await assertFails(
        tryCreateReview(db, orderId, { source: "pickup_delivery_link" })
      )
    })

    it("paymentStatus=failed — refusé", async () => {
      const orderId = "test-failed-payment"
      await createOrderAndAccess(
        {
          orderId,
          source: "client",
          orderType: "takeaway",
          paymentStatus: "failed",
          timestamps: { pickedUpAt: Timestamp.now() },
        },
        { orderId }
      )

      const db = testEnv.unauthenticatedContext().firestore()
      await assertFails(
        tryCreateReview(db, orderId, { source: "pickup_delivery_link" })
      )
    })
  })

  describe("I. reviewAccess absent", () => {
    it("commande valide sans reviewAccess — refusé", async () => {
      const orderId = "test-no-access-1"

      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore()
        await setDoc(
          doc(db, "restaurants", RESTAURANT_ID, "orders", orderId),
          {
            restaurantId: RESTAURANT_ID,
            source: "client",
            orderType: "delivery",
            paymentStatus: "paid",
            timestamps: { deliveredAt: Timestamp.now() },
            items: [],
            total: 1000,
            createdAt: serverTimestamp(),
          }
        )
      })

      const db = testEnv.unauthenticatedContext().firestore()
      await assertFails(
        tryCreateReview(db, orderId, { source: "pickup_delivery_link" })
      )
    })
  })

  describe("J. token incorrect", () => {
    it("reviewToken différent du reviewAccess — refusé", async () => {
      const orderId = "test-wrong-token-1"
      await createOrderAndAccess(
        {
          orderId,
          source: "client",
          orderType: "delivery",
          paymentStatus: "paid",
          timestamps: { deliveredAt: Timestamp.now() },
        },
        { orderId, reviewToken: REVIEW_TOKEN }
      )

      const db = testEnv.unauthenticatedContext().firestore()
      await assertFails(
        tryCreateReview(db, orderId, {
          source: "pickup_delivery_link",
          reviewToken: "different-token-0000000000000000000000000000",
        })
      )
    })
  })

  describe("K. version incorrecte", () => {
    it("reviewAccess.version != 1 — refusé", async () => {
      const orderId = "test-wrong-version-review"
      await createOrderAndAccess(
        {
          orderId,
          source: "client",
          orderType: "delivery",
          paymentStatus: "paid",
          timestamps: { deliveredAt: Timestamp.now() },
        },
        { orderId, reviewToken: REVIEW_TOKEN, version: 2 }
      )

      const db = testEnv.unauthenticatedContext().firestore()
      await assertFails(
        tryCreateReview(db, orderId, { source: "pickup_delivery_link" })
      )
    })
  })

  describe("L. review déjà existante", () => {
    it("doublon de review — refusé", async () => {
      const orderId = "test-review-duplicate-1"

      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore()
        const batch = writeBatch(db)
        batch.set(doc(db, "restaurants", RESTAURANT_ID, "orders", orderId), {
          restaurantId: RESTAURANT_ID,
          source: "client",
          orderType: "delivery",
          paymentStatus: "paid",
          timestamps: { deliveredAt: Timestamp.now() },
          items: [],
          total: 1000,
          createdAt: serverTimestamp(),
        })
        batch.set(doc(db, "restaurants", RESTAURANT_ID, "reviewAccess", orderId), {
          restaurantId: RESTAURANT_ID,
          orderId,
          reviewToken: REVIEW_TOKEN,
          version: 1,
          createdAt: serverTimestamp(),
          expiresAt: null,
        })
        batch.set(doc(db, "restaurants", RESTAURANT_ID, "reviews", orderId), {
          restaurantId: RESTAURANT_ID,
          orderId,
          orderType: "delivery",
          rating: 5,
          wouldRecommend: true,
          source: "pickup_delivery_link",
          status: "published",
          reviewToken: REVIEW_TOKEN,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
        await batch.commit()
      })

      const db = testEnv.unauthenticatedContext().firestore()
      await assertFails(
        tryCreateReview(db, orderId, { source: "pickup_delivery_link" })
      )
    })
  })

  describe("M. Champs optionnels absents", () => {
    it("review sans comment (comment=null) — autorisé si éligible", async () => {
      const orderId = "test-no-comment"
      await createOrderAndAccess(
        {
          orderId,
          source: "client",
          orderType: "delivery",
          paymentStatus: "paid",
          timestamps: { deliveredAt: Timestamp.now() },
        },
        { orderId }
      )

      const db = testEnv.unauthenticatedContext().firestore()
      await assertSucceeds(
        tryCreateReview(db, orderId, {
          source: "pickup_delivery_link",
          comment: null,
        })
      )
    })

    it("review avec customerId absent — autorisé si reste valide", async () => {
      const orderId = "test-no-customerid"
      await createOrderAndAccess(
        {
          orderId,
          source: "client",
          orderType: "delivery",
          paymentStatus: "paid",
          timestamps: { deliveredAt: Timestamp.now() },
        },
        { orderId }
      )

      const db = testEnv.unauthenticatedContext().firestore()
      await assertSucceeds(
        tryCreateReview(db, orderId, {
          source: "pickup_delivery_link",
          customerId: null,
        })
      )
    })
  })

  describe("N. Avis plats", () => {
    it("un plat commandé peut être noté", async () => {
      const orderId = "test-dish-valid"
      await createOrderAndAccess(
        {
          orderId,
          source: "client",
          orderType: "delivery",
          paymentStatus: "paid",
          timestamps: { deliveredAt: Timestamp.now() },
          items: [
            {
              id: "item-burger",
              productId: "product-burger",
              name: "Burger Signature",
              quantity: 1,
              reviewsEnabled: true,
            },
          ],
        },
        { orderId }
      )

      const db = testEnv.unauthenticatedContext().firestore()
      await assertSucceeds(tryCreateDishReview(db, orderId, "item-burger"))
    })

    it("un plat non commandé est refusé", async () => {
      const orderId = "test-dish-not-ordered"
      await createOrderAndAccess(
        {
          orderId,
          source: "client",
          orderType: "delivery",
          paymentStatus: "paid",
          timestamps: { deliveredAt: Timestamp.now() },
          items: [
            {
              id: "item-burger",
              productId: "product-burger",
              name: "Burger Signature",
              quantity: 1,
              reviewsEnabled: true,
            },
          ],
        },
        { orderId }
      )

      const db = testEnv.unauthenticatedContext().firestore()
      await assertFails(
        tryCreateDishReview(db, orderId, "item-pizza", {
          orderItemId: "item-pizza",
          productId: "product-pizza",
          productName: "Pizza Reine",
        })
      )
    })

    it("un doublon sur le même plat de commande est refusé", async () => {
      const orderId = "test-dish-duplicate"
      await createOrderAndAccess(
        {
          orderId,
          source: "client",
          orderType: "delivery",
          paymentStatus: "paid",
          timestamps: { deliveredAt: Timestamp.now() },
          items: [
            {
              id: "item-burger",
              productId: "product-burger",
              name: "Burger Signature",
              quantity: 1,
              reviewsEnabled: true,
            },
          ],
        },
        { orderId }
      )

      const db = testEnv.unauthenticatedContext().firestore()
      await assertSucceeds(tryCreateDishReview(db, orderId, "item-burger"))
      await assertFails(tryCreateDishReview(db, orderId, "item-burger"))
    })

    it("plusieurs plats d'une même commande peuvent être notés", async () => {
      const orderId = "test-multiple-dishes"
      await createOrderAndAccess(
        {
          orderId,
          source: "client",
          orderType: "delivery",
          paymentStatus: "paid",
          timestamps: { deliveredAt: Timestamp.now() },
          items: [
            {
              id: "item-burger",
              productId: "product-burger",
              name: "Burger Signature",
              quantity: 1,
              reviewsEnabled: true,
            },
            {
              id: "item-pizza",
              productId: "product-pizza",
              name: "Pizza Reine",
              quantity: 2,
              reviewsEnabled: true,
            },
          ],
        },
        { orderId }
      )

      const db = testEnv.unauthenticatedContext().firestore()
      await assertSucceeds(tryCreateDishReview(db, orderId, "item-burger"))
      await assertSucceeds(
        tryCreateDishReview(db, orderId, "item-pizza", {
          orderItemId: "item-pizza",
          orderItemIndex: 1,
          productId: "product-pizza",
          productName: "Pizza Reine",
          quantity: 2,
          rating: 4,
        })
      )
    })

    it("le commentaire est facultatif", async () => {
      const orderId = "test-dish-no-comment"
      await createOrderAndAccess(
        {
          orderId,
          source: "client",
          orderType: "delivery",
          paymentStatus: "paid",
          timestamps: { deliveredAt: Timestamp.now() },
          items: [
            {
              id: "item-burger",
              productId: "product-burger",
              name: "Burger Signature",
              quantity: 1,
              reviewsEnabled: true,
            },
          ],
        },
        { orderId }
      )

      const db = testEnv.unauthenticatedContext().firestore()
      await assertSucceeds(
        tryCreateDishReview(db, orderId, "item-burger", { comment: null })
      )
    })

    it("la note est obligatoire", async () => {
      const orderId = "test-dish-rating-required"
      await createOrderAndAccess(
        {
          orderId,
          source: "client",
          orderType: "delivery",
          paymentStatus: "paid",
          timestamps: { deliveredAt: Timestamp.now() },
          items: [
            {
              id: "item-burger",
              productId: "product-burger",
              name: "Burger Signature",
              quantity: 1,
              reviewsEnabled: true,
            },
          ],
        },
        { orderId }
      )

      const db = testEnv.unauthenticatedContext().firestore()
      await assertFails(
        tryCreateDishReview(db, orderId, "item-burger", { rating: null })
      )
    })

    it("un plat commandé mais non autorisé aux avis est refusé", async () => {
      const orderId = "test-dish-reviews-disabled"
      await createOrderAndAccess(
        {
          orderId,
          source: "client",
          orderType: "delivery",
          paymentStatus: "paid",
          timestamps: { deliveredAt: Timestamp.now() },
          items: [
            {
              id: "item-burger",
              productId: "product-burger",
              name: "Burger Signature",
              quantity: 1,
              reviewsEnabled: false,
            },
          ],
        },
        { orderId }
      )

      const db = testEnv.unauthenticatedContext().firestore()
      await assertFails(tryCreateDishReview(db, orderId, "item-burger"))
    })
  })
})

