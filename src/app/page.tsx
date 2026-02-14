"use client"

import * as React from "react"
import { 
  TrendingUp, 
  Users, 
  ShoppingBag, 
  Clock, 
  ArrowUpRight, 
  ArrowDownRight,
  Sparkles,
  Utensils,
  ChevronRight
} from "lucide-react"
import { 
  Bar, 
  BarChart, 
  ResponsiveContainer, 
  XAxis, 
  YAxis, 
  Tooltip,
  Cell,
  LineChart,
  Line,
  CartesianGrid
} from "recharts"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

const salesData = [
  { name: "Mon", total: 1200 },
  { name: "Tue", total: 1500 },
  { name: "Wed", total: 1100 },
  { name: "Thu", total: 2400 },
  { name: "Fri", total: 3200 },
  { name: "Sat", total: 4100 },
  { name: "Sun", total: 3800 },
]

const recentOrders = [
  { id: "#4032", table: "12", customer: "John D.", status: "Preparing", total: "$42.50", time: "5m ago" },
  { id: "#4031", table: "04", customer: "Sarah M.", status: "Ready", total: "$18.00", time: "12m ago" },
  { id: "#4030", table: "Room 102", customer: "Guest", status: "Served", total: "$55.20", time: "25m ago" },
  { id: "#4029", table: "08", customer: "Mike R.", status: "Pending", total: "$32.10", time: "2m ago" },
]

export default function Dashboard() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Tableau de Bord</h1>
          <p className="text-muted-foreground">Bienvenue chez Le Bistro Paris. Voici vos performances d'aujourd'hui.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-secondary text-primary font-medium py-1 px-3 border-primary/20">
            <Clock className="mr-2 h-4 w-4" />
            LIVE: 14 clients en salle
          </Badge>
          <Button size="sm" className="bg-primary hover:bg-primary/90">
            <Sparkles className="mr-2 h-4 w-4" />
            Rapport IA
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Ventes Totales" 
          value="$12,842.50" 
          change="+12.5%" 
          trend="up" 
          icon={TrendingUp} 
        />
        <StatCard 
          title="Nouveaux Clients" 
          value="+42" 
          change="+18%" 
          trend="up" 
          icon={Users} 
        />
        <StatCard 
          title="Commandes" 
          value="156" 
          change="-2%" 
          trend="down" 
          icon={ShoppingBag} 
        />
        <StatCard 
          title="Temps Moyen Cuisine" 
          value="14 min" 
          change="-3m" 
          trend="up" 
          icon={Clock} 
          description="Efficacité accrue"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-7">
        <Card className="md:col-span-4 border-none shadow-md overflow-hidden bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-xl">Aperçu de la Semaine</CardTitle>
            <CardDescription>Analyse des revenus par jour</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                <XAxis 
                  dataKey="name" 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip 
                  cursor={{fill: 'hsl(var(--secondary)/0.5)'}}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    borderColor: 'hsl(var(--border))',
                    borderRadius: 'var(--radius)'
                  }}
                />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="md:col-span-3 border-none shadow-md bg-card/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xl">Commandes Récentes</CardTitle>
              <CardDescription>Dernières activités en temps réel</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="text-primary hover:bg-secondary">
              Voir tout <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {recentOrders.map((order) => (
                <div key={order.id} className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-primary">
                    <Utensils className="h-5 w-5" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-bold leading-none">{order.customer}</p>
                    <p className="text-xs text-muted-foreground">
                      Table {order.table} • {order.time}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{order.total}</p>
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-[10px] px-1.5 py-0 h-5 border-none",
                        order.status === "Ready" ? "bg-green-100 text-green-700" : 
                        order.status === "Preparing" ? "bg-blue-100 text-blue-700" :
                        "bg-yellow-100 text-yellow-700"
                      )}
                    >
                      {order.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatCard({ title, value, change, trend, icon: Icon, description }: any) {
  return (
    <Card className="border-none shadow-md hover:shadow-lg transition-shadow bg-card/50 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-primary">{value}</div>
        <div className="mt-1 flex items-center gap-1">
          {trend === "up" ? (
            <ArrowUpRight className="h-4 w-4 text-green-500" />
          ) : (
            <ArrowDownRight className="h-4 w-4 text-red-500" />
          )}
          <span className={cn("text-xs font-medium", trend === "up" ? "text-green-500" : "text-red-500")}>
            {change}
          </span>
          <span className="text-xs text-muted-foreground">vs hier</span>
        </div>
        {description && <p className="mt-2 text-[10px] text-primary italic font-medium">{description}</p>}
      </CardContent>
    </Card>
  )
}