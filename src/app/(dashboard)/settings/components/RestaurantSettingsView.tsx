"use client"

import * as React from "react"
import { AlertTriangle, Building2, Copy, Mail, MessageCircle, Palette, Plus, RefreshCw, Save, Settings, Users } from "lucide-react"

import {
  SettingsFieldGroup,
  SettingsEmptyState,
  SettingsErrorState,
  SettingsForm,
  SettingsHeader,
  SettingsMediaField,
  SettingsNavigation,
  SettingsPage,
  SettingsSaveBar,
  SettingsSection,
  SettingsSelect,
  SettingsTeamMemberCard,
  SettingsTeamTable,
  SettingsTextField,
  type SettingsTeamColumn,
} from "@/components/settings-ui"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import RestaurantHoursSettings from "@/components/restaurant-hours/RestaurantHoursSettings"
import type { BrandingImageTarget, RestaurantBrandingFormModel, RestaurantProfileFormModel, RestaurantSettingsViewModel, RestaurantStaffEditModel, RestaurantStaffFormModel, RestaurantStaffMemberModel, SettingsTab } from "./restaurant-settings-view-model"
import { RESTAURANT_STAFF_ROLE_OPTIONS } from "./restaurant-settings-view-model"

export interface RestaurantSettingsViewProps {
  model: RestaurantSettingsViewModel
  payments: React.ReactNode
  onTabChange: (tab: SettingsTab) => void
  onProfileChange: (value: RestaurantProfileFormModel) => void
  onSaveProfile: () => void
  onBrandingChange: (value: RestaurantBrandingFormModel) => void
  brandingStatus?: "idle" | "saving" | "success" | "error"
  brandingMessage?: string
  onChooseBrandImage: (target: BrandingImageTarget) => void
  onSaveBranding: () => void
  onNewStaffChange: (value: RestaurantStaffFormModel) => void
  onInviteStaff: () => void
  onStartStaffEdit: (member: RestaurantStaffMemberModel) => void
  onStaffEditChange: (value: RestaurantStaffEditModel) => void
  onSaveStaffEdit: () => void
  onCancelStaffEdit: () => void
  onCopyInvite: (link?: string) => void
  onSendInviteEmail: (email: string, link?: string) => void
  onSendInviteWhatsApp: (link?: string) => void
  onResendInvite: (member: RestaurantStaffMemberModel) => void
}

