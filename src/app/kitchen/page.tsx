'use client';

import * as React from 'react';
import { useFirestore, useUser, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, doc } from 'firebase/firestore';
import { COLLECTION_NAMES, ORDER_STATUS } from '@/lib/constants';
import { Clock, Utensils, CheckCircle2, PlayCircle, ChefHat, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OrderService } from '@/services/order.service';
import { cn } from '@/lib/utils';

export default function KitchenPage() {
  const { user } = useUser();
  const db = useFirestore();

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, COLLECTION_NAMES.USERS, user.uid);
  }, [db, user]);
  const { data: profile } = useDoc(userProfileRef);

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

  if (isLoading) return <div className="flex flex-col justify-center items-center min-h-[60vh] gap-4">
    <Loader2 className="animate-spin h-10 w-10 text-primary" />
    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground animate-pulse">Chargement Cuisine...</p>
  </div>;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-black italic text-primary uppercase tracking-tighter flex items-center gap-3">
          <ChefHat className="h-10 w-10" /> Board Cuisine
        </h1>
        <Badge variant="secondary" className="px-4 py-1 text-lg font-bold bg-primary/10 text-primary border-primary/20">
          {orders?.length || 0} EN ATTENTE
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
        {orders?.map((order) => (
          <KitchenOrderCard key={order.id} order={order} db={db!} />
        ))}
        {orders?.length === 0 && (
          <div className="col-span-full h-[300px] flex flex-col items-center justify-center border-2 border-dashed border-muted rounded-2xl bg-card/20">
            <Utensils className="h-12 w-12 text-muted-foreground opacity-20 mb-4" />
            <p className="text-lg font-bold text-muted-foreground italic uppercase tracking-widest">Cuisine Libre</p>
          </div>
        )}
      </div>
    </div>
  );
}

function KitchenOrderCard({ order, db }: { order: any, db: any }) {
  const orderService = React.useMemo(() => new OrderService(db), [db]);
  const [elapsed, setElapsed] = React.useState('');

  React.useEffect(() => {
    const start = order.createdAt?.toDate?.() || new Date();
    const updateElapsed = () => {
      const diff = Math.floor((new Date().getTime() - start.getTime()) / 60000);
      setElapsed(`${diff} min`);
    };
    updateElapsed();
    const timer = setInterval(updateElapsed, 30000);
    return () => clearInterval(timer);
  }, [order.createdAt]);

  const handleUpdate = (status: string) => {
    orderService.updateOrderStatus(order.id, status);
  };

  return (
    <Card className={cn(
      "border-none shadow-2xl transition-all h-full flex flex-col group",
      order.status === ORDER_STATUS.PENDING ? "bg-yellow-500/5 ring-2 ring-yellow-500/20" : "bg-blue-500/5 ring-2 ring-blue-500/20"
    )}>
      <CardHeader className="p-4 border-b border-primary/5">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <CardTitle className="text-2xl font-black italic uppercase tracking-tighter">
              {order.tableId ? `Table ${order.tableId}` : order.type.toUpperCase()}
            </CardTitle>
            <p className="text-[10px] text-muted-foreground font-mono">#{order.id.slice(-6)}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge className={cn("text-[10px] font-black", order.status === ORDER_STATUS.PENDING ? "bg-yellow-500" : "bg-blue-500")}>
              {order.status.toUpperCase()}
            </Badge>
            <div className="flex items-center gap-1 text-sm font-black text-muted-foreground italic">
              <Clock className="h-4 w-4" /> {elapsed}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 flex-1">
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Détails Commande</p>
            <div className="bg-background/40 rounded-xl p-4 border border-primary/5 min-h-[120px] flex items-center justify-center">
              <p className="text-xs italic text-muted-foreground text-center">Contenu de la commande en chargement...</p>
            </div>
          </div>
        </div>
      </CardContent>
      <div className="p-4 pt-0 mt-auto flex gap-2">
        {order.status === ORDER_STATUS.PENDING && (
          <Button className="w-full bg-blue-600 hover:bg-blue-700 font-bold shadow-lg" onClick={() => handleUpdate(ORDER_STATUS.PREPARING)}>
            <PlayCircle className="mr-2 h-4 w-4" /> PRÉPARER
          </Button>
        )}
        {order.status === ORDER_STATUS.PREPARING && (
          <Button className="w-full bg-green-600 hover:bg-green-700 font-bold shadow-lg" onClick={() => handleUpdate(ORDER_STATUS.READY)}>
            <CheckCircle2 className="mr-2 h-4 w-4" /> PRÊT
          </Button>
        )}
      </div>
    </Card>
  );
}