import {
  collection,
  doc,
  getDocs,
  increment,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type Firestore,
  type QueryConstraint,
  type Timestamp,
  type Transaction,
} from "firebase/firestore"

import { COLLECTION_NAMES } from "@/lib/constants"

export type TreasuryAccountKind = "cash" | "mobile_money" | "bank"

export type TreasuryAccount = {
  id: string
  name: string
  kind: TreasuryAccountKind
  provider?: string
  balance: number
  currency: string
  active: boolean
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

export type TreasuryCashSessionInput = {
  restaurantId: string
  sessionId: string
  managerId: string
  managerRole?: "cashier" | "manager" | "owner" | "admin" | string | null
  calculatedTotal: number
  calculatedCash: number
  calculatedMobile: number
  totalOrders: number
  difference: number
  validationFlag?: "discrepancy" | null
  discrepancyReason?: string | null
}

export const DEFAULT_TREASURY_ACCOUNTS: Array<Omit<TreasuryAccount, "balance">> = [
  {
    id: "cash",
    name: "Cash physique",
    kind: "cash",
    provider: "cash",
    currency: "FCFA",
    active: true,
  },
  {
    id: "mobile_money",
    name: "Mobile Money",
    kind: "mobile_money",
    provider: "mobile_money",
    currency: "FCFA",
    active: true,
  },
]

export class TreasuryService {
  constructor(private db: Firestore) {}

  async ensureDefaultTreasuryAccounts(restaurantId: string): Promise<void> {
    const historicalBalances = await getHistoricalTreasuryBalances(this.db, restaurantId)

    await runTransaction(this.db, async (transaction) => {
      const accountRefs = DEFAULT_TREASURY_ACCOUNTS.map((account) => ({
        account,
        ref: getTreasuryAccountRef(this.db, restaurantId, account.id),
      }))
      const accountSnaps = await Promise.all(accountRefs.map(({ ref }) => transaction.get(ref)))

      accountRefs.forEach(({ account, ref }, index) => {
        if (accountSnaps[index]?.exists()) return

        transaction.set(ref, {
          ...account,
          balance: Math.max(0, Number(historicalBalances[account.id] || 0)),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      })
    })
  }

  async getTreasuryAccounts(restaurantId: string): Promise<TreasuryAccount[]> {
    const snapshot = await getDocs(collection(this.db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.TREASURY_ACCOUNTS))
    return snapshot.docs.map((accountDoc) => ({
      id: accountDoc.id,
      ...accountDoc.data(),
    })) as TreasuryAccount[]
  }

  subscribeTreasuryAccounts(
    restaurantId: string,
    callback: (accounts: TreasuryAccount[]) => void
  ): () => void {
    return onSnapshot(collection(this.db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.TREASURY_ACCOUNTS), (snapshot) => {
      callback(snapshot.docs.map((accountDoc) => ({ id: accountDoc.id, ...accountDoc.data() })) as TreasuryAccount[])
    })
  }

  subscribeCashMovements(
    restaurantId: string,
    filters: QueryConstraint[] = [],
    callback: (movements: any[]) => void
  ): () => void {
    const movementsQuery = query(
      collection(this.db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.CASH_MOVEMENTS),
      ...filters
    )
    return onSnapshot(movementsQuery, (snapshot) => {
      callback(snapshot.docs.map((movementDoc) => ({ id: movementDoc.id, ...movementDoc.data() })))
    })
  }

  async postCashSessionMovementToTreasury(input: TreasuryCashSessionInput): Promise<void> {
    validateCashSessionInput(input)

    const sessionRef = doc(
      this.db,
      COLLECTION_NAMES.RESTAURANTS,
      input.restaurantId,
      COLLECTION_NAMES.CASH_SESSIONS,
      input.sessionId
    )
    const legacyMovementRef = doc(
      this.db,
      COLLECTION_NAMES.RESTAURANTS,
      input.restaurantId,
      COLLECTION_NAMES.CASH_MOVEMENTS,
      `session-${input.sessionId}`
    )
    const cashMovementRef = doc(
      this.db,
      COLLECTION_NAMES.RESTAURANTS,
      input.restaurantId,
      COLLECTION_NAMES.CASH_MOVEMENTS,
      `session-${input.sessionId}-cash`
    )
    const mobileMovementRef = doc(
      this.db,
      COLLECTION_NAMES.RESTAURANTS,
      input.restaurantId,
      COLLECTION_NAMES.CASH_MOVEMENTS,
      `session-${input.sessionId}-mobile`
    )
    const cashAccountRef = getTreasuryAccountRef(this.db, input.restaurantId, "cash")
    const mobileAccountRef = getTreasuryAccountRef(this.db, input.restaurantId, "mobile_money")

    await runTransaction(this.db, async (transaction) => {
      const [
        sessionSnap,
        legacyMovementSnap,
        cashMovementSnap,
        mobileMovementSnap,
        cashAccountSnap,
        mobileAccountSnap,
      ] = await Promise.all([
        transaction.get(sessionRef),
        transaction.get(legacyMovementRef),
        transaction.get(cashMovementRef),
        transaction.get(mobileMovementRef),
        transaction.get(cashAccountRef),
        transaction.get(mobileAccountRef),
      ])

      if (!sessionSnap.exists()) throw new Error("Session introuvable.")
      const session = sessionSnap.data()

      if (session.treasuryPosted === true || session.validatedByManager || session.status === "validated") {
        return
      }

      const createdMovementIds: string[] = []
      const legacyAlreadyPosted = legacyMovementSnap.exists()
      const splitAlreadyPosted = cashMovementSnap.exists() || mobileMovementSnap.exists()

      if (!legacyAlreadyPosted && !splitAlreadyPosted) {
        if (input.calculatedCash > 0) {
          transaction.set(cashMovementRef, buildCashSessionMovement(input, {
            amount: input.calculatedCash,
            accountId: "cash",
            paymentMethod: "cash",
            paymentProvider: "cash",
            label: "Validation session caisse - cash",
          }))
          creditAccountInTransaction(transaction, cashAccountRef, cashAccountSnap.exists(), DEFAULT_TREASURY_ACCOUNTS[0], input.calculatedCash)
          createdMovementIds.push(cashMovementRef.id)
        }

        if (input.calculatedMobile > 0) {
          transaction.set(mobileMovementRef, buildCashSessionMovement(input, {
            amount: input.calculatedMobile,
            accountId: "mobile_money",
            paymentMethod: "mobile_money",
            paymentProvider: "mobile_money",
            label: "Validation session caisse - mobile money",
          }))
          creditAccountInTransaction(transaction, mobileAccountRef, mobileAccountSnap.exists(), DEFAULT_TREASURY_ACCOUNTS[1], input.calculatedMobile)
          createdMovementIds.push(mobileMovementRef.id)
        }

        if (input.calculatedCash <= 0 && input.calculatedMobile <= 0 && input.calculatedTotal > 0) {
          transaction.set(cashMovementRef, buildCashSessionMovement(input, {
            amount: input.calculatedTotal,
            accountId: "cash",
            paymentMethod: "cash",
            paymentProvider: "cash",
            label: "Validation session caisse",
            note: "Répartition cash/mobile indisponible au moment de la validation.",
          }))
          creditAccountInTransaction(transaction, cashAccountRef, cashAccountSnap.exists(), DEFAULT_TREASURY_ACCOUNTS[0], input.calculatedTotal)
          createdMovementIds.push(cashMovementRef.id)
        }
      }

      transaction.update(sessionRef, {
        status: "validated",
        validatedByManager: true,
        validatedBy: input.managerId,
        validatedAt: serverTimestamp(),
        validationFlag: input.validationFlag ?? null,
        discrepancyAmount: input.validationFlag === "discrepancy" ? input.difference : 0,
        calculatedTotal: input.calculatedTotal,
        calculatedCash: input.calculatedCash,
        calculatedMobile: input.calculatedMobile,
        calculatedOrders: input.totalOrders,
        discrepancyStatus: input.validationFlag === "discrepancy" ? "investigate" : "validated",
        discrepancyReason: input.discrepancyReason || null,
        investigationRequired: input.validationFlag === "discrepancy",
        depositCreated: true,
        treasuryPosted: !legacyAlreadyPosted && !splitAlreadyPosted,
        treasuryPostedAt: serverTimestamp(),
        treasuryPostedBy: input.managerId,
        cashMovementIds: legacyAlreadyPosted
          ? [legacyMovementRef.id]
          : splitAlreadyPosted
            ? [cashMovementSnap.exists() ? cashMovementRef.id : null, mobileMovementSnap.exists() ? mobileMovementRef.id : null].filter(Boolean)
            : createdMovementIds,
        updatedAt: serverTimestamp(),
      })
    })
  }
}

function getTreasuryAccountRef(db: Firestore, restaurantId: string, accountId: string) {
  return doc(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.TREASURY_ACCOUNTS, accountId)
}

async function getHistoricalTreasuryBalances(db: Firestore, restaurantId: string) {
  const [movementsSnap, sessionsSnap] = await Promise.all([
    getDocs(collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.CASH_MOVEMENTS)),
    getDocs(collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.CASH_SESSIONS)),
  ])
  const sessionById = new Map(sessionsSnap.docs.map((sessionDoc) => [sessionDoc.id, sessionDoc.data()]))

  return movementsSnap.docs.reduce<Record<string, number>>((totals, movementDoc) => {
    const movement = { id: movementDoc.id, ...movementDoc.data() }
    const expandedMovements = expandHistoricalMovement(movement, sessionById)

    for (const entry of expandedMovements) {
      const accountId = getHistoricalMovementAccountId(entry)
      const direction = getHistoricalMovementDirection(entry)
      const amount = Number(entry.amount || 0)
      if (!accountId || !Number.isFinite(amount) || amount <= 0) continue
      if (direction === "in") totals[accountId] = (totals[accountId] || 0) + amount
      if (direction === "out") totals[accountId] = (totals[accountId] || 0) - amount
    }

    return totals
  }, {})
}

function expandHistoricalMovement(movement: any, sessionById: Map<string, any>) {
  if (!isLegacySessionMovement(movement)) return [movement]

  const session = sessionById.get(String(movement.sessionId || movement.sourceSessionId || ""))
  const split = getSessionPaymentSplit(session)
  if (!split || (split.cash <= 0 && split.mobile <= 0)) return [movement]

  const entries: any[] = []
  if (split.cash > 0) {
    entries.push({
      ...movement,
      amount: split.cash,
      accountId: "cash",
      paymentMethod: "cash",
    })
  }
  if (split.mobile > 0) {
    entries.push({
      ...movement,
      amount: split.mobile,
      accountId: "mobile_money",
      paymentMethod: "mobile_money",
    })
  }
  return entries
}

function isLegacySessionMovement(movement: any) {
  const id = String(movement.id || "")
  return (
    movement.source === "session" &&
    movement.type === "deposit" &&
    !movement.accountId &&
    Boolean(movement.sessionId || movement.sourceSessionId) &&
    id.startsWith("session-") &&
    !id.endsWith("-cash") &&
    !id.endsWith("-mobile")
  )
}

function getSessionPaymentSplit(session: any) {
  if (!session) return null
  const snapshot = session.closeSnapshot || {}
  const cash = Number(snapshot.systemCash ?? snapshot.systemTotals?.cash ?? session.calculatedCash ?? session.totalCash ?? 0)
  const mobile = Number(snapshot.systemMobileMoney ?? snapshot.systemTotals?.mobileMoney ?? session.calculatedMobile ?? session.totalMobileMoney ?? session.totalMobile ?? 0)
  if (!Number.isFinite(cash) || !Number.isFinite(mobile)) return null
  return { cash: Math.max(0, cash), mobile: Math.max(0, mobile) }
}

function getHistoricalMovementDirection(movement: any) {
  if (movement.direction === "in" || movement.direction === "out" || movement.direction === "transfer") return movement.direction
  if (movement.type === "deposit") return "in"
  if (movement.type === "expense" || movement.type === "withdrawal") return "out"
  if (movement.type === "transfer") return "transfer"
  return "out"
}

function getHistoricalMovementAccountId(movement: any) {
  if (movement.accountId) return String(movement.accountId)
  if (movement.paymentMethod === "mobile_money") return "mobile_money"
  if (movement.paymentMethod === "bank") return "bank"
  if (movement.type === "expense" || movement.type === "deposit") return "cash"
  return null
}

function ensureAccountInTransaction(
  transaction: Transaction,
  accountRef: ReturnType<typeof doc>,
  exists: boolean,
  account: Omit<TreasuryAccount, "balance">
) {
  if (exists) return
  transaction.set(accountRef, {
    ...account,
    balance: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

function creditAccountInTransaction(
  transaction: Transaction,
  accountRef: ReturnType<typeof doc>,
  exists: boolean,
  account: Omit<TreasuryAccount, "balance">,
  amount: number
) {
  if (exists) {
    transaction.update(accountRef, {
      balance: increment(amount),
      updatedAt: serverTimestamp(),
    })
    return
  }

  transaction.set(accountRef, {
    ...account,
    balance: amount,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

function buildCashSessionMovement(
  input: TreasuryCashSessionInput,
  movement: {
    amount: number
    accountId: "cash" | "mobile_money"
    paymentMethod: "cash" | "mobile_money"
    paymentProvider: string
    label: string
    note?: string
  }
) {
  return {
    restaurantId: input.restaurantId,
    type: "deposit",
    source: "session",
    direction: "in",
    amount: movement.amount,
    accountId: movement.accountId,
    paymentMethod: movement.paymentMethod,
    paymentProvider: movement.paymentProvider,
    sessionId: input.sessionId,
    sourceSessionId: input.sessionId,
    label: movement.label,
    note: movement.note || null,
    createdBy: input.managerId,
    createdByRole: input.managerRole || "manager",
    createdAt: serverTimestamp(),
    occurredAt: serverTimestamp(),
  }
}

function validateCashSessionInput(input: TreasuryCashSessionInput) {
  if (!input.restaurantId || !input.sessionId || !input.managerId) {
    throw new Error("Session, restaurant et manager obligatoires.")
  }
  for (const value of [input.calculatedTotal, input.calculatedCash, input.calculatedMobile]) {
    if (!Number.isFinite(Number(value)) || Number(value) < 0) {
      throw new Error("Montant de trésorerie invalide.")
    }
  }
}

export function getTreasuryAccountLabel(accountId?: string | null) {
  if (accountId === "cash") return "Cash physique"
  if (accountId === "mobile_money") return "Mobile Money"
  if (accountId === "bank") return "Banque"
  if (!accountId) return "Compte non précisé"
  return accountId
}
