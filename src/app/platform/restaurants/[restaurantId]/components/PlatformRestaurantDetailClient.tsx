'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { collection, doc, limit, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { ArrowLeft, Building2, Loader2, Save } from 'lucide-react';

import { useCollectionOnce, useDocOnce, useFirestore, useMemoFirebase } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { COLLECTION_NAMES } from '@/lib/constants';

type PlatformCountry = {
  code: string;
  name: string;
  currency: string;
  dialCode: string;
  isActive: boolean;
};

export default function EditRestaurantPage() {
  const db = useFirestore();
  const params = useParams<{ restaurantId: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const restaurantId = params?.restaurantId;
  const [isSaving, setIsSaving] = React.useState(false);
  const [countrySearch, setCountrySearch] = React.useState('');
  const [formData, setFormData] = React.useState({
    name: '',
    city: '',
    phone: '',
    countryCode: '',
  });

  const restaurantRef = useMemoFirebase(() => {
    if (!db || !restaurantId) return null;
    return doc(db, COLLECTION_NAMES.RESTAURANTS, restaurantId);
  }, [db, restaurantId]);
  const { data: restaurant, isLoading } = useDocOnce(restaurantRef);

  const countriesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(
      collection(db, COLLECTION_NAMES.PLATFORM_COUNTRIES),
      orderBy('name', 'asc'),
      limit(100)
    );
  }, [db]);
  const { data: countries } = useCollectionOnce<PlatformCountry>(countriesQuery);

  const activeCountries = React.useMemo(() => {
    return (countries ?? []).filter((country) => country.isActive);
  }, [countries]);

  const filteredCountries = React.useMemo(() => {
    const search = countrySearch.trim().toLowerCase();
    if (!search) return activeCountries;

    return activeCountries.filter((country) =>
      `${country.code} ${country.name} ${country.currency} ${country.dialCode}`
        .toLowerCase()
        .includes(search)
    );
  }, [activeCountries, countrySearch]);

  React.useEffect(() => {
    if (!restaurant) return;

    const nextCountryCode = restaurant.countryCode || restaurant.country || '';

    setFormData({
      name: restaurant.name || '',
      city: restaurant.city || '',
      phone: restaurant.phone || '',
      countryCode: nextCountryCode,
    });

    const country = activeCountries.find((item) => item.code === nextCountryCode);
    if (country) setCountrySearch(country.name);
  }, [activeCountries, restaurant]);

  const selectedCountry = React.useMemo(() => {
    return activeCountries.find((country) => country.code === formData.countryCode);
  }, [activeCountries, formData.countryCode]);

  const canSave =
    formData.name.trim().length > 2 &&
    formData.city.trim().length > 1 &&
    formData.phone.trim().length > 5 &&
    formData.countryCode.length > 0;

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!restaurantRef || !canSave) return;

    setIsSaving(true);

    try {
      await updateDoc(restaurantRef, {
        name: formData.name.trim(),
        city: formData.city.trim(),
        phone: formData.phone.trim(),
        countryCode: formData.countryCode,
        updatedAt: serverTimestamp(),
      });

      toast({
        title: 'Restaurant mis à jour',
        description: 'Les informations ont été enregistrées.',
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de mettre à jour ce restaurant.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-20">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => router.push('/platform/restaurants')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-4xl font-black italic uppercase tracking-tighter text-primary">
            Modifier restaurant
          </h1>
          <p className="font-medium text-muted-foreground">
            Nom, ville, téléphone et pays de rattachement.
          </p>
        </div>
      </div>

      <Card className="overflow-hidden border-none shadow-2xl">
        <CardHeader className="border-b bg-primary/5 p-8">
          <CardTitle className="flex items-center gap-3 text-2xl font-black italic uppercase">
            <Building2 className="h-6 w-6 text-primary" />
            Informations établissement
          </CardTitle>
        </CardHeader>

        <form onSubmit={handleSave}>
          <CardContent className="space-y-6 p-8">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Nom</Label>
                <Input
                  value={formData.name}
                  onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <Label>Téléphone</Label>
                <Input
                  value={formData.phone}
                  onChange={(event) => setFormData({ ...formData, phone: event.target.value })}
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <Label>Ville</Label>
                <Input
                  value={formData.city}
                  onChange={(event) => setFormData({ ...formData, city: event.target.value })}
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <Label>Pays</Label>
                <div className="space-y-2 rounded-xl border p-3">
                  <Input
                    placeholder="Rechercher un pays..."
                    value={countrySearch}
                    onChange={(event) => setCountrySearch(event.target.value)}
                  />
                  <div className="max-h-56 space-y-2 overflow-y-auto">
                    {filteredCountries.map((country) => (
                      <button
                        key={country.id}
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, countryCode: country.code });
                          setCountrySearch(country.name);
                        }}
                        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                          formData.countryCode === country.code
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border hover:bg-muted'
                        }`}
                      >
                        <span className="font-bold">
                          {countryFlag(country.code)} {country.name}
                        </span>
                        <span className="text-xs font-medium text-muted-foreground">
                          {country.code} · {country.currency}
                        </span>
                      </button>
                    ))}
                    {filteredCountries.length === 0 && (
                      <p className="p-3 text-sm text-muted-foreground">
                        Aucun pays disponible.
                      </p>
                    )}
                  </div>
                </div>
                {selectedCountry && (
                  <p className="text-xs text-muted-foreground">
                    Pays sélectionné : {countryFlag(selectedCountry.code)} {selectedCountry.name}
                  </p>
                )}
              </div>
            </div>
          </CardContent>

          <CardFooter className="p-8 pt-0">
            <Button
              type="submit"
              disabled={!canSave || isSaving}
              className="h-12 w-full font-black uppercase"
            >
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Enregistrer
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

function countryFlag(code: string) {
  if (!/^[A-Z]{2}$/.test(code)) return '🏳';

  return code
    .split('')
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join('');
}
