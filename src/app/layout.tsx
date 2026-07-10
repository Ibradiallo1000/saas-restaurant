// app/layout.tsx
import type { Metadata, Viewport } from 'next'
import { DEFAULT_BRAND_PRIMARY } from '@/lib/brand-theme'
import Providers from './providers'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: "Oordera",
    template: "%s | Oordera",
  },
  description: "Commandez et suivez vos commandes restaurant avec Oordera.",
  manifest: "/pwa-manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Oordera",
  },
}

export const viewport: Viewport = {
  themeColor: DEFAULT_BRAND_PRIMARY,
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <meta charSet="UTF-8" />
        <link rel="manifest" href="/pwa-manifest.webmanifest" />
        <meta name="theme-color" content={DEFAULT_BRAND_PRIMARY} />
        <meta name="msapplication-TileColor" content={DEFAULT_BRAND_PRIMARY} />
      </head>
      <body suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
