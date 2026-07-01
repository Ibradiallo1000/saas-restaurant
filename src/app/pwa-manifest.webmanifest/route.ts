import { NextRequest, NextResponse } from "next/server"

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

export function GET(request: NextRequest) {
  const slug = sanitizeSlug(request.nextUrl.searchParams.get("slug"))
  const startUrl = slug ? `/${slug}?source=pwa` : "/?source=pwa"

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
      theme_color: "#f97316",
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
