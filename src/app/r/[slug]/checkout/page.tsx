'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CartProvider, useCart } from '@/components/public/cart-context';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { COLLECTION_NAMES, ORDER_STATUS, PAYMENT_STATUS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, CheckCircle2, Loader2, Phone, User, ShoppingBag, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function CheckoutPageWrapper() {
  return (
    <CartProvider>
      <CheckoutPage />
    </CartProvider>
  );
}

function CheckoutPage() {
  const params = useParams();
  const slug = params.slug as string;
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { items, totalPrice, clearCart } = useCart();
  
  const [loading, setLoading] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [formData, setFormData] = React.useState({
    name: '',
    phone: '',
    table: ''
  });

  const restaurantQuery = useMemoFirebase(() => {
    if (!db || !slug) return null;
    return query(collection(db, COLLECTION_NAMES.RESTAURANTS), where('slug', '==', slug), limit(1));
  }, [db, slug]);
  const { data: restaurants } = useCollection(restaurantQuery);
  const restaurant = restaurants?.[0];

  const handleOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !restaurant || items.length === 0) return;
    setLoading(true);

    try {
      const orderRef = await addDoc(collection(db, COLLECTION_NAMES.ORDERS), {
        restaurantId: restaurant.id,
        customerName: formData.name,
        customerPhone: formData.phone,
        tableId: formData.table || 'Emporté',
        items: items.map(i => ({
          productId: i.id,
          name: i.name,
          price: i.price,
          quantity: i.quantity
        })),
        totalAmount: totalPrice,
        status: ORDER_STATUS.PENDING,
        paymentStatus: PAYMENT_STATUS.UNPAID,
        type: formData.table ? 'table' : 'takeaway',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Also create sub-collection for items (redundancy for existing services)
      for (const item of items) {
        await addDoc(collection(db, COLLECTION_NAMES.ORDERS, orderRef.id, COLLECTION_NAMES.ORDER_ITEMS), {
          productId: item.id,
          nameSnapshot: item.name,
          priceSnapshot: item.price,
          quantity: item.quantity,
          subtotal: item.price * item.quantity,
          createdAt: serverTimestamp()
        });
      }

      setSuccess(true);
      clearCart();
      toast({ title: "Commande envoyée !", description: "La cuisine a reçu votre demande." });
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de valider la commande." });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-6 animate-in zoom-in-95 duration-500">
        <div className="h-24 w-24 bg-green-100 rounded-full flex items-center justify-center">
          <CheckCircle2 className="h-12 w-12 text-green-600" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-black italic uppercase tracking-tighter">Merci !</h1>
          <p className="text-muted-foreground">Votre commande est en préparation. Restez sur cette page pour suivre le statut.</p>
        </div>
        <Button className="w-full h-14 rounded-2xl font-black uppercase italic" onClick={() => router.push(`/r/${slug}`)}>
          Commander à nouveau
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl bg-secondary/50">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-black italic uppercase tracking-tighter">Finaliser Commande</h1>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <Card className="border-none shadow-xl rounded-3xl overflow-hidden">
            <CardHeader className="bg-primary text-white p-6">
              <CardTitle className="flex items-center gap-2 italic uppercase">
                <ShoppingBag className="h-5 w-5" /> Récapitulatif
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {items.map(item => (
                <div key={item.id} className="flex justify-between items-center py-2 border-b border-primary/5 last:border-0">
                  <div className="flex gap-3 items-center">
                    <span className="font-black text-primary bg-primary/10 h-6 w-6 rounded flex items-center justify-center text-[10px]">{item.quantity}x</span>
                    <span className="font-bold text-sm">{item.name}</span>
                  </div>
                  <span className="font-black italic text-sm">{item.price * item.quantity}{restaurant?.currency || '€'}</span>
                </div>
              ))}
              <div className="pt-4 flex justify-between items-center text-xl font-black italic text-primary uppercase">
                <span>Total</span>
                <span>{totalPrice}{restaurant?.currency || '€'}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <form onSubmit={handleOrder} className="space-y-6">
          <Card className="border-none shadow-xl rounded-3xl overflow-hidden">
            <CardHeader className="p-6">
              <CardTitle className="text-xl font-black italic uppercase">Vos Informations</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Nom complet</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                  <Input 
                    required 
                    placeholder="Ex: John Doe" 
                    className="pl-10 h-12 bg-secondary/30 border-none rounded-xl"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Numéro WhatsApp</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                  <Input 
                    required 
                    type="tel"
                    placeholder="+225 07..." 
                    className="pl-10 h-12 bg-secondary/30 border-none rounded-xl"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Numéro de Table (Optionnel)</Label>
                <Input 
                  placeholder="Ex: 4" 
                  className="h-12 bg-secondary/30 border-none rounded-xl"
                  value={formData.table}
                  onChange={e => setFormData({...formData, table: e.target.value})}
                />
                <p className="text-[10px] italic text-muted-foreground">Laissez vide si vous emportez.</p>
              </div>
            </CardContent>
          </Card>

          <Button 
            type="submit" 
            className="w-full h-16 text-xl font-black uppercase italic rounded-3xl shadow-[0_20px_50px_rgba(249,115,22,0.3)] group"
            disabled={loading || items.length === 0}
          >
            {loading ? <Loader2 className="animate-spin h-6 w-6" /> : (
              <>Envoyer la commande <Send className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" /></>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
