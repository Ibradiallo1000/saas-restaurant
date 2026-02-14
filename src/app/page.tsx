
"use client"

import * as React from "react"
import { Sparkles, ShieldCheck, Zap, LayoutGrid } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { useUser } from "@/firebase"

export default function LandingPage() {
  const { user, isUserLoading } = useUser()

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-12 animate-in fade-in duration-700">
      <div className="text-center space-y-4 max-w-2xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold mb-4">
          <Sparkles className="h-3 w-3" />
          GastronomeAI • Phase 1: Fondation SaaS
        </div>
        <h1 className="text-5xl font-black tracking-tighter text-primary font-headline italic">
          Ingénierie Hospitalière
        </h1>
        <p className="text-xl text-muted-foreground leading-relaxed">
          Infrastructure multi-tenant sécurisée pour la digitalisation complète des restaurants et hôtels.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3 w-full max-w-5xl">
        <FeatureCard 
          icon={ShieldCheck} 
          title="Isolation Multi-Tenant" 
          description="Architecture stricte basée sur 'restaurantId' pour une isolation totale des données." 
        />
        <FeatureCard 
          icon={LayoutGrid} 
          title="Schéma Relationnel" 
          description="9 collections piliers prêtes pour le scale : plans, restaurants, menus, orders, etc." 
        />
        <FeatureCard 
          icon={Zap} 
          title="Performance Temps Réel" 
          description="Optimisé pour les listeners Firebase et une communication cuisine-salle instantanée." 
        />
      </div>

      <div className="flex gap-4">
        {isUserLoading ? (
          <Button disabled variant="outline">Initialisation...</Button>
        ) : user ? (
          <Link href="/setup">
            <Button size="lg" className="px-8 shadow-xl hover:shadow-primary/20 transition-all font-bold">
              Accéder à la Configuration
            </Button>
          </Link>
        ) : (
          <Link href="/login">
            <Button size="lg" className="px-8 shadow-xl hover:shadow-primary/20 transition-all font-bold">
              Démarrer la Fondation
            </Button>
          </Link>
        )}
      </div>
    </div>
  )
}

function FeatureCard({ icon: Icon, title, description }: any) {
  return (
    <Card className="border-none shadow-md bg-card/50 backdrop-blur-sm hover:translate-y-[-4px] transition-all">
      <CardHeader>
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  )
}
