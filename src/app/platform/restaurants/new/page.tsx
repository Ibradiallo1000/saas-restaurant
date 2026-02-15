
'use client';

/**
 * @fileOverview Formulaire de provisionnement d'un nouveau restaurant par la plateforme.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore } from '@/firebase';
import { RestaurantService } from '@/services/restaurant.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Building2, Save, Loader2, ArrowLeft } from 'lucide-react';

export default function NewRestaurantPage() {
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);

  const [formData, setFormData] = React.useState({
    name: '',
    slug: '',
    country: 'CI',
    currency: 'XOF',
    ownerEmail: '',
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) return;
    setLoading(true);

    const restaurantService = new RestaurantService(db);

    try {
      await restaurantService.createRestaurantForOwner(formData.ownerEmail, formData);
      toast({
        title: "Provisionnement réussi",
        description: `L'établissement ${formData.name} est prêt.`,
      });
      router.push('/platform');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8">
      <Button variant="ghost" className="mb-6 font-bold" onClick={() => router.back()}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Retour
      </Button>

      <Card className="border-none shadow-2xl">
        <CardHeader className="bg-primary text-primary-foreground p-8">
          <div className="flex items-center gap-3">
            <Building2 className="h-8 w-8" />
            <CardTitle className="text-2xl font-black italic uppercase">Nouveau Restaurant</CardTitle>
          </div>
          <CardDescription className="text-primary-foreground/80">
            Initialisez une nouvelle instance SaaS pour un client.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleCreate}>
          <CardContent className="p-8 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="ownerEmail">Email du Propriétaire (Owner)</Label>
              <Input 
                id="ownerEmail" 
                type="email"
                placeholder="email@proprietaire.com" 
                required 
                value={formData.ownerEmail}
                onChange={e => setFormData({...formData, ownerEmail: e.target.value})}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="name">Nom de l'Établissement</Label>
              <Input 
                id="name" 
                placeholder="Ex: Le Palais de la Gastronomie" 
                required 
                value={formData.name}
                onChange={e => {
                  const slug = e.target.value.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
                  setFormData({...formData, name: e.target.value, slug});
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Pays</Label>
                <Select value={formData.country} onValueChange={v => setFormData({...formData, country: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CI">Côte d'Ivoire</SelectItem>
                    <SelectItem value="SN">Sénégal</SelectItem>
                    <SelectItem value="BJ">Bénin</SelectItem>
                    <SelectItem value="GH">Ghana</SelectItem>
                    <SelectItem value="NG">Nigéria</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Devise</Label>
                <Select value={formData.currency} onValueChange={v => setFormData({...formData, currency: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="XOF">XOF (FCFA)</SelectItem>
                    <SelectItem value="GHS">GHS (Cedi)</SelectItem>
                    <SelectItem value="NGN">NGN (Naira)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
          <CardFooter className="p-8 bg-secondary/30 flex justify-end">
            <Button type="submit" className="px-8 h-12 font-bold uppercase italic" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Créer l'Établissement
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
