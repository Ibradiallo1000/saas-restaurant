import assert from "node:assert/strict"
import test, { after, before } from "node:test"

import { deleteApp, initializeApp } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"

import { FirestoreCashHandover } from "../../src/server/finance/firestore-cash-handover.ts"

const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST)
let app
let db

before(() => {
  if (!enabled) return
  app = initializeApp({ projectId: process.env.GCLOUD_PROJECT || "cash-handover-tests" }, `handover-${Date.now()}`)
  db = getFirestore(app)
})
after(async () => { if (app) await deleteApp(app) })

test("soumission, correction et unicité sont transactionnelles", { skip: !enabled }, async () => {
  const restaurantId = `submit-${Date.now()}`
  const root = db.collection("restaurants").doc(restaurantId)
  await root.collection("cashSessions").doc("session").set({
    cashierId: "cashier", status: "closed", closeVersion: 2,
    expectedHandover: 20_000, expectedMobileMoney: 4_000,
  })
  const service = new FirestoreCashHandover(db)
  const submitted = await service.submit({
    restaurantId, sessionId: "session", cashierId: "cashier",
    declaredAmount: 19_500, note: "Première remise", idempotencyKey: "submit-1",
  })
  assert.equal(submitted.status, "submitted")
  assert.equal((await service.submit({
    restaurantId, sessionId: "session", cashierId: "cashier",
    declaredAmount: 19_500, note: "Première remise", idempotencyKey: "submit-1",
  })).replayed, true)
  await service.review({
    restaurantId, handoverId: "session-session", managerId: "manager", managerRole: "manager",
    decision: "correction_required", note: "Recompter les espèces", idempotencyKey: "review-correction",
  })
  await service.submit({
    restaurantId, sessionId: "session", cashierId: "cashier",
    declaredAmount: 20_000, note: "Montant corrigé", idempotencyKey: "submit-2",
  })
  const handover = (await root.collection("cashHandovers").doc("session-session").get()).data()
  assert.equal(handover.status, "submitted")
  assert.equal(handover.correctionCount, 1)
  assert.equal(handover.declarationDifference, 0)
})

test("validation concurrente crédite cash et Mobile Money une seule fois", { skip: !enabled }, async () => {
  const restaurantId = `validate-${Date.now()}`
  const root = db.collection("restaurants").doc(restaurantId)
  await root.collection("cashSessions").doc("session").set({
    cashierId: "cashier", status: "closed", closeVersion: 2,
    expectedHandover: 20_000, expectedMobileMoney: 4_000,
  })
  const service = new FirestoreCashHandover(db)
  await service.submit({
    restaurantId, sessionId: "session", cashierId: "cashier",
    declaredAmount: 20_000, note: "", idempotencyKey: "submit",
  })
  const review = () => service.review({
    restaurantId, handoverId: "session-session", managerId: "manager", managerRole: "manager",
    decision: "validated", receivedAmount: 19_000, note: "Réception",
    idempotencyKey: "validate",
  })
  const results = await Promise.all([review(), review()])
  assert.equal(results.filter((result) => result.replayed).length, 1)
  const cashAccount = (await root.collection("treasuryAccounts").doc("cash").get()).data()
  const mobileAccount = (await root.collection("treasuryAccounts").doc("mobile_money").get()).data()
  assert.equal(cashAccount.balance, 19_000)
  assert.equal(mobileAccount.balance, 4_000)
  assert.equal((await root.collection("cashMovements").get()).size, 2)
  const handover = (await root.collection("cashHandovers").doc("session-session").get()).data()
  assert.equal(handover.receiptDifference, -1_000)
  assert.equal(handover.status, "validated")
})

test("un caissier différent et une session legacy sont refusés", { skip: !enabled }, async () => {
  const restaurantId = `reject-${Date.now()}`
  const root = db.collection("restaurants").doc(restaurantId)
  await root.collection("cashSessions").doc("legacy").set({
    cashierId: "owner", status: "closed", expectedHandover: 1_000,
  })
  const service = new FirestoreCashHandover(db)
  await assert.rejects(service.submit({
    restaurantId, sessionId: "legacy", cashierId: "intruder",
    declaredAmount: 1_000, idempotencyKey: "wrong",
  }), (error) => error.code === "CASH_SESSION_OWNERSHIP_MISMATCH")
  await assert.rejects(service.submit({
    restaurantId, sessionId: "legacy", cashierId: "owner",
    declaredAmount: 1_000, idempotencyKey: "legacy",
  }), (error) => error.code === "CASH_SESSION_V2_CLOSE_REQUIRED")
})

