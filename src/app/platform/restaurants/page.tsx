'use client';

/**
 * @fileOverview Page de gestion de tous les établissements du réseau.
 */

import * as React from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { COLLECTION_NAMES } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Plus, ChevronRight, Search, MapPin, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

export default function RestaurantsAdminPage() {
  const db = useFirestore();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = React.useState('');

  const restaurantsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, COLLECTION_NAMES.RESTAURANTS), orderBy('createdAt', 'desc'));
  }, [db]);

  const { data: restaurants, isLoading } = useCollection(restaurantsQuery);

  const filteredRestaurants = React.useMemo(() => {
    if (!restaurants) return [];
    return restaurants.filter(r => 
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      r.ownerEmail?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [restaurants, searchTerm]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black italic uppercase tracking-tighter text-primary">Établissements</h1>
          <p className="text-muted-foreground font-medium">Gestion du parc de restaurants et hôtels GastronomeAI.</p>
        </div>
        <Button onClick={() => router.push('/platform/restaurants/new')} className="shadow-xl">
          <Plus className="mr-2 h-4 w-4" /> Provisionner un Restaurant
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Rechercher par nom ou email..." 
          className="pl-10 h-12 bg-white border-none shadow-sm rounded-xl"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <Card className="border-none shadow-2xl overflow-hidden">
        <CardContent className="p-0">
          <div className="divide-y">
            {filteredRestaurants.map((r) => (
              <div key={r.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/5">
                    <Building2 className="h-7 w-7 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-black uppercase italic text-primary leading-none">{r.name}</p>
                      <Badge variant={r.active ? "default" : "secondary"} className="text-[9px] font-black uppercase">
                        {r.subscriptionStatus}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium">
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {r.city || r.country}</span>
                      <span className="flex items-center gap-1"><Globe className="h-3 w-3" /> {r.slug}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-mono">{r.ownerEmail}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right hidden md:block">
                    <p className="text-xs font-bold">Expire le</p>
                    <p className="text-sm font-black text-primary">
                      {r.subscriptionEndDate ? new Date(r.subscriptionEndDate).toLocaleDateString() : 'Non définie'}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" className="font-bold border-primary/20 text-primary" onClick={() => router.push(`/platform/restaurants/${r.id}`)}>
                    GÉRER <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {filteredRestaurants.length === 0 && !isLoading && (
              <div className="p-20 text-center space-y-4">
                <Building2 className="h-12 w-12 text-muted-foreground mx-auto opacity-20" />
                <p className="text-muted-foreground italic">Aucun établissement trouvé.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
