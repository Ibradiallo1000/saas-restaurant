import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  qrCanonicalEnabled,
  resolveQrCanonicalMode,
} from "../../src/modules/public/canonical/feature-flag.ts"
import { comparePublicOrderProjections } from "../../src/modules/public/canonical/compare.ts"
import { ensurePublicFirebaseUser } from "../../src/modules/public/public-auth.ts"

const checkoutPath = new URL(
  "../../src/modules/public/components/CheckoutQRModal.tsx",
  import.meta.url
)
const trackingPath = new URL(
  "../../src/app/order/[restaurantId]/[orderId]/page.tsx",
  import.meta.url
)
const createRoutePath = new URL(
  "../../src/app/api/restaurants/[restaurantId]/orders/route.ts",
  import.meta.url
)
const publicReadRoutePath = new URL(
  "../../src/app/api/restaurants/[restaurantId]/orders/[orderId]/route.ts",
  import.meta.url
)
const paymentRoutePath = new URL(
  "../../src/app/api/restaurants/[restaurantId]/table-sessions/[tableSessionId]/payment-requests/route.ts",
  import.meta.url
)
const publicOrderPaymentRoutePath = new URL(
  "../../src/app/api/restaurants/[restaurantId]/orders/[orderId]/payment-requests/route.ts",
  import.meta.url
)
const tableSessionRoutePath = new URL(
  "../../src/app/api/restaurants/[restaurantId]/table-sessions/route.ts",
  import.meta.url
)
const publicSecurityConfigPath = new URL(
  "../../src/server/orders/public-security-config.ts",
  import.meta.url
)
const publicPagePath = new URL(
  "../../src/modules/public/PublicPage.tsx",
  import.meta.url
)
const posClientPath = new URL(
  "../../src/app/(dashboard)/pos/components/POSClient.tsx",
  import.meta.url
)

test("QR reste en legacy tant que l'activation canonique n'est pas explicite", () => {
  assert.equal(resolveQrCanonicalMode("restaurant-a", {}), "legacy")
})

test("le rollback legacy conserve l'UI mais utilise la frontière serveur sécurisée", () => {
  const mode = resolveQrCanonicalMode("restaurant-a", {
    NEXT_PUBLIC_QR_CANONICAL_MODE: "legacy",
  })
  assert.equal(mode, "legacy")
  assert.equal(qrCanonicalEnabled(mode), true)
})

test("legacy exige App Check et la capacité QR comme canonical", async () => {
  const [route, security] = await Promise.all([
    readFile(tableSessionRoutePath, "utf8"),
    readFile(publicSecurityConfigPath, "utf8"),
  ])
  assert.match(route, /authenticatePublic\(request\)/)
  assert.match(route, /createTableCapability/)
  assert.doesNotMatch(route, /capability\s*:\s*null/)
  assert.match(security, /resolveFirebaseAppCheckSiteKey/)
  assert.match(security, /ORDER_QR_CAPABILITY_SECRET/)
  assert.doesNotMatch(security, /return false/)
})

