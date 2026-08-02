import assert from "node:assert/strict"
import test, { after, before } from "node:test"

import { deleteApp, initializeApp } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"

import { FirestoreCashSessionClose } from "../../src/server/finance/firestore-cash-session-close.ts"
import { FirestoreCashHandover } from "../../src/server/finance/firestore-cash-handover.ts"
import { FirestorePaymentLedger } from "../../src/server/finance/firestore-payment-ledger.ts"

const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST)
let app
let db

before(() => {
  if (!enabled) return
  app = initializeApp({ projectId: "cash-session-close-v2" }, `close-v2-${Date.now()}`)
  db = getFirestore(app)
})

after(async () => {
  if (app) await deleteApp(app)
})

test("la clôture V2 est transactionnelle, idempotente et ne crée aucun versement", {
  skip: !enabled,
}, async () => {
  const restaurantId = `restaurant-${Date.now()}`
  const sessionId = "session-1"
  const root = db.collection("restaurants").doc(restaurantId)
  await root.collection("cashSessions").doc(sessionId).set({
    cashierId: "cashier-1",
    status: "open",
    openingBalance: 10_000,
  })
  await Promise.all([
    root.collection("payments").doc("cash").set({
      orderId: "order-1", sessionId, cashierId: "cashier-1", source: "pos",
      type: "cash", amount: 25_000, status: "confirmed", idempotencyKey: "cash-1",
    }),
    root.collection("payments").doc("mobile").set({
      orderId: "order-2", sessionId, cashierId: "cashier-1", source: "delivery",
      type: "mobile_money", amount: 12_000, status: "confirmed", idempotencyKey: "mobile-1",
    }),
  ])
  const service = new FirestoreCashSessionClose(db)
  const input = {
    restaurantId, sessionId, cashierId: "cashier-1",
    countedPhysicalCash: 35_000, retainedFloat: 10_000, idempotencyKey: "close-1",
  }
  assert.equal((await service.close(input)).replayed, false)
  assert.equal((await service.close(input)).replayed, true)

  const session = (await root.collection("cashSessions").doc(sessionId).get()).data()
  assert.equal(session.closeVersion, 2)
  assert.equal(session.expectedPhysicalCash, 35_000)
  assert.equal(session.expectedMobileMoney, 12_000)
  assert.equal(session.expectedHandover, 25_000)
  assert.equal(session.cashCountDifference, 0)
  assert.equal(session.totalCash, 25_000)
  assert.equal(session.totalMobileMoney, 12_000)
  assert.equal((await root.collection("cashHandovers").get()).empty, true)
  assert.equal((await root.collection("cashMovements").get()).empty, true)
})

test("une session d'un autre caissier est refusée", { skip: !enabled }, async () => {
  const restaurantId = `ownership-${Date.now()}`
  const root = db.collection("restaurants").doc(restaurantId)
  await root.collection("cashSessions").doc("session").set({
    cashierId: "cashier-owner", status: "open", openingBalance: 0,
  })
  await assert.rejects(
    new FirestoreCashSessionClose(db).close({
      restaurantId, sessionId: "session", cashierId: "intruder",
      countedPhysicalCash: 0, retainedFloat: 0, idempotencyKey: "close",
    }),
    (error) => error.code === "CASH_SESSION_OWNERSHIP_MISMATCH"
  )
})

test("une session uniquement Mobile Money ne produit aucune remise physique et crédite uniquement Mobile Money", {
  skip: !enabled,
}, async () => {
  const restaurantId = `mobile-only-${Date.now()}`
  const sessionId = "session-mobile"
  const root = db.collection("restaurants").doc(restaurantId)
  await root.collection("cashSessions").doc(sessionId).set({
    cashierId: "cashier-1", status: "open", openingBalance: 0,
  })
  await root.collection("payments").doc("mobile-payment").set({
    orderId: "order-mobile", sessionId, cashierId: "cashier-1", source: "delivery",
    type: "mobile_money", provider: "orange_money", amount: 10_000,
    status: "confirmed", idempotencyKey: "mobile-only-payment",
  })

  const closed = await new FirestoreCashSessionClose(db).close({
    restaurantId, sessionId, cashierId: "cashier-1",
    countedPhysicalCash: 0, retainedFloat: 0, idempotencyKey: "close-mobile-only",
  })
  assert.equal(closed.close.expectedPhysicalCash, 0)
  assert.equal(closed.close.retainedFloat, 0)
  assert.equal(closed.close.expectedHandover, 0)
  assert.equal(closed.close.expectedMobileMoney, 10_000)

  const session = (await root.collection("cashSessions").doc(sessionId).get()).data()
  assert.equal(session.totalCash, 0)
  assert.equal(session.totalMobileMoney, 10_000)
  const handover = (await root.collection("cashHandovers").doc(`session-${sessionId}`).get()).data()
  assert.equal(handover.expectedAmount, 0)
  assert.equal(handover.declaredAmount, 0)
  assert.equal(handover.physicalHandoverRequired, false)

  await new FirestoreCashHandover(db).review({
    restaurantId, handoverId: `session-${sessionId}`, managerId: "manager",
    managerRole: "manager", decision: "validated", receivedAmount: 0,
    note: "Validation Mobile Money", idempotencyKey: "review-mobile-only",
  })
  assert.equal((await root.collection("treasuryAccounts").doc("cash").get()).exists, false)
  assert.equal((await root.collection("treasuryAccounts").doc("mobile_money").get()).data().balance, 10_000)
  const movements = await root.collection("cashMovements").get()
  assert.equal(movements.size, 1)
  assert.equal(movements.docs[0].data().accountId, "mobile_money")
  assert.equal(movements.docs[0].data().amount, 10_000)
})

