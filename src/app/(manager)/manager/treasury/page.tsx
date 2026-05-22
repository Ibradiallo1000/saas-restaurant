"use client"

import * as React from "react"
import { collection } from "firebase/firestore"
import { Banknote, ReceiptText, Wallet } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { AdminRouteSkeleton } from "@/components/performance/route-skeletons"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { useRestaurant } from "@/design-system/context/RestaurantContext"
import { COLLECTION_NAMES } from "@/lib/constants"
import { getFinancialSummary } from "@/lib/finance/financial-summary"
import { cn } from "@/lib/utils"

export default function ManagerTreasuryPage() {
  const db = useFirestore()
  const { restaurantId } = useRestaurant()

  const cashMovementsQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.CASH_MOVEMENTS)
  }, [db, restaurantId])
  const { data: cashMovements, isLoading } = useCollection<any>(cashMovementsQuery)

  const paymentsQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.PAYMENTS)
  }, [db, restaurantId])
  const { data: payments, isLoading: isLoadingPayments } = useCollection<any>(paymentsQuery)

  const summary = React.useMemo(
    () => getFinancialSummary({ movements: cashMovements || [], payments: payments || [] }),
    [cashMovements, payments]
  )

  if (!restaurantId || isLoading || isLoadingPayments) {
    return <AdminRouteSkeleton />
  }

  return (
    <main className="space-y-4 pb-20 md:space-y-6 md:pb-6">
      <section className="rounded-xl border bg-card p-3 shadow-sm md:rounded-2xl md:p-4">
        <h1 className="text-2xl font-black uppercase tracking-tight text-primary md:text-3xl">
          Tresorerie
        </h1>
        <p className="text-sm text-muted-foreground">
          Lecture directe des paiements et mouvements de caisse.
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-3 md:gap-4">
        <TreasuryCard
          icon={Wallet}
          label="Solde actuel"
          value={summary.balance}
          priority
          danger={summary.balance < 0}
        />
        <TreasuryCard icon={ReceiptText} label="Entrees totales" value={summary.deposits} />
        <TreasuryCard icon={Banknote} label="Depenses totales" value={summary.expenses} danger={summary.expenses > 0} />
      </section>
    </main>
  )
}

function TreasuryCard({
  icon: Icon,
  label,
  value,
  priority,
  danger,
}: {
  icon: React.ElementType
  label: string
  value: number
  priority?: boolean
  danger?: boolean
}) {
  return (
    <Card className={cn(priority && "md:order-first", danger && "border-orange-300")}>
      <CardContent className={cn("p-4", priority && "md:p-5")}>
        <Icon className={cn("mb-3 h-5 w-5", danger ? "text-orange-600" : "text-primary")} />
        <p className="text-xs font-black uppercase text-muted-foreground">{label}</p>
        <p className={cn("mt-1 font-black", priority ? "text-4xl" : "text-2xl", danger ? "text-orange-600" : "text-foreground")}>
          {value.toLocaleString()} FCFA
        </p>
      </CardContent>
    </Card>
  )
}
