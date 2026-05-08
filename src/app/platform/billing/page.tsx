"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy } from "firebase/firestore"
import { COLLECTION_NAMES } from "@/lib/constants"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CreditCard, TrendingUp, Calendar, AlertTriangle, Download, Package } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function BillingAdminPage() {
  const db = useFirestore()
  const router = useRouter()

  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  // 🔥 PLANS
  const plansQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, COLLECTION_NAMES.PLANS))
  }, [db])

  const { data: plans } = useCollection(plansQuery)

  // 🔥 SUBSCRIPTIONS
  const subsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(
      collection(db, COLLECTION_NAMES.SUBSCRIPTIONS),
      orderBy("endDate", "desc")
    )
  }, [db])

  const { data: subscriptions } = useCollection(subsQuery)

  // 🔥 RESTAURANTS
  const restQuery = useMemoFirebase(() => {
    return null
  }, [db])

  const { data: restaurants } = useCollection(restQuery)

  // 🔥 STATS
  const stats = React.useMemo(() => {
    if (!subscriptions || !plans || !mounted) {
      return { mrr: 0, alerts: 0, count: 0 }
    }

    const now = new Date()

    const active = subscriptions.filter(s => s.status === "active")

    const mrr = active.reduce((acc, sub) => {
      const plan = plans.find(p => p.id === sub.planId)
      return acc + (plan?.price || 0)
    }, 0)

    const alerts = active.filter(s => {
      const end = s.endDate?.toDate?.()
      if (!end) return false

      return end < new Date(now.getTime() + 7 * 86400000)
    }).length

    return { mrr, alerts, count: active.length }
  }, [subscriptions, plans, mounted])

  const formatDate = (timestamp: any) => {
    if (!timestamp || !mounted) return "N/A"
    return timestamp.toDate().toLocaleDateString()
  }

  return (
    <div className="space-y-8 pb-20">

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black italic uppercase text-primary">
            Contrôle Financier
          </h1>
          <p className="text-muted-foreground">
            Gestion des revenus récurrents
          </p>
        </div>

        <div className="flex gap-2">
          <Button onClick={() => router.push("/platform/plans")}>
            <Package className="mr-2 h-4 w-4" />
            Gérer les Plans
          </Button>

          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Rapport PDF
          </Button>
        </div>
      </div>

      {/* STATS */}
      <div className="grid gap-6 md:grid-cols-3">
        <PlatformStatCard
          icon={TrendingUp}
          title="MRR"
          value={`${stats.mrr.toLocaleString()} XOF`}
          description="Revenu mensuel"
        />

        <PlatformStatCard
          icon={AlertTriangle}
          title="Expirations"
          value={stats.alerts}
          description="Sous 7 jours"
          variant={stats.alerts > 0 ? "warning" : "default"}
        />

        <PlatformStatCard
          icon={CreditCard}
          title="Restaurants actifs"
          value={stats.count}
          description="Sous abonnement"
        />
      </div>

      {/* TABLE */}
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle>Journal abonnements</CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          <div className="divide-y">
            {mounted && subscriptions?.map(sub => {
              const restaurant = restaurants?.find(r => r.id === sub.restaurantId)
              const plan = plans?.find(p => p.id === sub.planId)

              const price = plan?.price || 0

              return (
                <div key={sub.id} className="p-4 flex justify-between">

                  <div>
                    <p className="font-bold">{restaurant?.name || "Inconnu"}</p>
                    <p className="text-xs text-muted-foreground">
                      {plan?.name || sub.planId}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-bold">
                      {price.toLocaleString()} {plan?.currency || "XOF"}
                    </p>

                    <p className="text-xs">
                      {formatDate(sub.endDate)}
                    </p>
                  </div>

                  <Badge>
                    {sub.status}
                  </Badge>

                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* PLANS */}
      <Card className="bg-primary text-white">
        <CardHeader>
          <CardTitle>Plans disponibles</CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          {plans?.map(plan => (
            <div key={plan.id} className="p-4 bg-white/10 rounded-xl">

              <div className="flex justify-between">
                <span>{plan.name}</span>
                <span>{plan.price} {plan.currency}</span>
              </div>

              {/* 🔥 FIX FEATURES */}
              <div className="text-xs opacity-80 mt-2">
                {Array.isArray(plan.features)
                  ? plan.features.join(" • ")
                  : "Aucune info"}
              </div>

            </div>
          ))}
        </CardContent>
      </Card>

    </div>
  )
}

function PlatformStatCard({ icon: Icon, title, value, description, variant = "default" }: any) {
  return (
    <Card className={cn(
      "shadow-lg",
      variant === "warning" && "bg-orange-50"
    )}>
      <CardHeader className="flex justify-between">
        <span className="text-xs">{title}</span>
        <Icon className="h-4 w-4" />
      </CardHeader>

      <CardContent>
        <div className="text-xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}
