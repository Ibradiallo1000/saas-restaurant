"use client"

import { Activity, Building2, CreditCard, MessageSquare, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  PlatformDataQualityBadge,
  PlatformEmptyState,
  PlatformErrorState,
  PlatformHeader,
  PlatformLoadingState,
  PlatformMetricCard,
  PlatformMetricGrid,
  PlatformPage,
  PlatformSection,
  PlatformUnavailableState,
} from "@/components/platform-ui"
import type { PlatformDashboardViewModel } from "./platform-dashboard-view-model"

export interface PlatformDashboardViewProps {
  model: PlatformDashboardViewModel
  platformName: string
  requestsLoading: boolean
  requestsError: boolean
  onCreateRestaurant: () => void
  onProvisionRequest: (request: PlatformDashboardViewModel["requests"][number]) => void
}

export function PlatformDashboardView({ model, onCreateRestaurant, onProvisionRequest, platformName, requestsError, requestsLoading }: PlatformDashboardViewProps) {
  return <PlatformPage>
    <PlatformHeader title="Administration SaaS" subtitle={`Contrôle global du réseau ${platformName}.`} actions={<Button className="min-h-11" onClick={onCreateRestaurant}><Plus aria-hidden="true" className="mr-2 size-4" />Nouveau restaurant</Button>} />
    <PlatformMetricGrid>
      <PlatformMetricCard icon={<Building2 />} label="Établissements" value="Indisponible" description="La source restaurants du Dashboard n’est pas active." quality="unavailable" />
      <PlatformMetricCard icon={<MessageSquare />} label="Demandes chargées" value={requestsLoading ? "—" : model.requestCount} description={`${model.newRequestCount} nouvelle${model.newRequestCount === 1 ? "" : "s"} parmi les 20 dernières demandes.`} quality={model.requestQuality} />
      <PlatformMetricCard icon={<CreditCard />} label="Revenu SaaS" value="Indisponible" description="Aucune source fiable n’est raccordée à ce Dashboard." quality="unavailable" />
      <PlatformMetricCard icon={<Activity />} label="État système" value="Indisponible" description="Aucun contrat de monitoring actif n’est disponible." quality="unavailable" />
    </PlatformMetricGrid>

    <Tabs defaultValue="restaurants" className="w-full">
      <TabsList className="mb-4 max-w-full justify-start overflow-x-auto bg-[var(--platform-muted)]">
        <TabsTrigger value="restaurants" className="min-h-11">Restaurants</TabsTrigger>
        <TabsTrigger value="requests" className="min-h-11">Demandes ({model.newRequestCount})</TabsTrigger>
      </TabsList>
      <TabsContent value="restaurants">
        <PlatformSection title="Parc d’établissements" description="Vue synthétique des restaurants connus par la plateforme." surface>
          <PlatformUnavailableState title="Données restaurants indisponibles" description="La requête restaurants de ce Dashboard est volontairement désactivée. Consultez la liste dédiée pour accéder aux établissements chargés." />
        </PlatformSection>
      </TabsContent>
      <TabsContent value="requests">
        <PlatformSection title="Demandes de démo et d’accès" description={<span className="inline-flex flex-wrap items-center gap-2">Les 20 demandes les plus récentes uniquement <PlatformDataQualityBadge quality="partial" /></span>} surface>
          {requestsError ? <PlatformErrorState title="Demandes indisponibles" description="Impossible de charger les demandes récentes." /> : requestsLoading ? <PlatformLoadingState label="Chargement des demandes" /> : model.requests.length === 0 ? <PlatformEmptyState title="Aucune demande chargée" description="Aucune demande ne figure dans la fenêtre actuellement chargée." /> : <div className="grid gap-3">
            {model.requests.map((request) => <article key={request.id} className="rounded-[var(--radius-dashboard-widget)] border border-[var(--platform-border)] bg-[var(--platform-panel)] p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{request.restaurantName}</h3>{request.establishmentType ? <Badge variant="outline">{request.establishmentType}</Badge> : null}{request.isNew ? <Badge>Nouveau</Badge> : null}</div><p className="mt-1 text-sm text-[var(--dashboard-subtitle)]">{request.managerName}{request.city ? ` · ${request.city}` : ""}</p>{request.email || request.phone ? <p className="mt-1 break-words text-xs text-[var(--dashboard-muted)]">{[request.phone, request.email].filter(Boolean).join(" · ")}</p> : null}</div>
                {request.email ? <Button variant="outline" className="min-h-11 shrink-0" onClick={() => onProvisionRequest(request)}>Provisionner</Button> : null}
              </div>
            </article>)}
          </div>}
        </PlatformSection>
      </TabsContent>
    </Tabs>
  </PlatformPage>
}
