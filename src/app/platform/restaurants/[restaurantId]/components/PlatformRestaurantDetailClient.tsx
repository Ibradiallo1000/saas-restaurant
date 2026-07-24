'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { collection, doc, getDocs, limit, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useCollectionOnce, useDocOnce, useFirestore, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { COLLECTION_NAMES } from '@/lib/constants';
import { buildRestaurantLocationPayload } from '@/lib/restaurant-location';
import { PlatformErrorState, PlatformLoadingState, PlatformPage } from '@/components/platform-ui';
import { PlatformRestaurantDetailView, type PlatformCityPresentation, type PlatformCommunePresentation } from './PlatformRestaurantDetailView';

type PlatformCountry = {
  id: string;
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
  const [cities, setCities] = React.useState<PlatformCityPresentation[]>([]);
  const [communes, setCommunes] = React.useState<PlatformCommunePresentation[]>([]);
  const [isGeoLoading, setIsGeoLoading] = React.useState(false);
  const [formData, setFormData] = React.useState({
    name: '',
    phone: '',
    countryCode: '',
    cityId: '',
    cityName: '',
    communeId: '',
    communeName: '',
    districtName: '',
    address: '',
    googleMapsUrl: '',
    lat: '',
    lng: '',
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
    const nextLocation = restaurant.location || {};

    setFormData({
      name: restaurant.name || '',
      phone: restaurant.phone || '',
      countryCode: nextCountryCode,
      cityId: restaurant.cityId || '',
      cityName: restaurant.cityName || restaurant.city || '',
      communeId: restaurant.communeId || '',
      communeName: restaurant.communeName || '',
      districtName: restaurant.districtName || '',
      address: nextLocation.address || restaurant.address || '',
      googleMapsUrl: nextLocation.googleMapsUrl || '',
      lat: nextLocation.lat === null || nextLocation.lat === undefined ? '' : String(nextLocation.lat),
      lng: nextLocation.lng === null || nextLocation.lng === undefined ? '' : String(nextLocation.lng),
    });

    const country = activeCountries.find((item) => item.code === nextCountryCode);
    if (country) setCountrySearch(country.name);
  }, [activeCountries, restaurant]);

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
        setCities(snapshot.docs.map((document) => ({ id: document.id, ...document.data() } as PlatformCityPresentation)).filter((city) => city.isActive !== false));
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
        setCommunes(snapshot.docs.map((document) => ({ id: document.id, ...document.data() } as PlatformCommunePresentation)).filter((commune) => commune.isActive !== false));
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

  const selectedCountry = React.useMemo(() => {
    return activeCountries.find((country) => country.code === formData.countryCode);
  }, [activeCountries, formData.countryCode]);

  const selectedCity = React.useMemo(() => {
    return cities.find((city) => city.id === formData.cityId);
  }, [cities, formData.cityId]);

  const selectedCommune = React.useMemo(() => {
    return communes.find((commune) => commune.id === formData.communeId);
  }, [communes, formData.communeId]);

  const latitudeValid = !formData.lat || (Number.isFinite(Number(formData.lat)) && Number(formData.lat) >= -90 && Number(formData.lat) <= 90);
  const longitudeValid = !formData.lng || (Number.isFinite(Number(formData.lng)) && Number(formData.lng) >= -180 && Number(formData.lng) <= 180);
  const canSave =
    formData.name.trim().length > 2 &&
    formData.phone.trim().length > 5 &&
    formData.countryCode.length > 0 &&
    (formData.cityId.length > 0 || formData.cityName.trim().length > 1) &&
    latitudeValid &&
    longitudeValid;

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!restaurantRef || !canSave) return;

    setIsSaving(true);

    try {
      const locationPayload = buildRestaurantLocationPayload({
        phone: formData.phone,
        countryCode: formData.countryCode,
        countryName: selectedCountry?.name || restaurant?.countryName || restaurant?.country || '',
        cityId: formData.cityId,
        cityName: selectedCity?.name || formData.cityName,
        communeId: formData.communeId,
        communeName: selectedCommune?.name || formData.communeName,
        districtName: formData.districtName,
        location: {
          address: formData.address,
          googleMapsUrl: formData.googleMapsUrl,
          lat: formData.lat,
          lng: formData.lng,
        },
      });

      await updateDoc(restaurantRef, {
        name: formData.name.trim(),
        ...locationPayload,
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
    return <PlatformPage width="reading"><PlatformLoadingState label="Chargement du restaurant" /></PlatformPage>;
  }

  if (!restaurant) return <PlatformPage width="reading"><PlatformErrorState title="Restaurant indisponible" description="Le restaurant demandé n’a pas été trouvé ou ne peut pas être chargé." action={<button type="button" className="dashboard-focus-visible min-h-11 rounded-md border px-4" onClick={() => router.push('/platform/restaurants')}>Retour aux restaurants</button>} /></PlatformPage>;

  return <PlatformRestaurantDetailView value={formData} countrySearch={countrySearch} countries={filteredCountries} selectedCountry={selectedCountry} cities={cities} communes={communes} isGeoLoading={isGeoLoading} canSave={canSave} isSaving={isSaving} onBack={() => router.push('/platform/restaurants')} onSubmit={handleSave} onValueChange={setFormData} onCountrySearchChange={setCountrySearch} onCountrySelect={(country) => { setFormData({ ...formData, countryCode: country.code, cityId: '', cityName: '', communeId: '', communeName: '' }); setCountrySearch(country.name); setCommunes([]) }} onCitySelect={(cityId) => setFormData({ ...formData, cityId, cityName: cities.find((city) => city.id === cityId)?.name || '', communeId: '', communeName: '' })} onCommuneSelect={(communeId) => setFormData({ ...formData, communeId, communeName: communes.find((commune) => commune.id === communeId)?.name || '' })} coordinatesValid={latitudeValid && longitudeValid} />;
}
