'use client';

import * as React from 'react';
import { collection, orderBy, query } from 'firebase/firestore';

import { useAuth, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
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

export default function NewRestaurantPage() {
  const db = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = React.useState(false);
  const [inviteLink, setInviteLink] = React.useState<string | null>(null);
  const [countrySearch, setCountrySearch] = React.useState('');

  const [formData, setFormData] = React.useState({
    name: '',
    slug: '',
    ownerEmail: '',
    context: 'standalone' as 'standalone' | 'hotel' | 'lodge',
    countryCode: '',
    city: '',
    phone: '',
    address: '',
    googleMapsUrl: '',
  });

  const countriesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(
      collection(db, COLLECTION_NAMES.PLATFORM_COUNTRIES),
      orderBy('name', 'asc')
    );
  }, [db]);
  const { data: countries } = useCollection<PlatformCountry>(countriesQuery);

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

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
  };

  const isValid =
    formData.name.length > 2 &&
    formData.ownerEmail.includes('@') &&
    formData.countryCode.length > 0 &&
    formData.city.length > 1 &&
    formData.phone.length > 5;

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
          city: formData.city,
          phone: formData.phone,
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
    <div className="max-w-xl mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>Créer un restaurant</CardTitle>
        </CardHeader>

        <form onSubmit={handleCreate}>
          <CardContent className="space-y-4">
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
                <p className="text-xs text-muted-foreground mt-1">
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
              {selectedCountry && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Pays sélectionné : {countryFlag(selectedCountry.code)} {selectedCountry.name}
                </p>
              )}
            </div>

            <div>
              <Label>Ville</Label>
              <Input
                required
                value={formData.city}
                onChange={(event) =>
                  setFormData({ ...formData, city: event.target.value })
                }
              />
            </div>

            <div>
              <Label>Téléphone</Label>
              <Input
                required
                value={formData.phone}
                onChange={(event) =>
                  setFormData({ ...formData, phone: event.target.value })
                }
              />
            </div>

            <div className="pt-4 border-t">
              <p className="text-sm font-bold">Localisation (optionnel)</p>

              <div className="mt-2 space-y-3">
                <Input
                  placeholder="Adresse"
                  value={formData.address}
                  onChange={(event) =>
                    setFormData({ ...formData, address: event.target.value })
                  }
                />

                <Input
                  placeholder="Lien Google Maps"
                  value={formData.googleMapsUrl}
                  onChange={(event) =>
                    setFormData({ ...formData, googleMapsUrl: event.target.value })
                  }
                />
              </div>
            </div>

            {inviteLink && (
              <div className="mt-6 p-4 border rounded-xl space-y-3 bg-gray-50">
                <p className="font-semibold">Lien d’invitation</p>
                <Input value={inviteLink} readOnly />

                <div className="flex gap-2 flex-wrap">
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
