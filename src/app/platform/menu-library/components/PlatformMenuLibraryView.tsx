"use client"

import type * as React from "react"
import { Boxes, ChefHat, Layers3 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { PlatformConfirmationDialog, PlatformHeader, PlatformMetricCard, PlatformMetricGrid, PlatformPage } from "@/components/platform-ui"

export interface PlatformMenuLibraryViewProps { packCount: number; categoryCount: number; productCount: number; children: React.ReactNode; deleteLabel?: string; deleting: boolean; onDeleteOpenChange: (open: boolean) => void; onConfirmDelete: () => void }
export function PlatformMenuLibraryView({ categoryCount, children, deleteLabel, deleting, onConfirmDelete, onDeleteOpenChange, packCount, productCount }: PlatformMenuLibraryViewProps) {
  return <PlatformPage>
    <PlatformHeader title="Bibliothèque de menus" subtitle="Modèles globaux préparés par le Super Admin. Aucun menu restaurant n’est modifié ici." meta={<Badge variant="outline">Plateforme uniquement</Badge>} />
    <PlatformMetricGrid><PlatformMetricCard icon={<Boxes />} label="Packs modèles chargés" value={packCount} quality="partial" /><PlatformMetricCard icon={<Layers3 />} label="Catégories modèles chargées" value={categoryCount} quality="partial" /><PlatformMetricCard icon={<ChefHat />} label="Produits modèles chargés" value={productCount} quality="partial" /></PlatformMetricGrid>
    {children}
    <PlatformConfirmationDialog open={Boolean(deleteLabel)} onOpenChange={onDeleteOpenChange} title="Supprimer ce modèle global ?" description={deleteLabel ? `Vous allez supprimer « ${deleteLabel} » de la bibliothèque plateforme.` : "Confirmer la suppression."} consequence="Cette suppression utilise la mutation existante. Les dépendances éventuelles ne sont pas analysées automatiquement." confirmLabel="Supprimer" loading={deleting} onConfirm={onConfirmDelete} />
  </PlatformPage>
}