test("un compte Mobile Money partage est credite au paiement et jamais recredite a la cloture", {
  skip: !enabled,
}, async () => {
  const restaurantId = `shared-mobile-account-${Date.now()}`
  const root = db.collection("restaurants").doc(restaurantId)
  await root.collection("treasuryAccounts").doc("orange-shared").set({
    id: "orange-shared",
    name: "Orange Money principal",
    kind: "mobile_money",
    provider: "orange_money",
    balance: 100_000,
    currency: "FCFA",
    active: true,
  })
  await db.collection("restaurantPaymentConfigs").add({
    restaurantId,
    methodCode: "orange_money",
    variantId: "orange-ussd",
    merchantNumber: "123456",
    paymentAccountId: "orange-shared",
    isActive: true,
  })
  await Promise.all([
    root.collection("cashSessions").doc("session-a").set({
      cashierId: "cashier-a", status: "open", openingBalance: 0,
      posStationId: "station-a", posStationName: "Caisse A", posStationCode: "A",
    }),
    root.collection("cashSessions").doc("session-b").set({
      cashierId: "cashier-b", status: "open", openingBalance: 0,
      posStationId: "station-b", posStationName: "Caisse B", posStationCode: "B",
    }),
  ])
  const ledger = new FirestorePaymentLedger(db)
  await db.runTransaction((transaction) => ledger.createConfirmedPaymentInTransaction(transaction, {
    restaurantId,
    paymentId: "pay-a",
    orderId: "order-a",
    sessionId: "session-a",
    cashierId: "cashier-a",
    source: "pos",
    type: "mobile_money",
    provider: "orange_money",
    amount: 10_000,
    receivedAmount: 10_000,
    changeDue: 0,
    externalReference: null,
    idempotencyKey: "payment-a",
  }))
  await db.runTransaction((transaction) => ledger.createConfirmedPaymentInTransaction(transaction, {
    restaurantId,
    paymentId: "pay-b",
    orderId: "order-b",
    sessionId: "session-b",
    cashierId: "cashier-b",
    source: "pos",
    type: "mobile_money",
    provider: "orange_money",
    amount: 15_000,
    receivedAmount: 15_000,
    changeDue: 0,
    externalReference: null,
    idempotencyKey: "payment-b",
  }))
  assert.equal((await root.collection("treasuryAccounts").doc("orange-shared").get()).data().balance, 125_000)
  await ledger.refundPayment({
    restaurantId,
    paymentId: "pay-b",
    cashierId: "cashier-b",
    amount: 5_000,
    reason: "Remboursement partiel",
    idempotencyKey: "refund-b",
  })
  assert.equal((await root.collection("treasuryAccounts").doc("orange-shared").get()).data().balance, 120_000)

  await new FirestoreCashSessionClose(db).close({
    restaurantId, sessionId: "session-a", cashierId: "cashier-a",
    countedPhysicalCash: 0, retainedFloat: 0, idempotencyKey: "close-session-a",
  })
  await new FirestoreCashHandover(db).review({
    restaurantId, handoverId: "session-session-a", managerId: "manager",
    managerRole: "manager", decision: "validated", receivedAmount: 0,
    note: "Controle compte partage", idempotencyKey: "review-session-a",
  })
  assert.equal((await root.collection("treasuryAccounts").doc("orange-shared").get()).data().balance, 120_000)
  assert.equal((await root.collection("cashMovements").doc("payment-pay-a").get()).data().amount, 10_000)
  assert.equal((await root.collection("cashMovements").doc("handover-session-session-a-mobile").get()).exists, false)
})
