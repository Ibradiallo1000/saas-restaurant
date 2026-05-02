"use client"

import { AppShell } from "@/components/layout/app-shell"
import { Toaster } from "@/components/ui/toaster"
import { PlatformProvider } from "@/contexts/platform-context"
import { CurrentUserProvider } from "@/contexts/current-user-context"
import { ThemeProvider } from "@/contexts/theme-context"
import { FirebaseClientProvider } from "@/firebase/client-provider"

export default function Providers({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <FirebaseClientProvider>
      <ThemeProvider>
        <PlatformProvider>
          <CurrentUserProvider>
            <AppShell>{children}</AppShell>
          </CurrentUserProvider>
        </PlatformProvider>
      </ThemeProvider>
      <Toaster />
    </FirebaseClientProvider>
  )
}