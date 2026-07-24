'use client';

import * as React from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Timestamp,
} from 'firebase/firestore';
import { Building2, Globe2, Loader2, MapPinned, Plus, Trash2 } from 'lucide-react';

import { useFirestore } from '@/firebase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { COLLECTION_NAMES } from '@/lib/constants';
import { normalizeSlugSegment, normalizeText } from '@/lib/restaurant-location';
import { ErrorState } from '@/components/layout/app-states';
import { AdminRouteSkeleton } from '@/components/performance/route-skeletons';
import { useCollectionPage } from '@/hooks/use-collection-page';
import { PlatformConfirmationDialog, PlatformHeader, PlatformPage } from '@/components/platform-ui';

type PlatformCountry = {
  id: string;
  code: string;
  name: string;
  currency: string;
  dialCode: string;
  isActive: boolean;
  order?: number;
  createdAt?: Timestamp;
};

type GeoEntry = {
  id: string;
  name: string;
  normalizedName: string;
  isActive: boolean;
  order: number;
};

const EMPTY_COUNTRY_FORM = {
  code: '',
  name: '',
  currency: '',
  dialCode: '',
  order: '0',
};

const EMPTY_GEO_FORM = {
  name: '',
  order: '0',
};

export default function PlatformCountriesPage() {
  const db = useFirestore();
  const { toast } = useToast();
  const [formData, setFormData] = React.useState(EMPTY_COUNTRY_FORM);
  const [cityForm, setCityForm] = React.useState(EMPTY_GEO_FORM);
  const [communeForm, setCommuneForm] = React.useState(EMPTY_GEO_FORM);
  const [isSaving, setIsSaving] = React.useState(false);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [selectedCountryCode, setSelectedCountryCode] = React.useState('');
  const [selectedCityId, setSelectedCityId] = React.useState('');
  const [cities, setCities] = React.useState<GeoEntry[]>([]);
  const [communes, setCommunes] = React.useState<GeoEntry[]>([]);
  const [isGeoLoading, setIsGeoLoading] = React.useState(false);
  const [deleteCandidate, setDeleteCandidate] = React.useState<{ id: string; name: string; type: 'country' | 'city' | 'commune' } | null>(null);

  const {
    error,
    hasMore,
    isLoading,
    items: countries,
    loadMore,
    refetch,
  } = useCollectionPage<PlatformCountry>({
    collectionName: COLLECTION_NAMES.PLATFORM_COUNTRIES,
    orderByField: 'name',
    orderByDirection: 'asc',
    pageSize: 50,
  });

  const selectedCountry = React.useMemo(
    () => countries.find((country) => country.code === selectedCountryCode || country.id === selectedCountryCode),
    [countries, selectedCountryCode]
  );
  const selectedCity = React.useMemo(
    () => cities.find((city) => city.id === selectedCityId),
    [cities, selectedCityId]
  );

  const loadCities = React.useCallback(async (countryCode: string) => {
    if (!db || !countryCode) {
      setCities([]);
      return;
    }

    setIsGeoLoading(true);
    try {
      const snapshot = await getDocs(query(collection(db, COLLECTION_NAMES.PLATFORM_COUNTRIES, countryCode, 'cities'), orderBy('order', 'asc'), limit(200)));
      setCities(snapshot.docs.map((document) => ({ id: document.id, ...document.data() } as GeoEntry)));
    } catch (error) {
      console.error(error);
      setCities([]);
      toast({ title: 'Villes indisponibles', variant: 'destructive' });
    } finally {
      setIsGeoLoading(false);
    }
  }, [db, toast]);

  const loadCommunes = React.useCallback(async (countryCode: string, cityId: string) => {
    if (!db || !countryCode || !cityId) {
      setCommunes([]);
      return;
    }

    setIsGeoLoading(true);
    try {
      const snapshot = await getDocs(query(collection(db, COLLECTION_NAMES.PLATFORM_COUNTRIES, countryCode, 'cities', cityId, 'communes'), orderBy('order', 'asc'), limit(200)));
      setCommunes(snapshot.docs.map((document) => ({ id: document.id, ...document.data() } as GeoEntry)));
    } catch (error) {
      console.error(error);
      setCommunes([]);
      toast({ title: 'Communes indisponibles', variant: 'destructive' });
    } finally {
      setIsGeoLoading(false);
    }
  }, [db, toast]);

  React.useEffect(() => {
    if (!selectedCountryCode) return;
    void loadCities(selectedCountryCode);
    setSelectedCityId('');
    setCommunes([]);
  }, [loadCities, selectedCountryCode]);

  React.useEffect(() => {
    if (!selectedCountryCode || !selectedCityId) return;
    void loadCommunes(selectedCountryCode, selectedCityId);
  }, [loadCommunes, selectedCityId, selectedCountryCode]);

  if (isLoading && countries.length === 0) return <AdminRouteSkeleton />;

  if (error) {
    return (
      <ErrorState
        title="Pays indisponibles"
        description="Impossible de charger les pays de la plateforme."
        actionLabel="Reessayer"
        onAction={() => void refetch()}
      />
    );
  }

  const isValid =
    formData.code.trim().length === 2 &&
    formData.name.trim().length > 1 &&
    formData.currency.trim().length >= 3 &&
    formData.dialCode.trim().startsWith('+');

  const saveCountry = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!db || !isValid) return;

    setIsSaving(true);

    try {
      const code = formData.code.trim().toUpperCase();
      await setDoc(doc(db, COLLECTION_NAMES.PLATFORM_COUNTRIES, code), {
        code,
        name: normalizeText(formData.name, 100),
        currency: normalizeText(formData.currency, 8).toUpperCase(),
        dialCode: normalizeText(formData.dialCode, 12),
        isActive: true,
        order: toOrder(formData.order),
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      }, { merge: true });

      setFormData(EMPTY_COUNTRY_FORM);
      refetch();
      toast({ title: 'Pays enregistré', description: 'Le pays est disponible dans la plateforme.' });
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: "Impossible d'enregistrer ce pays.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleCountry = async (country: PlatformCountry, nextValue: boolean) => {
    if (!db) return;

    const countryId = country.id || country.code;
    setPendingId(countryId);

    try {
      await updateDoc(doc(db, COLLECTION_NAMES.PLATFORM_COUNTRIES, countryId), {
        isActive: nextValue,
        updatedAt: serverTimestamp(),
      });
      refetch();
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

  const saveCity = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!db || !selectedCountryCode || !cityForm.name.trim()) return;

    const cityId = normalizeSlugSegment(cityForm.name, 80);
    if (!cityId) return;

    try {
      await setDoc(doc(db, COLLECTION_NAMES.PLATFORM_COUNTRIES, selectedCountryCode, 'cities', cityId), {
        name: normalizeText(cityForm.name, 120),
        normalizedName: normalizeSlugSegment(cityForm.name, 120),
        isActive: true,
        order: toOrder(cityForm.order),
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      }, { merge: true });
      setCityForm(EMPTY_GEO_FORM);
      await loadCities(selectedCountryCode);
      toast({ title: 'Ville enregistrée' });
    } catch (error) {
      console.error(error);
      toast({
        title: 'Ville non enregistrée',
        description: 'Vérifiez vos droits super admin et les règles Firestore déployées.',
        variant: 'destructive',
      });
    }
  };

  const saveCommune = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!db || !selectedCountryCode || !selectedCityId || !communeForm.name.trim()) return;

    const communeId = normalizeSlugSegment(communeForm.name, 80);
    if (!communeId) return;

    try {
      await setDoc(doc(db, COLLECTION_NAMES.PLATFORM_COUNTRIES, selectedCountryCode, 'cities', selectedCityId, 'communes', communeId), {
        name: normalizeText(communeForm.name, 120),
        normalizedName: normalizeSlugSegment(communeForm.name, 120),
        isActive: true,
        order: toOrder(communeForm.order),
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      }, { merge: true });
      setCommuneForm(EMPTY_GEO_FORM);
      await loadCommunes(selectedCountryCode, selectedCityId);
      toast({ title: 'Commune enregistrée' });
    } catch (error) {
      console.error(error);
      toast({
        title: 'Commune non enregistrée',
        description: 'Vérifiez vos droits super admin et les règles Firestore déployées.',
        variant: 'destructive',
      });
    }
  };

  const toggleGeoEntry = async (type: 'city' | 'commune', entry: GeoEntry, nextValue: boolean) => {
    if (!db || !selectedCountryCode) return;
    try {
      if (type === 'city') {
        await updateDoc(doc(db, COLLECTION_NAMES.PLATFORM_COUNTRIES, selectedCountryCode, 'cities', entry.id), { isActive: nextValue, updatedAt: serverTimestamp() });
        await loadCities(selectedCountryCode);
        return;
      }

      if (!selectedCityId) return;
      await updateDoc(doc(db, COLLECTION_NAMES.PLATFORM_COUNTRIES, selectedCountryCode, 'cities', selectedCityId, 'communes', entry.id), { isActive: nextValue, updatedAt: serverTimestamp() });
      await loadCommunes(selectedCountryCode, selectedCityId);
    } catch (error) {
      console.error(error);
      toast({
        title: 'Statut non modifié',
        description: 'Vérifiez vos droits super admin et les règles Firestore déployées.',
        variant: 'destructive',
      });
    }
  };

  const deleteEntry = async () => {
    if (!db || !deleteCandidate) return;
    setPendingId(deleteCandidate.id);
    try {
      if (deleteCandidate.type === 'country') {
        await deleteDoc(doc(db, COLLECTION_NAMES.PLATFORM_COUNTRIES, deleteCandidate.id));
        await refetch();
      }
      if (deleteCandidate.type === 'city' && selectedCountryCode) {
        await deleteDoc(doc(db, COLLECTION_NAMES.PLATFORM_COUNTRIES, selectedCountryCode, 'cities', deleteCandidate.id));
        await loadCities(selectedCountryCode);
      }
      if (deleteCandidate.type === 'commune' && selectedCountryCode && selectedCityId) {
        await deleteDoc(doc(db, COLLECTION_NAMES.PLATFORM_COUNTRIES, selectedCountryCode, 'cities', selectedCityId, 'communes', deleteCandidate.id));
        await loadCommunes(selectedCountryCode, selectedCityId);
      }
      toast({ title: 'Élément supprimé' });
    } catch (error) {
      console.error(error);
      toast({ title: 'Suppression impossible', variant: 'destructive' });
    } finally {
      setPendingId(null);
      setDeleteCandidate(null);
    }
  };

  return (
    <PlatformPage>
      <PlatformHeader title="Pays" subtitle="Configuration des pays, villes et communes disponibles pour la plateforme." />

      <Card className="border-none shadow-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-black italic uppercase">
            <Plus className="h-5 w-5 text-primary" />
            Ajouter un pays
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveCountry} className="grid gap-4 md:grid-cols-6">
            <Field id="platform-country-code" label="Code ISO" className="md:col-span-1"><Input id="platform-country-code" placeholder="ML" value={formData.code} maxLength={2} onChange={(event) => setFormData({ ...formData, code: event.target.value })} /></Field>
            <Field id="platform-country-name" label="Nom" className="md:col-span-2"><Input id="platform-country-name" placeholder="Mali" value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} /></Field>
            <Field id="platform-country-currency" label="Devise"><Input id="platform-country-currency" placeholder="XOF" value={formData.currency} onChange={(event) => setFormData({ ...formData, currency: event.target.value })} /></Field>
            <Field id="platform-country-dial-code" label="Indicatif"><Input id="platform-country-dial-code" placeholder="+223" value={formData.dialCode} onChange={(event) => setFormData({ ...formData, dialCode: event.target.value })} /></Field>
            <Field id="platform-country-order" label="Ordre"><Input id="platform-country-order" inputMode="numeric" value={formData.order} onChange={(event) => setFormData({ ...formData, order: event.target.value })} /></Field>
            <Button type="submit" disabled={!isValid || isSaving} className="h-12 font-bold md:col-span-6">{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Enregistrer</Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card className="border-none shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-black italic uppercase">
              <Globe2 className="h-5 w-5 text-primary" />
              Liste des pays
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : (
              <div className="divide-y">
                {(countries ?? []).map((country) => (
                  <div key={country.id} className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                    <button type="button" className="min-w-0 space-y-1 text-left" onClick={() => setSelectedCountryCode(country.code || country.id)}>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-black uppercase text-primary">{country.name}</p>
                        <Badge variant={country.isActive ? 'default' : 'secondary'}>{country.isActive ? 'Actif' : 'Inactif'}</Badge>
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">{country.code} · {country.currency} · {country.dialCode}</p>
                    </button>
                    <div className="flex items-center justify-between gap-4 md:justify-end">
                      <div className="flex items-center gap-2"><Label className="text-xs font-bold uppercase text-muted-foreground">Actif</Label><Switch checked={country.isActive} disabled={pendingId === country.id} onCheckedChange={(checked) => toggleCountry(country, checked)} /></div>
                      <Button type="button" variant="outline" size="icon" className="min-h-11 min-w-11" disabled={pendingId === country.id} onClick={() => setDeleteCandidate({ id: country.id, name: country.name, type: 'country' })} aria-label={`Supprimer ${country.name}`}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </div>
                ))}
                {!countries?.length ? <div className="p-12 text-center text-muted-foreground">Aucun pays configuré.</div> : null}
                {hasMore ? <div className="p-4"><Button type="button" variant="outline" className="w-full" onClick={() => void loadMore()}>Charger plus</Button></div> : null}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-black italic uppercase">
              <MapPinned className="h-5 w-5 text-primary" />
              Villes et communes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {!selectedCountry ? <p className="rounded-xl border border-dashed p-6 text-center text-sm font-semibold text-muted-foreground">Sélectionnez un pays pour gérer ses villes.</p> : (
              <>
                <p className="text-sm font-semibold text-muted-foreground">Pays sélectionné : {selectedCountry.name}</p>
                <form onSubmit={saveCity} className="grid gap-3 sm:grid-cols-[1fr_120px_auto]">
                  <Field id="platform-city-name" label="Ville"><Input id="platform-city-name" value={cityForm.name} onChange={(event) => setCityForm({ ...cityForm, name: event.target.value })} placeholder="Bamako" /></Field>
                  <Field id="platform-city-order" label="Ordre"><Input id="platform-city-order" inputMode="numeric" value={cityForm.order} onChange={(event) => setCityForm({ ...cityForm, order: event.target.value })} /></Field>
                  <Button type="submit" className="self-end"><Plus className="mr-2 h-4 w-4" />Ville</Button>
                </form>
                <div className="space-y-2">
                  {cities.map((city) => <GeoRow key={city.id} entry={city} selected={city.id === selectedCityId} icon={<Building2 className="h-4 w-4" />} onSelect={() => setSelectedCityId(city.id)} onToggle={(checked) => void toggleGeoEntry('city', city, checked)} onDelete={() => setDeleteCandidate({ id: city.id, name: city.name, type: 'city' })} />)}
                  {isGeoLoading ? <p className="text-sm text-muted-foreground">Chargement...</p> : null}
                  {!cities.length && !isGeoLoading ? <p className="text-sm text-muted-foreground">Aucune ville configurée.</p> : null}
                </div>
                {selectedCity ? (
                  <div className="space-y-4 rounded-xl border p-4">
                    <p className="text-sm font-semibold text-muted-foreground">Communes de {selectedCity.name}</p>
                    <form onSubmit={saveCommune} className="grid gap-3 sm:grid-cols-[1fr_120px_auto]">
                      <Field id="platform-commune-name" label="Commune"><Input id="platform-commune-name" value={communeForm.name} onChange={(event) => setCommuneForm({ ...communeForm, name: event.target.value })} placeholder="Commune I" /></Field>
                      <Field id="platform-commune-order" label="Ordre"><Input id="platform-commune-order" inputMode="numeric" value={communeForm.order} onChange={(event) => setCommuneForm({ ...communeForm, order: event.target.value })} /></Field>
                      <Button type="submit" className="self-end"><Plus className="mr-2 h-4 w-4" />Commune</Button>
                    </form>
                    <div className="space-y-2">
                      {communes.map((commune) => <GeoRow key={commune.id} entry={commune} onToggle={(checked) => void toggleGeoEntry('commune', commune, checked)} onDelete={() => setDeleteCandidate({ id: commune.id, name: commune.name, type: 'commune' })} />)}
                      {!communes.length && !isGeoLoading ? <p className="text-sm text-muted-foreground">Aucune commune configurée.</p> : null}
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <PlatformConfirmationDialog open={Boolean(deleteCandidate)} onOpenChange={(open) => { if (!open && !pendingId) setDeleteCandidate(null) }} title="Supprimer cet élément ?" description={deleteCandidate ? `Vous allez supprimer « ${deleteCandidate.name} » de la configuration plateforme.` : "Confirmer la suppression."} consequence="Les dépendances éventuelles avec les restaurants existants ne sont pas modifiées par ce flux." confirmLabel="Supprimer" loading={Boolean(pendingId)} onConfirm={() => void deleteEntry()} />
    </PlatformPage>
  );
}

function Field({ children, className, id, label }: { children: React.ReactNode; className?: string; id: string; label: string }) {
  return <div className={`space-y-2 ${className || ''}`}><Label htmlFor={id}>{label}</Label>{children}</div>;
}

function GeoRow({ entry, icon, onDelete, onSelect, onToggle, selected = false }: { entry: GeoEntry; icon?: React.ReactNode; selected?: boolean; onSelect?: () => void; onToggle: (checked: boolean) => void; onDelete: () => void }) {
  return <div className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${selected ? 'border-primary bg-primary/10' : ''}`}>
    <button type="button" className="flex min-w-0 items-center gap-2 text-left" onClick={onSelect}>
      {icon}
      <span className="truncate font-semibold">{entry.name}</span>
      <Badge variant={entry.isActive ? 'default' : 'secondary'}>{entry.isActive ? 'Actif' : 'Inactif'}</Badge>
    </button>
    <div className="flex items-center gap-2">
      <Switch checked={entry.isActive} onCheckedChange={onToggle} />
      <Button type="button" variant="outline" size="icon" onClick={onDelete}><Trash2 className="h-4 w-4 text-destructive" /></Button>
    </div>
  </div>;
}

function toOrder(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}
