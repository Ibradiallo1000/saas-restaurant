
"use client"

import * as React from "react"
import { 
  Sparkles, 
  ChefHat, 
  Smartphone, 
  BarChart3, 
  Globe2, 
  ShieldCheck, 
  ArrowRight,
  Zap,
  Hotel,
  Truck
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { useUser } from "@/firebase"

export default function LandingPage() {
  const { user, isUserLoading } = useUser()

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative pt-20 pb-32 overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center text-center space-y-8 max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-bold animate-in fade-in slide-in-from-top-4 duration-1000">
              <Sparkles className="h-4 w-4" />
              Le futur de la restauration en Afrique est ici
            </div>
            
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-foreground font-headline leading-tight animate-in fade-in slide-in-from-bottom-4 duration-1000">
              Dominez votre Marché avec <br />
              <span className="text-primary italic">GastronomeAI</span>
            </h1>
            
            <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl animate-in fade-in duration-1000 delay-200">
              La plateforme de gestion ultra-performante pour restaurants et hôtels. 
              Ventes en salle, livraison et room-service synchronisés en temps réel.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 items-center animate-in fade-in duration-1000 delay-300">
              {isUserLoading ? (
                <Button disabled size="lg" className="rounded-full px-10 h-14">Chargement...</Button>
              ) : user ? (
                <Link href="/dashboard">
                  <Button size="lg" className="rounded-full px-10 h-14 text-lg font-black uppercase italic shadow-2xl shadow-primary/20 hover:scale-105 transition-all">
                    Ma Console de Gestion
                  </Button>
                </Link>
              ) : (
                <Link href="/login">
                  <Button size="lg" className="rounded-full px-10 h-14 text-lg font-black uppercase italic shadow-2xl shadow-primary/20 hover:scale-105 transition-all">
                    Essayer Gratuitement 30 Jours
                  </Button>
                </Link>
              )}
              <Button variant="outline" size="lg" className="rounded-full px-10 h-14 font-bold border-2 hover:bg-secondary">
                Voir la Démo
              </Button>
            </div>
            
            <p className="text-xs text-muted-foreground italic">
              Zéro frais d'installation. Compatible avec toutes les devises locales (XOF, GHS, NGN).
            </p>
          </div>
        </div>
        
        {/* Background Decorative Element */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl opacity-50" />
      </section>

      {/* Multi-Channel Section */}
      <section className="py-24 bg-secondary/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl font-black italic uppercase tracking-tighter">Une Gestion sans Limites</h2>
            <p className="text-muted-foreground">Un seul outil pour tous vos points de contact client.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={ChefHat} 
              title="Service en Salle" 
              description="QR codes sur table pour commande autonome ou prise de commande serveur ultra-rapide."
            />
            <FeatureCard 
              icon={Truck} 
              title="Livraison & Emporté" 
              description="Gérez vos propres coursiers et les commandes à emporter sans commissions tierces."
            />
            <FeatureCard 
              icon={Hotel} 
              title="Mode Hôtel" 
              description="Intégration room-service complète : commande directe depuis la chambre via smartphone."
            />
          </div>
        </div>
      </section>

      {/* African Market Value */}
      <section className="py-24 overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <h2 className="text-5xl font-black italic uppercase tracking-tighter leading-none">
                Pensé pour les Réalités de <span className="text-primary underline decoration-accent">l'Afrique</span>
              </h2>
              
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-primary flex items-center justify-center text-white font-bold">1</div>
                  <div>
                    <h3 className="text-xl font-bold mb-1">Mobile-First & Cloud</h3>
                    <p className="text-muted-foreground">Pilotez votre restaurant depuis votre smartphone. Accès permanent, même en déplacement.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-primary flex items-center justify-center text-white font-bold">2</div>
                  <div>
                    <h3 className="text-xl font-bold mb-1">Paiements Locaux</h3>
                    <p className="text-muted-foreground">Support natif du Mobile Money (Orange, MTN, Wave). Validation rapide des références de paiement.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-primary flex items-center justify-center text-white font-bold">3</div>
                  <div>
                    <h3 className="text-xl font-bold mb-1">Branding Personnalisé</h3>
                    <p className="text-muted-foreground">Votre nom, votre logo, vos couleurs. Le système s'adapte à votre identité de marque, pas l'inverse.</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="relative">
              <div className="bg-primary aspect-square rounded-3xl rotate-3 flex items-center justify-center p-8 shadow-2xl">
                <div className="bg-white aspect-[9/16] w-full rounded-2xl shadow-inner overflow-hidden border-8 border-black">
                  <div className="bg-primary/10 p-4 h-full flex flex-col gap-4">
                    <div className="h-8 w-1/2 bg-primary/20 rounded-full" />
                    <div className="grid grid-cols-2 gap-2">
                      <div className="h-20 bg-white rounded-xl" />
                      <div className="h-20 bg-white rounded-xl" />
                    </div>
                    <div className="h-40 bg-white rounded-xl" />
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-6 -left-6 bg-accent p-6 rounded-2xl shadow-xl hidden md:block">
                <p className="text-2xl font-black italic">+45%</p>
                <p className="text-xs font-bold uppercase">De chiffre d'affaires</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-24 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center space-y-12">
          <h2 className="text-4xl font-black italic uppercase">Prêt à digitaliser votre succès ?</h2>
          <div className="flex flex-wrap justify-center gap-8">
            <div className="flex flex-col items-center">
              <ShieldCheck className="h-10 w-10 mb-2" />
              <p className="font-bold">Données Sécurisées</p>
            </div>
            <div className="flex flex-col items-center">
              <BarChart3 className="h-10 w-10 mb-2" />
              <p className="font-bold">Analytics en Temps Réel</p>
            </div>
            <div className="flex flex-col items-center">
              <Globe2 className="h-10 w-10 mb-2" />
              <p className="font-bold">Support Multi-Langues</p>
            </div>
          </div>
          <Link href="/login">
            <Button size="lg" variant="secondary" className="rounded-full px-12 h-16 text-xl font-black uppercase italic hover:scale-105 transition-transform bg-white text-primary">
              Commencer maintenant <ArrowRight className="ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="py-12 bg-secondary/50 border-t">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Zap className="h-6 w-6 text-primary" />
            <span className="text-xl font-black italic uppercase tracking-tighter">GastronomeAI</span>
          </div>
          <p className="text-sm text-muted-foreground">© 2025 GastronomeAI - La Solution de Référence en Afrique.</p>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon: Icon, title, description }: any) {
  return (
    <Card className="border-none shadow-xl hover:-translate-y-2 transition-all duration-300 overflow-hidden group">
      <CardHeader className="p-8">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary group-hover:text-white transition-colors">
          <Icon className="h-8 w-8" />
        </div>
        <CardTitle className="text-2xl font-bold mb-2">{title}</CardTitle>
        <CardDescription className="text-base leading-relaxed">{description}</CardDescription>
      </CardHeader>
    </Card>
  )
}
