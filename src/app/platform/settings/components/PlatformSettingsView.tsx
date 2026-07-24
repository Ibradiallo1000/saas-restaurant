"use client"

import type * as React from "react"
import { Save } from "lucide-react"
import { MediaSelector } from "@/components/platform/MediaSelector"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { PlatformHeader, PlatformPage, PlatformSection, PlatformSettingsForm } from "@/components/platform-ui"
import type { PlatformMarketplaceHero, PlatformPublicFooter } from "@/types"

export interface PlatformSettingsFormValue { name: string; logoUrl: string; supportEmail: string; primaryColor: string; secondaryColor: string; maintenanceMode: boolean; marketplaceHero: PlatformMarketplaceHero; publicFooter: PlatformPublicFooter }
export interface PlatformSettingsViewProps { value: PlatformSettingsFormValue; activeLogoUrl?: string; activeMarketplaceHeroCoverUrl?: string; platformName: string; saving: boolean; onSubmit: (event: React.FormEvent) => void; onChange: (value: PlatformSettingsFormValue) => void; onSetLogo: (media: { url: string }) => Promise<void>; onClearActiveLogo: () => Promise<void>; onSetMarketplaceHeroCover: (media: { url: string }) => Promise<void>; onClearMarketplaceHeroCover: () => Promise<void> }