test("la création de session de table respecte le contrat de réponse du client canonique", async () => {
  const route = await readFile(tableSessionRoutePath, "utf8")
  assert.match(route, /NextResponse\.json\(\{\s*ok:\s*true,\s*\.\.\.result,\s*capability,/)
})

test("QR compare utilise le parcours canonique", () => {
  const mode = resolveQrCanonicalMode("restaurant-a", {
    NEXT_PUBLIC_QR_CANONICAL_MODE: "compare",
  })
  assert.equal(mode, "compare")
  assert.equal(qrCanonicalEnabled(mode), true)
})

test("QR allowlist laisse les autres restaurants en legacy", () => {
  const environment = {
    NEXT_PUBLIC_QR_CANONICAL_MODE: "canonical",
    NEXT_PUBLIC_QR_CANONICAL_RESTAURANTS: "restaurant-a",
  }
  assert.equal(resolveQrCanonicalMode("restaurant-a", environment), "canonical")
  assert.equal(resolveQrCanonicalMode("restaurant-b", environment), "legacy")
})

test("le checkout QR canonique appelle exclusivement la route serveur de création", async () => {
  const source = await readFile(checkoutPath, "utf8")
  const canonical = source.slice(source.indexOf("if (qrCanonicalEnabled(qrMode))"))
  assert.match(canonical, /createCanonicalQrOrder/)
  assert.match(canonical, /channel:\s*"qr_table"/)
  assert.match(canonical, /serviceMode:\s*"dine_in"/)
  assert.match(canonical, /tableSession\.capability/)
})

test("le panier n'est vidé qu'après la réponse canonique", async () => {
  const source = await readFile(checkoutPath, "utf8")
  const request = source.indexOf("const response = await createCanonicalQrOrder")
  const clear = source.indexOf("clear()", request)
  assert.ok(request >= 0 && clear > request)
})

test("le checkout empêche le double envoi avec un verrou et une clé stable", async () => {
  const source = await readFile(checkoutPath, "utf8")
  assert.match(source, /submittingRef\.current/)
  assert.match(source, /stablePublicIdempotencyKey/)
  assert.match(source, /clearPublicIdempotencyKey/)
})

test("la création serveur reconstruit les autorités et crée parent plus orderItems", async () => {
  const source = await readFile(createRoutePath, "utf8")
  assert.match(source, /createCanonicalOrder/)
  assert.match(source, /FirestoreAtomicOrderCreationStore/)
  assert.match(source, /resolveOrderPrincipal/)
})

test("le navigateur QR n'envoie aucun prix ni statut au serveur", async () => {
  const source = await readFile(checkoutPath, "utf8")
  const start = source.indexOf("body: {", source.indexOf("createCanonicalQrOrder"))
  const end = source.indexOf("\n        if (qrMode === \"compare\"", start)
  const body = source.slice(start, end)
  assert.doesNotMatch(body, /unitPrice|totalAmount|paymentStatus|kitchenStatus|orderStatus|actorRole/)
})

test("le suivi canonique charge parent et orderItems depuis la frontière serveur", async () => {
  const source = await readFile(trackingPath, "utf8")
  assert.match(source, /getCanonicalPublicOrder/)
  assert.match(source, /items:\s*response\.orderItems/)
  assert.match(source, /canonicalItems:\s*response\.orderItems/)
})

test("la lecture publique refuse une commande d'un autre client", async () => {
  const source = await readFile(publicReadRoutePath, "utf8")
  assert.match(source, /order\.createdBy !== uid/)
  assert.match(source, /Cette commande n’appartient pas à cette session/)
})

test("la lecture publique exige un Auth Firebase valide et App Check", async () => {
  const source = await readFile(publicReadRoutePath, "utf8")
  assert.match(source, /verifyOrderAppCheckToken\(appCheckToken\)/)
  assert.match(source, /verifyIdToken\(idToken,\s*true\)/)
  assert.doesNotMatch(source, /sign_in_provider\s*!==\s*"anonymous"/)
})

test("le checkout public accepte un utilisateur anonyme existant", async () => {
  let signInCount = 0
  const anonymousUser = { uid: "anonymous-1", isAnonymous: true }
  const user = await ensurePublicFirebaseUser(
    { currentUser: anonymousUser },
    async () => {
      signInCount += 1
      return { user: anonymousUser }
    }
  )
  assert.equal(user, anonymousUser)
  assert.equal(signInCount, 0)
})

test("le checkout public accepte un utilisateur password existant sans le déconnecter", async () => {
  let signInCount = 0
  const passwordUser = {
    uid: "customer-1",
    isAnonymous: false,
    providerData: [{ providerId: "password" }],
  }
  const user = await ensurePublicFirebaseUser(
    { currentUser: passwordUser },
    async () => {
      signInCount += 1
      return { user: passwordUser }
    }
  )
  assert.equal(user, passwordUser)
  assert.equal(signInCount, 0)
  const checkout = await readFile(
    new URL("../../src/modules/public/components/CheckoutPublicModal.tsx", import.meta.url),
    "utf8"
  )
  assert.match(checkout, /if \(!user\)/)
  assert.doesNotMatch(checkout, /if \(!user\?\.isAnonymous\)/)
  assert.doesNotMatch(checkout, /signOut\(/)
})

test("le checkout QR accepte toute session Firebase valide et initialise seulement une session absente", async () => {
  const checkout = await readFile(
    new URL("../../src/modules/public/components/CheckoutQRModal.tsx", import.meta.url),
    "utf8"
  )

  assert.doesNotMatch(checkout, /if \(!user\?\.isAnonymous\)/)
  assert.match(checkout, /if \(!orderUser\)/)
  assert.match(checkout, /await ensurePublicFirebaseUser\(auth\)/)
  assert.match(checkout, /user: orderUser/)
})

test("Auth et App Check sont préparés en parallèle pour les actions publiques", async () => {
  const client = await readFile(
    new URL("../../src/modules/public/canonical/public-api-client.ts", import.meta.url),
    "utf8"
  )

  assert.match(client, /Promise\.all\(\[/)
  assert.match(client, /user\.getIdToken\(\)/)
  assert.match(client, /getToken\(appCheck, false\)/)
})

test("le checkout public déclenche et mutualise l'authentification anonyme sans utilisateur", async () => {
  let signInCount = 0
  const anonymousUser = { uid: "anonymous-2", isAnonymous: true }
  const auth = { currentUser: null }
  const signIn = async () => {
    signInCount += 1
    return { user: anonymousUser }
  }
  const [first, second] = await Promise.all([
    ensurePublicFirebaseUser(auth, signIn),
    ensurePublicFirebaseUser(auth, signIn),
  ])
  assert.equal(first, anonymousUser)
  assert.equal(second, anonymousUser)
  assert.equal(signInCount, 1)
})

test("un véritable échec d'authentification conserve le message public explicite", async () => {
  const checkout = await readFile(
    new URL("../../src/modules/public/components/CheckoutPublicModal.tsx", import.meta.url),
    "utf8"
  )
  await assert.rejects(
    ensurePublicFirebaseUser(
      { currentUser: null },
      async () => {
        throw new Error("auth/network-request-failed")
      }
    ),
    /auth\/network-request-failed/
  )
  assert.match(
    checkout,
    /Impossible d’ouvrir une session client sécurisée\. Réessayez dans quelques instants\./
  )
})

test("la création publique accepte tout ID token Firebase valide sans relâcher App Check", async () => {
  const security = await readFile(
    new URL("../../src/server/orders/create/security.ts", import.meta.url),
    "utf8"
  )
  assert.match(security, /await requireAppCheck\(input\.request\)/)
  assert.match(security, /const token = await requireIdToken\(input\.request\)/)
  assert.doesNotMatch(security, /sign_in_provider\s*!==\s*"anonymous"/)
})

test("paiement, suivi et avis publics conservent Auth, App Check et la propriété sans imposer le provider", async () => {
  const paths = [
    publicOrderPaymentRoutePath,
    publicReadRoutePath,
    new URL("../../src/app/api/restaurants/[restaurantId]/orders/[orderId]/review-access/route.ts", import.meta.url),
  ]
  for (const path of paths) {
    const source = await readFile(path, "utf8")
    assert.match(source, /verifyOrderAppCheckToken\(appCheckToken\)/)
    assert.match(source, /verifyIdToken\(idToken,\s*true\)/)
    assert.doesNotMatch(source, /sign_in_provider\s*!==\s*"anonymous"/)
  }
  const readRoute = await readFile(publicReadRoutePath, "utf8")
  assert.match(readRoute, /order\.createdBy !== uid/)
})

test("la demande de paiement QR passe par une route serveur idempotente", async () => {
  const source = await readFile(paymentRoutePath, "utf8")
  assert.match(source, /publicPaymentRequestIdempotency/)
  assert.match(source, /runTransaction/)
  assert.match(source, /verifyTableCapability/)
  assert.match(source, /transaction\.update\(sessionRef/)
})

test("le paiement QR ne sert aucune ligne et ne touche pas au Stock", async () => {
  const source = await readFile(paymentRoutePath, "utf8")
  assert.doesNotMatch(source, /orderItems|servedQuantity|stockBalancesV2|stockOperationsV2/)
})

test("le suivi canonique neutralise la requête de toutes les commandes de table", async () => {
  const source = await readFile(trackingPath, "utf8")
  assert.match(source, /activeTableSessionId \|\| useCanonicalQr/)
  assert.match(source, /if \(!db \|\| !restaurantId \|\| !orderId \|\| useCanonicalQr\) return/)
})

test("compare détecte les divergences sans créer de seconde commande", () => {
  const base = {
    lineCount: 1,
    lines: [{ productId: "cola", quantity: 2 }],
    total: 1000,
    serviceMode: "dine_in",
    tableId: "table-a",
    status: "pending",
  }
  assert.deepEqual(comparePublicOrderProjections(base, base), {
    equal: true,
    differences: [],
  })
  assert.deepEqual(
    comparePublicOrderProjections(base, { ...base, total: 1200 }).differences,
    ["total"]
  )
})

test("emporté et livraison utilisent la route canonique et une demande de paiement serveur", async () => {
  const source = await readFile(
    new URL("../../src/modules/public/components/CheckoutPublicModal.tsx", import.meta.url),
    "utf8"
  )
  assert.match(source, /channel[\s\S]*"public_delivery"[\s\S]*"public_takeaway"/)
  assert.match(source, /createCanonicalQrOrder/)
  assert.match(source, /requestCanonicalOrderPayment/)
  assert.match(source, /item\.instructions\?\.trim\(\)/)
  assert.match(source, /notes:\s*flow\.customerNote\.trim\(\) \|\| null/)
})

test("la demande de paiement publique est visible par la Caisse sans confirmer le paiement", async () => {
  const source = await readFile(
    new URL(
      "../../src/app/api/restaurants/[restaurantId]/orders/[orderId]/payment-requests/route.ts",
      import.meta.url
    ),
    "utf8"
  )
  assert.match(source, /transaction\.update\(orderRef/)
  assert.match(source, /paymentProofSms/)
  assert.match(source, /paymentRequest:/)
  assert.doesNotMatch(source, /paymentStatus:\s*"paid"/)
  assert.doesNotMatch(source, /servedQuantity|stockBalancesV2|stockOperationsV2/)
})

test("l'ancien checkout /r est neutralisé sans écriture Firestore", async () => {
  const source = await readFile(
    new URL("../../src/app/r/[slug]/checkout/page.tsx", import.meta.url),
    "utf8"
  )
  assert.match(source, /redirect\(`\/\$\{slug\}`\)/)
  assert.doesNotMatch(source, /addDoc|setDoc|updateDoc|firebase\/firestore/)
})

test("QRPaymentModal passe par la frontière serveur en mode canonique", async () => {
  const source = await readFile(
    new URL("../../src/modules/public/components/QRPaymentModal.tsx", import.meta.url),
    "utf8"
  )
  const canonical = source.slice(source.indexOf("if (qrCanonicalEnabled"))
  assert.match(canonical, /requestCanonicalTablePayment/)
})

test("reviewAccess canonique est serveur, idempotent et limité à completed plus paid", async () => {
  const source = await readFile(
    new URL("../../src/app/api/restaurants/[restaurantId]/orders/[orderId]/review-access/route.ts", import.meta.url),
    "utf8"
  )
  assert.match(source, /order\?\.paymentStatus !== "paid"/)
  assert.match(source, /order\?\.orderStatus !== "completed"/)
  assert.match(source, /order\?\.createdBy !== uid/)
  assert.match(source, /if \(accessSnapshot\.exists\)/)
  assert.match(source, /transaction\.create\(accessRef/)
})

test("la configuration documente App Check, le secret QR, le mode et l'allowlist", async () => {
  const source = await readFile(new URL("../../.env.example", import.meta.url), "utf8")
  assert.match(source, /NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY/)
  assert.match(source, /ORDER_QR_CAPABILITY_SECRET/)
  assert.match(source, /NEXT_PUBLIC_QR_CANONICAL_MODE/)
  assert.match(source, /NEXT_PUBLIC_QR_CANONICAL_RESTAURANTS/)
})

test("la page publique ne crée plus de session legacy avant la commande canonique", async () => {
  const source = await readFile(publicPagePath, "utf8")
  assert.doesNotMatch(source, /ensureActiveTableSession/)
  assert.doesNotMatch(source, /setActiveTableSession/)
})

test("le POS conserve visibles les commandes opérationnelles avant paiement", async () => {
  const source = await readFile(
    new URL("../../src/modules/pos/canonical/pos-selectors.ts", import.meta.url),
    "utf8"
  )
  assert.match(source, /"pending", "preparing", "ready"/)
  assert.match(source, /operationStatus === "served" && !isPaid/)
  assert.match(source, /getTerminalCashSessionId\(order\) === activeCashSessionId/)
})
