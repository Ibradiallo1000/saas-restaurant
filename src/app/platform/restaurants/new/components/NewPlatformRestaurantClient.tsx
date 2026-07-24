'use client';

import * as React from 'react';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';

import { useAuth, useCollectionOnce, useFirestore, useMemoFirebase } from '@/firebase';
import { RestaurantLocationPicker } from '@/components/platform/RestaurantLocationPicker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { COLLECTION_NAMES } from '@/lib/constants';

type PlatformCountry = {
  id: string;
  code: string;
  name: string;
  currency: string;
  dialCode: string;
  isActive: boolean;
};

type PlatformCity = {
  id: string;
  name: string;
  normalizedName?: string;
  isActive: boolean;
  order?: number;
};

type PlatformCommune = {
  id: string;
  name: string;
  normalizedName?: string;
  isActive: boolean;
  order?: number;
};

export default function NewRestaurantPage() {
  const db = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = React.useState(false);
  const [inviteLink, setInviteLink] = React.useState<string | null>(null);
  const [countrySearch, setCountrySearch] = React.useState('');
  const [cities, setCities] = React.useState<PlatformCity[]>([]);
  const [communes, setCommunes] = React.useState<PlatformCommune[]>([]);
  const [isGeoLoading, setIsGeoLoading] = React.useState(false);

  const [formData, setFormData] = React.useState({
    name: '',
    slug: '',
    ownerEmail: '',
    context: 'standalone' as 'standalone' | 'hotel' | 'lodge',
    countryCode: '',
    cityId: '',
    communeId: '',
    districtName: '',
    phone: '',
    address: '',
    googleMapsUrl: '',
    lat: '',
    lng: '',
  });

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

  const selectedCountry = React.useMemo(() => {
    return activeCountries.find((country) => country.code === formData.countryCode);
  }, [activeCountries, formData.countryCode]);

  const selectedCity = React.useMemo(() => {
    return cities.find((city) => city.id === formData.cityId);
  }, [cities, formData.cityId]);

  const selectedCommune = React.useMemo(() => {
    return communes.find((commune) => commune.id === formData.communeId);
  }, [communes, formData.communeId]);

  React.useEffect(() => {
    if (!db || !formData.countryCode) {
      setCities([]);
      return;
    }

    let cancelled = false;
    setIsGeoLoading(true);
    getDocs(query(
      collection(db, COLLECTION_NAMES.PLATFORM_COUNTRIES, formData.countryCode, 'cities'),
      orderBy('order', 'asc'),
      limit(100)
    ))
      .then((snapshot) => {
        if (cancelled) return;
        setCities(snapshot.docs.map((document) => ({ id: document.id, ...document.data() } as PlatformCity)).filter((city) => city.isActive !== false));
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) setCities([]);
      })
      .finally(() => {
        if (!cancelled) setIsGeoLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [db, formData.countryCode]);

  React.useEffect(() => {
    if (!db || !formData.countryCode || !formData.cityId) {
      setCommunes([]);
      return;
    }

    let cancelled = false;
    setIsGeoLoading(true);
    getDocs(query(
      collection(db, COLLECTION_NAMES.PLATFORM_COUNTRIES, formData.countryCode, 'cities', formData.cityId, 'communes'),
      orderBy('order', 'asc'),
      limit(100)
    ))
      .then((snapshot) => {
        if (cancelled) return;
        setCommunes(snapshot.docs.map((document) => ({ id: document.id, ...document.data() } as PlatformCommune)).filter((commune) => commune.isActive !== false));
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) setCommunes([]);
      })
      .finally(() => {
        if (!cancelled) setIsGeoLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [db, formData.cityId, formData.countryCode]);

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
  };

  const latitudeValid = !formData.lat || (Number.isFinite(Number(formData.lat)) && Number(formData.lat) >= -90 && Number(formData.lat) <= 90);
  const longitudeValid = !formData.lng || (Number.isFinite(Number(formData.lng)) && Number(formData.lng) >= -180 && Number(formData.lng) <= 180);
  const isValid =
    formData.name.trim().length > 2 &&
    formData.ownerEmail.includes('@') &&
    formData.countryCode.length > 0 &&
    formData.cityId.length > 0 &&
    formData.communeId.length > 0 &&
    formData.phone.trim().length > 5 &&
    latitudeValid &&
    longitudeValid;

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!auth) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Auth non initialisée',
      });
      return;
    }

    setLoading(true);

    try {
      const user = auth.currentUser;

      if (!user) {
        throw new Error('Non authentifié');
      }

      const token = await user.getIdToken();

      const res = await fetch('/api/create-restaurant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: formData.ownerEmail,
          name: formData.name,
          slug: formData.slug,
          countryCode: formData.countryCode,
          countryName: selectedCountry?.name || '',
          cityId: formData.cityId,
          cityName: selectedCity?.name || '',
          communeId: formData.communeId,
          communeName: selectedCommune?.name || '',
          districtName: formData.districtName,
          phone: formData.phone,
          location: {
            address: formData.address,
            googleMapsUrl: formData.googleMapsUrl,
            lat: formData.lat,
            lng: formData.lng,
          },
        }),
      });

      const data = await res.json();

      if (data.error) throw new Error(data.error);

      setInviteLink(data.inviteLink);

      toast({
        title: 'Succès',
        description: 'Restaurant créé + lien généré',
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl py-10">
      <Card>
        <CardHeader>
          <CardTitle>Créer un restaurant</CardTitle>
        </CardHeader>

        <form onSubmit={handleCreate}>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Email propriétaire</Label>
                <Input
                  type="email"
                  required
                  value={formData.ownerEmail}
                  onChange={(event) =>
                    setFormData({ ...formData, ownerEmail: event.target.value })
                  }
                />
              </div>

              <div>
                <Label>Téléphone</Label>
                <Input
                  required
                  inputMode="tel"
                  value={formData.phone}
                  onChange={(event) =>
                    setFormData({ ...formData, phone: event.target.value })
                  }
                />
              </div>
            </div>

            <div>
              <Label>Nom établissement</Label>
              <Input
                required
                value={formData.name}
                onChange={(event) => {
                  const name = event.target.value;
                  setFormData({
                    ...formData,
                    name,
                    slug: generateSlug(name),
                  });
                }}
              />

              {formData.slug && (
                <p className="mt-1 text-xs text-muted-foreground">
                  URL publique : <b>/{formData.slug}</b>
                </p>
              )}
            </div>

            <div>
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
                        setFormData({ ...formData, countryCode: country.code, cityId: '', communeId: '' });
                        setCountrySearch(country.name);
                        setCommunes([]);
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
                        {country.code} · {country.currency} · {country.dialCode}
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
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Ville</Label>
                <Select
                  value={formData.cityId}
                  disabled={!formData.countryCode || cities.length === 0}
                  onValueChange={(cityId) => setFormData({ ...formData, cityId, communeId: '' })}
                >
                  <SelectTrigger className="min-h-11">
                    <SelectValue placeholder={isGeoLoading ? 'Chargement...' : 'Choisir une ville'} />
                  </SelectTrigger>
                  <SelectContent>
                    {cities.map((city) => (
                      <SelectItem key={city.id} value={city.id}>{city.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Commune</Label>
                <Select
                  value={formData.communeId}
                  disabled={!formData.cityId || communes.length === 0}
                  onValueChange={(communeId) => setFormData({ ...formData, communeId })}
                >
                  <SelectTrigger className="min-h-11">
                    <SelectValue placeholder={isGeoLoading ? 'Chargement...' : 'Choisir une commune'} />
                  </SelectTrigger>
                  <SelectContent>
                    {communes.map((commune) => (
                      <SelectItem key={commune.id} value={commune.id}>{commune.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Quartier</Label>
                <Input
                  placeholder="Ex: ACI 2000"
                  value={formData.districtName}
                  onChange={(event) =>
                    setFormData({ ...formData, districtName: event.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Adresse</Label>
                <Input
                  placeholder="Rue, porte, repère..."
                  value={formData.address}
                  onChange={(event) =>
                    setFormData({ ...formData, address: event.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-3 rounded-xl border p-4">
              <div className="space-y-2">
                <Label>Lien Google Maps</Label>
                <Input
                  placeholder="https://maps.google.com/..."
                  value={formData.googleMapsUrl}
                  onChange={(event) =>
                    setFormData({ ...formData, googleMapsUrl: event.target.value })
                  }
                />
              </div>

              <RestaurantLocationPicker
                value={{ lat: formData.lat, lng: formData.lng }}
                onChange={(coords) => setFormData({ ...formData, ...coords })}
                countryCode={formData.countryCode}
                countryName={selectedCountry?.name}
                cityName={selectedCity?.name}
              />

              {(!latitudeValid || !longitudeValid) && (
                <p className="text-sm font-semibold text-destructive">
                  Latitude entre -90 et 90, longitude entre -180 et 180.
                </p>
              )}
            </div>

            {inviteLink && (
              <div className="mt-6 space-y-3 rounded-xl border bg-gray-50 p-4">
                <p className="font-semibold">Lien d’invitation</p>
                <Input value={inviteLink} readOnly />

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(inviteLink)}
                  >
                    Copier
                  </Button>

                  <Button
                    type="button"
                    onClick={() =>
                      window.open(`https://wa.me/?text=${encodeURIComponent(inviteLink)}`)
                    }
                  >
                    WhatsApp
                  </Button>

                  <Button
                    type="button"
                    onClick={() =>
                      window.open(
                        `mailto:${formData.ownerEmail}?subject=Invitation&body=${encodeURIComponent(inviteLink)}`
                      )
                    }
                  >
                    Email
                  </Button>
                </div>
              </div>
            )}
          </CardContent>

          <CardFooter>
            <Button className="w-full" disabled={!isValid || loading}>
              {loading ? 'Création...' : 'Créer le restaurant'}
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
