"use client"

import * as React from "react"
import { collection } from "firebase/firestore"
import { HandCoins, Plus, UserRound } from "lucide-react"

import { AdminRouteSkeleton } from "@/components/performance/route-skeletons"
import { PageHeader } from "@/design-system/components"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { useRestaurant } from "@/design-system/context/RestaurantContext"
import { useTenant } from "@/design-system/context/TenantProvider"
import { COLLECTION_NAMES } from "@/lib/constants"
import { SupplyExpenseService } from "@/services/supply-expense.service"
import { getTreasuryAccountLabel, type TreasuryAccount } from "@/services/treasury.service"
import { useInventoryReferential } from "@/modules/stock/shared/use-inventory-referential"
import type { InventoryArticleV2 } from "@/modules/stock/shared/inventory-referential"

type Supplier = {
  id: string
  name: string
  phone?: string | null
  balance?: number
  articleIds?: string[]
}

export default function ManagerSuppliersPage() {
  const db = useFirestore()
  const { restaurantId } = useRestaurant()
  const { user } = useTenant()
  const [name, setName] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [payingSupplierId, setPayingSupplierId] = React.useState<string | null>(null)
  const [paymentAmount, setPaymentAmount] = React.useState("")
  const [paymentAccountId, setPaymentAccountId] = React.useState("cash")
  const [saving, setSaving] = React.useState(false)
  const [newArticleIds, setNewArticleIds] = React.useState<string[]>([])
  const [editingArticlesId, setEditingArticlesId] = React.useState<string | null>(null)
  const [editingArticleIds, setEditingArticleIds] = React.useState<string[]>([])

  const suppliersQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.SUPPLIERS)
  }, [db, restaurantId])
  const { data: suppliers, isLoading } = useCollection<Supplier>(suppliersQuery)
  const {
    activeArticles,
    isLoading: articlesLoading,
  } = useInventoryReferential(restaurantId)
  const treasuryAccountsQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.TREASURY_ACCOUNTS)
  }, [db, restaurantId])
  const { data: treasuryAccounts, isLoading: treasuryLoading } = useCollection<TreasuryAccount>(treasuryAccountsQuery)
  const activeTreasuryAccounts = (treasuryAccounts || []).filter((account) => account.active !== false)
  const service = React.useMemo(() => (db ? new SupplyExpenseService(db) : null), [db])
  const rows = React.useMemo(
    () => [...(suppliers || [])].sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0)),
    [suppliers]
  )
  const totalDebt = rows.reduce((sum, supplier) => sum + Number(supplier.balance || 0), 0)

  const createSupplier = async () => {
    if (!service || !restaurantId || !user || !name.trim() || saving) return
    setSaving(true)
    try {
      await service.createSupplier(restaurantId, {
        name,
        phone,
        articleIds: newArticleIds,
        createdBy: user.uid,
      })
      setName("")
      setPhone("")
      setNewArticleIds([])
    } finally {
      setSaving(false)
    }
  }

  const paySupplier = async (supplier: Supplier) => {
    if (!service || !restaurantId || !user || saving) return
    const amount = Number(paymentAmount || 0)
    if (!Number.isFinite(amount) || amount <= 0) return
    setSaving(true)
    try {
      await service.paySupplier(restaurantId, {
        supplierId: supplier.id,
        amount,
        paymentAccountId,
        createdBy: user.uid,
      })
      setPayingSupplierId(null)
      setPaymentAmount("")
    } finally {
      setSaving(false)
    }
  }

  const saveSupplierArticles = async (supplier: Supplier) => {
    if (!service || !restaurantId || !user || saving) return
    setSaving(true)
    try {
      await service.updateSupplierArticles(restaurantId, {
        supplierId: supplier.id,
        articleIds: editingArticleIds,
        updatedBy: user.uid,
      })
      setEditingArticlesId(null)
    } finally {
      setSaving(false)
    }
  }

  if (!restaurantId || isLoading || articlesLoading || treasuryLoading) return <AdminRouteSkeleton />

  return (
    <main className="space-y-5 pb-24 md:pb-6">
      <PageHeader
        title="Fournisseurs"
        subtitle="Dettes fournisseurs et paiements séparés des approvisionnements."
        action={
          <div className="rounded-full border bg-background px-3 py-1 text-xs font-black uppercase text-muted-foreground">
            Dette totale: {formatMoney(totalDebt)} FCFA
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Plus className="h-5 w-5 text-primary" />
            Nouveau fournisseur
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr_180px_auto] md:items-end">
          <div className="space-y-2">
            <Label>Nom</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex: Marché central" />
          </div>
          <div className="space-y-2">
            <Label>Téléphone</Label>
            <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Optionnel" />
          </div>
          <Button className="h-11" disabled={saving || !name.trim()} onClick={createSupplier}>
            Créer
          </Button>
          <div className="md:col-span-3">
            <Label>Articles fournis (optionnel)</Label>
            <ArticleCheckboxes
              articles={activeArticles}
              value={newArticleIds}
              onChange={setNewArticleIds}
            />
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-3 xl:grid-cols-2">
        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground xl:col-span-2">
            Aucun fournisseur.
          </div>
        ) : rows.map((supplier) => {
          const balance = Number(supplier.balance || 0)
          const isPaying = payingSupplierId === supplier.id
          return (
            <article key={supplier.id} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <UserRound className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-black">{supplier.name}</h2>
                  </div>
                  {supplier.phone ? <p className="mt-1 text-sm text-muted-foreground">{supplier.phone}</p> : null}
                </div>
                <div className="text-right">
                  <p className="text-xs font-black uppercase text-muted-foreground">Dette</p>
                  <p className="text-xl font-black text-[var(--brand-primary)]">{formatMoney(balance)} FCFA</p>
                </div>
              </div>

              <div className="mt-4 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-black uppercase text-muted-foreground">Articles fournis</p>
                    <p className="text-sm">
                      {(supplier.articleIds || []).length
                        ? activeArticles.filter((article) => supplier.articleIds?.includes(article.id)).map((article) => article.name).join(", ")
                        : "Aucune association"}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingArticlesId(supplier.id)
                      setEditingArticleIds(supplier.articleIds || [])
                    }}
                  >
                    Modifier
                  </Button>
                </div>
                {editingArticlesId === supplier.id ? (
                  <div className="mt-3 space-y-3">
                    <ArticleCheckboxes articles={activeArticles} value={editingArticleIds} onChange={setEditingArticleIds} />
                    <div className="flex gap-2">
                      <Button size="sm" disabled={saving} onClick={() => void saveSupplierArticles(supplier)}>Enregistrer</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingArticlesId(null)}>Annuler</Button>
                    </div>
                  </div>
                ) : null}
              </div>

              {isPaying ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
                  <Input
                    type="number"
                    min={0}
                    max={balance}
                    value={paymentAmount}
                    onChange={(event) => setPaymentAmount(event.target.value)}
                    placeholder="Montant payé"
                  />
                  <select
                    className="h-10 rounded-md border bg-background px-3 text-sm"
                    value={paymentAccountId}
                    onChange={(event) => setPaymentAccountId(event.target.value)}
                  >
                    {activeTreasuryAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name || getTreasuryAccountLabel(account.id)} · {formatMoney(account.balance)} FCFA
                      </option>
                    ))}
                  </select>
                  <Button disabled={saving || Number(paymentAmount || 0) <= 0} onClick={() => paySupplier(supplier)}>
                    Valider
                  </Button>
                  <Button variant="outline" onClick={() => setPayingSupplierId(null)}>
                    Annuler
                  </Button>
                </div>
              ) : (
                <Button
                  className="mt-4"
                  variant="outline"
                  disabled={balance <= 0}
                  onClick={() => {
                    setPayingSupplierId(supplier.id)
                    setPaymentAmount(String(balance))
                  }}
                >
                  <HandCoins className="mr-2 h-4 w-4" />
                  Payer
                </Button>
              )}
            </article>
          )
        })}
      </section>
    </main>
  )
}

function ArticleCheckboxes({
  articles,
  value,
  onChange,
}: {
  articles: InventoryArticleV2[]
  value: string[]
  onChange: (value: string[]) => void
}) {
  if (articles.length === 0) {
    return <p className="mt-2 text-sm text-muted-foreground">Créez d’abord un article d’inventaire.</p>
  }
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {articles.map((article) => (
        <Label key={article.id} className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2">
          <input
            type="checkbox"
            checked={value.includes(article.id)}
            onChange={(event) =>
              onChange(event.target.checked ? [...value, article.id] : value.filter((id) => id !== article.id))
            }
          />
          {article.name}
        </Label>
      ))}
    </div>
  )
}

function formatMoney(value: unknown) {
  const amount = Number(value || 0)
  if (!Number.isFinite(amount)) return "0"
  return Math.round(amount).toLocaleString("fr-FR")
}
