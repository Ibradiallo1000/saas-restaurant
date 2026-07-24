import type { SettingsNavigationItem, SettingsTeamMemberState } from "@/components/settings-ui"

export type SettingsTab = "profile" | "hours" | "staff" | "payments" | "branding"
export type BrandingImageTarget = "logo" | "cover"

export interface RestaurantProfileFormModel { name: string; country: string; currency: string }
export interface RestaurantBrandingFormModel { name: string; logoUrl: string; coverImage: string }
export interface RestaurantStaffFormModel { nomComplet: string; telephone: string; email: string; role: string }
export interface RestaurantStaffEditModel { nomComplet: string; telephone: string; role: string }
export interface RestaurantStaffMemberModel { id: string; name: string; email: string; telephone: string; role: string; roleLabel: string; status: string; statusLabel: string; state: SettingsTeamMemberState; incomplete: boolean; inviteLink: string; canResendInvite: boolean }

export interface RestaurantSettingsViewModel {
  activeTab: SettingsTab
  navigation: SettingsNavigationItem[]
  loading: boolean
  staffLoading: boolean
  staffError: string
  staffPendingAction: string | null
  profile: RestaurantProfileFormModel
  branding: RestaurantBrandingFormModel
  staff: RestaurantStaffMemberModel[]
  newStaff: RestaurantStaffFormModel
  editingStaffId: string | null
  editingStaff: RestaurantStaffEditModel
  lastInviteLink: string
  lastInviteEmail: string
  canInvite: boolean
}

export const RESTAURANT_STAFF_ROLE_OPTIONS = [
  { value: "manager", label: "Manager / Gérant" },
  { value: "cashier", label: "Caissier / POS" },
  { value: "kitchen", label: "Chef de Cuisine" },
  { value: "server", label: "Serveur / Salle" },
] as const

const ROLE_LABELS: Record<string, string> = {
  owner: "Propriétaire",
  manager: "Manager / Gérant",
  cashier: "Caissier / POS",
  kitchen: "Chef de Cuisine",
  server: "Serveur / Salle",
  super_admin: "Super-administrateur",
}

const STATUS_LABELS: Record<string, string> = {
  active: "Actif",
  actif: "Actif",
  invited: "Invité",
  inactive: "Désactivé",
  disabled: "Désactivé",
  incomplete: "Profil incomplet",
}

export function buildRestaurantSettingsViewModel(input: {
  activeTab: SettingsTab
  loading: boolean
  staffLoading: boolean
  staffError?: string
  staffPendingAction: string | null
  profile: RestaurantProfileFormModel
  branding: RestaurantBrandingFormModel
  staff?: any[] | null
  newStaff: RestaurantStaffFormModel
  editingStaffId: string | null
  editingStaff: RestaurantStaffEditModel
  lastInviteLink: string
  lastInviteEmail: string
}): RestaurantSettingsViewModel {
  return {
    activeTab: input.activeTab,
    loading: input.loading,
    staffLoading: input.staffLoading,
    staffError: input.staffError ?? "",
    staffPendingAction: input.staffPendingAction,
    profile: input.profile,
    branding: input.branding,
    newStaff: input.newStaff,
    editingStaffId: input.editingStaffId,
    editingStaff: input.editingStaff,
    lastInviteLink: input.lastInviteLink,
    lastInviteEmail: input.lastInviteEmail,
    canInvite: Boolean(input.newStaff.nomComplet.trim() && input.newStaff.telephone.trim() && input.newStaff.role),
    navigation: [
      { id: "profile", label: "Établissement" },
      { id: "hours", label: "Horaires" },
      { id: "staff", label: "Équipe & rôles" },
      { id: "payments", label: "Paiements" },
      { id: "branding", label: "Personnalisation" },
    ],
    staff: (input.staff ?? []).map((member: any) => {
      const incomplete = !member.nomComplet || !member.telephone
      const rawStatus = typeof member.status === "string" && member.status.trim() ? member.status.trim() : "unknown"
      const state: SettingsTeamMemberState = incomplete
        ? "incomplete"
        : rawStatus === "invited"
          ? "invited"
          : rawStatus === "active" || rawStatus === "actif"
            ? "active"
            : rawStatus === "inactive" || rawStatus === "disabled"
              ? "inactive"
              : "unknown"
      const rawRole = typeof member.role === "string" && member.role.trim() ? member.role.trim() : "unknown"
      return {
        id: String(member.id),
        name: member.nomComplet || member.email || "Membre",
        email: member.email || "",
        telephone: member.telephone || "",
        role: rawRole,
        roleLabel: ROLE_LABELS[rawRole] ?? rawRole,
        status: rawStatus,
        statusLabel: incomplete ? "Profil incomplet" : STATUS_LABELS[rawStatus] ?? rawStatus,
        state,
        incomplete,
        inviteLink: member.inviteLink || "",
        canResendInvite: Boolean(member.email),
      }
    }),
  }
}
