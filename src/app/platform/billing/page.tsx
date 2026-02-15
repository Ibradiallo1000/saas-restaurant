
'use client';

/**
 * @fileOverview Page de gestion financière SaaS.
 * Lit les données réelles des plans et des abonnements.
 */

import * as React from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { COLLECTION_NAMES } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard, TrendingUp, Calendar, AlertTriangle, Download, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function BillingAdminPage() {
  const db = useFirestore();

  // 1. Récupération des Plans
  const plansQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, COLLECTION_NAMES.PLANS));
  }, [db]);
  const { data: plans } = useCollection(plansQuery);

  // 2. Récupération des Abonnements
  const subsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, COLLECTION_NAMES.SUBSCRIPTIONS), orderBy('endDate', 'desc'));
  }, [db]);
  const { data: subscriptions } = useCollection(subsQuery);

  // 3. Récupération des Restaurants (pour le matching)
  const restQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, COLLECTION_NAMES.RESTAURANTS));
  }, [db]);
  const { data: restaurants } = useCollection(restQuery);

  const stats = React.useMemo(() => {
    if (!subscriptions || !plans) return { mrr: 0, churn: 0, alerts: 0 };
    
    const now = new Date();
    const active = subscriptions.filter(s => s.status === 'active');
    
    const mrr = active.reduce((acc, sub) => {
      const plan = plans.find(p => p.id === sub.planId);
      return acc + (plan?.price || 0);
    }, 0);

    const alerts = active.filter(s => {
      const end = s.endDate?.toDate?.() || new Date();
      return end < new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }).length;

    return { mrr, alerts, count: active.length };
  }, [subscriptions, plans]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black italic uppercase tracking-tighter text-primary">Contrôle Financier</h1>
          <p className="text-muted-foreground font-medium">Gestion des revenus récurrents et des offres.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline"><Package className="mr-2 h-4 w-4" /> Gérer les Plans</Button>
          <Button><Download className="mr-2 h-4 w-4" /> Rapport PDF</Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <PlatformStatCard 
          icon={TrendingUp} 
          title="MRR (Revenu Mensuel)" 
          value={`${stats.mrr.toLocaleString()} XOF`} 
          description="Basé sur les abonnements actifs" 
        />
        <PlatformStatCard 
          icon={AlertTriangle} 
          title="Alertes Expiration" 
          value={stats.alerts} 
          description="Fin de cycle sous 7 jours" 
          variant={stats.alerts > 0 ? "warning" : "default"}
        />
        <PlatformStatCard 
          icon={CreditCard} 
          title="Parc Actif" 
          value={stats.count} 
          description="Établissements sous contrat" 
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border-none shadow-2xl overflow-hidden">
          <CardHeader className="bg-secondary/10 p-6">
            <CardTitle className="text-xl font-black italic uppercase">Journal des Abonnements</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {subscriptions?.map((sub) => {
                const restaurant = restaurants?.find(r => r.id === sub.restaurantId);
                const plan = plans?.find(p => p.id === sub.planId);
                const isExpiring = (sub.endDate?.toDate?.() || new Date()) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

                return (
                  <div key={sub.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center">
                        <Calendar className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-bold text-sm uppercase italic">{restaurant?.name || 'Inconnu'}</p>
                        <p className="text-[10px] text-muted-foreground font-black uppercase">Plan: {plan?.name || sub.planId}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-xs font-black text-primary">{plan?.price.toLocaleString() || 0} {plan?.currency || 'XOF'}</p>
                        <p className={cn("text-[9px] font-bold uppercase", isExpiring ? "text-destructive" : "text-muted-foreground")}>
                          Fin: {sub.endDate?.toDate?.().toLocaleDateString() || 'N/A'}
                        </p>
                      </div>
                      <Badge variant={sub.status === 'active' ? 'default' : 'secondary'} className="text-[9px] uppercase font-black">
                        {sub.status}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-2xl bg-primary text-primary-foreground">
          <CardHeader>
            <CardTitle className="text-lg font-black italic uppercase">Offres de Services</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {plans?.map((plan) => (
              <div key={plan.id} className="p-4 bg-white/10 rounded-2xl border border-white/5 space-y-2">
                <div className="flex justify-between items-center">
                  <p className="font-bold uppercase italic">{plan.name}</p>
                  <p className="text-lg font-black">{plan.price.toLocaleString()} {plan.currency}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[9px] font-bold uppercase opacity-80">
                  <span className="flex items-center gap-1">● {plan.features.maxUsers} Users</span>
                  <span className="flex items-center gap-1">● {plan.features.aiEnabled ? 'AI Incluse' : 'No AI'}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PlatformStatCard({ icon: Icon, title, value, description, variant = "default" }: any) {
  return (
    <Card className={cn(
      "border-none shadow-lg",
      variant === "warning" ? "bg-orange-500/5 ring-1 ring-orange-500/20" : "bg-card/50 backdrop-blur-sm"
    )}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{title}</CardTitle>
        <Icon className={cn("h-4 w-4", variant === "warning" ? "text-orange-500" : "text-primary")} />
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-black italic tracking-tighter", variant === "warning" ? "text-orange-500" : "text-primary")}>
          {value}
        </div>
        <p className="text-[10px] font-medium text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}
