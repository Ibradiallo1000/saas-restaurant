
'use client';

/**
 * @fileOverview Interface Cuisine (Kitchen) - Mise à jour en temps réel des préparations.
 */

import * as React from 'react';
import { useFirestore, useUser, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { COLLECTION_NAMES, ORDER_STATUS } from '@/lib/constants';
import { ChefHat, PlayCircle, CheckCircle2, Clock, Loader2, Utensils } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function KitchenPage() {
  const { user } = useUser();
  const db = useFirestore();

  // Récupération du profil pour filtrer par restaurant (contexte multi-tenant préservé)
  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, COLLECTION_NAMES.USERS, user.uid);
  }, [db, user]);
  const { data: profile } = useDoc(userProfileRef);

  // Requête temps réel : uniquement les commandes en attente ou en préparation
  const kitchenQuery = useMemoFirebase(() => {
    if (!db || !profile?.restaurantId) return null;
    return query(
      collection(db, COLLECTION_NAMES.ORDERS),
      where('restaurantId', '==', profile.restaurantId),
      where('status', 'in', [ORDER_STATUS.PENDING, ORDER_STATUS.PREPARING]),
      orderBy('createdAt', 'asc')
    );
  }, [db, profile]);

  const { data: orders, isLoading } = useCollection(kitchenQuery);

  const updateStatus = async (orderId: string, newStatus: string) => {
    if (!db) return;
    const orderRef = doc(db, COLLECTION_NAMES.ORDERS, orderId);
    await updateDoc(orderRef, {
      status: newStatus,
      updatedAt: serverTimestamp(),
    });
  };

  if (isLoading) return <div className="flex flex-col items-center justify-center min-h-[50vh]"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <h1 className="text-3xl font-black italic uppercase tracking-tighter flex items-center gap-2">
          <ChefHat className="h-8 w-8 text-primary" /> Écran Cuisine
        </h1>
        <Badge variant="secondary" className="font-bold">{orders?.length || 0} EN COURS</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {orders?.map((order) => (
          <Card key={order.id} className={cn(
            "border-none shadow-lg transition-all",
            order.status === ORDER_STATUS.PENDING ? "bg-yellow-50" : "bg-blue-50"
          )}>
            <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg font-black uppercase">
                {order.tableId ? `Table ${order.tableId}` : 'À Emporter'}
              </CardTitle>
              <Badge className={cn(
                "text-[10px] font-bold",
                order.status === ORDER_STATUS.PENDING ? "bg-yellow-500" : "bg-blue-500"
              )}>
                {order.status === ORDER_STATUS.PENDING ? 'ATTENTE' : 'CUISINE'}
              </Badge>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-4">
              <div className="min-h-[60px] text-sm font-medium border-l-2 border-primary/20 pl-3">
                {order.items?.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between">
                    <span>{item.quantity}x {item.name || item.nameSnapshot}</span>
                  </div>
                ))}
              </div>
              
              <div className="pt-2">
                {order.status === ORDER_STATUS.PENDING ? (
                  <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => updateStatus(order.id, ORDER_STATUS.PREPARING)}>
                    <PlayCircle className="mr-2 h-4 w-4" /> LANCER
                  </Button>
                ) : (
                  <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => updateStatus(order.id, ORDER_STATUS.READY)}>
                    <CheckCircle2 className="mr-2 h-4 w-4" /> PRÊT
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {orders?.length === 0 && (
          <div className="col-span-full h-40 flex flex-col items-center justify-center border-2 border-dashed rounded-xl opacity-30">
            <Utensils className="h-10 w-10 mb-2" />
            <p className="font-bold uppercase tracking-widest text-xs">Cuisine vide</p>
          </div>
        )}
      </div>
    </div>
  );
}
