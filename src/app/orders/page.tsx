
"use client"

import * as React from "react"
import { useFirestore, useUser, useCollection, useDoc } from "@/firebase"
import { collection, query, where, orderBy, doc } from "firebase/firestore"
import { COLLECTION_NAMES, ORDER_STATUS } from "@/lib/constants"
import { 
  ClipboardList, 
  CheckCircle2, 
  Clock, 
  Search, 
  Utensils, 
  Bell, 
  ArrowRight,
  Loader2
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { OrderService } from "@/services/order.service"

export default function OrdersPage() {
  const { toast } = useToast()
  const { user } = useUser()
  const db = useFirestore()
  const [searchTerm, setSearchTerm] = React.useState("")
  const [mounted, setMounted] = React.useState(false)
  const audioRef = React.useRef<HTMLAudioElement | null>(null)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Get User Profile to get restaurantId
  const userProfileRef = React.useMemo(() => {
    if (!db || !user) return null
    return doc(db, COLLECTION_NAMES.USERS, user.uid)
  }, [db, user])
  const { data: profile } = useDoc(userProfileRef)

  // Memoized Query for orders
  const ordersQuery = React.useMemo(() => {
    if (!db || !profile?.restaurantId) return null
    const q = query(
      collection(db, COLLECTION_NAMES.ORDERS),
      where("restaurantId", "==", profile.restaurantId),
      orderBy("createdAt", "desc")
    )
    return Object.assign(q, { __memo: true })
  }, [db, profile])

  const { data: orders, isLoading } = useCollection(ordersQuery)

  // Sound notification effect
  React.useEffect(() => {
    if (orders && orders.length > 0 && mounted) {
      const latestOrder = orders[0]
      const isNew = latestOrder.status === ORDER_STATUS.PENDING
      if (isNew) {
        const createdAt = latestOrder.createdAt?.toDate?.() || new Date()
        const now = new Date()
        if (now.getTime() - createdAt.getTime() < 60000) {
          audioRef.current?.play().catch(() => {})
          toast({
            title: "Nouvelle Commande !",
            description: `${latestOrder.customerName} - ${latestOrder.totalAmount}€`,
            action: <Bell className="h-4 w-4 text-primary animate-bounce" />
          })
        }
      }
    }
  }, [orders, toast, mounted])

  const filteredOrders = React.useMemo(() => {
    if (!orders) return []
    return orders.filter(o => 
      o.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.id.includes(searchTerm)
    )
  }, [orders, searchTerm])

  if (isLoading || !mounted) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-10">
      <audio ref={audioRef} src="/notifications/new-order.mp3" preload="auto" />
      
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black italic text-primary font-headline uppercase tracking-tighter">
            Live Feed <span className="text-muted-foreground opacity-50 font-normal">Commandes</span>
          </h1>
          <p className="text-muted-foreground">Gestion temps réel de votre établissement.</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Rechercher..." 
            className="pl-10 bg-card/50 border-none shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="bg-secondary/30 p-1 rounded-xl">
          <TabsTrigger value="all" className="rounded-lg">Toutes</TabsTrigger>
          <TabsTrigger value="pending" className="rounded-lg">En Attente</TabsTrigger>
          <TabsTrigger value="preparing" className="rounded-lg">En Cuisine</TabsTrigger>
          <TabsTrigger value="ready" className="rounded-lg">Prêtes</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredOrders.map((order) => (
              <OrderCard key={order.id} order={order} db={db!} />
            ))}
            {filteredOrders.length === 0 && (
              <div className="col-span-full h-[200px] flex flex-col items-center justify-center border-2 border-dashed border-muted rounded-xl bg-card/20">
                <ClipboardList className="h-10 w-10 text-muted-foreground opacity-20 mb-2" />
                <p className="text-sm font-medium text-muted-foreground">Aucune commande trouvée</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function OrderCard({ order, db }: { order: any, db: any }) {
  const orderService = new OrderService(db)
  const [updating, setUpdating] = React.useState(false)
  const [formattedTime, setFormattedTime] = React.useState("")

  React.useEffect(() => {
    if (order.createdAt) {
      setFormattedTime(new Date(order.createdAt.toDate()).toLocaleTimeString())
    }
  }, [order.createdAt])

  const handleStatusUpdate = async (newStatus: string) => {
    setUpdating(true)
    try {
      await orderService.updateOrderStatus(order.id, newStatus)
    } finally {
      setUpdating(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case ORDER_STATUS.PENDING: return "bg-yellow-500/10 text-yellow-600 border-yellow-200"
      case ORDER_STATUS.PREPARING: return "bg-blue-500/10 text-blue-600 border-blue-200"
      case ORDER_STATUS.READY: return "bg-green-500/10 text-green-600 border-green-200"
      default: return "bg-secondary text-muted-foreground"
    }
  }

  return (
    <Card className="border-none shadow-lg hover:shadow-xl transition-all group overflow-hidden bg-card/80 backdrop-blur-md relative">
      {order.status === ORDER_STATUS.PENDING && (
        <div className="absolute top-0 right-0 p-2">
          <span className="flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
        </div>
      )}
      
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Utensils className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold truncate max-w-[120px]">
                {order.type === 'table' ? `Table ${order.tableId}` : order.type.toUpperCase()}
              </CardTitle>
              <span className="text-[10px] text-muted-foreground font-medium uppercase">#{order.id.slice(-4)}</span>
            </div>
          </div>
          <Badge variant="outline" className={cn("text-[9px] font-black tracking-widest", getStatusColor(order.status))}>
            {order.status.toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="p-4 pt-2">
        <div className="space-y-2 min-h-[80px]">
          <p className="text-xs font-bold text-muted-foreground mb-1 italic">Client: {order.customerName}</p>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-3">
            <Clock className="h-3 w-3" />
            {formattedTime}
          </div>
        </div>
        
        <div className="mt-4 pt-4 border-t border-primary/5 flex items-center justify-between">
          <span className="text-xl font-black text-primary italic">{order.totalAmount}€</span>
          <div className="flex gap-2">
            {order.status === ORDER_STATUS.PENDING && (
              <Button 
                size="sm" 
                className="bg-primary hover:bg-primary/90 h-8 font-bold"
                onClick={() => handleStatusUpdate(ORDER_STATUS.PREPARING)}
                disabled={updating}
              >
                Cuisine <ArrowRight className="ml-2 h-3 w-3" />
              </Button>
            )}
            {order.status === ORDER_STATUS.PREPARING && (
              <Button 
                size="sm" 
                variant="secondary"
                className="h-8 font-bold"
                onClick={() => handleStatusUpdate(ORDER_STATUS.READY)}
                disabled={updating}
              >
                Prêt <CheckCircle2 className="ml-2 h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
