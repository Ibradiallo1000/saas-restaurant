'use client';

/**
 * @fileOverview Page de gestion des abonnements et de la facturation globale.
 */

import * as React from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { COLLECTION_NAMES } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard, TrendingUp, Calendar, AlertTriangle, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function BillingAdminPage() {
  const db = useFirestore();

  const restaurantsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, COLLECTION_NAMES.RESTAURANTS), orderBy('createdAt', 'desc'));
  }, [db]);

  const { data: restaurants } = useCollection(restaurantsQuery);

  const expiringSoon = React.useMemo(() => {
    if (!restaurants) return [];
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return restaurants.filter(r => {
      if (!r.subscriptionEndDate) return false;
      const end = new Date(r.subscriptionEndDate);
      return end > now && end < nextWeek;
    });
  }, [restaurants]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-4xl font-black italic uppercase tracking-tighter text-primary">Abonnements</h1>
        <p className="text-muted-foreground font-medium">Contrôle de la facturation et des cycles de vie clients.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-none shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">MRR Estimé</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black italic text-primary">1.2M XOF</div>
            <p className="text-[10px] text-muted-foreground mt-1">Revenu Mensuel Récurrent</p>
          </CardContent>
        </Card>
        
        <Card className={cn("border-none shadow-lg", expiringSoon.length > 0 ? "bg-orange-500/5 ring-1 ring-orange-500/20" : "")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Alertes Expiration</CardTitle>
            <AlertTriangle className={cn("h-4 w-4", expiringSoon.length > 0 ? "text-orange-500" : "text-primary")} />
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-black italic", expiringSoon.length > 0 ? "text-orange-500" : "text-primary")}>
              {expiringSoon.length} Restaurants
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Fin d'abonnement sous 7 jours</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Taux de Rétention</CardTitle>
            <CreditCard className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black italic text-primary">94%</div>
            <p className="text-[10px] text-muted-foreground mt-1">Stabilité du parc client</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-2xl overflow-hidden">
        <CardHeader className="bg-secondary/10 p-6 flex flex-row items-center justify-between">
          <CardTitle className="text-xl font-black italic uppercase">État des Souscriptions</CardTitle>
          <Button variant="outline" size="sm" className="text-xs">
            <Download className="mr-2 h-3 w-3" /> Exporter PDF
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {restaurants?.map((r) => (
              <div key={r.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold">{r.name}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Plan: {r.planId || 'Basic'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xs font-bold">{r.currency} {r.planId === 'premium' ? '75 000' : '25 000'}</p>
                    <p className="text-[10px] text-muted-foreground italic">Dernier paiement: 01/10/2023</p>
                  </div>
                  <Badge variant={r.subscriptionStatus === 'active' ? 'default' : 'destructive'} className="text-[9px] uppercase">
                    {r.subscriptionStatus}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
