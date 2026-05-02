'use client';

import * as React from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Timestamp,
} from 'firebase/firestore';
import { Globe2, Loader2, Plus, Trash2 } from 'lucide-react';

import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { COLLECTION_NAMES } from '@/lib/constants';

type PlatformCountry = {
  code: string;
  name: string;
  currency: string;
  dialCode: string;
  isActive: boolean;
  createdAt?: Timestamp;
};

const EMPTY_FORM = {
  code: '',
  name: '',
  currency: '',
  dialCode: '',
};

export default function PlatformCountriesPage() {
  const db = useFirestore();
  const { toast } = useToast();
  const [formData, setFormData] = React.useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = React.useState(false);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const countriesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(
      collection(db, COLLECTION_NAMES.PLATFORM_COUNTRIES),
      orderBy('name', 'asc')
    );
  }, [db]);

  const { data: countries, isLoading } = useCollection<PlatformCountry>(countriesQuery);

  const isValid =
    formData.code.trim().length >= 2 &&
    formData.name.trim().length > 1 &&
    formData.currency.trim().length >= 3 &&
    formData.dialCode.trim().startsWith('+');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!db || !isValid) return;

    setIsSaving(true);

    try {
      await addDoc(collection(db, COLLECTION_NAMES.PLATFORM_COUNTRIES), {
        code: formData.code.trim().toUpperCase(),
        name: formData.name.trim(),
        currency: formData.currency.trim().toUpperCase(),
        dialCode: formData.dialCode.trim(),
        isActive: true,
        createdAt: serverTimestamp(),
      });

      setFormData(EMPTY_FORM);
      toast({ title: 'Pays ajouté', description: 'Le pays est disponible dans la plateforme.' });
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: "Impossible d'ajouter ce pays.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleCountry = async (countryId: string, nextValue: boolean) => {
    if (!db) return;

    setPendingId(countryId);

    try {
      await updateDoc(doc(db, COLLECTION_NAMES.PLATFORM_COUNTRIES, countryId), {
        isActive: nextValue,
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de modifier le statut du pays.',
      });
    } finally {
      setPendingId(null);
    }
  };

  const deleteCountry = async (countryId: string) => {
    if (!db) return;

    setPendingId(countryId);

    try {
      await deleteDoc(doc(db, COLLECTION_NAMES.PLATFORM_COUNTRIES, countryId));
      toast({ title: 'Pays supprimé' });
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de supprimer ce pays.',
      });
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-black italic uppercase tracking-tighter text-primary">
          Pays
        </h1>
        <p className="text-muted-foreground font-medium">
          Configuration des pays disponibles pour la plateforme.
        </p>
      </div>

      <Card className="border-none shadow-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-black italic uppercase">
            <Plus className="h-5 w-5 text-primary" />
            Ajouter un pays
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-5">
            <div className="space-y-2">
              <Label>Code ISO</Label>
              <Input
                placeholder="ML"
                value={formData.code}
                maxLength={2}
                onChange={(event) =>
                  setFormData({ ...formData, code: event.target.value })
                }
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Nom</Label>
              <Input
                placeholder="Mali"
                value={formData.name}
                onChange={(event) =>
                  setFormData({ ...formData, name: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Devise</Label>
              <Input
                placeholder="XOF"
                value={formData.currency}
                onChange={(event) =>
                  setFormData({ ...formData, currency: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Indicatif</Label>
              <Input
                placeholder="+223"
                value={formData.dialCode}
                onChange={(event) =>
                  setFormData({ ...formData, dialCode: event.target.value })
                }
              />
            </div>
            <Button
              type="submit"
              disabled={!isValid || isSaving}
              className="h-12 font-bold md:col-span-5"
            >
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Ajouter
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-none shadow-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-black italic uppercase">
            <Globe2 className="h-5 w-5 text-primary" />
            Liste des pays
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="divide-y">
              {(countries ?? []).map((country) => (
                <div
                  key={country.id}
                  className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-black uppercase text-primary">
                        {country.name}
                      </p>
                      <Badge variant={country.isActive ? 'default' : 'secondary'}>
                        {country.isActive ? 'Actif' : 'Inactif'}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {country.code} · {country.currency} · {country.dialCode}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-4 md:justify-end">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">
                        Actif
                      </Label>
                      <Switch
                        checked={country.isActive}
                        disabled={pendingId === country.id}
                        onCheckedChange={(checked) => toggleCountry(country.id, checked)}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={pendingId === country.id}
                      onClick={() => deleteCountry(country.id)}
                      aria-label={`Supprimer ${country.name}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}

              {!countries?.length && (
                <div className="p-12 text-center text-muted-foreground">
                  Aucun pays configuré.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
