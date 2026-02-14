"use client"

import * as React from "react"
import { AlertCircle, ArrowUpDown, Box, Filter, Plus, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

const INVENTORY = [
  { id: 1, name: "Poulet Fermier", category: "Viandes", stock: 12, unit: "kg", threshold: 5, level: 80 },
  { id: 2, name: "Farine T55", category: "Sec", stock: 45, unit: "kg", threshold: 10, level: 90 },
  { id: 3, name: "Huile d'Olive", category: "Épicerie", stock: 2, unit: "L", threshold: 5, level: 20 },
  { id: 4, name: "Café Arabica", category: "Boissons", stock: 1.5, unit: "kg", threshold: 2, level: 15 },
  { id: 5, name: "Saumon Atlantique", category: "Poissons", stock: 8, unit: "kg", threshold: 3, level: 65 },
]

export default function InventoryPage() {
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
        <Card className="border-none shadow-md bg-destructive/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-destructive">Alertes de Stock</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">3 Items</div>
            <p className="text-xs text-destructive/80 mt-1 font-medium">Réapprovisionnement suggéré</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valeur Totale</CardTitle>
            <Box className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$4,280.00</div>
            <p className="text-xs text-muted-foreground mt-1">Estimation inventaire actuel</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rotation</CardTitle>
            <ArrowUpDown className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4.2x</div>
            <p className="text-xs text-muted-foreground mt-1">Vitesse de rotation mensuelle</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-lg bg-card/50 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Liste d'Inventaire</CardTitle>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher un ingrédient..." className="pl-10 h-9" />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-muted hover:bg-transparent">
                <TableHead>Produit</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Stock Actuel</TableHead>
                <TableHead>Niveau de Stock</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {INVENTORY.map((item) => (
                <TableRow key={item.id} className="border-muted/50 hover:bg-secondary/20 transition-colors">
                  <TableCell className="font-bold text-primary">{item.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-secondary/40 border-none font-medium">
                      {item.category}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className={cn("font-bold", item.stock <= item.threshold ? "text-destructive" : "text-foreground")}>
                      {item.stock} {item.unit}
                    </span>
                    <p className="text-[10px] text-muted-foreground">Seuil: {item.threshold} {item.unit}</p>
                  </TableCell>
                  <TableCell className="w-[200px]">
                    <div className="flex items-center gap-2">
                      <Progress 
                        value={item.level} 
                        className={cn(
                          "h-2", 
                          item.level < 25 ? "[&>div]:bg-destructive" : 
                          item.level < 50 ? "[&>div]:bg-orange-400" : 
                          "[&>div]:bg-green-500"
                        )} 
                      />
                      <span className="text-xs font-bold text-muted-foreground">{item.level}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="h-8 text-primary">Editer</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
