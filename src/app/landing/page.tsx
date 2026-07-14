
"use client"

import * as React from "react"
import { 
  Sparkles, 
  ChefHat, 
  BarChart3, 
  Globe2, 
  ShieldCheck, 
  ArrowRight,
  Zap,
  Hotel,
  Truck,
  MessageSquare
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { useUser } from "@/firebase"
import { usePlatform } from "@/contexts/platform-context"

export default function LandingPage() {
  const { user, isUserLoading } = useUser()
  const { settings } = usePlatform()

  return (
    <div className="public-reduced-motion flex min-h-screen flex-col">
      {/* Hero Section */}
      <section className="relative pt-20 pb-32 overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center text-center space-y-8 max-w-4xl mx-auto">
            <div className="inline-flex animate-in items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-bold text-primary fade-in slide-in-from-top-2 [animation-duration:var(--motion-public-landing)] [animation-timing-function:var(--motion-public-ease-enter)] motion-reduce:animate-none">
              <Sparkles className="h-4 w-4" />
              Le futur de la restauration en Afrique est ici
            </div>
            
            <h1 className="animate-in font-headline text-5xl font-black leading-tight tracking-tighter text-foreground fade-in slide-in-from-bottom-2 [animation-duration:var(--motion-public-landing)] [animation-timing-function:var(--motion-public-ease-enter)] motion-reduce:animate-none md:text-7xl">
              Dominez votre Marché avec <br />
              <span className="text-primary italic">{settings.name}</span>
            </h1>
            
            <p className="max-w-2xl animate-in text-xl leading-relaxed text-muted-foreground fade-in [animation-duration:var(--motion-public-landing)] [animation-timing-function:var(--motion-public-ease-enter)] motion-reduce:animate-none">
              La plateforme de gestion ultra-performante pour restaurants et hôtels. 
              Ventes en salle, livraison et room-service synchronisés en temps réel.
            </p>

            <div className="flex animate-in flex-col items-center gap-4 fade-in [animation-duration:var(--motion-public-landing)] [animation-timing-function:var(--motion-public-ease-enter)] motion-reduce:animate-none sm:flex-row">
              {isUserLoading ? (
                <Button disabled size="lg" className="rounded-full px-10 h-14">Chargement...</Button>
              ) : user ? (
                <Button asChild size="lg" className="h-14 rounded-full px-10 text-lg font-black uppercase italic shadow-2xl shadow-primary/20 transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none">
                  <Link href="/dashboard" prefetch>
                    Accéder à ma Console
                  </Link>
                </Button>
              ) : (
                <Button asChild size="lg" className="h-14 rounded-full px-10 text-lg font-black uppercase italic shadow-2xl shadow-primary/20 transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none">
                  <Link href="/contact" prefetch>
                    Demander une Démo
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline" size="lg" className="rounded-full px-10 h-14 font-bold border-2 hover:bg-secondary">
                <Link href="/login" prefetch>
                  Se Connecter
                </Link>
              </Button>
            </div>
            
            <p className="text-xs text-muted-foreground italic">
              Zéro frais d'installation. Accès exclusif sur invitation.
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
                <div className="bg-background aspect-[9/16] w-full rounded-2xl shadow-inner overflow-hidden border-8 border-border">
                  <div className="bg-primary/10 p-4 h-full flex flex-col gap-4">
                    <div className="h-8 w-1/2 bg-primary/20 rounded-full" />
                    <div className="grid grid-cols-2 gap-2">
                      <div className="h-20 bg-background rounded-xl" />
                      <div className="h-20 bg-background rounded-xl" />
                    </div>
                    <div className="h-40 bg-background rounded-xl" />
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
          <Button asChild size="lg" variant="secondary" className="h-16 rounded-full bg-background px-12 text-xl font-black uppercase italic text-primary transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none">
            <Link href="/contact" prefetch>
              Demander mon accès <ArrowRight className="ml-2" />
            </Link>
          </Button>
        </div>
      </section>

      <footer className="py-12 bg-secondary/50 border-t">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Zap className="h-6 w-6 text-primary" />
            <span className="text-xl font-black italic uppercase tracking-tighter">{settings.name}</span>
          </div>
          <p className="text-sm text-muted-foreground">© 2025 {settings.name} - La Solution de Référence en Afrique.</p>
          <Link href="/" className="mt-4 inline-block text-sm font-bold text-primary underline-offset-4 hover:underline">Voir les restaurants</Link>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon: Icon, title, description }: any) {
  return (
    <Card className="group overflow-hidden border-none shadow-xl transition-shadow duration-200 hover:shadow-2xl motion-reduce:transition-none">
      <CardHeader className="p-8">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 transition-colors duration-200 group-hover:bg-primary group-hover:text-white motion-reduce:transition-none">
          <Icon className="h-8 w-8" />
        </div>
        <CardTitle className="text-2xl font-bold mb-2">{title}</CardTitle>
        <CardDescription className="text-base leading-relaxed">{description}</CardDescription>
      </CardHeader>
    </Card>
  )
}
