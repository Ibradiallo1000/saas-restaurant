import { NextRequest, NextResponse } from "next/server"

import { firebaseConfig } from "@/firebase/config"
import { DEFAULT_BRAND_PRIMARY, getBrandPrimary } from "@/lib/brand-theme"

const RESERVED_SEGMENTS = new Set([
  "",
  "api",
  "_next",
  "admin",
  "dashboard",
  "manager",
  "owner",
  "platform",
  "pos",
  "orders",
  "order",
  "settings",
  "setup",
  "login",
  "invite",
  "contact",
  "checkout",
  "images",
  "customers",
  "kitchen",
  "tables",
  "ai-tools",
])

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const slug = sanitizeSlug(request.nextUrl.searchParams.get("slug"))
  const startUrl = slug ? `/${slug}?source=pwa` : "/?source=pwa"
  const themeColor = await getPlatformThemeColor()

  return NextResponse.json(
    {
      name: "Oordera",
      short_name: "Oordera",
      description: "Commandez et suivez vos commandes restaurant avec Oordera.",
      start_url: startUrl,
      scope: "/",
      display: "standalone",
      orientation: "portrait-primary",
      background_color: "#ffffff",
      theme_color: themeColor,
      categories: ["food", "business", "productivity"],
      icons: [
        {
          src: "/icons/icon-192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "/icons/icon-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "/icons/maskable-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
    },
    {
      headers: {
        "Content-Type": "application/manifest+json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    }
  )
}

async function getPlatformThemeColor() {
  const projectId = firebaseConfig.projectId
  const apiKey = firebaseConfig.apiKey

  if (!projectId || !apiKey) return DEFAULT_BRAND_PRIMARY

  try {
    const response = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/platformSettings/default?key=${apiKey}`,
      { cache: "no-store" }
    )

    if (!response.ok) return DEFAULT_BRAND_PRIMARY

    const payload = (await response.json()) as {
      fields?: {
        primaryColor?: {
          stringValue?: string
        }
      }
    }

    return getBrandPrimary(payload.fields?.primaryColor?.stringValue)
  } catch {
    return DEFAULT_BRAND_PRIMARY
  }
}

function sanitizeSlug(value: string | null) {
  if (!value) return ""

  const slug = value
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .split("/")[0]
    .toLowerCase()

  if (!slug || RESERVED_SEGMENTS.has(slug)) return ""
  if (!/^[a-z0-9-]{2,80}$/.test(slug)) return ""

  return slug
}
