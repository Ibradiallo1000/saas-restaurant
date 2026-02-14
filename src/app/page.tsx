
"use client"

import * as React from "react"
import { Sparkles, Building2, ShieldCheck, Zap } from "lucide-react"
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
          Phase 1: Foundation SaaS
        </div>
        <h1 className="text-5xl font-black tracking-tighter text-primary font-headline italic">
          GastronomeAI
        </h1>
        <p className="text-xl text-muted-foreground leading-relaxed">
          La base de données multi-tenant haute performance pour la restauration et l'hôtellerie moderne.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3 w-full max-w-5xl">
        <FeatureCard 
          icon={ShieldCheck} 
          title="Isolation Multi-Tenant" 
          description="Architecture stricte basée sur 'restaurantId' pour une sécurité totale des données." 
        />
        <FeatureCard 
          icon={Building2} 
          title="Structure Firestore" 
          description="9 collections piliers prêtes pour le scale : plans, restaurants, menus, orders, etc." 
        />
        <FeatureCard 
          icon={Zap} 
          title="Prêt pour le Temps Réel" 
          description="Infrastructure optimisée pour les mises à jour instantanées en cuisine et au POS." 
        />
      </div>

      <div className="flex gap-4">
        {isUserLoading ? (
          <Button disabled variant="outline">Chargement...</Button>
        ) : user ? (
          <Link href="/dashboard">
            <Button size="lg" className="px-8 shadow-xl hover:shadow-primary/20 transition-all">
              Accéder au Dashboard
            </Button>
          </Link>
        ) : (
          <Link href="/login">
            <Button size="lg" className="px-8 shadow-xl hover:shadow-primary/20 transition-all">
              Se Connecter
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
