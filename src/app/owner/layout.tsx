import type { ReactNode } from "react"

import { ProtectedAppShell } from "@/components/layout/protected-app-shell"

export default function OwnerLayout({ children }: { children: ReactNode }) {
  return <ProtectedAppShell mode="dashboard">{children}</ProtectedAppShell>
}