export function PlatformSettingsView({ activeLogoUrl, activeMarketplaceHeroCoverUrl, onChange, onClearActiveLogo, onClearMarketplaceHeroCover, onSetLogo, onSetMarketplaceHeroCover, onSubmit, platformName, saving, value }: PlatformSettingsViewProps) {
  return <PlatformPage width="reading">
    <PlatformHeader title="Configuration SaaS" subtitle={`Identité visuelle et paramètres globaux de ${platformName}.`} />
    <PlatformSettingsForm saving={saving} onSubmit={onSubmit}>
      <PlatformSection title="Identité de marque" description="Ces valeurs alimentent les surfaces déjà raccordées à la configuration plateforme." surface>
        <MediaSelector type="logo" label="Logo de la plateforme" description="Utilisé globalement dans l’interface d’administration." value={value.logoUrl} onChange={(logoUrl) => onChange({ ...value, logoUrl: logoUrl ?? "" })} activeUrl={activeLogoUrl} onSetActive={onSetLogo} onDeleteActive={onClearActiveLogo} />
        <MediaSelector type="marketplaceHero" label="Image de couverture marketplace" description="Bannière large affichée en fond du hero public. Privilégier un format type couverture Facebook ou YouTube." value={value.marketplaceHero.coverImageUrl} onChange={(coverImageUrl) => onChange({ ...value, marketplaceHero: { ...value.marketplaceHero, coverImageUrl: coverImageUrl ?? "" } })} activeUrl={activeMarketplaceHeroCoverUrl} onSetActive={onSetMarketplaceHeroCover} onDeleteActive={onClearMarketplaceHeroCover} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="platform-name">Nom de la plateforme</Label><Input id="platform-name" className="min-h-11" value={value.name} onChange={(event) => onChange({ ...value, name: event.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="platform-support-email">Email de support</Label><Input id="platform-support-email" type="email" className="min-h-11" value={value.supportEmail} onChange={(event) => onChange({ ...value, supportEmail: event.target.value })} /></div>
          <ColorField id="platform-primary-color" label="Couleur primaire (HEX)" value={value.primaryColor} onChange={(primaryColor) => onChange({ ...value, primaryColor })} />
          <ColorField id="platform-secondary-color" label="Couleur secondaire (HEX)" value={value.secondaryColor} onChange={(secondaryColor) => onChange({ ...value, secondaryColor })} />
        </div>
      </PlatformSection>
      <PlatformSection title="Sécurité et état" description="Le comportement métier de ce paramètre reste celui du contrôleur existant." surface>
        <div className="flex flex-col gap-3 rounded-[var(--radius-dashboard-input)] border border-[var(--platform-border)] bg-[var(--platform-muted)] p-4 sm:flex-row sm:items-center sm:justify-between"><div><Label htmlFor="platform-maintenance-mode" className="font-semibold">Mode maintenance</Label><p id="platform-maintenance-description" className="mt-1 text-sm text-[var(--dashboard-muted)]">Désactive l’accès aux dashboards restaurants selon le comportement existant.</p></div><Switch id="platform-maintenance-mode" aria-describedby="platform-maintenance-description" checked={value.maintenanceMode} onCheckedChange={(maintenanceMode) => onChange({ ...value, maintenanceMode })} /></div>
      </PlatformSection>
      <PlatformSection title="Footer public" description="Informations publiques affichées dans le marketplace Oordera." surface>
        <div className="space-y-5">
          <div className="space-y-2"><Label htmlFor="footer-description">Courte description Oordera</Label><Input id="footer-description" className="min-h-11" value={value.publicFooter.description} onChange={(event) => onChange({ ...value, publicFooter: { ...value.publicFooter, description: event.target.value } })} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FooterField id="footer-phone" label="Téléphone" value={value.publicFooter.phone} onChange={(phone) => onChange({ ...value, publicFooter: { ...value.publicFooter, phone } })} />
            <FooterField id="footer-whatsapp" label="WhatsApp" value={value.publicFooter.whatsapp} onChange={(whatsapp) => onChange({ ...value, publicFooter: { ...value.publicFooter, whatsapp } })} />
            <FooterField id="footer-email" label="Email" type="email" value={value.publicFooter.email} onChange={(email) => onChange({ ...value, publicFooter: { ...value.publicFooter, email } })} />
            <FooterField id="footer-address" label="Adresse du bureau" value={value.publicFooter.officeAddress} onChange={(officeAddress) => onChange({ ...value, publicFooter: { ...value.publicFooter, officeAddress } })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FooterField id="footer-facebook" label="Facebook URL" value={value.publicFooter.socialLinks.facebook} onChange={(facebook) => onChange({ ...value, publicFooter: { ...value.publicFooter, socialLinks: { ...value.publicFooter.socialLinks, facebook } } })} />
            <FooterField id="footer-instagram" label="Instagram URL" value={value.publicFooter.socialLinks.instagram} onChange={(instagram) => onChange({ ...value, publicFooter: { ...value.publicFooter, socialLinks: { ...value.publicFooter.socialLinks, instagram } } })} />
            <FooterField id="footer-tiktok" label="TikTok URL" value={value.publicFooter.socialLinks.tiktok} onChange={(tiktok) => onChange({ ...value, publicFooter: { ...value.publicFooter, socialLinks: { ...value.publicFooter.socialLinks, tiktok } } })} />
            <FooterField id="footer-linkedin" label="LinkedIn URL" value={value.publicFooter.socialLinks.linkedin} onChange={(linkedin) => onChange({ ...value, publicFooter: { ...value.publicFooter, socialLinks: { ...value.publicFooter.socialLinks, linkedin } } })} />
            <FooterField id="footer-youtube" label="YouTube URL" value={value.publicFooter.socialLinks.youtube} onChange={(youtube) => onChange({ ...value, publicFooter: { ...value.publicFooter, socialLinks: { ...value.publicFooter.socialLinks, youtube } } })} />
            <FooterField id="footer-twitter" label="X / Twitter URL" value={value.publicFooter.socialLinks.twitter} onChange={(twitter) => onChange({ ...value, publicFooter: { ...value.publicFooter, socialLinks: { ...value.publicFooter.socialLinks, twitter } } })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <FooterField id="footer-privacy" label="URL Confidentialité" value={value.publicFooter.legalLinks.privacy} onChange={(privacy) => onChange({ ...value, publicFooter: { ...value.publicFooter, legalLinks: { ...value.publicFooter.legalLinks, privacy } } })} />
            <FooterField id="footer-terms" label="URL Conditions" value={value.publicFooter.legalLinks.terms} onChange={(terms) => onChange({ ...value, publicFooter: { ...value.publicFooter, legalLinks: { ...value.publicFooter.legalLinks, terms } } })} />
            <FooterField id="footer-legal" label="URL Mentions légales" value={value.publicFooter.legalLinks.legalNotice} onChange={(legalNotice) => onChange({ ...value, publicFooter: { ...value.publicFooter, legalLinks: { ...value.publicFooter.legalLinks, legalNotice } } })} />
          </div>
        </div>
      </PlatformSection>
      <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={saving} aria-busy={saving || undefined}><Save aria-hidden="true" className="mr-2 size-4" />{saving ? "Enregistrement…" : "Enregistrer les modifications"}</Button>
    </PlatformSettingsForm>
  </PlatformPage>
}

function ColorField({ id, label, onChange, value }: { id: string; label: string; value: string; onChange: (value: string) => void }) { return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><div className="flex gap-2"><span aria-hidden="true" className="size-11 shrink-0 rounded-[var(--radius-dashboard-input)] border border-[var(--platform-border)]" style={{ backgroundColor: value }} /><Input id={id} className="min-h-11" value={value} onChange={(event) => onChange(event.target.value)} /></div></div> }

function FooterField({ id, label, onChange, type = "text", value }: { id: string; label: string; type?: string; value: string; onChange: (value: string) => void }) { return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} type={type} className="min-h-11" value={value} onChange={(event) => onChange(event.target.value)} /></div> }
