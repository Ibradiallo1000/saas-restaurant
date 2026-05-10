import { ProtectedAppShell } from "@/components/layout/protected-app-shell"

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return <ProtectedAppShell mode="dashboard">{children}</ProtectedAppShell>
}
