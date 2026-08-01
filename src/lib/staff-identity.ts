type IdentitySource = Record<string, unknown> | null | undefined

export function resolveStaffDisplayName(
  staff: IdentitySource,
  firebaseUser?: { displayName?: string | null; email?: string | null } | null,
  fallback = "Utilisateur"
) {
  return firstText(
    staff?.nomComplet,
    staff?.fullName,
    staff?.displayName,
    staff?.name,
    firebaseUser?.displayName,
    firebaseUser?.email,
    fallback
  )
}

export function resolveStaffRoleLabel(role: unknown) {
  const value = typeof role === "string" ? role.toLowerCase() : ""
  if (value === "owner") return "Propriétaire"
  if (value === "super_admin" || value === "admin") return "Super administrateur"
  if (value === "manager") return "Manager"
  if (value === "cashier") return "Caissier"
  if (value === "kitchen") return "Chef de cuisine"
  return firstText(role, "Membre du personnel")
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return "Utilisateur"
}
