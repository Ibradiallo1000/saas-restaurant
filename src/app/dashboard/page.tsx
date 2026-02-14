"use client"

import * as React from "react"
import { useFirestore, useUser, useDoc, useMemoFirebase } from "@/firebase"
import { doc } from "firebase/firestore"
import { COLLECTION_NAMES } from "@/lib/constants"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  TrendingUp, 
  Clock, 
  CreditCard, 
  AlertTriangle, 
  Trophy, 
  Wallet, 
  Download,
  Calendar,
  ChevronRight,
  Loader2,
  RefreshCcw,
  LayoutDashboard,
  BarChart3
} from "lucide-react"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AnalyticsService, DashboardStats } from "@/services/analytics.service"
import { 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  XAxis,
  YAxis
} from 'recharts';

export default function DashboardPage() {
  const { t } = useTranslation()
  const { user } = useUser()
  const db = useFirestore()
  const [stats, setStats] = React.useState<DashboardStats | null>(null)
  const [chartData, setChartData] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)

  const analytics = React.useMemo(() => db ? new AnalyticsService(db) : null, [db])

  const profileRef = useMemoFirebase(() => {
    if (!db || !user) return null
    return doc(db, COLLECTION_NAMES.USERS, user.uid)
  }, [db, user])
  const { data: profile } = useDoc(profileRef)

  const restaurantRef = useMemoFirebase(() => {
    if (!db || !profile?.restaurantId) return null
    return doc(db, COLLECTION_NAMES.RESTAURANTS, profile.restaurantId)
  }, [db, profile])
  const { data: restaurant } = useDoc(restaurantRef)

  const loadData = React.useCallback(async (isRefresh = false) => {
    if (!analytics || !profile?.restaurantId) return
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const [newStats, trend] = await Promise.all([
        analytics.getDashboardOverview(profile.restaurantId),
        analytics.getSalesTrend(profile.restaurantId)
      ])
      setStats(newStats)
      setChartData(trend)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [analytics, profile?.restaurantId])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  const trialDaysLeft = React.useMemo(() => {
    if (!restaurant?.trialEndDate) return 0
    const end = new Date(restaurant.trialEndDate)
    const now = new Date()
    return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
  }, [restaurant])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm font-bold animate-pulse uppercase tracking-widest text-muted-foreground text-center">Initialisation Console Maître...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black italic text-primary uppercase tracking-tighter flex items-center gap-3">
            <LayoutDashboard className="h-10 w-10" /> {restaurant?.name || "Dashboard"}
          </h1>
          <p className="text-muted-foreground font-medium">Contrôle financier et analytique en temps réel.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => loadData(true)} disabled={refreshing}>
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          </Button>
          <Badge variant="outline" className="bg-primary/5 border-primary/20 py-1 px-3">
            <Calendar className="mr-2 h-3 w-3" /> Essai: {trialDaysLeft} jours
          </Badge>
          <Button size="sm" className="bg-primary hover:bg-primary/90">
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          icon={TrendingUp} 
          title="CA Mensuel" 
          value={`${stats?.sales.month.current || 0} ${restaurant?.currency || ''}`} 
          description="Ventes encaissées"
          trend={stats?.sales.month.percentageChange}
        />
        <StatCard 
          icon={Wallet} 
          title="Ventes Aujourd'hui" 
          value={`${stats?.sales.today.current || 0} ${restaurant?.currency || ''}`} 
          description={`${stats?.orders.completedToday || 0} commandes`}
          trend={stats?.sales.today.percentageChange}
        />
        <StatCard 
          icon={Clock} 
          title="Temps Moyen Cuisine" 
          value={`${stats?.orders.avgPrepTime || 0} min`} 
          description="Préparation & Service"
        />
        <StatCard 
          icon={AlertTriangle} 
          title="Alertes Stock" 
          value={stats?.alerts.lowStockCount || 0} 
          description="Produits sous le seuil"
          variant={stats?.alerts.lowStockCount ? "destructive" : "default"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-none shadow-xl overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between bg-secondary/10">
            <div>
              <CardTitle className="text-xl font-black italic uppercase">Flux de Trésorerie</CardTitle>
              <CardDescription>Évolution des ventes sur les 7 derniers jours.</CardDescription>
            </div>
            <BarChart3 className="h-5 w-5 text-primary opacity-50" />
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700}} />
                  <Tooltip 
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                    itemStyle={{fontWeight: 800, color: 'hsl(var(--primary))'}}
                  />
                  <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-none shadow-xl overflow-hidden">
            <CardHeader className="bg-primary text-primary-foreground">
              <CardTitle className="text-lg font-black italic uppercase flex items-center justify-between">
                Ventilation Paiements
                <CreditCard className="h-5 w-5" />
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-xl">
                <span className="text-sm font-bold uppercase">Espèces (Cash)</span>
                <span className="text-lg font-black">{stats?.sales.breakdown.cash} {restaurant?.currency}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-primary/5 rounded-xl border border-primary/10">
                <span className="text-sm font-bold uppercase text-primary">Mobile Money</span>
                <span className="text-lg font-black text-primary">{stats?.sales.breakdown.mobileMoney} {restaurant?.currency}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl">
            <CardHeader>
              <CardTitle className="text-lg font-black italic uppercase flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" /> Top Ventes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground italic text-center py-4">Analyse des articles les plus populaires en cours...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, title, value, description, trend, variant = "default" }: any) {
  const isPositive = trend > 0;
  const isZero = trend === 0;

  return (
    <Card className={cn(
      "border-none shadow-lg transition-all hover:scale-[1.02]",
      variant === "destructive" ? "bg-destructive/5 ring-1 ring-destructive/20" : "bg-card/50 backdrop-blur-sm"
    )}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{title}</CardTitle>
        <Icon className={cn("h-4 w-4", variant === "destructive" ? "text-destructive" : "text-primary")} />
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-black italic tracking-tighter", variant === "destructive" ? "text-destructive" : "text-primary")}>
          {value}
        </div>
        <div className="flex items-center justify-between mt-1">
          <p className="text-[10px] font-medium text-muted-foreground">{description}</p>
          {trend !== undefined && (
            <span className={cn(
              "text-[9px] font-bold px-1.5 py-0.5 rounded-md",
              isZero ? "bg-muted text-muted-foreground" : isPositive ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
            )}>
              {isPositive ? '+' : ''}{trend}%
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}