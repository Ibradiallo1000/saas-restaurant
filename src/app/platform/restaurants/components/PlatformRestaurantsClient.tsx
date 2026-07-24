'use client';

/**
 * @fileOverview Page de gestion de tous les établissements du réseau.
 */

import * as React from 'react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { COLLECTION_NAMES } from '@/lib/constants';
import { useRouter } from 'next/navigation';
import { ErrorState } from '@/components/layout/app-states';
import { AdminRouteSkeleton } from '@/components/performance/route-skeletons';
import { useCollectionPage } from '@/hooks/use-collection-page';
import { usePlatform } from '@/contexts/platform-context';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { PlatformRestaurantsView } from './PlatformRestaurantsView';
import { buildPlatformRestaurantsViewModel } from './platform-restaurants-view-model';

export default function RestaurantsAdminPage() {
  const db = useFirestore();
  const router = useRouter();
  const { settings } = usePlatform();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [pendingStatusId, setPendingStatusId] = React.useState<string | null>(null);
  const [disableCandidate, setDisableCandidate] = React.useState<{ id: string; name: string } | null>(null);
  const {
    error,
    hasMore,
    isLoading,
    items: restaurants,
    loadMore,
    refetch,
  } = useCollectionPage<any>({
    collectionName: COLLECTION_NAMES.RESTAURANTS,
    orderByField: 'createdAt',
    orderByDirection: 'desc',
    pageSize: 50,
  });

  const filteredRestaurants = React.useMemo(() => {
    return restaurants.filter(r =>
      r.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.ownerEmail?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [restaurants, searchTerm]);
  const viewModel = React.useMemo(() => buildPlatformRestaurantsViewModel(filteredRestaurants), [filteredRestaurants]);

  const updateRestaurantStatus = React.useCallback(async (restaurantId: string, active: boolean) => {
    if (!db) return;
    setPendingStatusId(restaurantId);
    try {
      await updateDoc(doc(db, COLLECTION_NAMES.RESTAURANTS, restaurantId), {
        active,
        isActive: active,
        status: active ? 'active' : 'inactive',
        updatedAt: serverTimestamp(),
      });
      await refetch();
      toast({ title: active ? 'Restaurant activé' : 'Restaurant désactivé' });
    } catch (error) {
      console.error(error);
      toast({ title: 'Statut non modifié', description: 'Impossible de modifier le statut du restaurant.', variant: 'destructive' });
    } finally {
      setPendingStatusId(null);
      setDisableCandidate(null);
    }
  }, [db, refetch, toast]);

  if (isLoading && restaurants.length === 0) return <AdminRouteSkeleton />;

  if (error) {
    return (
      <ErrorState
        title="Etablissements indisponibles"
        description="Impossible de charger la liste des restaurants."
        actionLabel="Reessayer"
        onAction={() => void refetch()}
      />
    );
  }

  return <PlatformRestaurantsView restaurants={viewModel} platformName={settings.name} searchTerm={searchTerm} hasMore={hasMore} isLoading={isLoading} pendingStatusId={pendingStatusId} disableCandidate={disableCandidate} onSearchChange={setSearchTerm} onCreate={() => router.push('/platform/restaurants/new')} onOpen={(id) => router.push(`/platform/restaurants/${id}`)} onLoadMore={() => void loadMore()} onRequestDisable={(restaurant) => setDisableCandidate({ id: restaurant.id, name: restaurant.name })} onCancelDisable={() => setDisableCandidate(null)} onConfirmDisable={() => disableCandidate ? void updateRestaurantStatus(disableCandidate.id, false) : undefined} onActivate={(restaurant) => void updateRestaurantStatus(restaurant.id, true)} />;
}
