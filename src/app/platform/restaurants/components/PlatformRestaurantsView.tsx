"use client"

import { Building2, CheckCircle2, ChevronRight, Globe2, MapPin, Phone, Plus, Search, SlidersHorizontal, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  PlatformConfirmationDialog,
  PlatformEmptyState,
  PlatformHeader,
  PlatformPage,
  PlatformSection,
  PlatformStatusBadge,
} from "@/components/platform-ui"
import type { PlatformRestaurantPresentation } from "./platform-restaurants-view-model"

export interface PlatformRestaurantsViewProps {
  restaurants: PlatformRestaurantPresentation[]
  platformName: string
  searchTerm: string
  hasMore: boolean
  isLoading: boolean
  pendingStatusId: string | null
  disableCandidate: { id: string; name: string } | null
  onSearchChange: (value: string) => void
  onCreate: () => void
  onOpen: (id: string) => void
  onLoadMore: () => void
  onActivate: (restaurant: PlatformRestaurantPresentation) => void
  onRequestDisable: (restaurant: PlatformRestaurantPresentation) => void
  onCancelDisable: () => void
  onConfirmDisable: () => void
}

export function PlatformRestaurantsView({
  disableCandidate,
  hasMore,
  isLoading,
  onActivate,
  onCancelDisable,
  onConfirmDisable,
  onCreate,
  onLoadMore,
  onOpen,
  onRequestDisable,
  onSearchChange,
  pendingStatusId,
  platformName,
  restaurants,
  searchTerm,
}: PlatformRestaurantsViewProps) {
  const empty = <PlatformEmptyState title={searchTerm ? "Aucun résultat chargé" : "Aucun établissement chargé"} description={searchTerm ? "La recherche porte uniquement sur les pages déjà chargées." : "Aucun restaurant ne figure dans la page courante."} />

  return <PlatformPage>
    <PlatformHeader title="Établissements" subtitle={`Gestion du parc de restaurants et hôtels ${platformName}.`} actions={<Button className="min-h-11" onClick={onCreate}><Plus aria-hidden="true" className="mr-2 size-4" />Provisionner un restaurant</Button>} />
    <PlatformSection title="Restaurants chargés" description="Liste paginée par lots de 50. La recherche reste limitée aux pages déjà chargées.">
      <div className="relative w-full max-w-md">
        <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--dashboard-muted)]" />
        <Input type="search" aria-label="Rechercher un restaurant par nom ou email" placeholder="Rechercher par nom ou email…" className="min-h-11 pl-10" value={searchTerm} onChange={(event) => onSearchChange(event.target.value)} />
      </div>

      {restaurants.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {restaurants.map((restaurant) => (
            <RestaurantCard
              key={restaurant.id}
              restaurant={restaurant}
              isPending={pendingStatusId === restaurant.id}
              onActivate={onActivate}
              onOpen={onOpen}
              onRequestDisable={onRequestDisable}
            />
          ))}
        </div>
      ) : empty}

      {hasMore && !searchTerm ? <div className="flex justify-center"><Button type="button" variant="outline" className="min-h-11" disabled={isLoading} aria-busy={isLoading || undefined} onClick={onLoadMore}>{isLoading ? "Chargement…" : "Charger plus"}</Button></div> : null}
    </PlatformSection>

    <PlatformConfirmationDialog
      open={Boolean(disableCandidate)}
      onOpenChange={(open) => { if (!open) onCancelDisable() }}
      title="Désactiver ce restaurant ?"
      description={disableCandidate ? `Le restaurant « ${disableCandidate.name} » ne sera plus actif dans la plateforme.` : "Confirmer la désactivation."}
      consequence="Cette action peut rendre le restaurant indisponible pour les parcours publics et internes qui exigent un établissement actif."
      confirmLabel="Désactiver"
      loading={Boolean(disableCandidate && pendingStatusId === disableCandidate.id)}
      onConfirm={onConfirmDisable}
    />
  </PlatformPage>
}

