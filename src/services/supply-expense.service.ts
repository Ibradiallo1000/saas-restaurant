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
  inventoryItemId: string
  inventoryItemName?: string | null
  quantity: number
  unitCost: number
}

export type CreateSupplierInput = {
  name: string
  phone?: string | null
  createdBy: string
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
        balance: 0,
        createdBy: input.createdBy,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    })
    return supplierRef.id
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
      const itemSnapshots: Array<{ input: NormalizedSupplyItem; ref: ReturnType<typeof doc>; data: any }> = []

      if (normalized.type === "supply") {
        amount = normalized.items.reduce((sum, item) => sum + item.lineTotal, 0)
        for (const item of normalized.items) {
          const inventoryRef = doc(
            this.db,
            COLLECTION_NAMES.RESTAURANTS,
            restaurantId,
            "inventoryItems",
            item.inventoryItemId
          )
          const inventorySnap = await transaction.get(inventoryRef)
          if (!inventorySnap.exists()) {
            throw new Error(`Produit inventaire introuvable: ${item.inventoryItemName || item.inventoryItemId}`)
          }
          itemSnapshots.push({ input: item, ref: inventoryRef, data: inventorySnap.data() })
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
        const oldStock = normalizePositiveNumber(snapshot.data.stockEstimated)
        const oldCost = normalizePositiveNumber(snapshot.data.costPerUnit)
        const newStock = oldStock + snapshot.input.quantity
        const weightedCost =
          newStock > 0
            ? ((oldStock * oldCost) + (snapshot.input.quantity * snapshot.input.unitCost)) / newStock
            : snapshot.input.unitCost

        transaction.update(snapshot.ref, {
          stockEstimated: newStock,
          costPerUnit: weightedCost,
          updatedAt: serverTimestamp(),
        })

        const movementRef = doc(collection(this.db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.INVENTORY_MOVEMENTS))
        transaction.set(movementRef, {
          restaurantId,
          expenseId: expenseRef.id,
          inventoryItemId: snapshot.input.inventoryItemId,
          inventoryItemName: snapshot.input.inventoryItemName,
          type: "supply",
          quantity: snapshot.input.quantity,
          unitCost: snapshot.input.unitCost,
          lineTotal: snapshot.input.lineTotal,
          stockBefore: oldStock,
          stockAfter: newStock,
          createdBy: normalized.createdBy,
          createdAt: serverTimestamp(),
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

    await runTransaction(this.db, async (transaction) => {
      const supplierSnap = await transaction.get(supplierRef)
      if (!supplierSnap.exists()) throw new Error("Fournisseur introuvable.")

      const balance = normalizePositiveNumber(supplierSnap.data().balance)
      const requestedAmount = normalizePositiveNumber(input.amount)
      const paymentAmount = Math.min(requestedAmount, balance)
      if (paymentAmount <= 0) throw new Error("Aucun montant à payer.")

      transaction.set(supplierPaymentRef, {
        restaurantId,
        supplierId: input.supplierId,
        supplierName: supplierSnap.data().name || null,
        amount: paymentAmount,
        cashMovementId: cashMovementRef.id,
        createdBy: input.createdBy,
        createdAt: serverTimestamp(),
      })

      transaction.set(cashMovementRef, {
        restaurantId,
        type: "expense",
        amount: paymentAmount,
        source: "manual",
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
    })

    return supplierPaymentRef.id
  }
}

type NormalizedSupplyItem = {
  inventoryItemId: string
  inventoryItemName: string | null
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
        inventoryItemId: item.inventoryItemId.trim(),
        inventoryItemName: item.inventoryItemName?.trim() || null,
        quantity,
        unitCost,
        lineTotal: quantity * unitCost,
      }
    })
    .filter((item) => item.inventoryItemId && item.quantity > 0 && item.unitCost >= 0)
}

function normalizePositiveNumber(value: unknown) {
  const amount = Number(value || 0)
  return Number.isFinite(amount) && amount > 0 ? amount : 0
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
