'use client';

import * as React from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore';
import { CreditCard, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';

import { useCollectionOnce, useFirestore, useMemoFirebase } from '@/firebase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MediaSelector } from '@/components/platform/MediaSelector';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { COLLECTION_NAMES } from '@/lib/constants';
import { PlatformConfirmationDialog, PlatformHeader, PlatformPage } from '@/components/platform-ui';

type PaymentMethodType = 'ussd' | 'link';

type PlatformPaymentMethod = {
  name: string;
  code: string;
  logoUrl: string;
  type: PaymentMethodType;
  isActive: boolean;
};

const EMPTY_FORM: PlatformPaymentMethod = {
  name: '',
  code: '',
  logoUrl: '',
  type: 'ussd',
  isActive: true,
};

export default function PlatformPaymentMethodsPage() {
  const db = useFirestore();
  const { toast } = useToast();
  const [formData, setFormData] = React.useState<PlatformPaymentMethod>(EMPTY_FORM);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = React.useState<{ id: string; name: string } | null>(null);

  const methodsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(
      collection(db, COLLECTION_NAMES.PLATFORM_PAYMENT_METHODS),
      orderBy('name', 'asc'),
      limit(50)
    );
  }, [db]);

  const { data: methods, isLoading, refetch } = useCollectionOnce<PlatformPaymentMethod>(methodsQuery);

  const isValid =
    formData.name.trim().length > 1 &&
    formData.code.trim().length > 1 &&
    ['ussd', 'link'].includes(formData.type);

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setEditingId(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!db || !isValid) return;

    setIsSaving(true);

    const finalLogoUrl = formData.logoUrl.startsWith('blob:') ? "" : formData.logoUrl.trim();

    const payload = {
      name: formData.name.trim(),
      code: formData.code.trim().toLowerCase(),
      logoUrl: finalLogoUrl,
      type: formData.type,
      isActive: formData.isActive,
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, COLLECTION_NAMES.PLATFORM_PAYMENT_METHODS, editingId), payload);
        refetch();
        toast({ title: 'Méthode mise à jour' });
      } else {
        await addDoc(collection(db, COLLECTION_NAMES.PLATFORM_PAYMENT_METHODS), payload);
        refetch();
        toast({ title: 'Méthode ajoutée' });
      }

      resetForm();
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: "Impossible d'enregistrer cette méthode.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (method: PlatformPaymentMethod & { id: string }) => {
    setEditingId(method.id);
    setFormData({
      name: method.name || '',
      code: method.code || '',
      logoUrl: method.logoUrl?.startsWith('blob:') ? '' : (method.logoUrl || ''),
      type: method.type || 'ussd',
      isActive: method.isActive ?? true,
    });
  };

  const toggleMethod = async (methodId: string, nextValue: boolean) => {
    if (!db) return;

    setPendingId(methodId);

    try {
      await updateDoc(doc(db, COLLECTION_NAMES.PLATFORM_PAYMENT_METHODS, methodId), {
        isActive: nextValue,
      });
      refetch();
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de modifier le statut.',
      });
    } finally {
      setPendingId(null);
    }
  };

  const deleteMethod = async (methodId: string) => {
    if (!db) return;

    setPendingId(methodId);

    try {
      await deleteDoc(doc(db, COLLECTION_NAMES.PLATFORM_PAYMENT_METHODS, methodId));
      refetch();
      if (editingId === methodId) resetForm();
      toast({ title: 'Méthode supprimée' });
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de supprimer cette méthode.',
      });
    } finally {
      setPendingId(null);
      setDeleteCandidate(null);
    }
  };

  return (
    <PlatformPage>
      <PlatformHeader title="Moyens de paiement" subtitle="Configuration des moyens de paiement disponibles sur la plateforme." />

      <Card className="border-none shadow-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-black italic uppercase">
            {editingId ? <Pencil className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
            {editingId ? 'Modifier une méthode' : 'Ajouter une méthode'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-6">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="platform-payment-method-name">Nom</Label>
              <Input
                id="platform-payment-method-name"
                placeholder="Orange Money"
                value={formData.name}
                onChange={(event) => setFormData({ ...formData, name: event.target.value })}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="platform-payment-method-code">Code</Label>
              <Input
                id="platform-payment-method-code"
                placeholder="orange_money"
                value={formData.code}
                onChange={(event) => setFormData({ ...formData, code: event.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="platform-payment-method-type">Type</Label>
              <select
                id="platform-payment-method-type"
                value={formData.type}
                onChange={(event) =>
                  setFormData({ ...formData, type: event.target.value as PaymentMethodType })
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="ussd">USSD</option>
                <option value="link">Lien</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="platform-payment-method-active">Actif</Label>
              <div className="flex h-10 items-center">
                <Switch
                  id="platform-payment-method-active"
                  checked={formData.isActive}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isActive: checked })
                  }
                />
              </div>
            </div>

            <div className="md:col-span-6">
              <MediaSelector
                type="payment"
                label="Logo"
                description="Logo affiché pour ce moyen de paiement."
                value={formData.logoUrl}
                onChange={(logoUrl) => setFormData({ ...formData, logoUrl: logoUrl || "" })}
              />
            </div>

            <div className="flex flex-col gap-2 md:col-span-6 md:flex-row">
              <Button type="submit" disabled={!isValid || isSaving} className="h-12 font-bold">
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                {editingId ? 'Enregistrer' : 'Ajouter'}
              </Button>

              {editingId && (
                <Button type="button" variant="outline" className="h-12 font-bold" onClick={resetForm}>
                  <X className="mr-2 h-4 w-4" />
                  Annuler
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isLoading && (
          <Card className="border-none shadow-xl md:col-span-2 xl:col-span-3">
            <CardContent className="flex justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </CardContent>
          </Card>
        )}

        {!isLoading &&
          (methods ?? []).map((method) => (
            <Card key={method.id} className="border-none shadow-xl">
              <CardContent className="space-y-5 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10">
                      {method.logoUrl && !method.logoUrl.startsWith('blob:') ? (
                        <img src={method.logoUrl} alt={method.name} className="h-full w-full object-cover" />
                      ) : (
                        <CreditCard className="h-6 w-6 text-primary" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-lg font-black text-primary">{method.name}</p>
                      <p className="truncate text-sm font-medium text-muted-foreground">{method.code}</p>
                    </div>
                  </div>
                  <Badge variant={method.isActive ? 'default' : 'secondary'}>
                    {method.isActive ? 'Actif' : 'Inactif'}
                  </Badge>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-secondary/30 p-3">
                  <span className="text-xs font-bold uppercase text-muted-foreground">Type</span>
                  <span className="text-sm font-black uppercase">{method.type}</span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">
                      Actif
                    </Label>
                    <Switch
                      aria-label={`${method.isActive ? 'Désactiver' : 'Activer'} ${method.name}`}
                      checked={method.isActive}
                      disabled={pendingId === method.id}
                      onCheckedChange={(checked) => toggleMethod(method.id, checked)}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="min-h-11 min-w-11"
                      disabled={pendingId === method.id}
                      onClick={() => startEdit(method)}
                      aria-label={`Modifier ${method.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="min-h-11 min-w-11"
                      disabled={pendingId === method.id}
                      onClick={() => setDeleteCandidate({ id: method.id, name: method.name })}
                      aria-label={`Supprimer ${method.name}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

        {!isLoading && !methods?.length && (
          <Card className="border-none shadow-xl md:col-span-2 xl:col-span-3">
            <CardContent className="p-12 text-center text-muted-foreground">
              Aucun moyen de paiement configuré.
            </CardContent>
          </Card>
        )}
      </div>
      <PlatformConfirmationDialog open={Boolean(deleteCandidate)} onOpenChange={(open) => { if (!open && !pendingId) setDeleteCandidate(null) }} title="Supprimer ce moyen de paiement ?" description={deleteCandidate ? `Vous allez supprimer « ${deleteCandidate.name} ».` : "Confirmer la suppression."} consequence="Les variantes ou usages dépendants ne sont pas analysés automatiquement par le flux existant." confirmLabel="Supprimer" loading={Boolean(pendingId)} onConfirm={() => { if (deleteCandidate) void deleteMethod(deleteCandidate.id) }} />
    </PlatformPage>
  );
}
