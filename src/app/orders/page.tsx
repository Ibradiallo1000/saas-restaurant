
"use client"

import * as React from "react"
import { ClipboardList, CheckCircle2, Clock, MapPin, MoreVertical, Search, Utensils } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

const INITIAL_ORDERS = [
  { id: "#4032", type: "Table 12", status: "Preparing", items: ["Burger Deluxe x2", "Frites Maison x1", "Coca Zero x2"], total: "$42.50", time: "5m ago", color: "bg-blue-100 text-blue-700" },
  { id: "#4031", type: "Table 04", status: "Ready", items: ["Salade César x1", "Vin Blanc x1"], total: "$18.00", time: "12m ago", color: "bg-green-100 text-green-700" },
  { id: "#4033", type: "Takeaway", status: "Pending", items: ["Pizza Regina x1"], total: "$12.50", time: "1m ago", color: "bg-yellow-100 text-yellow-700" },
  { id: "#4030", type: "Room 102", status: "Served", items: ["Petit Déj Continental x2", "Café x2"], total: "$55.20", time: "25m ago", color: "bg-gray-100 text-gray-700" },
]

export default function OrdersPage() {
  const [activeTab, setActiveTab] = React.useState("all")

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Commandes en Direct</h1>
          <p className="text-muted-foreground">Gérez les flux cuisine et salle en temps réel.</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher une table, un client..." className="pl-10" />
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full" onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList className="bg-secondary/50 p-1">
            <TabsTrigger value="all">Toutes (8)</TabsTrigger>
            <TabsTrigger value="pending">En Attente (2)</TabsTrigger>
            <TabsTrigger value="preparing">En Cuisine (3)</TabsTrigger>
            <TabsTrigger value="ready">Prêtes (3)</TabsTrigger>
          </TabsList>
          <div className="hidden md:flex items-center gap-2">
            <Badge variant="outline" className="h-8 bg-primary/5 border-primary/20 text-primary">
              <Clock className="mr-2 h-3 w-3" /> Délai moy: 12min
            </Badge>
          </div>
        </div>

        <TabsContent value="all" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {INITIAL_ORDERS.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
            <button className="h-full min-h-[250px] flex flex-col items-center justify-center border-2 border-dashed border-muted rounded-xl hover:bg-muted/30 transition-colors">
              <ClipboardList className="h-10 w-10 text-muted-foreground mb-2" />
              <p className="text-sm font-medium text-muted-foreground">Historique complet</p>
            </button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function OrderCard({ order }: { order: any }) {
  return (
    <Card className="border-none shadow-md hover:shadow-lg transition-all group overflow-hidden bg-card/70 backdrop-blur-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Utensils className="h-4 w-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-sm font-bold">{order.type}</CardTitle>
            <span className="text-[10px] text-muted-foreground">{order.id} • {order.time}</span>
          </div>
        </div>
        <Badge className={cn("text-[10px] font-bold border-none h-6 px-2", order.color)}>
          {order.status.toUpperCase()}
        </Badge>
      </CardHeader>
      <CardContent className="p-4 pt-4">
        <div className="space-y-2 min-h-[100px]">
          {order.items.map((item: string, i: number) => (
            <div key={i} className="flex justify-between text-xs font-medium">
              <span className="text-muted-foreground">{item}</span>
              <span className="h-4 w-4 bg-secondary rounded flex items-center justify-center text-[10px] text-primary">✓</span>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t flex items-center justify-between">
          <span className="text-lg font-black text-primary">{order.total}</span>
          <div className="flex gap-2">
            <Button size="icon" variant="outline" className="h-8 w-8 rounded-full">
              <MoreVertical className="h-4 w-4" />
            </Button>
            <Button size="sm" className="bg-primary hover:bg-primary/90 rounded-lg h-8 px-4">
              <CheckCircle2 className="mr-2 h-4 w-4" /> Servir
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
