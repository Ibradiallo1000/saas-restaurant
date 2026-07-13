// app/layout.tsx
import type { Metadata, Viewport } from 'next'
import { BRAND_PRIMARY_STORAGE_KEY, DEFAULT_BRAND_PRIMARY } from '@/lib/brand-theme'
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

const brandThemeBootstrapScript = `
(function () {
  var fallback = ${JSON.stringify(DEFAULT_BRAND_PRIMARY)};
  var storageKey = ${JSON.stringify(BRAND_PRIMARY_STORAGE_KEY)};
  var legacyKeys = ["oordera-brand-primary", "oordera:primary-color", "oordera:primaryColor", "oordera:theme-primary", "oordera:brandColor"];

  function sanitize(value) {
    if (typeof value !== "string") return null;
    var normalized = value.trim().replace("#", "");
    if (normalized.length === 3) {
      normalized = normalized.split("").map(function (char) { return char + char; }).join("");
    }
    return /^[0-9a-fA-F]{6}$/.test(normalized) ? "#" + normalized : null;
  }

  function rgb(hex) {
    return [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16)
    ].join(" ");
  }

  function hsl(hex) {
    var r = parseInt(hex.slice(1, 3), 16) / 255;
    var g = parseInt(hex.slice(3, 5), 16) / 255;
    var b = parseInt(hex.slice(5, 7), 16) / 255;
    var max = Math.max(r, g, b);
    var min = Math.min(r, g, b);
    var h = 0;
    var s = 0;
    var l = (max + min) / 2;

    if (max !== min) {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }

    return Math.round(h * 360) + " " + Math.round(s * 100) + "% " + Math.round(l * 100) + "%";
  }

  var color = fallback;
  try {
    color = sanitize(window.localStorage.getItem(storageKey)) || fallback;
    legacyKeys.forEach(function (key) { window.localStorage.removeItem(key); });
  } catch (error) {}

  var colorRgb = rgb(color);
  var root = document.documentElement;
  root.style.setProperty("--brand-primary", color);
  root.style.setProperty("--brand-primary-rgb", colorRgb);
  root.style.setProperty("--brand-primary-soft", "rgb(" + colorRgb + " / 0.10)");
  root.style.setProperty("--color-primary", color);
  root.style.setProperty("--primary", color);
  root.style.setProperty("--primary-rgb", colorRgb);
  root.style.setProperty("--ring", color);
  root.style.setProperty("--sidebar-primary", color);
  root.style.setProperty("--sidebar-ring", color);
  root.style.setProperty("--chart-1", hsl(color));
  root.style.setProperty("--public-card-border", "rgb(" + colorRgb + " / 0.14)");
  root.style.setProperty("--public-pattern-color", "rgb(" + colorRgb + ")");
  root.dataset.themeReady = "true";

  document.querySelectorAll('meta[name="theme-color"], meta[name="msapplication-TileColor"], meta[name="apple-mobile-web-app-status-bar-style"]').forEach(function (meta) {
    meta.setAttribute("content", color);
  });
})();
`

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
        <meta name="apple-mobile-web-app-status-bar-style" content={DEFAULT_BRAND_PRIMARY} />
        <script dangerouslySetInnerHTML={{ __html: brandThemeBootstrapScript }} />
      </head>
      <body suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
