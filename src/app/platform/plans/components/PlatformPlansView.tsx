"use client"

import type * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PlatformDataQualityBadge, PlatformHeader, PlatformPage, PlatformPlanCard, PlatformSection } from "@/components/platform-ui"

export interface PlatformPlanTemplatePresentation { key: string; name: string; features: Array<{ label: string; enabled: boolean }>; limits: Array<{ label: string; value: React.ReactNode }> }
export interface PlatformPlansViewProps { selectedPlan: string; price: string; loading: boolean; template: PlatformPlanTemplatePresentation; onSelectedPlanChange: (value: string) => void; onPriceChange: (value: string) => void; onCreate: () => void }

export function PlatformPlansView({ loading, onCreate, onPriceChange, onSelectedPlanChange, price, selectedPlan, template }: PlatformPlansViewProps) {
  return <PlatformPage width="reading">
    <PlatformHeader title="Créer un plan" subtitle="Création depuis les trois modèles réellement disponibles. Cette route ne charge pas le catalogue des plans existants." meta={<PlatformDataQualityBadge quality="partial" label="Création uniquement" />} />
    <PlatformSection title="Configuration du plan" description="Le code, les fonctionnalités, les limites, la devise et les valeurs métier existantes restent inchangés." surface>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="platform-plan-template">Modèle</Label><Select value={selectedPlan} onValueChange={onSelectedPlanChange}><SelectTrigger id="platform-plan-template" className="min-h-11"><SelectValue placeholder="Choisir un plan" /></SelectTrigger><SelectContent><SelectItem value="starter">Starter</SelectItem><SelectItem value="pro">Pro</SelectItem><SelectItem value="enterprise">Enterprise</SelectItem></SelectContent></Select></div>
        <div className="space-y-2"><Label htmlFor="platform-plan-price">Prix en XOF</Label><Input id="platform-plan-price" type="number" inputMode="decimal" className="min-h-11" value={price} onChange={(event) => onPriceChange(event.target.value)} /></div>
      </div>
      <PlatformPlanCard title={template.name} price={`${price || "—"} XOF`} description={`Code technique : ${template.key}`} features={<div className="grid gap-4 sm:grid-cols-2"><div><h3 className="text-sm font-semibold">Fonctionnalités du modèle</h3><ul className="mt-2 space-y-1 text-sm text-[var(--dashboard-subtitle)]">{template.features.map((feature) => <li key={feature.label}>{feature.label} : {feature.enabled ? "Oui" : "Non"}</li>)}</ul></div><div><h3 className="text-sm font-semibold">Limites du modèle</h3><dl className="mt-2 space-y-1 text-sm">{template.limits.map((limit) => <div key={limit.label} className="flex justify-between gap-3"><dt className="text-[var(--dashboard-muted)]">{limit.label}</dt><dd className="font-medium tabular-nums">{limit.value}</dd></div>)}</dl></div></div>} />
      <Button type="button" className="min-h-11" disabled={loading} aria-busy={loading || undefined} onClick={onCreate}>{loading ? "Création…" : "Créer le plan"}</Button>
    </PlatformSection>
  </PlatformPage>
}

