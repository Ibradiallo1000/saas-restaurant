"use client"

import * as React from "react"
import { useFirestore, useUser, useDoc, useCollection } from "@/firebase"
import { doc, collection, query, where } from "firebase/firestore"
import { COLLECTION_NAMES } from "@/lib/constants"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ShoppingBag, Users, Clock, CreditCard, AlertCircle, Trophy } from "lucide-react"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export default function DashboardPage() {
  const { t } = useTranslation()
  const { user } = useUser()
  const db = useFirestore()

  const profileRef = React.useMemo(() => {
    if (!db || !user) return null
    return doc(db, COLLECTION_NAMES.USERS, user.uid)
  }, [db, user])
  const { data: profile } = useDoc(profileRef)

  const restaurantRef = React.useMemo(() => {
    if (!db || !profile?.restaurantId) return null
    return doc(db, COLLECTION_NAMES.RESTAURANTS, profile.restaurantId)
  }, [db, profile])
  const { data: restaurant } = useDoc(restaurantRef)

  // Real-time Inventory Alerts
  const inventoryQuery = React.useMemo(() => {
    if (!db || !profile?.restaurantId) return null
    const q = query(
      collection(db, COLLECTION_NAMES.RESTAURANTS, profile.restaurantId, COLLECTION_NAMES.INVENTORY)
    )
    return Object.assign(q, { __memo: true })
  }, [db, profile])
  const { data: inventory } = useCollection(inventoryQuery)

  const lowStockItems = React.useMemo(() => {
    if (!inventory) return []
    return inventory.filter(item => item.quantity <= item.threshold)
  }, [inventory])

  // Real-time Loyalty Highlights
  const customersQuery = React.useMemo(() => {
    if (!db || !profile?.restaurantId) return null
    const q = query(
      collection(db, COLLECTION_NAMES.CUSTOMERS),
      where("restaurantId", "==", profile.restaurantId),
      where("loyaltyPoints", ">=", 100) // Example reward threshold
    )
    return Object.assign(q, { __memo: true })
  }, [db, profile])
  const { data: topCustomers } = useCollection(customersQuery)

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
        <StatCard icon={ShoppingBag} title="Commandes" value="--" description="Aujourd'hui" />
        <StatCard icon={Users} title="Clients VIP" value={topCustomers?.length || 0} description="Points > 100" />
        <StatCard icon={CreditCard} title="Chiffre d'Affaires" value={`-- ${restaurant?.currency || ''}`} description="Ventes payées" />
        <StatCard icon={AlertCircle} title="Alertes Stock" value={lowStockItems.length} description="Items sous le seuil" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-none shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Alertes de Stock Critique
            </CardTitle>
            <CardDescription>Articles nécessitant un réapprovisionnement immédiat.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {lowStockItems.length === 0 ? (
              <p className="text-sm italic text-muted-foreground py-4 text-center">Aucune alerte de stock.</p>
            ) : (
              lowStockItems.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-destructive/5 rounded-lg border border-destructive/10">
                  <span className="font-bold text-sm">{item.name}</span>
                  <Badge variant="destructive">{item.quantity} {item.unit || 'units'} restant</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              Fidélité & Récompenses
            </CardTitle>
            <CardDescription>Clients ayant débloqué des avantages.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {topCustomers && topCustomers.length > 0 ? (
              topCustomers.slice(0, 3).map(customer => (
                <div key={customer.id} className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg border border-primary/5">
                  <div className="flex flex-col">
                    <span className="font-bold text-sm">{customer.name}</span>
                    <span className="text-[10px] text-muted-foreground">{customer.phone}</span>
                  </div>
                  <Badge className="bg-primary">{customer.loyaltyPoints} pts</Badge>
                </div>
              ))
            ) : (
              <p className="text-sm italic text-muted-foreground py-4 text-center">Aucun client VIP pour le moment.</p>
            )}
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
