"use client"

import * as React from "react"
import { collection, query, where } from "firebase/firestore"
import { Banknote, Plus, ReceiptText, Trash2 } from "lucide-react"

import { AdminRouteSkeleton } from "@/components/performance/route-skeletons"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { useRestaurant } from "@/design-system/context/RestaurantContext"
import { useTenant } from "@/design-system/context/TenantProvider"
import { COLLECTION_NAMES } from "@/lib/constants"
import { getDateRange, useTimeFilter } from "@/contexts/time-filter-context"
import { cn } from "@/lib/utils"
import {
  ExpensePaymentStatus,
  ExpenseType,
  SupplyExpenseService,
} from "@/services/supply-expense.service"
import { TreasuryService, getTreasuryAccountLabel, type TreasuryAccount } from "@/services/treasury.service"

type Supplier = {
  id: string
  name: string
  phone?: string | null
  balance?: number
}

type InventoryItem = {
  id: string
  name: string
  stockEstimated?: number
  costPerUnit?: number
  unit?: string
}

type SupplyLine = {
  inventoryItemId: string
  quantity: string
  unitCost: string
}

const EXPENSE_TYPES: Array<{ value: ExpenseType; label: string }> = [
  { value: "other", label: "Dépense simple" },
  { value: "salary", label: "Salaire" },
  { value: "supply", label: "Approvisionnement" },
]