test("une remise physique à zéro ne peut pas être déclarée manuellement", { skip: !enabled }, async () => {
  const restaurantId = `zero-handover-${Date.now()}`
  const root = db.collection("restaurants").doc(restaurantId)
  await root.collection("cashSessions").doc("session").set({
    cashierId: "cashier", status: "closed", closeVersion: 2,
    expectedHandover: 0, expectedMobileMoney: 10_000,
  })
  await assert.rejects(new FirestoreCashHandover(db).submit({
    restaurantId, sessionId: "session", cashierId: "cashier",
    declaredAmount: 8_000, idempotencyKey: "invalid-physical-remittance",
  }), (error) => error.code === "NO_PHYSICAL_HANDOVER_REQUIRED")
  assert.equal((await root.collection("cashHandovers").get()).empty, true)
})

test("un mouvement de session historique empêche un double crédit", { skip: !enabled }, async () => {
  const restaurantId = `legacy-posted-${Date.now()}`
  const root = db.collection("restaurants").doc(restaurantId)
  await root.collection("cashSessions").doc("session").set({
    cashierId: "cashier", status: "closed", closeVersion: 2,
    expectedHandover: 5_000, expectedMobileMoney: 0,
  })
  await root.collection("cashMovements").doc("session-session-cash").set({
    type: "deposit", source: "session", amount: 5_000,
  })
  const service = new FirestoreCashHandover(db)
  await service.submit({
    restaurantId, sessionId: "session", cashierId: "cashier",
    declaredAmount: 5_000, idempotencyKey: "submit",
  })
  await assert.rejects(service.review({
    restaurantId, handoverId: "session-session", managerId: "manager", managerRole: "manager",
    decision: "validated", receivedAmount: 5_000, idempotencyKey: "validate",
  }), (error) => error.code === "SESSION_TREASURY_ALREADY_POSTED")
  assert.equal((await root.collection("treasuryAccounts").get()).empty, true)
})

test("un manager récupère une session V2 sans remise puis applique submitted → under_review → validated", { skip: !enabled }, async () => {
  const restaurantId = `manager-recovery-${Date.now()}`
  const root = db.collection("restaurants").doc(restaurantId)
  await root.collection("cashSessions").doc("session").set({
    cashierId: "cashier", status: "closed", closeVersion: 2,
    expectedHandover: 8_000, expectedMobileMoney: 2_000,
  })
  const service = new FirestoreCashHandover(db)
  const ensured = await service.ensureForManagerReview({
    restaurantId, sessionId: "session", managerId: "manager",
    idempotencyKey: "recover-session",
  })
  assert.equal(ensured.status, "submitted")
  assert.equal((await service.ensureForManagerReview({
    restaurantId, sessionId: "session", managerId: "manager",
    idempotencyKey: "recover-session",
  })).replayed, true)
  await service.review({
    restaurantId, handoverId: "session-session", managerId: "manager", managerRole: "manager",
    decision: "under_review", note: "Comptage", idempotencyKey: "start-review",
  })
  await service.review({
    restaurantId, handoverId: "session-session", managerId: "manager", managerRole: "manager",
    decision: "validated", receivedAmount: 8_000, note: "Réception conforme",
    idempotencyKey: "validate-review",
  })
  const handover = (await root.collection("cashHandovers").doc("session-session").get()).data()
  assert.deepEqual(handover.statusHistory.map((entry) => entry.status), [
    "submitted", "under_review", "validated",
  ])
  const session = (await root.collection("cashSessions").doc("session").get()).data()
  assert.equal(session.status, "validated")
  assert.equal(session.validatedByManager, true)
  assert.equal((await root.collection("treasuryAccounts").doc("cash").get()).data().balance, 8_000)
  assert.equal((await root.collection("treasuryAccounts").doc("mobile_money").get()).data().balance, 2_000)
})
