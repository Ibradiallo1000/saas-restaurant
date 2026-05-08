
'use client';

import * as React from 'react';
import { useFirestore } from '@/firebase';
import { CashierService } from '@/services/cashier.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Power, Receipt, Wallet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRestaurant } from '@/design-system/context/RestaurantContext';
import { useTenant } from '@/design-system/context/TenantProvider';

export default function CashierSessionPage() {
  const db = useFirestore();
  const { restaurantId } = useRestaurant();
  const { user } = useTenant();
  const { toast } = useToast();
  const [session, setSession] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])
const cashierService = React.useMemo(() => db ? new CashierService(db) : null, [db]);

  const loadSession = React.useCallback(async () => {
    if (!cashierService || !restaurantId || !user) return;
    const current = await cashierService.getCurrentSession(restaurantId, user.uid);
    setSession(current);
    setLoading(false);
  }, [cashierService, restaurantId, user]);

  React.useEffect(() => {
    if (mounted) loadSession();
  }, [loadSession, mounted]);

  const handleOpenShift = async () => {
    if (!cashierService || !restaurantId || !user) return;
    await cashierService.openShift(restaurantId, user.uid);
    toast({ title: "Session ouverte", description: "Bon service !" });
    loadSession();
  };

  const handleCloseShift = async () => {
    if (!cashierService || !session) return;
    await cashierService.closeShift(session.id, { cash: 0, mobileMoney: 0 }); // Simplifié pour MVP
    toast({ title: "Session clôturée", description: "Rapport généré avec succès." });
    loadSession();
  };

  const formatSessionDate = (timestamp: any) => {
    if (!timestamp || !mounted) return "...";
    return new Date(timestamp.toDate()).toLocaleString();
  };

  if (loading || !mounted) return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="max-w-2xl mx-auto py-10">
      {!session ? (
        <Card className="border-none shadow-2xl text-center p-10">
          <CardHeader>
            <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Power className="h-10 w-10 text-primary" />
            </div>
            <CardTitle className="text-3xl font-black italic uppercase">Ouverture de Caisse</CardTitle>
            <CardDescription>Prêt pour un nouveau service ? Ouvrez votre session pour commencer à encaisser.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Button size="lg" className="w-full h-14 text-lg font-bold shadow-xl" onClick={handleOpenShift}>
              Démarrer mon Service
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-none shadow-2xl overflow-hidden">
          <CardHeader className="bg-primary text-primary-foreground p-8">
            <CardTitle className="text-3xl font-black italic uppercase">Session en cours</CardTitle>
            <CardDescription className="text-primary-foreground/80">Ouverte le {formatSessionDate(session.openedAt)}</CardDescription>
          </CardHeader>
          <CardContent className="p-8 space-y-8">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-6 bg-secondary/30 rounded-2xl border border-primary/5">
                <Wallet className="h-8 w-8 text-primary mb-2" />
                <p className="text-sm font-bold text-muted-foreground uppercase">Espèces</p>
                <p className="text-2xl font-black">{session.totalCash}€</p>
              </div>
              <div className="p-6 bg-secondary/30 rounded-2xl border border-primary/5">
                <Receipt className="h-8 w-8 text-primary mb-2" />
                <p className="text-sm font-bold text-muted-foreground uppercase">Mobile Money</p>
                <p className="text-2xl font-black">{session.totalMobileMoney}€</p>
              </div>
            </div>
            <Button variant="destructive" size="lg" className="w-full h-14 font-bold" onClick={handleCloseShift}>
              Clôturer ma Session
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
