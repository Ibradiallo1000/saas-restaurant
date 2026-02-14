'use client';

import * as React from 'react';
import { useFirestore, useUser, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, doc } from 'firebase/firestore';
import { COLLECTION_NAMES, PAYMENT_STATUS } from '@/lib/constants';
import { Search, CreditCard, Banknote, History, Filter, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { OrderService } from '@/services/order.service';

export default function POSPage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [processingId, setProcessingId] = React.useState<string | null>(null);

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, COLLECTION_NAMES.USERS, user.uid);
  }, [db, user]);
  const { data: profile } = useDoc(userProfileRef);

  const orderService = React.useMemo(() => db ? new OrderService(db) : null, [db]);

  const posQuery = useMemoFirebase(() => {
    if (!db || !profile?.restaurantId) return null;
    return query(
      collection(db, COLLECTION_NAMES.ORDERS),
      where('restaurantId', '==', profile.restaurantId),
      where('paymentStatus', '==', PAYMENT_STATUS.UNPAID),
      orderBy('createdAt', 'desc')
    );
  }, [db, profile]);

  const { data: orders, isLoading } = useCollection(posQuery);

  const handlePayment = async (orderId: string, method: 'cash' | 'mobile_money') => {
    if (!orderService || !profile?.restaurantId) return;
    
    setProcessingId(orderId);
    try {
      await orderService.processPayment(orderId, profile.restaurantId, method);
      toast({
        title: "Paiement Validé",
        description: `Commande traitée. Inventaire et fidélité mis à jour.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Le traitement du paiement a échoué.",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const filteredOrders = React.useMemo(() => {
    if (!orders) return []
    return orders.filter(o => 
      o.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.tableId?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [orders, searchTerm])

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

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
        {filteredOrders.map((order) => (
          <Card key={order.id} className="border-none shadow-xl overflow-hidden group hover:ring-2 ring-primary/20 transition-all bg-card/80 backdrop-blur-sm">
            <CardHeader className="bg-secondary/30 p-4">
              <div className="flex justify-between items-center">
                <Badge variant="outline" className="font-bold uppercase text-[10px]">
                  {order.type}
                </Badge>
                <span className="text-xl font-black text-primary italic">{order.totalAmount}€</span>
              </div>
              <CardTitle className="mt-2 text-lg font-bold">
                {order.tableId ? `Table ${order.tableId}` : order.customerName || 'Client'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="flex flex-col gap-2">
                <Button 
                  className="w-full h-12 bg-green-600 hover:bg-green-700 font-bold shadow-lg" 
                  onClick={() => handlePayment(order.id, 'cash')}
                  disabled={processingId === order.id}
                >
                  {processingId === order.id ? <Loader2 className="animate-spin" /> : <><Banknote className="mr-2 h-5 w-5" /> Encaisser Espèces</>}
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full h-12 border-primary/20 text-primary hover:bg-primary/5 font-bold" 
                  onClick={() => handlePayment(order.id, 'mobile_money')}
                  disabled={processingId === order.id}
                >
                  <CreditCard className="mr-2 h-5 w-5" /> Mobile Money
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {filteredOrders.length === 0 && (
          <div className="col-span-full h-[300px] flex flex-col items-center justify-center bg-muted/20 rounded-2xl border-2 border-dashed border-muted">
            <Filter className="h-12 w-12 text-muted-foreground opacity-20 mb-4" />
            <p className="text-lg font-bold text-muted-foreground italic">Aucun paiement en attente</p>
          </div>
        )}
      </div>
    </div>
  );
}