
'use client';

/**
 * @fileOverview Vue d'ensemble de la plateforme SaaS.
 * Affiche les statistiques globales, les demandes de démo et l'état du réseau.
 */

import * as React from 'react';
import { useFirestore, useCollectionOnce, useMemoFirebase } from '@/firebase';
import { collection, limit, query, orderBy } from 'firebase/firestore';
import { COLLECTION_NAMES } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, CreditCard, Activity, Plus, ChevronRight, MessageSquare, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function PlatformDashboard() {
  const db = useFirestore();
  const router = useRouter();

  const restaurantsQuery = useMemoFirebase(() => {
    return null;
  }, [db]);

  const requestsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, COLLECTION_NAMES.CONTACT_REQUESTS), orderBy('createdAt', 'desc'), limit(20));
  }, [db]);

  const { data: restaurants, isLoading: isRestaurantsLoading } = useCollectionOnce(restaurantsQuery);
  const { data: requests, isLoading: isRequestsLoading } = useCollectionOnce(requestsQuery);

  const activeCount = restaurants?.filter(r => r.active).length || 0;
  const newRequestsCount = requests?.filter(r => r.status === 'new').length || 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black italic uppercase tracking-tighter text-primary">Administration SaaS</h1>
          <p className="text-muted-foreground font-medium">Contrôle global du réseau GastronomeAI.</p>
        </div>
        <Button onClick={() => router.push('/platform/restaurants/new')} className="shadow-xl">
          <Plus className="mr-2 h-4 w-4" /> Nouveau Restaurant
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <PlatformStatCard icon={Building2} title="Établissements" value={restaurants?.length || 0} description={`${activeCount} actifs`} />
        <PlatformStatCard icon={MessageSquare} title="Demandes" value={requests?.length || 0} description={`${newRequestsCount} nouvelles`} variant={newRequestsCount > 0 ? "warning" : "default"} />
        <PlatformStatCard icon={CreditCard} title="Abonnements" value="1.2M XOF" description="CA mensuel estimé" />
        <PlatformStatCard icon={Activity} title="État Système" value="100%" description="Services opérationnels" />
      </div>

      <Tabs defaultValue="restaurants" className="w-full">
        <TabsList className="bg-secondary/30 p-1 rounded-xl mb-6">
          <TabsTrigger value="restaurants" className="rounded-lg font-bold">RESTAURANTS</TabsTrigger>
          <TabsTrigger value="requests" className="rounded-lg font-bold">DEMANDES D'ACCÈS ({newRequestsCount})</TabsTrigger>
        </TabsList>

        <TabsContent value="restaurants" className="space-y-4">
          <Card className="border-none shadow-2xl">
            <CardHeader className="bg-secondary/10 p-6">
              <CardTitle className="text-xl font-black italic uppercase">Parc d'Établissements</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {restaurants?.map((r) => (
                  <div key={r.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-bold">{r.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{r.ownerEmail}</p>
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
                {(!restaurants || restaurants.length === 0) && !isRestaurantsLoading && (
                  <div className="p-8 text-center text-muted-foreground italic">Aucun établissement enregistré.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          <Card className="border-none shadow-2xl">
            <CardHeader className="bg-primary/5 p-6">
              <CardTitle className="text-xl font-black italic uppercase">Demandes de Démo / Accès</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {requests?.map((req) => (
                  <div key={req.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-black uppercase italic text-primary">{req.restaurantName}</p>
                        <Badge variant="outline" className="text-[9px]">{req.establishmentType}</Badge>
                      </div>
                      <div className="flex flex-col gap-0.5 text-sm">
                        <span className="font-bold">{req.managerName}</span>
                        <span className="text-muted-foreground text-xs">{req.city}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="text-right hidden md:block">
                        <p className="text-xs font-bold">{req.phone}</p>
                        <p className="text-[10px] text-muted-foreground">{req.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" className="text-xs font-bold" onClick={() => {
                          router.push(`/platform/restaurants/new?email=${req.email}&name=${req.restaurantName}`)
                        }}>
                          PROVISIONNER
                        </Button>
                        <Button size="icon" variant="ghost">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {(!requests || requests.length === 0) && !isRequestsLoading && (
                  <div className="p-8 text-center text-muted-foreground italic">Aucune demande en attente.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PlatformStatCard({ icon: Icon, title, value, description, variant = "default" }: any) {
  return (
    <Card className={cn(
      "border-none shadow-lg",
      variant === "warning" ? "bg-orange-500/5 ring-1 ring-orange-500/20" : ""
    )}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">{title}</CardTitle>
        <Icon className={cn("h-4 w-4", variant === "warning" ? "text-orange-500" : "text-primary")} />
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-black italic", variant === "warning" ? "text-orange-500" : "text-primary")}>{value}</div>
        <p className="text-[10px] font-medium text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}

import { cn } from "@/lib/utils";
