"use client"

import * as React from "react"
import { useFirestore } from "@/firebase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, Clock, AlertTriangle, Wallet, LayoutDashboard, Calendar, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { AnalyticsService, DashboardStats } from "@/services/analytics.service"
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useRestaurant } from "@/design-system/context/RestaurantContext"

export default function DashboardPage() {
  const db = useFirestore()
  const { restaurantId, restaurant } = useRestaurant()

  const [mounted, setMounted] = React.useState(false)
  const [stats, setStats] = React.useState<DashboardStats | null>(null)
  const [chartData, setChartData] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => { setMounted(true) }, [])
// 🔹 ANALYTICS
  const analytics = React.useMemo(() => db ? new AnalyticsService(db) : null, [db])

  const loadData = React.useCallback(async () => {
    if (!analytics || !restaurantId) return
    setLoading(true)
    try {
      const [newStats, trend] = await Promise.all([
        analytics.getDashboardOverview(restaurantId),
        analytics.getSalesTrend(restaurantId)
      ])
      setStats(newStats)
      setChartData(trend)
    } catch (error) {
      console.error("Erreur chargement dashboard:", error)
      setStats(null)
      setChartData([])
    } finally {
      setLoading(false)
    }
  }, [analytics, restaurantId])

  React.useEffect(() => {
    if (mounted) loadData()
  }, [loadData, mounted])

  // ===============================
  // 🔥 FIX ABONNEMENT (IMPORTANT)
  // ===============================
  const trialDaysLeft = React.useMemo(() => {
    if (!mounted || !restaurant) return null

    // 👉 PAS CONFIGURÉ = MODE TEST
    if (!restaurant.subscriptionEndDate) return null

    const end = restaurant.subscriptionEndDate.toDate()
    const diff = Math.ceil(
      (end.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )

    return Math.max(0, diff)
  }, [restaurant, mounted])

  // 🔥 statut réel (pour futur blocage propre)
  const isExpired = React.useMemo(() => {
    if (!restaurant?.subscriptionEndDate) return false
    return restaurant.subscriptionEndDate.toDate() < new Date()
  }, [restaurant])

  if (loading || !mounted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-xs font-black uppercase tracking-widest animate-pulse">
          Initialisation Dashboard...
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-20">

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-black italic text-primary uppercase tracking-tighter flex items-center gap-3">
          <LayoutDashboard className="h-10 w-10" />
          {restaurant?.name || "Dashboard"}
        </h1>

        <Badge
          variant="outline"
          className={cn(
            "py-1 px-3 bg-primary/5",
            trialDaysLeft !== null && trialDaysLeft < 5 && "bg-destructive/10 text-destructive"
          )}
        >
          <Calendar className="mr-2 h-3 w-3" />

          {trialDaysLeft === null
            ? "Mode test"
            : `Expiration : ${trialDaysLeft} jours`}
        </Badge>
      </div>

      {/* STATS */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          icon={TrendingUp}
          title="CA Mensuel"
          value={`${stats?.sales.month.current || 0} ${restaurant?.currency || 'XOF'}`}
          trend={stats?.sales.month.percentageChange}
        />
        <StatCard
          icon={Wallet}
          title="Aujourd'hui"
          value={`${stats?.sales.today.current || 0} ${restaurant?.currency || 'XOF'}`}
          trend={stats?.sales.today.percentageChange}
        />
        <StatCard
          icon={Clock}
          title="Temps Cuisine"
          value={`${stats?.orders.avgPrepTime || 0} min`}
        />
        <StatCard
          icon={AlertTriangle}
          title="Alertes Stock"
          value={stats?.alerts.lowStockCount || 0}
          variant={stats?.alerts.lowStockCount ? "destructive" : "default"}
        />
      </div>

      {/* CHART */}
      <Card className="border-none shadow-xl overflow-hidden">
        <CardHeader className="bg-secondary/10">
          <CardTitle className="text-xl font-black italic uppercase">
            Tendance des Ventes
          </CardTitle>
        </CardHeader>

        <CardContent className="pt-6 h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
              <Area
                type="monotone"
                dataKey="total"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.1}
                strokeWidth={3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

    </div>
  )
}

function StatCard({ icon: Icon, title, value, trend, variant = "default" }: any) {
  return (
    <Card className={cn("border-none shadow-lg", variant === "destructive" ? "bg-destructive/5" : "bg-card/50")}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
          {title}
        </span>
        <Icon className={cn("h-4 w-4", variant === "destructive" ? "text-destructive" : "text-primary")} />
      </CardHeader>

      <CardContent>
        <div className={cn("text-2xl font-black italic tracking-tighter", variant === "destructive" ? "text-destructive" : "text-primary")}>
          {value}
        </div>

        {trend !== undefined && (
          <span className={cn("text-[10px] font-bold", trend >= 0 ? "text-green-500" : "text-red-500")}>
            {trend > 0 ? '+' : ''}{trend}% vs p.p
          </span>
        )}
      </CardContent>
    </Card>
  )
}
