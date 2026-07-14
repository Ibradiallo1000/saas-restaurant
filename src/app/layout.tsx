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

  function luminance(hex) {
    var channels = [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16)
    ].map(function (channel) {
      var normalized = channel / 255;
      return normalized <= 0.04045
        ? normalized / 12.92
        : Math.pow((normalized + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  }

  function contrast(background, foreground) {
    var backgroundLuminance = luminance(background);
    var foregroundLuminance = luminance(foreground);
    var lighter = Math.max(backgroundLuminance, foregroundLuminance);
    var darker = Math.min(backgroundLuminance, foregroundLuminance);
    return (lighter + 0.05) / (darker + 0.05);
  }

  function accessibleForeground(background) {
    var dark = "#0b0f14";
    var light = "#ffffff";
    return contrast(background, dark) >= contrast(background, light) ? dark : light;
  }

  function mix(background, foreground, foregroundWeight) {
    var backgroundChannels = [1, 3, 5].map(function (index) { return parseInt(background.slice(index, index + 2), 16); });
    var foregroundChannels = [1, 3, 5].map(function (index) { return parseInt(foreground.slice(index, index + 2), 16); });
    var channels = backgroundChannels.map(function (channel, index) {
      return Math.round(channel * (1 - foregroundWeight) + foregroundChannels[index] * foregroundWeight);
    });
    return "#" + channels.map(function (channel) { return channel.toString(16).padStart(2, "0"); }).join("");
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
  var actionForeground = accessibleForeground(color);
  var actionForegroundRgb = rgb(actionForeground);
  var root = document.documentElement;
  root.style.setProperty("--brand-primary", color);
  root.style.setProperty("--brand-primary-rgb", colorRgb);
  root.style.setProperty("--brand-primary-soft", "rgb(" + colorRgb + " / 0.10)");
  root.style.setProperty("--action-primary-bg", color);
  root.style.setProperty("--action-primary-fg", actionForeground);
  root.style.setProperty("--action-primary-fg-rgb", actionForegroundRgb);
  root.style.setProperty("--action-primary-hover", mix(color, actionForeground, 0.08));
  root.style.setProperty("--action-primary-active", mix(color, actionForeground, 0.14));
  root.style.setProperty("--focus-ring", "#ea580c");
  root.style.setProperty("--color-primary", "var(--action-primary-bg)");
  root.style.setProperty("--primary", "var(--action-primary-bg)");
  root.style.setProperty("--primary-rgb", colorRgb);
  root.style.setProperty("--primary-foreground", "var(--action-primary-fg)");
  root.style.setProperty("--primary-foreground-rgb", actionForegroundRgb);
  root.style.setProperty("--ring", "var(--focus-ring)");
  root.style.setProperty("--sidebar-primary", "var(--action-primary-bg)");
  root.style.setProperty("--sidebar-primary-foreground", "var(--action-primary-fg)");
  root.style.setProperty("--sidebar-ring", "var(--focus-ring)");
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&family=Playfair+Display:wght@400..900&display=swap"
          rel="stylesheet"
        />
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
