"use client"

import {
  Firestore,
  collection,
  doc,
  increment,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore"

import { COLLECTION_NAMES } from "@/lib/constants"

export type ExpenseType = "supply" | "salary" | "other"
export type ExpensePaymentStatus = "paid" | "partial" | "unpaid"

export type SupplyExpenseItemInput = {
  articleId: string
  articleName?: string | null
  quantity: number
  unitCost: number
}

export type CreateSupplierInput = {
  name: string
  phone?: string | null
  articleIds?: string[]
  createdBy: string
}

export type UpdateSupplierArticlesInput = {
  supplierId: string
  articleIds: string[]
  updatedBy: string
}

export type CreateExpenseInput = {
  type: ExpenseType
  paymentStatus: ExpensePaymentStatus
  paidAmount?: number
  amount?: number
  paymentAccountId?: string | null
  supplierId?: string | null
  supplierName?: string | null
  items?: SupplyExpenseItemInput[]
  category?: string | null
  note?: string | null
  createdBy: string
}

export type PaySupplierInput = {
  supplierId: string
  amount: number
  paymentAccountId: string
  createdBy: string
}

const MAX_SUPPLY_ITEMS = 10

export class SupplyExpenseService {
  constructor(private db: Firestore) {}

  async createSupplier(restaurantId: string, input: CreateSupplierInput) {
    const supplierName = input.name.trim()
    if (!supplierName) throw new Error("Nom fournisseur obligatoire.")

    const supplierRef = doc(collection(this.db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.SUPPLIERS))
    await runTransaction(this.db, async (transaction) => {
      transaction.set(supplierRef, {
        name: supplierName,
        phone: input.phone?.trim() || null,
        articleIds: normalizeArticleIds(input.articleIds),
        balance: 0,
        createdBy: input.createdBy,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    })
    return supplierRef.id
  }

  async updateSupplierArticles(
    restaurantId: string,
    input: UpdateSupplierArticlesInput
  ) {
    const supplierRef = doc(
      this.db,
      COLLECTION_NAMES.RESTAURANTS,
      restaurantId,
      COLLECTION_NAMES.SUPPLIERS,
      input.supplierId
    )
    await runTransaction(this.db, async (transaction) => {
      const supplierSnap = await transaction.get(supplierRef)
      if (!supplierSnap.exists()) throw new Error("Fournisseur introuvable.")
      transaction.update(supplierRef, {
        articleIds: normalizeArticleIds(input.articleIds),
        updatedBy: input.updatedBy,
        updatedAt: serverTimestamp(),
      })
    })
  }

  async createExpense(restaurantId: string, input: CreateExpenseInput) {
    const expenseRef = doc(collection(this.db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.EXPENSES))
    const expenseLogRef = doc(this.db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.EXPENSE_LOGS, expenseRef.id)

    await runTransaction(this.db, async (transaction) => {
      const logSnap = await transaction.get(expenseLogRef)
      if (logSnap.exists()) return

      const normalized = normalizeExpenseInput(input)
      const supplierRef = normalized.supplierId
        ? doc(this.db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.SUPPLIERS, normalized.supplierId)
        : null
      const supplierSnap = supplierRef ? await transaction.get(supplierRef) : null
      if (supplierRef && !supplierSnap?.exists()) {
        throw new Error("Fournisseur introuvable.")
      }

      let amount = normalized.amount
      const itemSnapshots: Array<{
        input: NormalizedSupplyItem
        articleRef: ReturnType<typeof doc>
        balanceRef: ReturnType<typeof doc>
        articleCostRef: ReturnType<typeof doc>
        article: any
        balance: any | null
        articleCost: any | null
      }> = []

      if (normalized.type === "supply") {
        amount = normalized.items.reduce((sum, item) => sum + item.lineTotal, 0)
        console.log("[SupplyAudit] createExpense — Approvisionnement", {
          restaurantId,
          type: normalized.type,
          amount,
          itemsCount: normalized.items.length,
          items: normalized.items.map((item) => ({
            articleId: item.articleId,
            articleName: item.articleName,
            quantity: item.quantity,
            unitCost: item.unitCost,
            lineTotal: item.lineTotal,
          })),
          collectionPath: `restaurants/${restaurantId}/stockItemsV2`,
          featureFlagArticlesV2: process.env.NEXT_PUBLIC_STOCK_ARTICLES_V2_ENABLED,
          featureFlagAutomaticSimple: process.env.NEXT_PUBLIC_STOCK_AUTOMATIC_SIMPLE_ENABLED,
        })
        for (const item of normalized.items) {
          const articleRef = doc(
            this.db,
            COLLECTION_NAMES.RESTAURANTS,
            restaurantId,
            "stockItemsV2",
            item.articleId
          )
          const balanceRef = doc(
            this.db,
            COLLECTION_NAMES.RESTAURANTS,
            restaurantId,
            "stockBalancesV2",
            item.articleId
          )
          const articleCostRef = doc(
            this.db,
            COLLECTION_NAMES.RESTAURANTS,
            restaurantId,
            "stockItemCostsV2",
            item.articleId
          )
          const articleSnap = await transaction.get(articleRef)
          const balanceSnap = await transaction.get(balanceRef)
          const articleCostSnap = await transaction.get(articleCostRef)
          if (!articleSnap.exists()) {
            throw new Error(`Article de stock introuvable: ${item.articleName || item.articleId}`)
          }
          const article = articleSnap.data()
          if (article.status !== "active" || article.trackingMode === "NONE") {
            throw new Error(`Article non approvisionnable: ${item.articleName || item.articleId}`)
          }
          itemSnapshots.push({
            input: item,
            articleRef,
            balanceRef,
            articleCostRef,
            article,
            balance: balanceSnap.exists() ? balanceSnap.data() : null,
            articleCost: articleCostSnap.exists() ? articleCostSnap.data() : null,
          })
        }
      }

      if (normalized.paidAmount > amount) {
        throw new Error("Le montant payé ne peut pas dépasser le total.")
      }
      if (normalized.paymentStatus !== "paid" && !supplierRef) {
        throw new Error("Fournisseur obligatoire si la dépense n'est pas totalement payée.")
      }

      const debtAmount = Math.max(0, amount - normalized.paidAmount)
      const paidAccountId = normalized.paymentAccountId || "cash"
      const paymentAccountRef = normalized.paidAmount > 0
        ? doc(this.db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.TREASURY_ACCOUNTS, paidAccountId)
        : null
      const paymentAccountSnap = paymentAccountRef ? await transaction.get(paymentAccountRef) : null
      if (paymentAccountRef && !paymentAccountSnap?.exists()) {
        throw new Error("Source de paiement introuvable.")
      }
      if (paymentAccountSnap?.exists()) {
        const balance = normalizePositiveNumber(paymentAccountSnap.data().balance)
        if (balance < normalized.paidAmount) {
          throw new Error("Solde insuffisant sur la source de paiement.")
        }
      }

      const cashMovementRef = normalized.paidAmount > 0
        ? doc(this.db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.CASH_MOVEMENTS, `expense-${expenseRef.id}`)
        : null

      transaction.set(expenseRef, {
        restaurantId,
        type: normalized.type,
        amount,
        paidAmount: normalized.paidAmount,
        debtAmount,
        paymentStatus: normalized.paymentStatus,
        paymentAccountId: normalized.paidAmount > 0 ? paidAccountId : null,
        paymentAccountName: paymentAccountSnap?.data()?.name || null,
        supplierId: normalized.supplierId,
        supplierName: normalized.supplierName || supplierSnap?.data()?.name || null,
        category: normalized.category,
        note: normalized.note,
        items: normalized.type === "supply" ? normalized.items : [],
        cashMovementId: cashMovementRef?.id || null,
        validated: false,
        createdBy: normalized.createdBy,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      for (const snapshot of itemSnapshots) {
        const oldStock = normalizeNonNegativeNumber(snapshot.balance?.quantity)
        const newStock = oldStock + snapshot.input.quantity
        const oldVersion = normalizeNonNegativeNumber(snapshot.balance?.version)
        const oldReferenceCost = normalizeNonNegativeNumber(snapshot.articleCost?.referenceCost)
        const weightedReferenceCost = newStock > 0
          ? ((oldStock * oldReferenceCost) + snapshot.input.lineTotal) / newStock
          : snapshot.input.unitCost
        const occurredAt = new Date().toISOString()
        const operationRef = doc(
          collection(this.db, COLLECTION_NAMES.RESTAURANTS, restaurantId, "stockOperationsV2")
        )
        const idempotencyKey = `expense:${expenseRef.id}:supply:${snapshot.input.articleId}`
        const idempotencyRef = doc(
          this.db,
          COLLECTION_NAMES.RESTAURANTS,
          restaurantId,
          "stockIdempotencyV2",
          encodeURIComponent(idempotencyKey)
        )
        const costRef = doc(
          this.db,
          COLLECTION_NAMES.RESTAURANTS,
          restaurantId,
          "stockOperationCostsV2",
          operationRef.id
        )

        transaction.set(snapshot.balanceRef, {
          restaurantId,
          articleId: snapshot.input.articleId,
          quantity: newStock,
          unit: snapshot.article.baseUnit,
          version: oldVersion + 1,
          lastOperationAt: occurredAt,
          lastControlAt: snapshot.balance?.lastControlAt || null,
          lastSupplyAt: occurredAt,
        })
        transaction.set(operationRef, {
          restaurantId,
          articleId: snapshot.input.articleId,
          type: "APPROVISIONNEMENT",
          quantityBefore: oldStock,
          variation: snapshot.input.quantity,
          quantityAfter: newStock,
          unit: snapshot.article.baseUnit,
          occurredAt,
          createdAt: occurredAt,
          createdBy: normalized.createdBy,
          idempotencyKey,
          expectedVersion: oldVersion,
          expenseId: expenseRef.id,
          supplierId: normalized.supplierId,
          reference: normalized.note,
        })
        transaction.set(idempotencyRef, {
          restaurantId,
          articleId: snapshot.input.articleId,
          operationId: operationRef.id,
          fingerprint: [
            "APPROVISIONNEMENT",
            snapshot.input.articleId,
            snapshot.input.quantity,
            "",
            "",
            "",
            "",
          ].join("|"),
          createdAt: occurredAt,
          createdBy: normalized.createdBy,
        })
        transaction.set(costRef, {
          restaurantId,
          operationId: operationRef.id,
          totalCost: snapshot.input.lineTotal,
          unitCost: snapshot.input.unitCost,
          updatedAt: occurredAt,
          updatedBy: normalized.createdBy,
        })
        transaction.set(snapshot.articleCostRef, {
          restaurantId,
          articleId: snapshot.input.articleId,
          referenceCost: weightedReferenceCost,
          updatedAt: occurredAt,
          updatedBy: normalized.createdBy,
        })
      }

      if (cashMovementRef) {
        transaction.set(cashMovementRef, {
          restaurantId,
          type: "expense",
          direction: "out",
          amount: normalized.paidAmount,
          source: "expense",
          accountId: paidAccountId,
          paymentMethod: getPaymentMethodFromAccount(paymentAccountSnap?.data()),
          paymentProvider: paymentAccountSnap?.data()?.provider || paidAccountId,
          category: normalized.type,
          label: getCashMovementReason(normalized.type, normalized.note),
          reason: getCashMovementReason(normalized.type, normalized.note),
          supplierId: normalized.supplierId,
          expenseId: expenseRef.id,
          sourceExpenseId: expenseRef.id,
          createdBy: normalized.createdBy,
          createdByRole: "manager",
          createdAt: serverTimestamp(),
          occurredAt: serverTimestamp(),
        })

        transaction.update(paymentAccountRef!, {
          balance: increment(-normalized.paidAmount),
          updatedAt: serverTimestamp(),
        })
      }

      if (supplierRef && debtAmount > 0) {
        transaction.update(supplierRef, {
          balance: increment(debtAmount),
          updatedAt: serverTimestamp(),
        })
      }

      transaction.set(expenseLogRef, {
        expenseId: expenseRef.id,
        createdAt: serverTimestamp(),
      })
    })

    return expenseRef.id
  }

  async paySupplier(restaurantId: string, input: PaySupplierInput) {
    const supplierPaymentRef = doc(collection(this.db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.SUPPLIER_PAYMENTS))
    const cashMovementRef = doc(collection(this.db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.CASH_MOVEMENTS))
    const supplierRef = doc(this.db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.SUPPLIERS, input.supplierId)
    const paymentAccountId = input.paymentAccountId.trim()
    if (!paymentAccountId) throw new Error("Source de paiement obligatoire.")
    const paymentAccountRef = doc(this.db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.TREASURY_ACCOUNTS, paymentAccountId)

    await runTransaction(this.db, async (transaction) => {
      const supplierSnap = await transaction.get(supplierRef)
      const paymentAccountSnap = await transaction.get(paymentAccountRef)
      if (!supplierSnap.exists()) throw new Error("Fournisseur introuvable.")
      if (!paymentAccountSnap.exists()) throw new Error("Source de paiement introuvable.")

      const balance = normalizePositiveNumber(supplierSnap.data().balance)
      const requestedAmount = normalizePositiveNumber(input.amount)
      const paymentAmount = Math.min(requestedAmount, balance)
      if (paymentAmount <= 0) throw new Error("Aucun montant à payer.")
      if (normalizeNonNegativeNumber(paymentAccountSnap.data().balance) < paymentAmount) {
        throw new Error("Solde insuffisant sur la source de paiement.")
      }

      transaction.set(supplierPaymentRef, {
        restaurantId,
        supplierId: input.supplierId,
        supplierName: supplierSnap.data().name || null,
        amount: paymentAmount,
        paymentAccountId,
        paymentAccountName: paymentAccountSnap.data().name || null,
        cashMovementId: cashMovementRef.id,
        createdBy: input.createdBy,
        createdAt: serverTimestamp(),
      })

      transaction.set(cashMovementRef, {
        restaurantId,
        type: "expense",
        direction: "out",
        amount: paymentAmount,
        source: "supplier_payment",
        accountId: paymentAccountId,
        paymentMethod: getPaymentMethodFromAccount(paymentAccountSnap.data()),
        paymentProvider: paymentAccountSnap.data().provider || paymentAccountId,
        category: "supplier_payment",
        reason: "Paiement fournisseur",
        supplierId: input.supplierId,
        supplierPaymentId: supplierPaymentRef.id,
        createdBy: input.createdBy,
        createdAt: serverTimestamp(),
      })

      transaction.update(supplierRef, {
        balance: balance - paymentAmount,
        updatedAt: serverTimestamp(),
      })
      transaction.update(paymentAccountRef, {
        balance: increment(-paymentAmount),
        updatedAt: serverTimestamp(),
      })
    })

    return supplierPaymentRef.id
  }
}

type NormalizedSupplyItem = {
  articleId: string
  articleName: string | null
  quantity: number
  unitCost: number
  lineTotal: number
}

function normalizeExpenseInput(input: CreateExpenseInput) {
  const type = input.type
  if (!["supply", "salary", "other"].includes(type)) throw new Error("Type de dépense invalide.")

  const paymentStatus = input.paymentStatus
  if (!["paid", "partial", "unpaid"].includes(paymentStatus)) throw new Error("Statut paiement invalide.")

  const items = normalizeSupplyItems(input.items)
  if (type === "supply" && items.length === 0) throw new Error("Approvisionnement vide.")
  if (type === "supply" && items.length > MAX_SUPPLY_ITEMS) throw new Error("Maximum 10 produits par approvisionnement.")

  const amount = type === "supply"
    ? items.reduce((sum, item) => sum + item.lineTotal, 0)
    : normalizePositiveNumber(input.amount)
  if (amount <= 0) throw new Error("Montant invalide.")

  const paidAmount = paymentStatus === "paid"
    ? amount
    : paymentStatus === "unpaid"
      ? 0
      : normalizePositiveNumber(input.paidAmount)
  if (paymentStatus === "partial" && paidAmount <= 0) throw new Error("Montant partiel invalide.")
  if (paidAmount > amount) throw new Error("Le montant payé dépasse le total.")

  if (paidAmount > 0 && !input.paymentAccountId?.trim()) throw new Error("Source de paiement obligatoire.")

  return {
    type,
    paymentStatus,
    amount,
    paidAmount,
    supplierId: input.supplierId?.trim() || null,
    supplierName: input.supplierName?.trim() || null,
    paymentAccountId: input.paymentAccountId?.trim() || null,
    items,
    category: input.category?.trim() || null,
    note: input.note?.trim() || null,
    createdBy: input.createdBy,
  }
}

function normalizeSupplyItems(items: SupplyExpenseItemInput[] | undefined): NormalizedSupplyItem[] {
  return (items || [])
    .map((item) => {
      const quantity = normalizePositiveNumber(item.quantity)
      const unitCost = normalizePositiveNumber(item.unitCost)
      return {
        articleId: item.articleId.trim(),
        articleName: item.articleName?.trim() || null,
        quantity,
        unitCost,
        lineTotal: quantity * unitCost,
      }
    })
    .filter((item) => item.articleId && item.quantity > 0 && item.unitCost >= 0)
}

function normalizePositiveNumber(value: unknown) {
  const amount = Number(value || 0)
  return Number.isFinite(amount) && amount > 0 ? amount : 0
}

function normalizeNonNegativeNumber(value: unknown) {
  const amount = Number(value || 0)
  return Number.isFinite(amount) && amount >= 0 ? amount : 0
}

function normalizeArticleIds(values: string[] | undefined) {
  return [...new Set((values || []).map((value) => value.trim()).filter(Boolean))]
}

function getCashMovementReason(type: ExpenseType, note: string | null) {
  if (note) return note
  if (type === "supply") return "Approvisionnement"
  if (type === "salary") return "Salaire"
  return "Dépense"
}

function getPaymentMethodFromAccount(account: any) {
  if (account?.kind === "mobile_money") return "mobile_money"
  if (account?.kind === "bank") return "bank"
  return "cash"
}
