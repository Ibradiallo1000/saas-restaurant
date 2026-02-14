"use client"

import * as React from "react"
import { Sparkles, ShieldCheck, Zap, LayoutGrid, Globe, CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { useUser } from "@/firebase"

export default function LandingPage() {
  const { user, isUserLoading } = useUser()

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-12 animate-in fade-in duration-700 max-w-6xl mx-auto px-4">
      <div className="text-center space-y-4 max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold mb-4">
          <Sparkles className="h-3 w-3" />
          GastronomeAI • SaaS Foundation v1.0
        </div>
        <h1 className="text-6xl font-black tracking-tighter text-primary font-headline italic leading-tight">
          L'Élite de l'Ingénierie <br />Hospitalière Africaine.
        </h1>
        <p className="text-xl text-muted-foreground leading-relaxed">
          Digitalisez votre établissement en quelques minutes. Isolation multi-tenant stricte, 
          gestion temps réel et fidélité intelligente pour restaurants et hôtels.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3 w-full">
        <FeatureCard 
          icon={ShieldCheck} 
          title="Isolation Multi-Tenant" 
          description="Chaque restaurant dispose d'une isolation totale des données via 'restaurantId' natif." 
        />
        <FeatureCard 
          icon={Globe} 
          title="Prêt pour l'Afrique" 
          description="Support multi-pays et multi-devises (FCFA, GHS, NGN) avec gestion i18n native." 
        />
        <FeatureCard 
          icon={CreditCard} 
          title="Monétisation Flexible" 
          description="Période d'essai automatique de 30 jours et gestion de plans d'abonnement intégrée." 
        />
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center">
        {isUserLoading ? (
          <Button disabled variant="outline">Initialisation système...</Button>
        ) : user ? (
          <Link href="/dashboard">
            <Button size="lg" className="px-10 h-14 text-lg shadow-xl hover:shadow-primary/20 transition-all font-black uppercase italic">
              Accéder à ma Console
            </Button>
          </Link>
        ) : (
          <Link href="/login">
            <Button size="lg" className="px-10 h-14 text-lg shadow-xl hover:shadow-primary/20 transition-all font-black uppercase italic">
              Commencer l'essai gratuit
            </Button>
          </Link>
        )}
        <p className="text-xs text-muted-foreground italic">Aucune carte de crédit requise pour l'essai de 30 jours.</p>
      </div>
    </div>
  )
}

function FeatureCard({ icon: Icon, title, description }: any) {
  return (
    <Card className="border-none shadow-md bg-card/50 backdrop-blur-sm hover:translate-y-[-4px] transition-all duration-300">
      <CardHeader>
        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-xl font-bold">{title}</CardTitle>
        <CardDescription className="text-sm leading-relaxed">{description}</CardDescription>
      </CardHeader>
    </Card>
  )
}
