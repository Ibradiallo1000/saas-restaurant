"use client"

import * as React from "react"
import { useFirestore, useCollectionOnce, useMemoFirebase } from "@/firebase"
import { collection, limit, query } from "firebase/firestore"
import { COLLECTION_NAMES } from "@/lib/constants"
import { Users, Search, Star, MessageSquare, TrendingUp, Filter, Loader2, Award } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { useRestaurant } from "@/design-system/context/RestaurantContext"

export default function CustomersPage() {
  const db = useFirestore()
  const { restaurantId } = useRestaurant()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = React.useState("")
  const [analyzingId, setAnalyzingId] = React.useState<string | null>(null)
  const customersQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return query(
      collection(
        db,
        COLLECTION_NAMES.RESTAURANTS,
        restaurantId,
        COLLECTION_NAMES.CUSTOMERS
      ),
      limit(20)
    )
  }, [db, restaurantId])
  const { data: customers, isLoading } = useCollectionOnce(customersQuery)

  const handleAIAnalysis = async (customer: any) => {
    setAnalyzingId(customer.id)
    try {
      // Simulation de l'historique pour le MVP
      const response = await fetch("/api/ai/customer-marketing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
        customerId: customer.id,
        diningHistory: [
          { orderId: "ord_1", itemsOrdered: ["Plat Signature"], totalSpent: customer.totalSpent || 0, orderDate: new Date().toISOString() }
        ],
        availableOffers: ["-10% de réduction", "Dessert offert"],
        menuHighlights: ["Nouveau Cocktail Maison"]
        }),
      })

      if (!response.ok) throw new Error("AI analysis failed")
      const result = await response.json()
      
      toast({
        title: `Analyse pour ${customer.name || customer.phone}`,
        description: `Segment: ${result.customerSegment}. Suggestion: ${result.targetedOffer}`,
      })
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur IA", description: "Impossible d'analyser ce profil." })
    } finally {
      setAnalyzingId(null)
    }
  }

  const filteredCustomers = React.useMemo(() => {
    if (!customers) return []
    return customers.filter(c => 
      (c.name || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.phone.includes(searchTerm)
    )
  }, [customers, searchTerm])

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black italic uppercase tracking-tighter text-primary flex items-center gap-3">
            <Users className="h-10 w-10" /> Fidélité & CRM
          </h1>
          <p className="text-muted-foreground font-medium">Gérez vos clients et personnalisez vos offres.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="font-bold"><Filter className="mr-2 h-4 w-4" /> Filtres</Button>
          <Button className="font-bold bg-muted-berry text-white">Exporter CSV</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard icon={Users} title="Clients Total" value={customers?.length || 0} />
        <MetricCard icon={Star} title="Points Distribués" value={customers?.reduce((acc, c) => acc + (c.loyaltyPoints || 0), 0) || 0} />
        <MetricCard icon={TrendingUp} title="Visites / Mois" value="142" />
        <MetricCard icon={Award} title="Top Clients (VIP)" value={customers?.filter(c => (c.loyaltyPoints || 0) > 100).length || 0} />
      </div>

      <Card className="border-none shadow-xl overflow-hidden bg-card/50 backdrop-blur-md">
        <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
          <div>
            <CardTitle className="text-xl font-black italic uppercase">Répertoire Clients</CardTitle>
            <CardDescription>Liste des clients enregistrés via le POS ou le menu QR.</CardDescription>
          </div>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Rechercher par nom ou téléphone..." 
              className="pl-10 h-10 rounded-xl bg-background/50 border-none shadow-inner"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-secondary/30">
              <TableRow className="hover:bg-transparent">
                <TableHead>Client</TableHead>
                <TableHead>Visites</TableHead>
                <TableHead>Points</TableHead>
                <TableHead>Dernier Achat</TableHead>
                <TableHead className="text-right">Actions IA</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.map((customer) => (
                <TableRow key={customer.id} className="border-muted/50 hover:bg-primary/5 transition-colors">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold">{customer.name || "Client Anonyme"}</span>
                      <span className="text-xs text-muted-foreground font-mono">{customer.phone}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{customer.visits || 1}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="bg-primary/10 text-primary font-black">
                      {customer.loyaltyPoints || 0} pts
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {customer.lastVisit?.toDate?.() ? new Date(customer.lastVisit.toDate()).toLocaleDateString() : 'Aujourd\'hui'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-primary font-bold hover:bg-primary/10"
                      onClick={() => handleAIAnalysis(customer)}
                      disabled={analyzingId === customer.id}
                    >
                      {analyzingId === customer.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <><MessageSquare className="mr-2 h-4 w-4" /> Segmenter</>
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredCustomers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-20 text-muted-foreground italic">
                    Aucun client ne correspond à votre recherche.
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

function MetricCard({ icon: Icon, title, value }: any) {
  return (
    <Card className="border-none shadow-lg bg-card/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{title}</CardTitle>
        <Icon className="h-4 w-4 text-primary" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-black italic tracking-tighter text-primary">{value}</div>
      </CardContent>
    </Card>
  )
}
