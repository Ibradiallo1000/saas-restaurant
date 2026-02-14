"use client"

import * as React from "react"
import { useFirestore, useUser, useCollection, useDoc } from "@/firebase"
import { collection, query, where, doc } from "firebase/firestore"
import { COLLECTION_NAMES } from "@/lib/constants"
import { AlertCircle, ArrowUpDown, Box, Filter, Plus, Search, Loader2 } from "lucide-react"
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

export default function InventoryPage() {
  const { user } = useUser()
  const db = useFirestore()
  const [searchTerm, setSearchTerm] = React.useState("")

  const userProfileRef = React.useMemo(() => {
    if (!db || !user) return null
    return doc(db, COLLECTION_NAMES.USERS, user.uid)
  }, [db, user])
  const { data: profile } = useDoc(userProfileRef)

  const inventoryQuery = React.useMemo(() => {
    if (!db || !profile?.restaurantId) return null
    const q = query(
      collection(db, COLLECTION_NAMES.RESTAURANTS, profile.restaurantId, COLLECTION_NAMES.INVENTORY)
    )
    return Object.assign(q, { __memo: true })
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

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Gestion des Stocks</h1>
          <p className="text-muted-foreground">Surveillez vos ingrédients et évitez les ruptures.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Filter className="mr-2 h-4 w-4" /> Filtres
          </Button>
          <Button size="sm" className="bg-primary hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" /> Ajouter Produit
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className={cn("border-none shadow-md", alertsCount > 0 ? "bg-destructive/5" : "")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn("text-sm font-medium", alertsCount > 0 ? "text-destructive" : "")}>Alertes de Stock</CardTitle>
            <AlertCircle className={cn("h-4 w-4", alertsCount > 0 ? "text-destructive" : "text-muted-foreground")} />
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", alertsCount > 0 ? "text-destructive" : "")}>{alertsCount} Items</div>
            <p className={cn("text-xs mt-1 font-medium", alertsCount > 0 ? "text-destructive/80" : "text-muted-foreground")}>Réapprovisionnement suggéré</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Items Total</CardTitle>
            <Box className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inventory?.length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Ingrédients référencés</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Statut Global</CardTitle>
            <ArrowUpDown className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inventory && alertsCount === 0 ? "OK" : "Alerte"}</div>
            <p className="text-xs text-muted-foreground mt-1">Santé de l'inventaire</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-lg bg-card/50 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Liste d'Inventaire</CardTitle>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Rechercher un ingrédient..." 
              className="pl-10 h-9" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-muted hover:bg-transparent">
                <TableHead>Produit</TableHead>
                <TableHead>Stock Actuel</TableHead>
                <TableHead>Niveau de Stock</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInventory.map((item) => {
                const percentage = Math.min(100, Math.floor((item.quantity / (item.threshold * 3)) * 100))
                return (
                  <TableRow key={item.id} className="border-muted/50 hover:bg-secondary/20 transition-colors">
                    <TableCell className="font-bold text-primary">{item.name}</TableCell>
                    <TableCell>
                      <span className={cn("font-bold", item.quantity <= item.threshold ? "text-destructive" : "text-foreground")}>
                        {item.quantity} {item.unit || 'units'}
                      </span>
                      <p className="text-[10px] text-muted-foreground">Seuil: {item.threshold} {item.unit || 'units'}</p>
                    </TableCell>
                    <TableCell className="w-[200px]">
                      <div className="flex items-center gap-2">
                        <Progress 
                          value={percentage} 
                          className={cn(
                            "h-2", 
                            item.quantity <= item.threshold ? "[&>div]:bg-destructive" : "[&>div]:bg-green-500"
                          )} 
                        />
                        <span className="text-xs font-bold text-muted-foreground">{percentage}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="h-8 text-primary">Editer</Button>
                    </TableCell>
                  </TableRow>
                )
              })}
              {filteredInventory.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
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
