
'use client';

/**
 * @fileOverview Vue d'ensemble de la plateforme SaaS.
 * Affiche les statistiques globales, les demandes de démo et l'état du réseau.
 */

import * as React from 'react';
import { useFirestore, useCollectionOnce, useMemoFirebase } from '@/firebase';
import { collection, limit, query, orderBy } from 'firebase/firestore';
import { COLLECTION_NAMES } from '@/lib/constants';
import { useRouter } from 'next/navigation';
import { usePlatform } from '@/contexts/platform-context';
import { PlatformDashboardView } from './PlatformDashboardView';
import { buildPlatformDashboardViewModel } from './platform-dashboard-view-model';

export default function PlatformDashboard() {
  const db = useFirestore();
  const router = useRouter();
  const { settings } = usePlatform();

  const restaurantsQuery = useMemoFirebase(() => {
    return null;
  }, [db]);

  const requestsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, COLLECTION_NAMES.CONTACT_REQUESTS), orderBy('createdAt', 'desc'), limit(20));
  }, [db]);

  useCollectionOnce(restaurantsQuery);
  const { data: requests, isLoading: isRequestsLoading, error: requestsError } = useCollectionOnce(requestsQuery);

  const model = React.useMemo(() => buildPlatformDashboardViewModel(requests), [requests]);

  return <PlatformDashboardView model={model} platformName={settings.name} requestsLoading={isRequestsLoading} requestsError={Boolean(requestsError)} onCreateRestaurant={() => router.push('/platform/restaurants/new')} onProvisionRequest={(request) => router.push(`/platform/restaurants/new?email=${encodeURIComponent(request.email ?? '')}&name=${encodeURIComponent(request.restaurantName)}`)} />;
}