export default function ManagerExpensesPage() {
  const db = useFirestore()
  const { restaurantId } = useRestaurant()
  const { user } = useTenant()
  const { filter } = useTimeFilter()
  const range = React.useMemo(() => getDateRange(filter), [filter])
  const [type, setType] = React.useState<ExpenseType>("other")
  const [paymentStatus, setPaymentStatus] = React.useState<ExpensePaymentStatus>("paid")
  const [amount, setAmount] = React.useState("")
  const [paidAmount, setPaidAmount] = React.useState("")
  const [paymentAccountId, setPaymentAccountId] = React.useState("cash")
  const [supplierId, setSupplierId] = React.useState("")
  const [newSupplierName, setNewSupplierName] = React.useState("")
  const [newSupplierPhone, setNewSupplierPhone] = React.useState("")
  const [note, setNote] = React.useState("")
  const [lines, setLines] = React.useState<SupplyLine[]>([
    { inventoryItemId: "", quantity: "", unitCost: "" },
  ])
  const [saving, setSaving] = React.useState(false)
  const [feedback, setFeedback] = React.useState("")
  const [treasurySetupStatus, setTreasurySetupStatus] = React.useState<"idle" | "creating" | "error">("idle")

  const suppliersQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.SUPPLIERS)
  }, [db, restaurantId])
  const { data: suppliers, isLoading: suppliersLoading } = useCollection<Supplier>(suppliersQuery)

  const inventoryQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, "inventoryItems")
  }, [db, restaurantId])
  const { data: inventoryItems, isLoading: inventoryLoading } = useCollection<InventoryItem>(inventoryQuery)

  const expensesQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return query(
      collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.EXPENSES),
      where("createdAt", ">=", range.startDate),
      where("createdAt", "<=", range.endDate)
    )
  }, [db, restaurantId, range.endDate, range.startDate])
  const { data: expenses, isLoading: expensesLoading } = useCollection<any>(expensesQuery)

  const treasuryAccountsQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.TREASURY_ACCOUNTS)
  }, [db, restaurantId])
  const { data: treasuryAccounts, isLoading: treasuryAccountsLoading } = useCollection<TreasuryAccount>(treasuryAccountsQuery)

  const service = React.useMemo(() => (db ? new SupplyExpenseService(db) : null), [db])
  const treasuryService = React.useMemo(() => (db ? new TreasuryService(db) : null), [db])
  const safeSuppliers = suppliers || []
  const safeInventoryItems = inventoryItems || []
  const safeTreasuryAccounts = React.useMemo(
    () => (treasuryAccounts || []).filter((account) => account.active !== false),
    [treasuryAccounts]
  )
  const safeExpenses = React.useMemo(
    () => [...(expenses || [])].sort((a, b) => getTimeMs(b.createdAt) - getTimeMs(a.createdAt)),
    [expenses]
  )

  const ensureTreasuryAccounts = React.useCallback(async () => {
    if (!treasuryService || !restaurantId || treasurySetupStatus === "creating") return
    setTreasurySetupStatus("creating")
    try {
      await treasuryService.ensureDefaultTreasuryAccounts(restaurantId)
      setTreasurySetupStatus("idle")
    } catch (error) {
      console.warn("[expenses] treasury accounts unavailable", error)
      setTreasurySetupStatus("error")
    }
  }, [restaurantId, treasuryService, treasurySetupStatus])

  React.useEffect(() => {
    if (!treasuryService || !restaurantId || safeTreasuryAccounts.length > 0 || treasurySetupStatus !== "idle") return
    ensureTreasuryAccounts()
  }, [ensureTreasuryAccounts, restaurantId, safeTreasuryAccounts.length, treasuryService, treasurySetupStatus])

  React.useEffect(() => {
    if (paymentStatus === "unpaid") return
    if (safeTreasuryAccounts.length === 0) {
      setPaymentAccountId("")
      return
    }
    if (!safeTreasuryAccounts.some((account) => account.id === paymentAccountId)) {
      setPaymentAccountId(safeTreasuryAccounts[0]?.id || "")
    }
  }, [paymentAccountId, paymentStatus, safeTreasuryAccounts])

  const supplyTotal = React.useMemo(() => {
    return lines.reduce((sum, line) => {
      const quantity = Number(line.quantity || 0)
      const unitCost = Number(line.unitCost || 0)
      if (!Number.isFinite(quantity) || !Number.isFinite(unitCost)) return sum
      return sum + quantity * unitCost
    }, 0)
  }, [lines])
  const effectiveAmount = type === "supply" ? supplyTotal : Math.round(Number(amount || 0))
  const effectivePaidAmount = paymentStatus === "paid"
    ? effectiveAmount
    : paymentStatus === "unpaid"
      ? 0
      : Math.round(Number(paidAmount || 0))
  const requiresSupplier = type === "supply" || paymentStatus !== "paid"
  const selectedSupplier = safeSuppliers.find((supplier) => supplier.id === supplierId)
  const canSubmit =
    Boolean(service && restaurantId && user) &&
    effectiveAmount > 0 &&
    effectivePaidAmount <= effectiveAmount &&
    (effectivePaidAmount <= 0 || (safeTreasuryAccounts.length > 0 && Boolean(paymentAccountId))) &&
    (!requiresSupplier || Boolean(supplierId)) &&
    (type !== "supply" || getValidSupplyLines(lines, safeInventoryItems).length > 0)

  const addSupplier = async () => {
    if (!service || !restaurantId || !user || !newSupplierName.trim()) return
    const createdId = await service.createSupplier(restaurantId, {
      name: newSupplierName,
      phone: newSupplierPhone,
      createdBy: user.uid,
    })
    setSupplierId(createdId)
    setNewSupplierName("")
    setNewSupplierPhone("")
  }

  const updateLine = (index: number, patch: Partial<SupplyLine>) => {
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line))
  }

  const removeLine = (index: number) => {
    setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))
  }

  const submitExpense = async () => {
    if (!service || !restaurantId || !user || !canSubmit || saving) return
    setSaving(true)
    try {
      await service.createExpense(restaurantId, {
        type,
        paymentStatus,
        paidAmount: effectivePaidAmount,
        paymentAccountId: effectivePaidAmount > 0 ? paymentAccountId : null,
        amount: type === "supply" ? undefined : effectiveAmount,
        supplierId: supplierId || null,
        supplierName: selectedSupplier?.name || null,
        items: type === "supply" ? getValidSupplyLines(lines, safeInventoryItems) : [],
        category: type,
        note,
        createdBy: user.uid,
      })
      setAmount("")
      setPaidAmount("")
      setNote("")
      setLines([{ inventoryItemId: "", quantity: "", unitCost: "" }])
      setPaymentStatus("paid")
      setPaymentAccountId("cash")
      setFeedback("Dépense enregistrée")
      window.setTimeout(() => setFeedback(""), 2500)
    } finally {
      setSaving(false)
    }
  }

  if (!restaurantId || suppliersLoading || inventoryLoading || expensesLoading || treasuryAccountsLoading) return <AdminRouteSkeleton />

  return (
    <main className="space-y-5 pb-24 md:pb-6">
      <section className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-primary md:text-3xl">
              Dépenses
            </h1>
            <p className="text-sm text-muted-foreground">
              Point d'entrée unique pour dépenses, approvisionnements et dettes fournisseurs.
            </p>
          </div>
          <div className="rounded-full border bg-background px-3 py-1 text-xs font-black uppercase text-muted-foreground">
            {safeExpenses.length} opération(s)
          </div>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ReceiptText className="h-5 w-5 text-primary" />
            Nouvelle dépense
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            {EXPENSE_TYPES.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setType(item.value)}
                className={cn(
                  "rounded-xl border p-4 text-left font-black transition",
                  type === item.value ? "border-primary bg-primary/10 text-primary" : "bg-background hover:bg-muted"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          {type === "supply" ? (
            <section className="space-y-3 rounded-xl border bg-background p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-black">Produits approvisionnés</h2>
                  <p className="text-sm text-muted-foreground">Maximum 10 lignes. Le montant est recalculé automatiquement.</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black uppercase text-muted-foreground">Total</p>
                  <p className="text-2xl font-black">{formatMoney(supplyTotal)} FCFA</p>
                </div>
              </div>

              <div className="space-y-3">
                {lines.map((line, index) => (
                  <div key={index} className="grid gap-2 rounded-lg border bg-card p-3 md:grid-cols-[1fr_130px_150px_44px] md:items-end">
                    <div className="space-y-2">
                      <Label>Produit</Label>
                      <select
                        value={line.inventoryItemId}
                        onChange={(event) => updateLine(index, { inventoryItemId: event.target.value })}
                        className="h-11 w-full rounded-md border bg-background px-3 text-sm"
                      >
                        <option value="">Choisir</option>
                        {safeInventoryItems.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Quantité</Label>
                      <Input type="number" min={0} step="any" value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Coût unitaire</Label>
                      <Input type="number" min={0} step="any" value={line.unitCost} onChange={(event) => updateLine(index, { unitCost: event.target.value })} />
                    </div>
                    <Button type="button" variant="outline" size="icon" disabled={lines.length === 1} onClick={() => removeLine(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                disabled={lines.length >= 10}
                onClick={() => setLines((current) => [...current, { inventoryItemId: "", quantity: "", unitCost: "" }])}
              >
                <Plus className="mr-2 h-4 w-4" />
                Ajouter une ligne
              </Button>
            </section>
          ) : (
            <div className="grid gap-3 md:grid-cols-[180px_1fr] md:items-end">
              <div className="space-y-2">
                <Label>Montant</Label>
                <Input type="number" min={0} value={amount} onChange={(event) => setAmount(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Note</Label>
                <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Motif, contexte, détail..." />
              </div>
            </div>
          )}

          <section className="grid gap-4 rounded-xl border bg-background p-4 lg:grid-cols-[1fr_1fr]">
            <div className="space-y-3">
              <Label>Paiement</Label>
              <RadioGroup value={paymentStatus} onValueChange={(value) => setPaymentStatus(value as ExpensePaymentStatus)} className="grid gap-2 sm:grid-cols-3">
                <PaymentOption value="paid" label="Payé" />
                <PaymentOption value="partial" label="Partiel" />
                <PaymentOption value="unpaid" label="Non payé" />
              </RadioGroup>
              {paymentStatus === "partial" ? (
                <div className="space-y-2">
                  <Label>Montant payé</Label>
                  <Input type="number" min={0} max={effectiveAmount} value={paidAmount} onChange={(event) => setPaidAmount(event.target.value)} />
                </div>
              ) : null}
              <p className="text-sm font-bold text-muted-foreground">
                Trésorerie impactée maintenant : {formatMoney(effectivePaidAmount)} FCFA
              </p>
              {paymentStatus !== "unpaid" && safeTreasuryAccounts.length === 0 ? (
                <div className="rounded-lg border border-orange-300 bg-orange-50 p-3 text-orange-900">
                  <p className="text-sm font-black">Configuration trésorerie requise</p>
                  <p className="mt-1 text-sm font-semibold">
                    Avant d'enregistrer une dépense payée, il faut créer les comptes qui représentent l'argent du restaurant : Cash physique et Mobile Money.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3 bg-white font-black"
                    disabled={treasurySetupStatus === "creating"}
                    onClick={ensureTreasuryAccounts}
                  >
                    {treasurySetupStatus === "creating" ? "Création..." : "Créer les comptes de trésorerie"}
                  </Button>
                  {treasurySetupStatus === "error" ? (
                    <p className="mt-2 text-xs font-bold">
                      Création impossible pour le moment. Vérifie que les règles Firestore sont déployées.
                    </p>
                  ) : null}
                </div>
              ) : null}
              {paymentStatus !== "unpaid" && safeTreasuryAccounts.length > 0 ? (
                <div className="space-y-2">
                  <Label>Source de paiement</Label>
                  <select
                    value={paymentAccountId}
                    onChange={(event) => setPaymentAccountId(event.target.value)}
                    disabled={safeTreasuryAccounts.length === 0}
                    className="h-11 w-full rounded-md border bg-background px-3 text-sm font-bold"
                  >
                    {safeTreasuryAccounts.length === 0 ? (
                      <option value="">Aucun compte disponible</option>
                    ) : (
                      safeTreasuryAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name || getTreasuryAccountLabel(account.id)} - {formatMoney(account.balance)} FCFA
                        </option>
                      ))
                    )}
                  </select>
                </div>
              ) : null}
              {paymentStatus !== "unpaid" && safeTreasuryAccounts.length > 0 ? (
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-xs font-black uppercase text-muted-foreground">Argent disponible</p>
                  <div className="mt-2 grid gap-2">
                    {safeTreasuryAccounts.map((account) => (
                      <div key={account.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-bold">{account.name || getTreasuryAccountLabel(account.id)}</span>
                        <span className="font-black">{formatMoney(account.balance)} FCFA</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="space-y-3">
              <Label>Fournisseur {requiresSupplier ? "(obligatoire)" : "(optionnel)"}</Label>
              <select
                value={supplierId}
                onChange={(event) => setSupplierId(event.target.value)}
                className="h-11 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Aucun fournisseur</option>
                {safeSuppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name} · dette {formatMoney(supplier.balance || 0)} FCFA
                  </option>
                ))}
              </select>
              <div className="grid gap-2 sm:grid-cols-[1fr_150px_auto]">
                <Input value={newSupplierName} onChange={(event) => setNewSupplierName(event.target.value)} placeholder="Nouveau fournisseur" />
                <Input value={newSupplierPhone} onChange={(event) => setNewSupplierPhone(event.target.value)} placeholder="Téléphone" />
                <Button type="button" variant="outline" disabled={!newSupplierName.trim()} onClick={addSupplier}>
                  Créer
                </Button>
              </div>
            </div>
          </section>

          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black">Total : {formatMoney(effectiveAmount)} FCFA</p>
              <p className="text-sm text-muted-foreground">Dette créée : {formatMoney(Math.max(0, effectiveAmount - effectivePaidAmount))} FCFA</p>
              {feedback ? <p className="mt-1 text-sm font-black text-emerald-700">{feedback}</p> : null}
            </div>
            <Button className="h-12" disabled={!canSubmit || saving} onClick={submitExpense}>
              {saving ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-black uppercase tracking-tight">Historique métier</h2>
        {safeExpenses.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
            Aucune donnée pour cette période
          </div>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {safeExpenses.map((expense) => (
              <article key={expense.id} className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-black">{formatMoney(expense.amount)} FCFA</p>
                    <p className="text-xs font-bold uppercase text-muted-foreground">
                      {formatExpenseType(expense.type)} · {formatPaymentStatus(expense.paymentStatus)}
                    </p>
                  </div>
                  <Banknote className="h-5 w-5 text-primary" />
                </div>
                {expense.supplierName ? (
                  <p className="mt-2 text-sm font-bold">Fournisseur : {expense.supplierName}</p>
                ) : null}
                {expense.paymentAccountName || expense.paymentAccountId ? (
                  <p className="mt-2 text-sm font-bold">
                    Source : {expense.paymentAccountName || getTreasuryAccountLabel(expense.paymentAccountId)}
                  </p>
                ) : null}
                {expense.note ? <p className="mt-2 rounded-lg bg-muted p-2 text-sm">{expense.note}</p> : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

function PaymentOption({ value, label }: { value: ExpensePaymentStatus; label: string }) {
  return (
    <Label className="flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 font-black">
      <RadioGroupItem value={value} />
      {label}
    </Label>
  )
}

function getValidSupplyLines(lines: SupplyLine[], inventoryItems: InventoryItem[]) {
  return lines
    .map((line) => {
      const item = inventoryItems.find((entry) => entry.id === line.inventoryItemId)
      return {
        inventoryItemId: line.inventoryItemId,
        inventoryItemName: item?.name || null,
        quantity: Number(line.quantity || 0),
        unitCost: Number(line.unitCost || 0),
      }
    })
    .filter((line) => line.inventoryItemId && Number.isFinite(line.quantity) && line.quantity > 0 && Number.isFinite(line.unitCost) && line.unitCost >= 0)
}

function getTimeMs(value: any) {
  return value?.toDate?.()?.getTime?.() || 0
}

function formatMoney(value: unknown) {
  const amount = Number(value || 0)
  if (!Number.isFinite(amount)) return "0"
  return Math.round(amount).toLocaleString("fr-FR")
}

function formatExpenseType(type: string) {
  if (type === "supply") return "Approvisionnement"
  if (type === "salary") return "Salaire"
  return "Dépense simple"
}

function formatPaymentStatus(status: string) {
  if (status === "paid") return "payé"
  if (status === "partial") return "partiel"
  return "non payé"
}
