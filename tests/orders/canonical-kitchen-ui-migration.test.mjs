import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { afterEach, describe, it } from "node:test"

import {
  adaptCanonicalGroupsToKitchenBoard,
} from "../../src/modules/kitchen/canonical-read/kitchen-board-adapter.ts"
import {
  executeKitchenItemsTransition,
  executeKitchenItemTransition,
  KitchenCommandClientError,
} from "../../src/modules/kitchen/canonical-read/kitchen-command-client.ts"

const boardSource = read("src/modules/kitchen/KitchenBoard.tsx")
const cardSource = read("src/modules/kitchen/KitchenOrderCard.tsx")
const clientSource = read("src/app/(dashboard)/kitchen/components/KitchenClient.tsx")
const viewModelSource = read("src/modules/kitchen/kitchen-view-model.tsx")
const kitchenItemSource = read("src/components/kitchen-ui/kitchen-item.tsx")
const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe("migration complète de la Cuisine canonique", () => {
  it("adapte une commande par statut de ligne sans fusionner les cycles", () => {
    const orders = adaptCanonicalGroupsToKitchenBoard([group([
      item("line-pending", "pending"),
      item("line-ready", "ready"),
    ])])
    assert.equal(orders.length, 2)
    assert.deepEqual(orders.map((order) => order.kitchenStatus), ["pending", "ready"])
    assert.deepEqual(orders.map((order) => order.items.length), [1, 1])
  })

  it("conserve l’identité de la commande pour une commande mixte", () => {
    const orders = adaptCanonicalGroupsToKitchenBoard([{ ...group([item("line", "pending")]), isMixed: true }])
    assert.equal(orders[0].__canonicalOrderId, "order-a")
    assert.equal(orders[0].id, "order-a:pending")
  })

  it("appelle la route LOT 4.1 avec identité serveur et payload minimal", async () => {
    let request
    globalThis.fetch = async (url, init) => {
      request = { url, init }
      return new Response(JSON.stringify({ ok: true, result: { version: 2 } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    }
    await executeKitchenItemTransition({
      user: { getIdToken: async () => "firebase-token" },
      restaurantId: "restaurant-a",
      orderId: "order-a",
      orderItemId: "line-a",
      expectedVersion: 1,
      targetStatus: "preparing",
      idempotencyKey: "stable-key-0001",
    })
    assert.equal(request.url, "/api/restaurants/restaurant-a/orders/order-a/commands")
    assert.equal(request.init.headers.authorization, "Bearer firebase-token")
    assert.deepEqual(JSON.parse(request.init.body), {
      command: "MARK_ORDER_ITEM_PREPARING",
      orderItemId: "line-a",
      idempotencyKey: "stable-key-0001",
      expectedVersion: 1,
    })
  })

  it("mappe Prête vers MARK_ORDER_ITEM_READY", async () => {
    let command
    globalThis.fetch = async (_url, init) => {
      command = JSON.parse(init.body).command
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }
    await executeKitchenItemTransition({
      user: { getIdToken: async () => "token" },
      restaurantId: "restaurant-a",
      orderId: "order-a",
      orderItemId: "line-a",
      expectedVersion: 2,
      targetStatus: "ready",
    })
    assert.equal(command, "MARK_ORDER_ITEM_READY")
  })

  it("propage un code métier stable retourné par la frontière", async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({
      ok: false,
      error: { code: "CONCURRENT_MODIFICATION", message: "Version obsolète.", retryable: true },
    }), { status: 409 })
    await assert.rejects(
      () => executeKitchenItemTransition({
        user: { getIdToken: async () => "token" },
        restaurantId: "restaurant-a",
        orderId: "order-a",
        orderItemId: "line-a",
        expectedVersion: 1,
        targetStatus: "preparing",
      }),
      (error) =>
        error instanceof KitchenCommandClientError &&
        error.code === "CONCURRENT_MODIFICATION" &&
        error.retryable
    )
  })

  it("propage le message de paiement préalable retourné par le serveur", async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({
      ok: false,
      error: {
        code: "PREPAYMENT_REQUIRED_BEFORE_PREPARATION",
        message: "Le paiement doit être confirmé avant de traiter cette commande.",
        retryable: false,
      },
    }), { status: 409 })
    await assert.rejects(
      () => executeKitchenItemTransition({
        user: { getIdToken: async () => "token" },
        restaurantId: "restaurant-a",
        orderId: "delivery-a",
        orderItemId: "line-a",
        expectedVersion: 1,
        targetStatus: "preparing",
      }),
      (error) =>
        error instanceof KitchenCommandClientError &&
        error.code === "PREPAYMENT_REQUIRED_BEFORE_PREPARATION" &&
        error.message === "Le paiement doit être confirmé avant de traiter cette commande."
    )
    assert.match(cardSource, /error instanceof Error[\s\S]*error\.message/)
  })

  it("met à jour indépendamment toutes les lignes Cuisine d’un groupe", async () => {
    const calls = []
    await executeKitchenItemsTransition({
      user: {},
      restaurantId: "restaurant-a",
      orderId: "order-a",
      targetStatus: "preparing",
      items: [
        { orderItemId: "line-a", expectedVersion: 1 },
        { orderItemId: "line-b", expectedVersion: 3 },
      ],
      execute: async (input) => { calls.push(input); return { ok: true } },
    })
    assert.deepEqual(calls.map((call) => [call.orderItemId, call.expectedVersion]), [
      ["line-a", 1],
      ["line-b", 3],
    ])
  })

  it("utilise une seule requête HTTP pour une action Cuisine groupée", async () => {
    const originalFetch = globalThis.fetch
    const calls = []
    globalThis.fetch = async (_url, init) => {
      calls.push(JSON.parse(init.body))
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    }
    try {
      await executeKitchenItemsTransition({
        user: { getIdToken: async () => "token" },
        restaurantId: "restaurant-a",
        orderId: "order-a",
        targetStatus: "preparing",
        items: [
          { orderItemId: "line-a", expectedVersion: 1 },
          { orderItemId: "line-b", expectedVersion: 3 },
        ],
      })
      assert.equal(calls.length, 1)
      assert.equal(calls[0].command, "MARK_ORDER_ITEMS_PREPARING")
      assert.equal(calls[0].expectedItems.length, 2)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("refuse une action sans ligne Cuisine active", async () => {
    await assert.rejects(
      () => executeKitchenItemsTransition({
        user: {},
        restaurantId: "restaurant-a",
        orderId: "order-a",
        targetStatus: "ready",
        items: [],
      }),
      (error) => error.code === "ORDER_ITEM_NOT_FOUND"
    )
  })

  it("retire toute écriture Firestore directe et tout moteur Stock de KitchenBoard", () => {
    assert.doesNotMatch(boardSource, /updateDoc|writeBatch|runTransaction|serverTimestamp|arrayUnion/)
    assert.doesNotMatch(boardSource, /markOrderItemAsServedAndDeductStock|stockBalancesV2/)
    assert.doesNotMatch(boardSource, /from "firebase\/firestore"/)
  })

  it("ne propose plus Servir, Paiement, Récupérer ou Terminer comme action Cuisine", () => {
    assert.match(cardSource, /proposedNextStatus === "preparing" \|\| proposedNextStatus === "ready"/)
    assert.doesNotMatch(viewModelSource, /served:\s*"Servir"/)
    assert.doesNotMatch(viewModelSource, /picked_up:\s*"R/)
    assert.doesNotMatch(viewModelSource, /completed:\s*"Terminer"/)
  })

  it("active la lecture canonique et conserve OrdersProvider seulement pour rollback legacy", () => {
    assert.match(clientSource, /mode !== "legacy"/)
    assert.match(clientSource, /CanonicalKitchenPageContent/)
    assert.match(clientSource, /<OrdersProvider/)
    assert.match(clientSource, /<LegacyKitchenPageContent/)
  })

  it("ne démarre pas le provider temps réel global sur la route Cuisine", () => {
    const providerSource = read("src/modules/restaurant-live/RestaurantLiveDataProvider.tsx")
    assert.match(
      providerSource,
      /const enabled = isClient && isOperationalRoute\(pathname\) && !isKitchenRoute/
    )
  })

  it("conserve le son de nouvelle commande dans le pipeline KitchenBoard", () => {
    assert.match(boardSource, /playNewOrderNotificationSound\(\)/)
    assert.match(boardSource, /entrySoundOrderIdsRef/)
  })

  it("conserve trois colonnes dès tablette et trois boutons de navigation sur mobile", () => {
    assert.match(boardSource, /grid-cols-3[\s\S]*md:grid/)
    assert.match(boardSource, /role="tablist"/)
    assert.match(boardSource, /label: "Nouvelles"/)
    assert.match(boardSource, /label: "Préparation"/)
    assert.match(boardSource, /label: "Prêtes"/)
    assert.match(boardSource, /bg-\[var\(--brand-primary\)\]/)
    assert.match(boardSource, /md:hidden/)
    assert.match(boardSource, /mobileColumn/)
    assert.doesNotMatch(boardSource, /title:\s*"Servies"/)
    assert.doesNotMatch(boardSource, /label:\s*"Visibles"/)
    assert.doesNotMatch(boardSource, /RefreshCw|Actualiser la Cuisine/)
    assert.doesNotMatch(boardSource, /MetricGroup|Indicateurs de production Cuisine/)
  })

  it("projette le vrai paiement, le téléphone et l'adresse de livraison", () => {
    const [order] = adaptCanonicalGroupsToKitchenBoard([
      {
        ...group([item("delivery-line", "pending")]),
        orderType: "delivery",
        serviceMode: "delivery",
        paymentStatus: "unpaid",
        customerPhone: "74746520",
        deliveryAddress: "Sirakoro",
      },
    ])
    assert.equal(order.paymentStatus, "unpaid")
    assert.equal(order.serviceMode, "delivery")
    assert.equal(order.customer.phone, "74746520")
    assert.equal(order.deliveryAddress, "Sirakoro")
    assert.doesNotMatch(
      read("src/modules/kitchen/canonical-read/kitchen-board-adapter.ts"),
      /paymentStatus:\s*"verified"/
    )
  })

  it("désactive Commencer avant paiement et se réactive avec la projection paid", () => {
    assert.match(cardSource, /model\.isPaymentLocked/)
    assert.match(cardSource, /En attente de validation du paiement/)
    assert.match(cardSource, /disabled:\s*isUpdating \|\| model\.isPaymentLocked/)
    assert.match(viewModelSource, /!isOrderPaid\(order\)/)
    const reader = read("src/modules/kitchen/canonical-read/firestore-reader.ts")
    assert.match(reader, /syncParentSubscriptions/)
    assert.match(reader, /where\(documentId\(\), "in", ids\)/)
    assert.match(reader, /parentUnsubscribes/)
    assert.doesNotMatch(reader, /where\("kitchenStatus", "in"/)
  })

  it("affiche téléphone et adresse sans identité Firebase technique", () => {
    assert.match(viewModelSource, /Tél\. : \$\{phone\}/)
    assert.match(viewModelSource, /Adresse : \$\{address\}/)
    assert.doesNotMatch(viewModelSource, /uid|providerId|isAnonymous|Client anonyme/)
  })

  it("affiche les images produit et le vrai libellé de table en Cuisine", () => {
    const enrichedItem = {
      ...item("pictured-line", "pending"),
      productImageUrl: "https://cdn.example.test/pizza.webp",
      tableId: "9lkVsfYMPOYztahvOOkU",
      tableNumber: "Table 9",
    }
    const [order] = adaptCanonicalGroupsToKitchenBoard([{
      ...group([enrichedItem]),
      tableId: "9lkVsfYMPOYztahvOOkU",
      tableNumber: "Table 9",
    }])
    assert.equal(order.items[0].imageUrl, "https://cdn.example.test/pizza.webp")
    assert.equal(order.table, "Table 9")
    assert.match(viewModelSource, /\^table\/i/)
    assert.doesNotMatch(viewModelSource, /\^table\\b\/i/)
    assert.match(viewModelSource, /imageUrl: item\.imageUrl \?\? null/)
    assert.match(kitchenItemSource, /loading="lazy"/)
    assert.match(read("src/modules/kitchen/canonical-read/firestore-reader.ts"), /collection\(db, "restaurants", restaurantId, "tables"\)/)
    assert.match(read("src/modules/kitchen/canonical-read/firestore-reader.ts"), /collection\(db, "restaurants", restaurantId, "products"\)/)
    assert.match(read("src/modules/kitchen/canonical-read/firestore-reader.ts"), /storedTableLabel !== tableId/)
  })

  it("affiche l'observation générale sur la carte et l'instruction sous sa ligne", () => {
    const [order] = adaptCanonicalGroupsToKitchenBoard([
      {
        ...group([{ ...item("noted-line", "pending"), customerNote: "sans oignon" }]),
        orderNote: "Ajouter un peu de piment 🌶️ <script>alert(1)</script>",
      },
    ])
    assert.equal(order.notes, "Ajouter un peu de piment 🌶️ <script>alert(1)</script>")
    assert.equal(order.items[0].instructions, "sans oignon")
    assert.match(cardSource, /Observation client/)
    assert.match(kitchenItemSource, /Instruction :/)
    assert.doesNotMatch(cardSource + kitchenItemSource, /dangerouslySetInnerHTML/)
  })

  it("une commande sans note ne réserve aucun bloc vide", () => {
    const [order] = adaptCanonicalGroupsToKitchenBoard([group([item("plain-line", "pending")])])
    assert.equal(order.notes, null)
    assert.equal(order.items[0].instructions, null)
    assert.match(cardSource, /model\.note \?/)
    assert.match(kitchenItemSource, /note \?/)
  })

  it("contraint le viewport et confie le scroll à chaque colonne", () => {
    const boardPrimitive = read("src/components/kitchen-ui/kitchen-board.tsx")
    assert.match(boardSource, /<KitchenPage[\s\S]*fullScreen/)
    assert.match(boardSource, /overflow-hidden md:grid/)
    assert.match(boardPrimitive, /flex-1 overflow-y-auto/)
  })
})

function item(orderItemId, status) {
  return {
    restaurantId: "restaurant-a",
    orderId: "order-a",
    orderItemId,
    productId: `product-${orderItemId}`,
    productName: "Pizza",
    productImageUrl: null,
    quantity: 1,
    activeQuantity: 1,
    cancelledQuantity: 0,
    servedQuantity: 0,
    status,
    version: 1,
    preparationMode: "kitchen",
    variants: [],
    supplements: [],
    customerNote: null,
    orderType: "table",
    serviceMode: "dine_in",
    paymentStatus: "unpaid",
    tableId: "table-4",
    tableNumber: "4",
    orderNumber: "CMD-001",
    customerName: null,
    customerPhone: null,
    deliveryAddress: null,
    orderNote: null,
    createdAt: 1000,
    updatedAt: 1000,
    elapsedTime: 0,
    legacyState: "canonical",
    actionsAllowed: true,
  }
}

function group(items) {
  return {
    orderId: "order-a",
    restaurantId: "restaurant-a",
    orderType: "table",
    serviceMode: "dine_in",
    paymentStatus: "unpaid",
    tableId: "table-4",
    tableNumber: "4",
    orderNumber: "CMD-001",
    customerName: null,
    customerPhone: null,
    deliveryAddress: null,
    orderNote: null,
    createdAt: 1000,
    isMixed: false,
    legacyState: "canonical",
    items,
  }
}

function read(relativePath) {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8")
}
