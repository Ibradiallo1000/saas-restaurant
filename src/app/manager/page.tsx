"use client"

import * as React from "react"
import { useFirestore, useUser, useCollection, useDoc, useMemoFirebase } from "@/firebase"
import { collection, query, where, doc, updateDoc, serverTimestamp } from "firebase/firestore"
import { COLLECTION_NAMES, ROLES } from "@/lib/constants"
import { Store, Plus, Search, MoreVertical, Edit2, Trash2, LayoutGrid, List } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"

export default function ManagerDashboard() {
  const { user } = useUser()
  const db = useFirestore()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = React.useState("")

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null
    return doc(db, COLLECTION_NAMES.USERS, user.uid)
  }, [db, user])
  const { data: profile } = useDoc(userProfileRef)

  const productsQuery = useMemoFirebase(() => {
    if (!db || !profile?.restaurantId) return null
    return query(collection(db, COLLECTION_NAMES.PRODUCTS), where("restaurantId", "==", profile.restaurantId))
  }, [db, profile])
  const { data: products, isLoading } = useCollection(productsQuery)

  const categoriesQuery = useMemoFirebase(() => {
    if (!db || !profile?.restaurantId) return null
    return query(collection(db, "categories"), where("restaurantId", "==", profile.restaurantId))
  }, [db, profile])
  const { data: categories } = useCollection(categoriesQuery)

  if (isLoading) return <div className="p-20 text-center animate-pulse">Chargement du menu...</div>

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black italic uppercase tracking-tighter text-primary flex items-center gap-3">
            <Store className="h-10 w-10" /> Gestion du Menu
          </h1>
          <p className="text-muted-foreground font-medium">Configurez votre catalogue et vos catégories.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="font-bold uppercase text-xs">
            <LayoutGrid className="mr-2 h-4 w-4" /> Catégories
          </Button>
          <Button className="font-black uppercase italic shadow-lg">
            <Plus className="mr-2 h-4 w-4" /> Ajouter un Produit
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Rechercher un plat ou une boisson..." 
            className="pl-10 h-12 bg-card/50 border-none shadow-sm rounded-xl"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Tabs defaultValue="all" className="w-auto">
          <TabsList className="bg-secondary/30 h-12 rounded-xl">
            <TabsTrigger value="all" className="rounded-lg font-bold">Tous</TabsTrigger>
            {categories?.map(cat => (
              <TabsTrigger key={cat.id} value={cat.id} className="rounded-lg font-bold">{cat.name}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {products?.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).map((product) => (
          <Card key={product.id} className="border-none shadow-xl overflow-hidden group hover:ring-2 ring-primary/20 transition-all bg-card/50 backdrop-blur-md">
            <div className="aspect-video relative bg-muted overflow-hidden">
               {/* eslint-disable-next-line @next/next/no-img-element */}
               <img src={product.imageUrl || `https://picsum.photos/seed/${product.id}/400/225`} alt={product.name} className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-500" />
               <div className="absolute top-2 right-2">
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full bg-white/80 backdrop-blur-sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl">
                      <DropdownMenuItem className="font-bold"><Edit2 className="mr-2 h-4 w-4" /> Modifier</DropdownMenuItem>
                      <DropdownMenuItem className="font-bold text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Supprimer</DropdownMenuItem>
                    </DropdownMenuContent>
                 </DropdownMenu>
               </div>
               {product.isDailySpecial && <Badge className="absolute top-2 left-2 bg-primary font-black uppercase italic text-[8px]">Plat du Jour</Badge>}
            </div>
            <CardHeader className="p-4">
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg font-bold leading-tight">{product.name}</CardTitle>
                <span className="font-black italic text-primary">{product.price}€</span>
              </div>
              <CardDescription className="line-clamp-2 text-xs mt-1">{product.description}</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="text-[9px] font-black uppercase tracking-widest">{product.category}</Badge>
                <div className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">En Stock</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {products?.length === 0 && (
          <div className="col-span-full py-20 text-center space-y-4 border-2 border-dashed rounded-3xl bg-muted/20">
            <Store className="h-12 w-12 text-muted-foreground mx-auto opacity-20" />
            <div className="space-y-1">
              <p className="font-black italic uppercase text-lg">Votre menu est vide</p>
              <p className="text-muted-foreground text-sm">Commencez par ajouter votre premier produit pour digitaliser votre carte.</p>
            </div>
            <Button className="font-black uppercase italic mt-4">Ajouter mon premier plat</Button>
          </div>
        )}
      </div>
    </div>
  )
}
