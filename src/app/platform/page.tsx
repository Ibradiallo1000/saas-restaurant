
'use client';

/**
 * @fileOverview Vue d'ensemble de la plateforme SaaS.
 * Affiche les statistiques globales et l'état du réseau de restaurants.
 */

import * as React from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { COLLECTION_NAMES } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, CreditCard, Activity, Plus, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';

export default function PlatformDashboard() {
  const db = useFirestore();
  const router = useRouter();

  const restaurantsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, COLLECTION_NAMES.RESTAURANTS), orderBy('createdAt', 'desc'));
  }, [db]);

  const { data: restaurants, isLoading } = useCollection(restaurantsQuery);

  const activeCount = restaurants?.filter(r => r.active).length || 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black italic uppercase tracking-tighter text-primary">Vue d'ensemble SaaS</h1>
          <p className="text-muted-foreground font-medium">Gestion globale du réseau GastronomeAI.</p>
        </div>
        <Button onClick={() => router.push('/platform/restaurants/new')} className="shadow-xl">
          <Plus className="mr-2 h-4 w-4" /> Provisionner un Restaurant
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <PlatformStatCard icon={Building2} title="Établissements" value={restaurants?.length || 0} description={`${activeCount} actifs`} />
        <PlatformStatCard icon={Users} title="Utilisateurs Plateforme" value="3" description="Admins & Support" />
        <PlatformStatCard icon={CreditCard} title="Abonnements" value="1.2M XOF" description="CA mensuel estimé" />
        <PlatformStatCard icon={Activity} title="État Système" value="100%" description="Services opérationnels" />
      </div>

      <Card className="border-none shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between bg-secondary/20 p-6">
          <CardTitle className="text-xl font-black italic uppercase">Dernières Activités</CardTitle>
          <Button variant="ghost" size="sm" className="font-bold text-xs" onClick={() => router.push('/platform/restaurants')}>
            Voir tout <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {restaurants?.slice(0, 5).map((r) => (
              <div key={r.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{r.ownerEmail}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant={r.active ? "default" : "secondary"} className="text-[10px] font-black uppercase">
                    {r.subscriptionStatus}
                  </Badge>
                  <Button variant="ghost" size="icon" onClick={() => router.push(`/platform/restaurants/${r.id}`)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {(!restaurants || restaurants.length === 0) && !isLoading && (
              <div className="p-8 text-center text-muted-foreground italic">Aucun établissement enregistré.</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PlatformStatCard({ icon: Icon, title, value, description }: any) {
  return (
    <Card className="border-none shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-primary" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-black italic text-primary">{value}</div>
        <p className="text-[10px] font-medium text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}
