"use client"

import * as React from "react"
import { useFirestore, useUser, useCollection, useDoc, useMemoFirebase } from "@/firebase"
import { collection, query, where, doc, updateDoc, serverTimestamp, increment } from "firebase/firestore"
import { COLLECTION_NAMES } from "@/lib/constants"
import { AlertCircle, ArrowUpDown, Box, Filter, Plus, Search, Loader2, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"

export default function InventoryPage() {
  const { user } = useUser()
  const db = useFirestore()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = React.useState("")
  const [restockAmount, setRestockAmount] = React.useState<number>(0)
  const [loading, setLoading] = React.useState(false)

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null
    return doc(db, COLLECTION_NAMES.USERS, user.uid)
  }, [db, user])
  const { data: profile } = useDoc(userProfileRef)

  const inventoryQuery = useMemoFirebase(() => {
    if (!db || !profile?.restaurantId) return null
    return query(collection(db, COLLECTION_NAMES.RESTAURANTS, profile.restaurantId, COLLECTION_NAMES.INVENTORY))
  }, [db, profile])
  const { data: inventory, isLoading } = useCollection(inventoryQuery)

  const filteredInventory = React.useMemo(() => {
    if (!inventory) return []
    return inventory.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [inventory, searchTerm])

  const alertsCount = React.useMemo(() => {
    if (!inventory) return 0
    return inventory.filter(item => item.quantity <= item.threshold).length
  }, [inventory])

  const handleRestock = async (itemId: string) => {
    if (!db || !profile?.restaurantId || restockAmount <= 0) return
    setLoading(true)
    try {
      const itemRef = doc(db, COLLECTION_NAMES.RESTAURANTS, profile.restaurantId, COLLECTION_NAMES.INVENTORY, itemId)
      await updateDoc(itemRef, {
        quantity: increment(restockAmount),
        updatedAt: serverTimestamp()
      })
      toast({ title: "Stock mis à jour", description: "Le réapprovisionnement a été enregistré." })
      setRestockAmount(0)
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de mettre à jour le stock." })
    } finally {
      setLoading(false)
    }
  }

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>

  return (
    <div className="space-y-6 pb-10 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black italic uppercase tracking-tighter text-primary">Gestion des Stocks</h1>
          <p className="text-muted-foreground font-medium">Surveillez vos ingrédients et évitez les ruptures.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="font-bold border-primary/20 text-primary">
            <Filter className="mr-2 h-4 w-4" /> Filtres
          </Button>
          <Button className="bg-primary hover:bg-primary/90 font-bold uppercase italic shadow-lg">
            <Plus className="mr-2 h-4 w-4" /> Ajouter Produit
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className={cn("border-none shadow-md", alertsCount > 0 ? "bg-destructive/5 ring-1 ring-destructive/20" : "bg-card/50")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn("text-[10px] font-black uppercase tracking-widest", alertsCount > 0 ? "text-destructive" : "text-muted-foreground")}>Alertes Critiques</CardTitle>
            <AlertCircle className={cn("h-4 w-4", alertsCount > 0 ? "text-destructive" : "text-muted-foreground")} />
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-black italic", alertsCount > 0 ? "text-destructive" : "text-primary")}>{alertsCount} Items</div>
            <p className="text-[10px] text-muted-foreground font-medium">Sous le seuil de sécurité</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Valeur Stock</CardTitle>
            <Box className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black italic text-primary">{inventory?.length || 0} Références</div>
            <p className="text-[10px] text-muted-foreground font-medium">Ingrédients enregistrés</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Santé Globale</CardTitle>
            <RefreshCw className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black italic text-primary">{inventory && alertsCount === 0 ? "OPTIMALE" : "ATTENTION"}</div>
            <p className="text-[10px] text-muted-foreground font-medium">Auto-diagnostic live</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-lg bg-card/50 backdrop-blur-sm overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
          <CardTitle className="text-xl font-black italic uppercase">Inventaire Live</CardTitle>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Rechercher un ingrédient..." 
              className="pl-10 h-10 bg-background/50 border-none shadow-inner rounded-xl" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-secondary/30">
              <TableRow className="border-none hover:bg-transparent">
                <TableHead className="font-bold text-[10px] uppercase tracking-widest">Produit</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-widest">Stock Actuel</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-widest">Disponibilité</TableHead>
                <TableHead className="text-right font-bold text-[10px] uppercase tracking-widest">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInventory.map((item) => {
                const isAlert = item.quantity <= item.threshold
                const percentage = Math.min(100, Math.floor((item.quantity / (item.threshold * 3)) * 100))
                return (
                  <TableRow key={item.id} className="border-muted/30 hover:bg-primary/5 transition-colors">
                    <TableCell className="font-black italic text-primary">{item.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className={cn("text-lg font-black", isAlert ? "text-destructive" : "text-foreground")}>
                          {item.quantity} {item.unit || 'uds'}
                        </span>
                        <span className="text-[9px] font-bold text-muted-foreground uppercase">Seuil: {item.threshold}</span>
                      </div>
                    </TableCell>
                    <TableCell className="w-[180px]">
                      <div className="flex items-center gap-3">
                        <Progress 
                          value={percentage} 
                          className={cn(
                            "h-2 flex-1", 
                            isAlert ? "[&>div]:bg-destructive" : "[&>div]:bg-green-500"
                          )} 
                        />
                        <span className="text-[10px] font-black text-muted-foreground">{percentage}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 font-bold text-primary hover:bg-primary/10">
                            Réapprovisionner
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="rounded-2xl">
                          <DialogHeader>
                            <DialogTitle className="font-black italic uppercase">Réapprovisionner {item.name}</DialogTitle>
                          </DialogHeader>
                          <div className="py-4 space-y-4">
                            <Label>Quantité à ajouter ({item.unit || 'uds'})</Label>
                            <Input 
                              type="number" 
                              value={restockAmount} 
                              onChange={e => setRestockAmount(Number(e.target.value))}
                              className="h-12 bg-secondary/30 border-none rounded-xl"
                            />
                          </div>
                          <DialogFooter>
                            <Button className="w-full h-12 font-bold uppercase italic" onClick={() => handleRestock(item.id)} disabled={loading}>
                              {loading ? "Mise à jour..." : "Confirmer l'ajout"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                )
              })}
              {filteredInventory.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-20 text-muted-foreground italic">
                    Aucun ingrédient trouvé.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
