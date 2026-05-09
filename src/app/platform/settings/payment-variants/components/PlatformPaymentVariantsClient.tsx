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
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { COLLECTION_NAMES } from '@/lib/constants';

type VariantType = 'ussd' | 'link';

type PlatformPaymentMethod = {
  name: string;
  code: string;
  type: VariantType;
  isActive: boolean;
};

type PlatformCountry = {
  code: string;
  name: string;
  currency: string;
  isActive: boolean;
};

type PlatformPaymentVariant = {
  methodCode: string;
  countryCode: string;
  type: VariantType;
  ussdTemplate: string;
  requiresMerchant: boolean;
  requiresPhone: boolean;
  isActive: boolean;
};

const EMPTY_FORM: PlatformPaymentVariant = {
  methodCode: '',
  countryCode: '',
  type: 'ussd',
  ussdTemplate: '',
  requiresMerchant: true,
  requiresPhone: false,
  isActive: true,
};

const PREVIEW_VALUES = {
  merchant: '12345',
  phone: '74746580',
  amount: '5000',
};

export default function PlatformPaymentVariantsPage() {
  const db = useFirestore();
  const { toast } = useToast();
  const [formData, setFormData] = React.useState<PlatformPaymentVariant>(EMPTY_FORM);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const methodsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(
      collection(db, COLLECTION_NAMES.PLATFORM_PAYMENT_METHODS),
      orderBy('name', 'asc'),
      limit(50)
    );
  }, [db]);

  const countriesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(
      collection(db, COLLECTION_NAMES.PLATFORM_COUNTRIES),
      orderBy('name', 'asc'),
      limit(100)
    );
  }, [db]);

  const variantsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(
      collection(db, COLLECTION_NAMES.PLATFORM_PAYMENT_VARIANTS),
      orderBy('methodCode', 'asc'),
      limit(50)
    );
  }, [db]);

  const { data: methods } = useCollectionOnce<PlatformPaymentMethod>(methodsQuery);
  const { data: countries } = useCollectionOnce<PlatformCountry>(countriesQuery);
  const { data: variants, isLoading, refetch } = useCollectionOnce<PlatformPaymentVariant>(variantsQuery);

  const activeMethods = React.useMemo(
    () => (methods ?? []).filter((method) => method.isActive),
    [methods]
  );

  const activeCountries = React.useMemo(
    () => (countries ?? []).filter((country) => country.isActive),
    [countries]
  );

  const isValid =
    formData.methodCode.length > 0 &&
    formData.countryCode.length > 0 &&
    ['ussd', 'link'].includes(formData.type) &&
    formData.ussdTemplate.trim().length > 0;

  const preview = buildPreview(formData.ussdTemplate);

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setEditingId(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!db || !isValid) return;

    setIsSaving(true);

    const payload = {
      methodCode: formData.methodCode,
      countryCode: formData.countryCode,
      type: formData.type,
      ussdTemplate: formData.ussdTemplate.trim(),
      requiresMerchant: formData.requiresMerchant,
      requiresPhone: formData.requiresPhone,
      isActive: formData.isActive,
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, COLLECTION_NAMES.PLATFORM_PAYMENT_VARIANTS, editingId), payload);
        refetch();
        toast({ title: 'Variante mise à jour' });
      } else {
        await addDoc(collection(db, COLLECTION_NAMES.PLATFORM_PAYMENT_VARIANTS), payload);
        refetch();
        toast({ title: 'Variante ajoutée' });
      }

      resetForm();
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: "Impossible d'enregistrer cette variante.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (variant: PlatformPaymentVariant & { id: string }) => {
    setEditingId(variant.id);
    setFormData({
      methodCode: variant.methodCode || '',
      countryCode: variant.countryCode || '',
      type: variant.type || 'ussd',
      ussdTemplate: variant.ussdTemplate || '',
      requiresMerchant: variant.requiresMerchant ?? true,
      requiresPhone: variant.requiresPhone ?? false,
      isActive: variant.isActive ?? true,
    });
  };

  const toggleVariant = async (variantId: string, nextValue: boolean) => {
    if (!db) return;

    setPendingId(variantId);

    try {
      await updateDoc(doc(db, COLLECTION_NAMES.PLATFORM_PAYMENT_VARIANTS, variantId), {
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

  const deleteVariant = async (variantId: string) => {
    if (!db) return;

    setPendingId(variantId);

    try {
      await deleteDoc(doc(db, COLLECTION_NAMES.PLATFORM_PAYMENT_VARIANTS, variantId));
      refetch();
      if (editingId === variantId) resetForm();
      toast({ title: 'Variante supprimée' });
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de supprimer cette variante.',
      });
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-black italic uppercase tracking-tighter text-primary">
          Variantes de paiement
        </h1>
        <p className="text-muted-foreground font-medium">
          Associez les moyens de paiement aux pays et configurez les formats USSD.
        </p>
      </div>

      <Card className="border-none shadow-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-black italic uppercase">
            {editingId ? <Pencil className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
            {editingId ? 'Modifier une variante' : 'Ajouter une variante'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-6">
            <div className="space-y-2 md:col-span-2">
              <Label>Méthode</Label>
              <select
                value={formData.methodCode}
                onChange={(event) => setFormData({ ...formData, methodCode: event.target.value })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Sélectionner</option>
                {activeMethods.map((method) => (
                  <option key={method.id} value={method.code}>
                    {method.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Pays</Label>
              <select
                value={formData.countryCode}
                onChange={(event) => setFormData({ ...formData, countryCode: event.target.value })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Sélectionner</option>
                {activeCountries.map((country) => (
                  <option key={country.id} value={country.code}>
                    {country.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Type</Label>
              <select
                value={formData.type}
                onChange={(event) =>
                  setFormData({ ...formData, type: event.target.value as VariantType })
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="ussd">USSD</option>
                <option value="link">Lien</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Actif</Label>
              <div className="flex h-10 items-center">
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
              </div>
            </div>

            <div className="space-y-2 md:col-span-6">
              <Label>Template USSD / lien</Label>
              <Input
                placeholder="*144*8*{merchant}*{amount}#"
                value={formData.ussdTemplate}
                onChange={(event) =>
                  setFormData({ ...formData, ussdTemplate: event.target.value })
                }
              />
            </div>

            <div className="grid gap-3 md:col-span-6 md:grid-cols-2">
              <ToggleField
                label="Marchand requis"
                checked={formData.requiresMerchant}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, requiresMerchant: checked })
                }
              />
              <ToggleField
                label="Téléphone requis"
                checked={formData.requiresPhone}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, requiresPhone: checked })
                }
              />
            </div>

            <div className="rounded-xl bg-secondary/30 p-4 md:col-span-6">
              <p className="text-xs font-bold uppercase text-muted-foreground">Aperçu</p>
              <p className="mt-2 break-all font-mono text-lg font-black text-primary">
                {preview || 'Renseignez un template pour générer un aperçu'}
              </p>
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
          (variants ?? []).map((variant) => (
            <Card key={variant.id} className="border-none shadow-xl">
              <CardContent className="space-y-5 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-primary" />
                      <p className="truncate text-lg font-black text-primary">
                        {getMethodName(methods, variant.methodCode)}
                      </p>
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {getCountryName(countries, variant.countryCode)} · {variant.type.toUpperCase()}
                    </p>
                  </div>
                  <Badge variant={variant.isActive ? 'default' : 'secondary'}>
                    {variant.isActive ? 'Actif' : 'Inactif'}
                  </Badge>
                </div>

                <div className="rounded-xl bg-secondary/30 p-3">
                  <p className="text-xs font-bold uppercase text-muted-foreground">Template</p>
                  <p className="mt-1 break-all font-mono text-sm font-bold">
                    {variant.ussdTemplate}
                  </p>
                </div>

                <div className="rounded-xl bg-primary/10 p-3">
                  <p className="text-xs font-bold uppercase text-muted-foreground">Aperçu</p>
                  <p className="mt-1 break-all font-mono text-sm font-black text-primary">
                    {buildPreview(variant.ussdTemplate)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {variant.requiresMerchant && <Badge variant="outline">Marchand requis</Badge>}
                  {variant.requiresPhone && <Badge variant="outline">Téléphone requis</Badge>}
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">
                      Actif
                    </Label>
                    <Switch
                      checked={variant.isActive}
                      disabled={pendingId === variant.id}
                      onCheckedChange={(checked) => toggleVariant(variant.id, checked)}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={pendingId === variant.id}
                      onClick={() => startEdit(variant)}
                      aria-label="Modifier la variante"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={pendingId === variant.id}
                      onClick={() => deleteVariant(variant.id)}
                      aria-label="Supprimer la variante"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

        {!isLoading && !variants?.length && (
          <Card className="border-none shadow-xl md:col-span-2 xl:col-span-3">
            <CardContent className="p-12 text-center text-muted-foreground">
              Aucune variante de paiement configurée.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function ToggleField({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-secondary/30 p-4">
      <Label className="font-bold">{label}</Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function buildPreview(template: string) {
  return template
    .replaceAll('{merchant}', PREVIEW_VALUES.merchant)
    .replaceAll('{phone}', PREVIEW_VALUES.phone)
    .replaceAll('{amount}', PREVIEW_VALUES.amount);
}

function getMethodName(
  methods: Array<PlatformPaymentMethod & { id: string }> | null,
  methodCode: string
) {
  return methods?.find((method) => method.code === methodCode)?.name ?? methodCode;
}

function getCountryName(
  countries: Array<PlatformCountry & { id: string }> | null,
  countryCode: string
) {
  return countries?.find((country) => country.code === countryCode)?.name ?? countryCode;
}
