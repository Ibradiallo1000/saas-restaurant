"use client"

import * as React from "react"
import { collection } from "firebase/firestore"
import { HandCoins, Plus, UserRound } from "lucide-react"

import { AdminRouteSkeleton } from "@/components/performance/route-skeletons"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { useRestaurant } from "@/design-system/context/RestaurantContext"
import { useTenant } from "@/design-system/context/TenantProvider"
import { COLLECTION_NAMES } from "@/lib/constants"
import { SupplyExpenseService } from "@/services/supply-expense.service"

type Supplier = {
  id: string
  name: string
  phone?: string | null
  balance?: number
}

export default function ManagerSuppliersPage() {
  const db = useFirestore()
  const { restaurantId } = useRestaurant()
  const { user } = useTenant()
  const [name, setName] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [payingSupplierId, setPayingSupplierId] = React.useState<string | null>(null)
  const [paymentAmount, setPaymentAmount] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  const suppliersQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.SUPPLIERS)
  }, [db, restaurantId])
  const { data: suppliers, isLoading } = useCollection<Supplier>(suppliersQuery)
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
        createdBy: user.uid,
      })
      setName("")
      setPhone("")
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
        createdBy: user.uid,
      })
      setPayingSupplierId(null)
      setPaymentAmount("")
    } finally {
      setSaving(false)
    }
  }

  if (!restaurantId || isLoading) return <AdminRouteSkeleton />

  return (
    <main className="space-y-5 pb-24 md:pb-6">
      <section className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-primary md:text-3xl">
              Fournisseurs
            </h1>
            <p className="text-sm text-muted-foreground">
              Dettes fournisseurs et paiements séparés des approvisionnements.
            </p>
          </div>
          <div className="rounded-full border bg-background px-3 py-1 text-xs font-black uppercase text-muted-foreground">
            Dette totale: {formatMoney(totalDebt)} FCFA
          </div>
        </div>
      </section>

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

              {isPaying ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                  <Input
                    type="number"
                    min={0}
                    max={balance}
                    value={paymentAmount}
                    onChange={(event) => setPaymentAmount(event.target.value)}
                    placeholder="Montant payé"
                  />
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

function formatMoney(value: unknown) {
  const amount = Number(value || 0)
  if (!Number.isFinite(amount)) return "0"
  return Math.round(amount).toLocaleString("fr-FR")
}
