"use client"

import * as React from "react"
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection } from "@/firebase"
import { collection, query, where, doc, addDoc, serverTimestamp } from "firebase/firestore"
import { COLLECTION_NAMES, PAYMENT_STATUS, ORDER_STATUS } from "@/lib/constants"
import { 
  Search, 
  CreditCard, 
  Banknote, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  Zap, 
  Table as TableIcon, 
  Loader2 
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { OrderService } from "@/services/order.service"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

export default function POSPage() {
  const { user } = useUser()
  const db = useFirestore()
  const { toast } = useToast()
  
  const [searchTerm, setSearchTerm] = React.useState("")
  const [cart, setCart] = React.useState<any[]>([])
  const [tableId, setTableId] = React.useState("")
  const [processing, setProcessing] = React.useState(false)

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null
    return doc(db, COLLECTION_NAMES.USERS, user.uid)
  }, [db, user])
  const { data: profile } = useDoc(userProfileRef)

  const productsQuery = useMemoFirebase(() => {
    if (!db || !profile?.restaurantId) return null
    return query(collection(db, COLLECTION_NAMES.PRODUCTS), where("restaurantId", "==", profile.restaurantId))
  }, [db, profile])
  const { data: products } = useCollection(productsQuery)

  const addToCart = (product: any) => {
    const existing = cart.find(item => item.id === product.id)
    if (existing) {
      setCart(cart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item))
    } else {
      setCart([...cart, { ...product, quantity: 1 }])
    }
  }

  const removeFromCart = (productId: string) => {
    const existing = cart.find(item => item.id === productId)
    if (existing?.quantity === 1) {
      setCart(cart.filter(item => item.id !== productId))
    } else {
      setCart(cart.map(item => item.id === productId ? { ...item, quantity: item.quantity - 1 } : item))
    }
  }

  const total = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0)

  const handleCheckout = async (method: string) => {
    if (!db || !profile?.restaurantId || cart.length === 0) return
    setProcessing(true)
    
    const orderService = new OrderService(db)
    try {
      const orderId = await orderService.createOrder({
        restaurantId: profile.restaurantId,
        type: tableId ? 'table' : 'takeaway',
        tableId: tableId || null,
        items: cart.map(item => ({
          productId: item.id,
          nameSnapshot: item.name,
          priceSnapshot: item.price,
          quantity: item.quantity
        }))
      })

      if (method === 'cash' || method === 'mobile_money') {
        await orderService.processPayment(orderId, profile.restaurantId, method)
      }

      setCart([])
      setTableId("")
      toast({ title: "Vente validée", description: `Encaissement ${method.toUpperCase()} terminé.` })
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de finaliser la vente." })
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="grid lg:grid-cols-3 gap-6 h-[calc(100vh-120px)] animate-in fade-in duration-500">
      {/* Product Selection */}
      <div className="lg:col-span-2 flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Rechercher un produit..." 
              className="pl-10 h-12 bg-card/50 border-none shadow-sm rounded-xl"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 bg-secondary/30 p-1 rounded-xl">
             <Badge variant="outline" className="px-3 py-1 font-bold">Menu Digital</Badge>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 pb-4">
            {products?.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).map((product) => (
              <button 
                key={product.id}
                onClick={() => addToCart(product)}
                className="flex flex-col text-left bg-card hover:ring-2 ring-primary/50 transition-all rounded-2xl shadow-sm overflow-hidden active:scale-95 group"
              >
                <div className="aspect-square relative bg-muted">
                   {/* eslint-disable-next-line @next/next/no-img-element */}
                   <img src={product.imageUrl || `https://picsum.photos/seed/${product.id}/200/200`} alt={product.name} className="object-cover w-full h-full" />
                   <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                   <div className="absolute bottom-2 right-2 h-8 w-8 bg-primary rounded-full flex items-center justify-center text-white shadow-lg scale-0 group-hover:scale-100 transition-transform">
                     <Plus className="h-5 w-5" />
                   </div>
                </div>
                <div className="p-3 space-y-1">
                  <p className="text-xs font-bold truncate">{product.name}</p>
                  <p className="text-sm font-black italic text-primary">{product.price}€</p>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Cart & Checkout */}
      <Card className="flex flex-col border-none shadow-2xl rounded-3xl overflow-hidden bg-card/80 backdrop-blur-md">
        <CardHeader className="bg-primary text-primary-foreground p-6">
          <CardTitle className="flex items-center gap-2 italic uppercase">
            <ShoppingCart className="h-5 w-5" /> Panier Actuel
          </CardTitle>
          <CardDescription className="text-white/80">Session: {profile?.email}</CardDescription>
        </CardHeader>
        
        <CardContent className="flex-1 p-0 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-primary/5">
             <div className="relative">
               <TableIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
               <Input 
                 placeholder="Numéro de Table (Optionnel)" 
                 className="pl-10 h-10 bg-secondary/30 border-none rounded-xl"
                 value={tableId}
                 onChange={(e) => setTableId(e.target.value)}
               />
             </div>
          </div>

          <ScrollArea className="flex-1 px-4">
            <div className="space-y-4 py-4">
              {cart.map((item) => (
                <div key={item.id} className="flex items-center justify-between group animate-in slide-in-from-right-2">
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold truncate max-w-[150px]">{item.name}</p>
                    <p className="text-[10px] text-muted-foreground font-black italic">{item.price}€ x {item.quantity}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full bg-secondary/50" onClick={() => removeFromCart(item.id)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="text-xs font-black w-4 text-center">{item.quantity}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full bg-primary/10 text-primary" onClick={() => addToCart(item)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
              {cart.length === 0 && (
                <div className="py-20 text-center space-y-2 opacity-30">
                  <Zap className="h-10 w-10 mx-auto" />
                  <p className="text-xs font-bold uppercase tracking-tighter italic">Panier Vide</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>

        <CardFooter className="p-6 bg-secondary/30 flex flex-col gap-4">
          <div className="flex justify-between items-center w-full">
            <span className="text-xs font-black uppercase text-muted-foreground italic">Total à payer</span>
            <span className="text-3xl font-black italic text-primary tracking-tighter">{total}€</span>
          </div>
          
          <div className="grid grid-cols-2 gap-3 w-full">
            <Button 
              className="h-14 font-black uppercase italic bg-green-600 hover:bg-green-700 shadow-lg"
              disabled={cart.length === 0 || processing}
              onClick={() => handleCheckout('cash')}
            >
              {processing ? <Loader2 className="animate-spin" /> : <><Banknote className="mr-2 h-5 w-5" /> Cash</>}
            </Button>
            <Button 
              variant="outline" 
              className="h-14 font-black uppercase italic border-2 border-primary/20 text-primary"
              disabled={cart.length === 0 || processing}
              onClick={() => handleCheckout('mobile_money')}
            >
              <CreditCard className="mr-2 h-5 w-5" /> Mobile
            </Button>
          </div>
          <Button 
            variant="ghost" 
            className="w-full text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-destructive"
            onClick={() => setCart([])}
            disabled={cart.length === 0}
          >
            <Trash2 className="mr-2 h-3 w-3" /> Annuler la vente
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
