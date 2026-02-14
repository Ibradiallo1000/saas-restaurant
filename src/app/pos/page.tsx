'use client';

import * as React from 'react';
import { useFirestore, useUser, useCollection, useDoc } from '@/firebase';
import { collection, query, where, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { COLLECTION_NAMES, PAYMENT_STATUS, ORDER_STATUS } from '@/lib/constants';
import { Search, CreditCard, Banknote, History, Filter, LogOut } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

export default function POSPage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = React.useState('');

  const userProfileRef = React.useMemo(() => {
    if (!db || !user) return null;
    return doc(db, COLLECTION_NAMES.USERS, user.uid);
  }, [db, user]);
  const { data: profile } = useDoc(userProfileRef);

  const posQuery = React.useMemo(() => {
    if (!db || !profile?.restaurantId) return null;
    const q = query(
      collection(db, COLLECTION_NAMES.ORDERS),
      where('restaurantId', '==', profile.restaurantId),
      where('paymentStatus', '==', PAYMENT_STATUS.UNPAID),
      orderBy('createdAt', 'desc')
    );
    return Object.assign(q, { __memo: true });
  }, [db, profile]);

  const { data: orders, isLoading } = useCollection(posQuery);

  const handlePayment = async (orderId: string, method: 'cash' | 'mobile_money') => {
    if (!db) return;
    const orderRef = doc(db, COLLECTION_NAMES.ORDERS, orderId);
    await updateDoc(orderRef, {
      paymentStatus: PAYMENT_STATUS.PAID,
      paymentMethod: method,
      updatedAt: serverTimestamp(),
    });
    toast({
      title: "Paiement Validé",
      description: `Commande ${orderId.slice(-6)} marquée comme payée via ${method}.`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black italic text-primary uppercase tracking-tighter">Point de Vente</h1>
          <p className="text-muted-foreground font-medium">Gestion des encaissements et sessions.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push('/pos/session')}>
            <History className="mr-2 h-4 w-4" /> Ma Session
          </Button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Table ou client..." 
              className="pl-10" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {orders?.map((order) => (
          <Card key={order.id} className="border-none shadow-xl overflow-hidden group hover:ring-2 ring-primary/20 transition-all">
            <CardHeader className="bg-secondary/30 p-4">
              <div className="flex justify-between items-center">
                <Badge variant="outline" className="font-bold">
                  {order.type.toUpperCase()}
                </Badge>
                <span className="text-xl font-black text-primary">{order.totalAmount}€</span>
              </div>
              <CardTitle className="mt-2 text-lg">
                {order.tableId ? `Table ${order.tableId}` : order.customerName || 'Client'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="flex flex-col gap-2">
                <Button className="w-full h-12 bg-green-600 hover:bg-green-700 font-bold" onClick={() => handlePayment(order.id, 'cash')}>
                  <Banknote className="mr-2 h-5 w-5" /> Encaisser Espèces
                </Button>
                <Button variant="outline" className="w-full h-12 border-primary text-primary hover:bg-primary/10 font-bold" onClick={() => handlePayment(order.id, 'mobile_money')}>
                  <CreditCard className="mr-2 h-5 w-5" /> Mobile Money
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {orders?.length === 0 && (
          <div className="col-span-full h-[300px] flex flex-col items-center justify-center bg-muted/20 rounded-2xl border-2 border-dashed">
            <Filter className="h-12 w-12 text-muted-foreground opacity-20 mb-4" />
            <p className="text-lg font-bold text-muted-foreground">Aucun paiement en attente</p>
          </div>
        )}
      </div>
    </div>
  );
}
