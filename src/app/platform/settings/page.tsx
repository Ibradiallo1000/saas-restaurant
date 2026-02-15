'use client';

/**
 * @fileOverview Page de configuration globale de la plateforme SaaS (Branding & Paramètres).
 */

import * as React from 'react';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { COLLECTION_NAMES } from '@/lib/constants';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, Save, Loader2, Globe, Palette, Mail, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';

export default function PlatformSettingsPage() {
  const db = useFirestore();
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);

  const configRef = useMemoFirebase(() => {
    if (!db) return null;
    return doc(db, COLLECTION_NAMES.PLATFORM, 'main');
  }, [db]);

  const { data: config, isLoading } = useDoc(configRef);

  const [formData, setFormData] = React.useState({
    name: '',
    supportEmail: '',
    primaryColor: '',
    secondaryColor: '',
    maintenanceMode: false,
  });

  React.useEffect(() => {
    if (config) {
      setFormData({
        name: config.name || '',
        supportEmail: config.supportEmail || '',
        primaryColor: config.primaryColor || '',
        secondaryColor: config.secondaryColor || '',
        maintenanceMode: config.maintenanceMode || false,
      });
    }
  }, [config]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configRef) return;
    setLoading(true);

    try {
      await updateDoc(configRef, {
        ...formData,
        updatedAt: serverTimestamp(),
      });
      toast({ title: "Configuration mise à jour", description: "Le branding de la plateforme a été actualisé." });
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible d'enregistrer les paramètres." });
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary h-10 w-10" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-primary rounded-xl text-primary-foreground">
          <Settings className="h-8 w-8" />
        </div>
        <div>
          <h1 className="text-4xl font-black italic uppercase tracking-tighter text-primary">Configuration SaaS</h1>
          <p className="text-muted-foreground font-medium">Personnalisez l'identité visuelle de votre plateforme GastronomeAI.</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="grid md:grid-cols-2 gap-8">
        <Card className="border-none shadow-2xl overflow-hidden md:col-span-2">
          <CardHeader className="bg-primary text-primary-foreground p-8">
            <CardTitle className="text-2xl font-black italic uppercase">Identité de Marque</CardTitle>
            <CardDescription className="text-white/80">Ces paramètres affectent l'ensemble des pages publiques et des emails.</CardDescription>
          </CardHeader>
          <CardContent className="p-8 grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Globe className="h-4 w-4" /> Nom de la Plateforme</Label>
              <Input 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="h-12 bg-secondary/30 border-none rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Mail className="h-4 w-4" /> Email de Support</Label>
              <Input 
                value={formData.supportEmail}
                onChange={e => setFormData({...formData, supportEmail: e.target.value})}
                className="h-12 bg-secondary/30 border-none rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Palette className="h-4 w-4" /> Couleur Primaire (HEX)</Label>
              <div className="flex gap-2">
                <div className="h-12 w-12 rounded-xl border" style={{ backgroundColor: formData.primaryColor }} />
                <Input 
                  value={formData.primaryColor}
                  onChange={e => setFormData({...formData, primaryColor: e.target.value})}
                  className="h-12 bg-secondary/30 border-none rounded-xl flex-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Palette className="h-4 w-4" /> Couleur Secondaire (HEX)</Label>
              <div className="flex gap-2">
                <div className="h-12 w-12 rounded-xl border" style={{ backgroundColor: formData.secondaryColor }} />
                <Input 
                  value={formData.secondaryColor}
                  onChange={e => setFormData({...formData, secondaryColor: e.target.value})}
                  className="h-12 bg-secondary/30 border-none rounded-xl flex-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-2xl">
          <CardHeader>
            <CardTitle className="text-xl font-black italic uppercase flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" /> Sécurité & État
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-xl">
              <div className="space-y-0.5">
                <Label className="font-bold">Mode Maintenance</Label>
                <p className="text-[10px] text-muted-foreground italic">Désactive l'accès aux dashboards restaurants.</p>
              </div>
              <Switch 
                checked={formData.maintenanceMode}
                onCheckedChange={v => setFormData({...formData, maintenanceMode: v})}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full h-12 font-bold uppercase italic shadow-lg" disabled={loading}>
              {loading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
              Enregistrer les modifications
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
