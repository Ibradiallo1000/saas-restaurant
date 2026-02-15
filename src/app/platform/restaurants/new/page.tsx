'use client';

/**
 * @fileOverview Formulaire de provisionnement d'un nouveau restaurant par la plateforme.
 * Gère la création complète du compte propriétaire et de l'établissement.
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
import { Building2, Save, Loader2, ArrowLeft, Mail } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
        description: `L'établissement ${formData.name} est prêt et un email a été envoyé à ${formData.ownerEmail}.`,
      });
      router.push('/platform');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur de provisioning",
        description: error.message || "Une erreur est survenue lors de la création.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <Button variant="ghost" className="mb-6 font-bold" onClick={() => router.back()}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Retour
      </Button>

      <Card className="border-none shadow-2xl overflow-hidden rounded-3xl">
        <CardHeader className="bg-primary text-primary-foreground p-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
              <Building2 className="h-8 w-8" />
            </div>
            <div>
              <CardTitle className="text-2xl font-black italic uppercase tracking-tighter">Provisionnement</CardTitle>
              <CardDescription className="text-primary-foreground/80">
                Créez une instance et un compte propriétaire en une étape.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <form onSubmit={handleCreate}>
          <CardContent className="p-8 space-y-6">
            <Alert className="bg-primary/5 border-primary/20">
              <Mail className="h-4 w-4 text-primary" />
              <AlertTitle className="text-primary font-bold">Information Sécurité</AlertTitle>
              <AlertDescription className="text-xs italic">
                Un compte Firebase Authentication sera créé. Le propriétaire recevra un email automatique pour définir son mot de passe.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="ownerEmail" className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Email du Propriétaire</Label>
              <Input 
                id="ownerEmail" 
                type="email"
                placeholder="Ex: proprietaire@restaurant.com" 
                required 
                className="h-12 bg-secondary/30 border-none rounded-xl"
                value={formData.ownerEmail}
                onChange={e => setFormData({...formData, ownerEmail: e.target.value})}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="name" className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Nom de l'Établissement</Label>
              <Input 
                id="name" 
                placeholder="Ex: Le Palais de la Gastronomie" 
                required 
                className="h-12 bg-secondary/30 border-none rounded-xl"
                value={formData.name}
                onChange={e => {
                  const slug = e.target.value.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
                  setFormData({...formData, name: e.target.value, slug});
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Pays</Label>
                <Select value={formData.country} onValueChange={v => setFormData({...formData, country: v})}>
                  <SelectTrigger className="h-12 bg-secondary/30 border-none rounded-xl"><SelectValue /></SelectTrigger>
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
                <Label className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Devise</Label>
                <Select value={formData.currency} onValueChange={v => setFormData({...formData, currency: v})}>
                  <SelectTrigger className="h-12 bg-secondary/30 border-none rounded-xl"><SelectValue /></SelectTrigger>
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

          <CardFooter className="p-8 pt-0">
            <Button type="submit" className="w-full h-14 text-lg font-black uppercase italic shadow-2xl" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <><Save className="mr-2 h-5 w-5" /> Provisionner l'Espace</>}
            </Button>
          </CardFooter>
        </form>
      </Card>
      
      <p className="text-center text-[10px] text-muted-foreground mt-8 italic">
        Une fois créé, l'établissement sera immédiatement actif avec un plan d'essai de 30 jours.
      </p>
    </div>
  );
}