function RestaurantCard({ isPending, onActivate, onOpen, onRequestDisable, restaurant }: {
  restaurant: PlatformRestaurantPresentation
  isPending: boolean
  onActivate: (restaurant: PlatformRestaurantPresentation) => void
  onOpen: (id: string) => void
  onRequestDisable: (restaurant: PlatformRestaurantPresentation) => void
}) {
  return (
    <article className="flex min-h-[320px] flex-col overflow-hidden rounded-2xl border border-[var(--platform-border)] bg-[var(--platform-panel)] shadow-[var(--shadow-dashboard-surface)]">
      <div className="flex items-start gap-4 border-b border-[var(--platform-border)] p-4">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--platform-border)] bg-[var(--platform-muted)]">
          {restaurant.imageUrl ? <img src={restaurant.imageUrl} alt="" className="h-full w-full object-cover" /> : <Building2 className="size-7 text-[var(--dashboard-muted)]" aria-hidden="true" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 truncate text-lg font-bold text-[var(--dashboard-title)]">{restaurant.name}</h3>
            <PlatformStatusBadge family="restaurant" state={restaurant.state} label={restaurant.isActive ? "Actif" : "Inactif"} className="shrink-0" />
          </div>
          <p className="mt-1 break-all text-xs font-medium text-[var(--dashboard-muted)]">{restaurant.slug ? `/${restaurant.slug}` : "Slug non renseigné"}</p>
        </div>
      </div>

      <div className="grid flex-1 gap-3 p-4 text-sm">
        <InfoRow icon={<Phone className="size-4" aria-hidden="true" />} label="Téléphone" value={restaurant.phone || "Non renseigné"} />
        <InfoRow icon={<MapPin className="size-4" aria-hidden="true" />} label="Ville / quartier" value={restaurant.location || "Non renseigné"} />
        <InfoRow icon={<Globe2 className="size-4" aria-hidden="true" />} label="Adresse" value={restaurant.address || "Non renseignée"} />
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--platform-border)] bg-[var(--platform-muted)] px-3 py-2">
          <span className="flex min-w-0 items-center gap-2 font-semibold text-[var(--dashboard-subtitle)]">
            {restaurant.hasConfiguredLocation ? <CheckCircle2 className="size-4 text-[var(--data-positive)]" aria-hidden="true" /> : <XCircle className="size-4 text-[var(--data-warning)]" aria-hidden="true" />}
            Localisation
          </span>
          <span className="shrink-0 text-xs font-bold text-[var(--dashboard-muted)]">{restaurant.hasConfiguredLocation ? "Configurée" : "À compléter"}</span>
        </div>
      </div>

      <div className="grid gap-2 border-t border-[var(--platform-border)] p-4 sm:grid-cols-2">
        {restaurant.isActive ? (
          <Button type="button" variant="outline" className="min-h-11" disabled={isPending} onClick={() => onRequestDisable(restaurant)}>
            {isPending ? "Traitement…" : "Désactiver"}
          </Button>
        ) : (
          <Button type="button" variant="outline" className="min-h-11" disabled={isPending} onClick={() => onActivate(restaurant)}>
            {isPending ? "Traitement…" : "Activer"}
          </Button>
        )}
        <Button type="button" className="min-h-11" onClick={() => onOpen(restaurant.id)}>
          <SlidersHorizontal className="mr-2 size-4" aria-hidden="true" />
          Gérer
          <ChevronRight className="ml-2 size-4" aria-hidden="true" />
        </Button>
      </div>
    </article>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-[var(--dashboard-muted)]">{icon}</span>
      <p className="min-w-0">
        <span className="block text-xs font-bold uppercase text-[var(--dashboard-muted)]">{label}</span>
        <span className="line-clamp-2 font-semibold text-[var(--dashboard-subtitle)]">{value}</span>
      </p>
    </div>
  )
}
