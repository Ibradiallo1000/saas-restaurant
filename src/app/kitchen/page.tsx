'use client';

import * as React from 'react';
import { useFirestore, useUser, useCollection, useDoc } from '@/firebase';
import { collection, query, where, orderBy, doc } from 'firebase/firestore';
import { COLLECTION_NAMES, ORDER_STATUS } from '@/lib/constants';
import { Clock, Utensils, CheckCircle2, PlayCircle, ChefHat } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OrderService } from '@/services/order.service';
import { cn } from '@/lib/utils';

export default function KitchenPage() {
  const { user } = useUser();
  const db = useFirestore();

  const userProfileRef = React.useMemo(() => {
    if (!db || !user) return null;
    return doc(db, COLLECTION_NAMES.USERS, user.uid);
  }, [db, user]);
  const { data: profile } = useDoc(userProfileRef);

  const kitchenQuery = React.useMemo(() => {
    if (!db || !profile?.restaurantId) return null;
    const q = query(
      collection(db, COLLECTION_NAMES.ORDERS),
      where('restaurantId', '==', profile.restaurantId),
      where('status', 'in', [ORDER_STATUS.PENDING, ORDER_STATUS.PREPARING]),
      orderBy('createdAt', 'asc')
    );
    return Object.assign(q, { __memo: true });
  }, [db, profile]);

  const { data: orders, isLoading } = useCollection(kitchenQuery);

  if (isLoading) return <div className="flex justify-center items-center min-h-screen"><ChefHat className="animate-bounce h-12 w-12 text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-black italic text-primary uppercase tracking-tighter flex items-center gap-3">
          <ChefHat className="h-10 w-10" /> Board Cuisine
        </h1>
        <Badge variant="secondary" className="px-4 py-1 text-lg font-bold">
          {orders?.length || 0} EN ATTENTE
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
        {orders?.map((order) => (
          <KitchenOrderCard key={order.id} order={order} db={db!} />
        ))}
      </div>
    </div>
  );
}

function KitchenOrderCard({ order, db }: { order: any, db: any }) {
  const orderService = new OrderService(db);
  const [elapsed, setElapsed] = React.useState('');

  React.useEffect(() => {
    const start = order.createdAt?.toDate?.() || new Date();
    const timer = setInterval(() => {
      const diff = Math.floor((new Date().getTime() - start.getTime()) / 60000);
      setElapsed(`${diff} min`);
    }, 10000);
    return () => clearInterval(timer);
  }, [order.createdAt]);

  const handleUpdate = (status: string) => {
    orderService.updateOrderStatus(order.id, status);
  };

  return (
    <Card className={cn(
      "border-none shadow-2xl transition-all h-full flex flex-col",
      order.status === ORDER_STATUS.PENDING ? "bg-yellow-500/5 ring-2 ring-yellow-500/20" : "bg-blue-500/5 ring-2 ring-blue-500/20"
    )}>
      <CardHeader className="p-4 border-b border-primary/5">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <CardTitle className="text-2xl font-black">
              {order.tableId ? `Table ${order.tableId}` : order.type.toUpperCase()}
            </CardTitle>
            <p className="text-xs text-muted-foreground font-mono">#{order.id.slice(-6)}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge className={order.status === ORDER_STATUS.PENDING ? "bg-yellow-500" : "bg-blue-500"}>
              {order.status.toUpperCase()}
            </Badge>
            <div className="flex items-center gap-1 text-sm font-bold text-muted-foreground">
              <Clock className="h-4 w-4" /> {elapsed}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 flex-1">
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-bold uppercase text-muted-foreground tracking-widest">Articles</p>
            {/* Note: Items should ideally be fetched from subcollection, for MVP we assume order might have them or we just show simple order details */}
            <div className="bg-background/50 rounded-lg p-3 border border-primary/5 min-h-[100px]">
              <p className="text-sm italic text-muted-foreground">Chargement des détails de la commande...</p>
            </div>
          </div>
        </div>
      </CardContent>
      <div className="p-4 pt-0 mt-auto flex gap-2">
        {order.status === ORDER_STATUS.PENDING && (
          <Button className="w-full bg-blue-600 hover:bg-blue-700 font-bold" onClick={() => handleUpdate(ORDER_STATUS.PREPARING)}>
            <PlayCircle className="mr-2 h-4 w-4" /> Préparer
          </Button>
        )}
        {order.status === ORDER_STATUS.PREPARING && (
          <Button className="w-full bg-green-600 hover:bg-green-700 font-bold" onClick={() => handleUpdate(ORDER_STATUS.READY)}>
            <CheckCircle2 className="mr-2 h-4 w-4" /> Prêt
          </Button>
        )}
      </div>
    </Card>
  );
}
