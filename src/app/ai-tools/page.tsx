
"use client"

import * as React from "react"
import { Sparkles, BrainCircuit, Lightbulb, Users, ListPlus, Send } from "lucide-react"
import { dishRecommendationAssistant } from "@/ai/flows/dish-recommendation-assistant"
import { customerMarketingAssistant } from "@/ai/flows/customer-marketing-assistant"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"

export default function AIToolsPage() {
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(false)
  const [recommendations, setRecommendations] = React.useState<any>(null)
  const [marketingResult, setMarketingResult] = React.useState<any>(null)

  const handleDishRecommendation = async () => {
    setLoading(true)
    try {
      const result = await dishRecommendationAssistant({
        availableInventory: ["Poulet", "Crème Fraîche", "Champignons", "Pâtes Fraîches", "Vinaigre Balsamique"],
        customerDietaryPreferences: "Sans noix",
        customerPreferences: "Aime les plats crémeux et réconfortants",
        existingMenu: [
          { name: "Pasta Carbonara", description: "Pâtes avec sauce crémeuse et lardons", ingredients: ["Pâtes", "Crème", "Oeufs", "Lardons"] }
        ]
      })
      setRecommendations(result.recommendedDishes)
      toast({ title: "Recommandations générées", description: "L'IA a analysé votre inventaire." })
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de générer des recommandations.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleMarketingAssistant = async () => {
    setLoading(true)
    try {
      const result = await customerMarketingAssistant({
        customerId: "cust_99",
        diningHistory: [
          { orderId: "ord_1", itemsOrdered: ["Pasta Carbonara", "Red Wine"], totalSpent: 45, orderDate: "2023-10-01" },
          { orderId: "ord_2", itemsOrdered: ["Pasta Pesto", "Tiramisu"], totalSpent: 38, orderDate: "2023-11-15" }
        ],
        availableOffers: ["-10% sur votre prochain repas", "Dessert offert", "Café de bienvenue"],
        menuHighlights: ["Risotto Truffe", "Entrecôte Maturée", "Plateau Fromages"]
      })
      setMarketingResult(result)
      toast({ title: "Analyse client terminée", description: "Segment identifié avec succès." })
    } catch (error) {
      toast({ title: "Erreur", description: "Échec de l'analyse marketing.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-10">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary rounded-xl shadow-lg">
            <Sparkles className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Intelligence Gastronomique</h1>
        </div>
        <p className="text-muted-foreground text-lg">Optimisez vos menus et fidélisez vos clients grâce à nos outils d'IA avancés.</p>
      </div>

      <Tabs defaultValue="menu" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-secondary/50 p-1 rounded-xl">
          <TabsTrigger value="menu" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <BrainCircuit className="mr-2 h-4 w-4" /> Optimisation Menu
          </TabsTrigger>
          <TabsTrigger value="marketing" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Users className="mr-2 h-4 w-4" /> Marketing Ciblé
          </TabsTrigger>
        </TabsList>

        <TabsContent value="menu" className="mt-6 space-y-6 animate-in slide-in-from-left-4 duration-300">
          <Card className="border-none shadow-lg overflow-hidden">
            <CardHeader className="bg-secondary/30">
              <CardTitle className="text-xl flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-primary" />
                Assistant Recettes & Gaspillage
              </CardTitle>
              <CardDescription>L'IA suggère des plats basés sur votre inventaire actuel pour réduire les pertes.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Inventaire Actuel</h3>
                    <div className="flex flex-wrap gap-2">
                      {["Poulet", "Crème", "Champignons", "Pâtes", "Vin Blanc"].map(item => (
                        <Badge key={item} variant="secondary" className="px-3 py-1 font-medium">{item}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Préférences Client</h3>
                    <p className="text-sm italic text-muted-foreground">"Cuisine réconfortante, pas trop épicée"</p>
                  </div>
                  <Button onClick={handleDishRecommendation} disabled={loading} className="w-full shadow-md">
                    {loading ? "Calcul en cours..." : "Générer Recommandations"}
                  </Button>
                </div>

                <div className="bg-muted/30 rounded-xl p-4 min-h-[200px] flex flex-col items-center justify-center text-center">
                  {!recommendations ? (
                    <div className="text-muted-foreground space-y-2">
                      <ListPlus className="h-8 w-8 mx-auto opacity-20" />
                      <p>Les suggestions apparaîtront ici</p>
                    </div>
                  ) : (
                    <div className="w-full space-y-4">
                      {recommendations.map((dish: any, idx: number) => (
                        <div key={idx} className="bg-card p-4 rounded-lg shadow-sm border border-primary/10 text-left">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold text-primary">{dish.name}</h4>
                            {dish.isCustomDish && <Badge className="bg-muted-berry text-[10px]">NOUVEAU</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mb-3">{dish.description}</p>
                          <p className="text-[11px] font-medium text-primary/80 italic">{dish.reasonForRecommendation}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="marketing" className="mt-6 space-y-6 animate-in slide-in-from-right-4 duration-300">
          <Card className="border-none shadow-lg">
            <CardHeader className="bg-secondary/30">
              <CardTitle className="text-xl flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Segmentation & Fidélité IA
              </CardTitle>
              <CardDescription>Identifiez les segments de clients et proposez des offres personnalisées.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="p-4 bg-secondary/20 rounded-xl border border-primary/5">
                    <p className="text-sm font-bold mb-2">Simulation Client: John Doe</p>
                    <ul className="text-xs space-y-1 text-muted-foreground">
                      <li>• 12 visites les 6 derniers mois</li>
                      <li>• Panier moyen: 52€</li>
                      <li>• Préférence: Plats italiens, Vins rouges</li>
                    </ul>
                  </div>
                  <Button onClick={handleMarketingAssistant} disabled={loading} className="w-full">
                    {loading ? "Analyse..." : "Lancer l'Analyse Marketing"}
                  </Button>
                </div>

                <div className="relative">
                  {!marketingResult ? (
                    <div className="h-full bg-muted/20 rounded-xl border border-dashed flex flex-center items-center justify-center p-8 text-center">
                      <p className="text-sm text-muted-foreground">Appuyez sur analyser pour voir les résultats de segmentation.</p>
                    </div>
                  ) : (
                    <div className="space-y-4 animate-in zoom-in-95 duration-300">
                      <div className="p-4 bg-card rounded-xl shadow-md border-l-4 border-primary">
                        <Badge variant="outline" className="mb-2 bg-primary/10 text-primary border-primary/20">
                          Segment: {marketingResult.customerSegment}
                        </Badge>
                        <h4 className="font-bold text-lg mb-1">Offre Recommandée</h4>
                        <p className="text-sm text-primary font-medium">{marketingResult.targetedOffer}</p>
                        <div className="mt-4 pt-4 border-t">
                          <p className="text-xs text-muted-foreground mb-1 font-bold uppercase">Plat à suggérer</p>
                          <p className="text-sm font-bold">{marketingResult.recommendedMenuItem}</p>
                        </div>
                        <p className="mt-4 text-xs italic text-muted-foreground leading-relaxed">
                          "{marketingResult.reasoning}"
                        </p>
                        <Button variant="secondary" size="sm" className="mt-4 w-full text-xs">
                          <Send className="mr-2 h-3 w-3" /> Envoyer par SMS
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