export function RestaurantSettingsView(props: RestaurantSettingsViewProps) {
  const { model } = props
  const renderMemberActions = (member: RestaurantStaffMemberModel) => <StaffActions member={member} pendingAction={model.staffPendingAction} onEdit={props.onStartStaffEdit} onCopy={props.onCopyInvite} onEmail={props.onSendInviteEmail} onWhatsApp={props.onSendInviteWhatsApp} onResend={props.onResendInvite}/>
  const columns: SettingsTeamColumn[] = [
    { id: "member", header: "Membre", render: (member) => { const staffMember = member as RestaurantStaffMemberModel; return <div><p className="font-medium text-[var(--dashboard-title)]">{staffMember.name}</p><p className="text-xs text-[var(--settings-muted)]">{staffMember.telephone || staffMember.email || "Contact non renseigne"}</p>{staffMember.incomplete ? <p className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--settings-state-dirty-fg)]"><AlertTriangle aria-hidden="true" className="size-3"/>Profil incomplet</p> : null}</div> } },
    { id: "role", header: "Rôle", render: (member) => <Badge variant="outline">{(member as RestaurantStaffMemberModel).roleLabel}</Badge> },
    { id: "status", header: "Statut", render: (member) => <StaffStatusBadge member={member as RestaurantStaffMemberModel}/> },
    { id: "actions", header: "Actions", className: "min-w-[15rem]", render: (member) => renderMemberActions(member as RestaurantStaffMemberModel) },
  ]

  return <SettingsPage
    header={<SettingsHeader title="Configuration" description="Paramètres de l'établissement et gestion d'équipe." scope={<span className="inline-flex items-center gap-2"><Settings aria-hidden="true" className="size-4"/>Restaurant</span>}/>}
    navigation={<SettingsNavigation items={model.navigation} activeId={model.activeTab} onSelect={(id) => props.onTabChange(id as SettingsTab)}/>}
  >
    {model.activeTab === "profile" ? <SettingsSection id="settings-profile" title="Identité" icon={<Building2/>}>
      <SettingsForm onSubmit={(event) => { event.preventDefault(); props.onSaveProfile() }} saving={model.loading}>
        <SettingsFieldGroup columns="two">
          <SettingsTextField label="Nom de l'établissement" value={model.profile.name} onChange={(event) => props.onProfileChange({ ...model.profile, name: event.target.value })}/>
          <SettingsTextField label="Devise locale" value={model.profile.currency} onChange={(event) => props.onProfileChange({ ...model.profile, currency: event.target.value })}/>
        </SettingsFieldGroup>
        <SettingsSaveBar state={model.loading ? "saving" : "idle"} dirty={false} saving={model.loading} primaryAction={{ id: "save-profile", label: <><Save aria-hidden="true" className="mr-2 size-4"/>Enregistrer les modifications</>, onSelect: props.onSaveProfile, disabled: model.loading }}/>
      </SettingsForm>
    </SettingsSection> : null}

    {model.activeTab === "staff" ? <SettingsSection id="settings-staff" title="Personnel" icon={<Users/>}>
      <div className="space-y-6">
        <div className="hidden md:block"><SettingsTeamTable caption="Personnel du restaurant" members={model.staff} columns={columns} loading={model.staffLoading} error={model.staffError || undefined} empty={<SettingsEmptyState title="Aucun membre" description="Le personnel ajouté au restaurant apparaîtra ici."/>}/></div>
        <div className="md:hidden">{model.staffLoading ? <p role="status" className="p-4 text-sm text-[var(--settings-muted)]">Chargement de l'équipe</p> : model.staffError ? <SettingsErrorState title="Personnel indisponible" description={model.staffError}/> : model.staff.length === 0 ? <SettingsEmptyState title="Aucun membre" description="Le personnel ajouté au restaurant apparaîtra ici."/> : <div className="grid gap-3">{model.staff.map((member) => <SettingsTeamMemberCard key={member.id} member={{ ...member, role: <Badge variant="outline">{member.roleLabel}</Badge>, status: <StaffStatusBadge member={member}/>, actions: renderMemberActions(member) }}/>)}</div>}</div>
        {model.editingStaffId ? <SettingsForm onSubmit={(event) => { event.preventDefault(); props.onSaveStaffEdit() }} saving={model.staffPendingAction?.startsWith("complete:")}>
          <SettingsFieldGroup title="Compléter le profil" columns="adaptive">
            <SettingsTextField label="Nom complet" value={model.editingStaff.nomComplet} onChange={(event) => props.onStaffEditChange({ ...model.editingStaff, nomComplet: event.target.value })}/>
            <SettingsTextField label="Téléphone" value={model.editingStaff.telephone} onChange={(event) => props.onStaffEditChange({ ...model.editingStaff, telephone: event.target.value })}/>
            <SettingsSelect label="Rôle / Fonction" value={model.editingStaff.role} options={[...RESTAURANT_STAFF_ROLE_OPTIONS]} onChange={(event) => props.onStaffEditChange({ ...model.editingStaff, role: event.target.value })}/>
          </SettingsFieldGroup>
          <div className="flex flex-col gap-2 sm:flex-row"><Button type="submit" className="min-h-11" disabled={Boolean(model.staffPendingAction)}>{model.staffPendingAction?.startsWith("complete:") ? "Enregistrement…" : "Enregistrer"}</Button><Button type="button" variant="outline" className="min-h-11" disabled={Boolean(model.staffPendingAction)} onClick={props.onCancelStaffEdit}>Annuler</Button></div>
        </SettingsForm> : null}
        <SettingsForm onSubmit={(event) => { event.preventDefault(); props.onInviteStaff() }} saving={model.staffPendingAction === "invite"}>
          <SettingsFieldGroup title="Ajouter un membre" description="Avec un email, un lien d’activation est généré. Sans email, le profil est ajouté sans accès Auth." columns="adaptive">
            <SettingsTextField label="Nom complet" required value={model.newStaff.nomComplet} onChange={(event) => props.onNewStaffChange({ ...model.newStaff, nomComplet: event.target.value })}/>
            <SettingsTextField label="Téléphone" required value={model.newStaff.telephone} onChange={(event) => props.onNewStaffChange({ ...model.newStaff, telephone: event.target.value })}/>
            <SettingsTextField label="Email professionnel (optionnel)" value={model.newStaff.email} onChange={(event) => props.onNewStaffChange({ ...model.newStaff, email: event.target.value })}/>
            <SettingsSelect label="Rôle / Fonction" value={model.newStaff.role} options={[...RESTAURANT_STAFF_ROLE_OPTIONS]} onChange={(event) => props.onNewStaffChange({ ...model.newStaff, role: event.target.value })}/>
          </SettingsFieldGroup>
          <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={Boolean(model.staffPendingAction) || !model.canInvite}><Plus aria-hidden="true" className="mr-2 size-4"/>{model.staffPendingAction === "invite" ? "Ajout…" : "Ajouter le membre"}</Button>
          {model.lastInviteLink ? <div className="space-y-3 rounded-[var(--radius-dashboard-widget)] border border-[var(--settings-border)] bg-[var(--settings-section)] p-3"><p className="text-sm font-medium">Lien d’invitation généré</p><Input value={model.lastInviteLink} readOnly aria-label="Lien d'invitation"/><div className="grid gap-2 sm:flex sm:flex-wrap"><Button type="button" variant="outline" className="min-h-11" onClick={() => props.onCopyInvite()}><Copy aria-hidden="true" className="mr-2 size-4"/>Copier</Button>{model.lastInviteEmail ? <Button type="button" variant="outline" className="min-h-11" onClick={() => props.onSendInviteEmail(model.lastInviteEmail)}><Mail aria-hidden="true" className="mr-2 size-4"/>Ouvrir l’email</Button> : null}<Button type="button" variant="outline" className="min-h-11" onClick={() => props.onSendInviteWhatsApp()}><MessageCircle aria-hidden="true" className="mr-2 size-4"/>Ouvrir WhatsApp</Button></div></div> : null}
        </SettingsForm>
      </div>
    </SettingsSection> : null}

    {model.activeTab === "payments" ? <SettingsSection id="settings-payments" title="Paiements">{props.payments}</SettingsSection> : null}

    {model.activeTab === "hours" ? <RestaurantHoursSettings /> : null}

    {model.activeTab === "branding" ? <SettingsSection id="settings-branding" title="Personnalisation" description="Personnalisez l'identité visuelle du restaurant. La couleur de marque reste pilotée par les paramètres SaaS." icon={<Palette/>}>
      <SettingsForm onSubmit={(event) => { event.preventDefault(); props.onSaveBranding() }} saving={model.loading} error={props.brandingStatus === "error" ? props.brandingMessage : undefined}>
        <SettingsFieldGroup columns="one"><SettingsTextField label="Nom du restaurant" value={model.branding.name} onChange={(event) => props.onBrandingChange({ ...model.branding, name: event.target.value })}/></SettingsFieldGroup>
        <SettingsFieldGroup columns="two">
          <SettingsMediaField label="Logo" state={model.loading ? "loading" : model.branding.logoUrl ? "ready" : "empty"} loading={model.loading} value={model.branding.logoUrl} preview={model.branding.logoUrl ? <img src={model.branding.logoUrl} alt="Logo" className="h-32 w-full object-contain"/> : undefined} onSelect={() => props.onChooseBrandImage("logo")} selectLabel={model.branding.logoUrl ? "Changer" : "Choisir une image"}/>
          <SettingsMediaField label="Image de couverture" description="L'image est adaptée automatiquement en object-cover sur la couverture publique, sans imposer un format source unique." state={model.loading ? "loading" : model.branding.coverImage ? "ready" : "empty"} loading={model.loading} value={model.branding.coverImage} preview={model.branding.coverImage ? <img src={model.branding.coverImage} alt="Image de couverture" className="h-32 w-full object-cover"/> : undefined} onSelect={() => props.onChooseBrandImage("cover")} selectLabel={model.branding.coverImage ? "Changer" : "Choisir une image"}/>
        </SettingsFieldGroup>
        <SettingsSaveBar state={props.brandingStatus === "success" ? "saved" : props.brandingStatus === "error" ? "error" : model.loading || props.brandingStatus === "saving" ? "saving" : props.brandingMessage ? "dirty" : "idle"} message={props.brandingMessage} dirty={Boolean(props.brandingMessage && props.brandingStatus === "idle")} saving={model.loading || props.brandingStatus === "saving"} primaryAction={{ id: "save-branding", label: <><Save aria-hidden="true" className="mr-2 size-4"/>Enregistrer la personnalisation</>, onSelect: props.onSaveBranding, disabled: model.loading }}/>
      </SettingsForm>
    </SettingsSection> : null}
  </SettingsPage>
}

function StaffStatusBadge({ member }: { member: RestaurantStaffMemberModel }) { return <Badge variant={member.state === "active" ? "default" : "secondary"}>{member.statusLabel}</Badge> }

function StaffActions({ member, pendingAction, onCopy, onEdit, onEmail, onResend, onWhatsApp }: { member: RestaurantStaffMemberModel; pendingAction: string | null; onEdit: (member: RestaurantStaffMemberModel) => void; onCopy: (link?: string) => void; onEmail: (email: string, link?: string) => void; onWhatsApp: (link?: string) => void; onResend: (member: RestaurantStaffMemberModel) => void }) { const disabled = Boolean(pendingAction); const resending = pendingAction === `resend:${member.id}`; return <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap">{member.incomplete ? <Button type="button" variant="outline" className="min-h-11" disabled={disabled} onClick={() => onEdit(member)}>Compléter</Button> : null}{member.inviteLink ? <><Button type="button" variant="outline" className="min-h-11" disabled={disabled} onClick={() => onCopy(member.inviteLink)}><Copy aria-hidden="true" className="mr-1 size-3"/>Copier</Button>{member.email ? <Button type="button" variant="outline" className="min-h-11" disabled={disabled} onClick={() => onEmail(member.email, member.inviteLink)}><Mail aria-hidden="true" className="mr-1 size-3"/>Email</Button> : null}<Button type="button" variant="outline" className="min-h-11" disabled={disabled} onClick={() => onWhatsApp(member.inviteLink)}><MessageCircle aria-hidden="true" className="mr-1 size-3"/>WhatsApp</Button></> : null}{member.canResendInvite ? <Button type="button" variant="ghost" className="min-h-11" disabled={disabled} onClick={() => onResend(member)}><RefreshCw aria-hidden="true" className="mr-1 size-3"/>{resending ? "Renvoi…" : "Renvoyer"}</Button> : null}</div> }
