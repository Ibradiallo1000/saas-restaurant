import { ProtectedAppShell } from "@/components/layout/protected-app-shell"

export function PlatformShell({ children }: { children: React.ReactNode }) {
  return <ProtectedAppShell mode="platform">{children}</ProtectedAppShell>
}
