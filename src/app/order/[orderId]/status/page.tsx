'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { COLLECTION_NAMES, ORDER_STATUS } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Sparkles, Clock, ChefHat, Bell, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function OrderStatusPage() {
  const params = useParams();
  const db = useFirestore();
  const orderId = params.orderId as string;

  const orderRef = React.useMemo(() => {
    if (!db || !orderId) return null;
    return doc(db, COLLECTION_NAMES.ORDERS, orderId);
  }, [db, orderId]);

  const { data: order, isLoading } = useDoc(orderRef);

  const getProgress = (status: string) => {
    switch (status) {
      case ORDER_STATUS.PENDING: return 20;
      case ORDER_STATUS.PREPARING: return 50;
      case ORDER_STATUS.READY: return 80;
      case ORDER_STATUS.SERVED:
      case ORDER_STATUS.DELIVERED: return 100;
      default: return 10;
    }
  };

  const steps = [
    { id: ORDER_STATUS.PENDING, label: 'Reçu', icon: Clock },
    { id: ORDER_STATUS.PREPARING, label: 'En Cuisine', icon: ChefHat },
    { id: ORDER_STATUS.READY, label: 'Prêt', icon: Bell },
    { id: ORDER_STATUS.SERVED, label: 'Servi', icon: CheckCircle2 },
  ];

  if (isLoading) return <div className="flex justify-center p-20 animate-pulse">Suivi de commande...</div>;
  if (!order) return <div className="text-center p-20 font-bold">Commande introuvable</div>;

  return (
    <div className="max-w-md mx-auto py-10 px-4 space-y-8 animate-in fade-in duration-700">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
          <Sparkles className="h-3 w-3" /> GastronomeAI • Suivi Live
        </div>
        <h1 className="text-4xl font-black italic text-primary uppercase tracking-tighter">Votre Commande</h1>
        <p className="text-muted-foreground font-medium">#{order.id.slice(-6)} • {order.totalAmount}€</p>
      </div>

      <Card className="border-none shadow-2xl overflow-hidden bg-card/80 backdrop-blur-sm">
        <CardHeader className="bg-primary text-primary-foreground p-8 text-center">
          <div className="mb-4">
            <Progress value={getProgress(order.status)} className="h-3 bg-white/20" />
          </div>
          <CardTitle className="text-2xl font-black italic uppercase">
            {steps.find(s => s.id === order.status)?.label || 'Chargement...'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <div className="space-y-6">
            {steps.map((step, idx) => {
              const isPast = getProgress(order.status) >= getProgress(step.id);
              const isCurrent = order.status === step.id;
              const Icon = step.icon;
              
              return (
                <div key={step.id} className={cn(
                  "flex items-center gap-4 transition-all duration-500",
                  isPast ? "opacity-100" : "opacity-30"
                )}>
                  <div className={cn(
                    "h-12 w-12 rounded-2xl flex items-center justify-center shadow-lg transition-all",
                    isCurrent ? "bg-primary text-white scale-110 animate-pulse" : isPast ? "bg-green-500 text-white" : "bg-muted"
                  )}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <p className={cn("font-black italic uppercase tracking-wider", isCurrent ? "text-primary text-lg" : "text-sm")}>
                      {step.label}
                    </p>
                    {isCurrent && <p className="text-xs font-medium text-muted-foreground italic">C'est l'étape actuelle !</p>}
                  </div>
                  {isPast && !isCurrent && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      
      <p className="text-center text-xs text-muted-foreground italic">
        Cette page se met à jour automatiquement dès que la cuisine progresse.
      </p>
    </div>
  );
}
