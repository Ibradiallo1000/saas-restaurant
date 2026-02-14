"use client"

import * as React from "react"
import { useFirestore, useUser, useDoc } from "@/firebase"
import { doc } from "firebase/firestore"
import { COLLECTION_NAMES } from "@/lib/constants"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ShoppingBag, Users, Clock, CreditCard } from "lucide-react"
import { useTranslation } from "@/lib/i18n"

export default function DashboardPage() {
  const { t } = useTranslation()
  const { user } = useUser()
  const db = useFirestore()

  const profileRef = React.useMemo(() => {
    if (!db || !user) return null
    const r = doc(db, COLLECTION_NAMES.USERS, user.uid)
    return Object.assign(r, { __memo: true })
  }, [db, user])

  const { data: profile } = useDoc(profileRef)

  const restaurantRef = React.useMemo(() => {
    if (!db || !profile?.restaurantId) return null
    const r = doc(db, COLLECTION_NAMES.RESTAURANTS, profile.restaurantId)
    return Object.assign(r, { __memo: true })
  }, [db, profile])

  const { data: restaurant } = useDoc(restaurantRef)

  // Calcul des jours restants d'essai
  const daysLeft = React.useMemo(() => {
    if (!restaurant?.trialEndDate) return 0
    const end = new Date(restaurant.trialEndDate)
    const now = new Date()
    const diff = end.getTime() - now.getTime()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }, [restaurant])

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black italic text-primary font-headline">
            {restaurant?.name || t.common.dashboard}
          </h1>
          <p className="text-muted-foreground">{t.dashboard.welcome}, {profile?.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="bg-secondary/50 py-1 px-3">
            {t.dashboard.trialInfo} : {daysLeft} {t.dashboard.daysLeft}
          </Badge>
          <Badge className="bg-muted-berry">{restaurant?.currency}</Badge>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={ShoppingBag} title="Commandes" value="0" description="Aujourd'hui" />
        <StatCard icon={Users} title="Clients" value="0" description="Total fidélité" />
        <StatCard icon={CreditCard} title="Chiffre d'Affaires" value={`0 ${restaurant?.currency}`} description="Ventes payées" />
        <StatCard icon={Clock} title="Temps Moyen" value="-- min" description="Cuisine ↔ Table" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-none shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Opérations en cours</CardTitle>
            <CardDescription>Flux temps réel de votre établissement.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground italic border-t">
            Aucune activité pour le moment.
          </CardContent>
        </Card>
        <Card className="border-none shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Notifications Système</CardTitle>
            <CardDescription>Alertes stocks et abonnements.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="p-3 bg-secondary/30 rounded-lg text-xs border border-primary/5">
              Bienvenue sur votre nouvelle instance SaaS GastronomeAI.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, title, value, description }: any) {
  return (
    <Card className="border-none shadow-md bg-card/50 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-primary" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-black text-primary">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  )
}
