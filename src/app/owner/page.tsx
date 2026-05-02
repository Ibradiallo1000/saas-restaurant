"use client"

import * as React from "react"
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Calendar,
  Activity,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CurrentUserProvider } from "@/contexts/current-user-context"
import { useCurrentUser } from "@/hooks/use-current-user"
import { useOrders } from "@/hooks/useOrders"

// 🔥 IMPORT TYPE
import type { Order } from "@/types/index"

export default function OwnerPage() {
  return (
    <CurrentUserProvider>
      <OwnerPageContent />
    </CurrentUserProvider>
  )
}

function OwnerPageContent() {
  const { companyId } = useCurrentUser()
  const orders = useOrders(companyId ?? undefined)

  if (!companyId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div>
          <BarChart3 className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Aucun restaurant</h1>
          <p className="mt-2 text-muted-foreground">
            Vous devez d’abord créer un restaurant.
          </p>

          <button
            onClick={() => (window.location.href = "/create-restaurant")}
            className="mt-4 bg-black text-white px-4 py-2 rounded"
          >
            Créer un restaurant
          </button>
        </div>
      </div>
    )
  }

  const analytics = computeAnalytics(orders)

  return (
    <main className="min-h-screen space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Analytics CEO
        </h1>
        <p className="text-sm text-muted-foreground">
          Vue d'ensemble de l'activité
        </p>
      </div>

      {/* METRICS */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total commandes"
          value={analytics.totalOrders}
          icon={Activity}
        />
        <MetricCard
          title="Revenu total"
          value={`${analytics.totalRevenue.toLocaleString()} FCFA`}
          icon={DollarSign}
        />
        <MetricCard
          title="Panier moyen"
          value={`${analytics.averageOrder.toLocaleString()} FCFA`}
          icon={TrendingUp}
        />
        <MetricCard
          title="Ce mois"
          value={`${analytics.thisMonthRevenue.toLocaleString()} FCFA`}
          icon={Calendar}
        />
      </div>

      {/* CHART + TOP */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Évolution sur 7 jours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.last7Days.map((day) => (
                <div key={day.date} className="flex items-center gap-3">
                  <span className="w-24 text-xs text-muted-foreground">
                    {day.label}
                  </span>

                  <div className="flex-1 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{
                        width: `${Math.min(
                          100,
                          (day.count / Math.max(1, analytics.maxDayCount)) * 100
                        )}%`,
                      }}
                    />
                  </div>

                  <span className="w-8 text-right text-xs font-medium">
                    {day.count}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Top produits
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-2">
            {analytics.topProducts.slice(0, 5).map((product, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <span className="text-sm font-medium">
                  {product.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {product.count} vendus
                </span>
              </div>
            ))}

            {analytics.topProducts.length === 0 && (
              <div className="text-sm text-muted-foreground">
                Pas assez de données
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

//
// 🔥 COMPONENT METRIC
//
function MetricCard({
  title,
  value,
  icon: Icon,
}: {
  title: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>

      <CardContent>
        <div className="text-2xl font-bold">
          {value}
        </div>
      </CardContent>
    </Card>
  )
}

//
// 🔥 ANALYTICS ENGINE (FIX TIMESTAMP)
//
function computeAnalytics(orders: Order[]) {
  const validOrders = orders

  const totalOrders = validOrders.length

  const totalRevenue = validOrders.reduce((sum, o) => sum + o.total, 0)

  const averageOrder =
    totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const thisMonthRevenue = validOrders
    .filter((o) => {
      const date = o.createdAt?.toDate?.()
      return date && date >= startOfMonth
    })
    .reduce((sum, o) => sum + o.total, 0)

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    d.setHours(0, 0, 0, 0)

    const nextDay = new Date(d)
    nextDay.setDate(nextDay.getDate() + 1)

    const count = validOrders.filter((o) => {
      const date = o.createdAt?.toDate?.()
      return date && date >= d && date < nextDay
    }).length

    return {
      date: d.toISOString(),
      label: d.toLocaleDateString("fr-FR", {
        weekday: "short",
        day: "numeric",
      }),
      count,
    }
  })

  const maxDayCount = Math.max(1, ...last7Days.map((d) => d.count))

  const productMap = new Map<string, number>()

  validOrders.forEach((order) => {
    order.items.forEach((item) => {
      productMap.set(
        item.name,
        (productMap.get(item.name) || 0) + item.quantity
      )
    })
  })

  const topProducts = Array.from(productMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  return {
    totalOrders,
    totalRevenue,
    averageOrder,
    thisMonthRevenue,
    last7Days,
    maxDayCount,
    topProducts,
  }
}
