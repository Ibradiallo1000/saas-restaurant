// app/layout.tsx
import Providers from './providers'
import { SidebarProvider } from "@/components/ui/sidebar"
import './globals.css'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <SidebarProvider defaultOpen>
          <Providers>
            {children}
          </Providers>
        </SidebarProvider>
      </body>
    </html>
  )
}