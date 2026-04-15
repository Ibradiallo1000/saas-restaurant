
'use client';

/**
 * @fileOverview Interface Caisse (Cashier) - Monitoring temps réel et clôture des commandes.
 */

import * as React from 'react';
import { useFirestore, useUser, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { COLLECTION_NAMES, ORDER_STATUS } from '@/lib/constants';
import { ClipboardList, CheckCircle2, Clock, Loader2, BellRing } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function OrdersPage() {
  const { user } = useUser();
  const db = useFirestore();

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, COLLECTION_NAMES.USERS, user.uid);
  }, [db, user]);
  const { data: profile } = useDoc(userProfileRef);

  // Requête temps réel : toutes les commandes actives (non encore servies/livrées)
  const ordersQuery = useMemoFirebase(() => {
    if (!db || !profile?.restaurantId) return null;
    return query(
      collection(db, COLLECTION_NAMES.ORDERS),
      where('restaurantId', '==', profile.restaurantId),
      where('status', 'in', [ORDER_STATUS.PENDING, ORDER_STATUS.PREPARING, ORDER_STATUS.READY]),
      orderBy('createdAt', 'desc')
    );
  }, [db, profile]);

  const { data: orders, isLoading } = useCollection(ordersQuery);

  const completeOrder = async (orderId: string) => {
    if (!db) return;
    const orderRef = doc(db, COLLECTION_NAMES.ORDERS, orderId);
    await updateDoc(orderRef, {
      status: ORDER_STATUS.SERVED, // "Completed" dans le flux métier
      updatedAt: serverTimestamp(),
    });
  };

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <h1 className="text-3xl font-black italic uppercase tracking-tighter flex items-center gap-2">
          <ClipboardList className="h-8 w-8 text-primary" /> Gestion Commandes
        </h1>
        <div className="flex gap-2">
          <Badge variant="outline" className="font-bold">
            {orders?.filter(o => o.status === ORDER_STATUS.READY).length || 0} PRÊTES
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {orders?.map((order) => (
          <Card key={order.id} className={cn(
            "border-none shadow-lg transition-all",
            order.status === ORDER_STATUS.READY ? "ring-2 ring-green-500 bg-green-50" : "bg-card"
          )}>
            <CardHeader className="p-4 pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-sm font-bold">
                    {order.tableId ? `Table ${order.tableId}` : 'Emporté'}
                  </CardTitle>
                  <span className="text-[10px] font-mono text-muted-foreground">#{order.id.slice(-6)}</span>
                </div>
                <Badge className={cn(
                  "text-[9px] font-black",
                  order.status === ORDER_STATUS.READY ? "bg-green-500" : "bg-secondary text-muted-foreground"
                )}>
                  {order.status.toUpperCase()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-xs space-y-1 mb-4">
                <p className="font-bold text-muted-foreground italic">Client: {order.customerName || 'N/A'}</p>
                <div className="flex items-center gap-1 text-[10px] opacity-60">
                  <Clock className="h-3 w-3" />
                  {order.createdAt?.toDate?.().toLocaleTimeString()}
                </div>
              </div>

              {order.status === ORDER_STATUS.READY ? (
                <Button className="w-full bg-green-600 hover:bg-green-700 font-bold" onClick={() => completeOrder(order.id)}>
                  <BellRing className="mr-2 h-4 w-4 animate-bounce" /> MARQUER SERVI
                </Button>
              ) : (
                <div className="text-center py-2 bg-muted/50 rounded text-[10px] font-bold uppercase text-muted-foreground">
                  En cours de préparation...
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {orders?.length === 0 && (
          <div className="col-span-full h-40 flex items-center justify-center text-muted-foreground italic">
            Aucune commande active en caisse.
          </div>
        )}
      </div>
    </div>
  );
}
