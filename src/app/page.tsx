import type { Metadata } from "next"

import { adminDb } from "@/lib/firebase-admin"
import MarketplaceClient, { type PublicRestaurantSummary } from "./marketplace-client"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Restaurants et menus",
  description: "Découvrez les restaurants disponibles sur Oordera et consultez leur menu en ligne.",
  alternates: { canonical: "/" },
}

export default async function MarketplacePage() {
  let restaurants: PublicRestaurantSummary[] = []
  let loadError = false
  try {
    const snapshot = await adminDb.collection("restaurants").where("status", "==", "active").get()
    restaurants = snapshot.docs.map((document) => toPublicRestaurant(document.id, document.data())).filter((restaurant): restaurant is PublicRestaurantSummary => Boolean(restaurant)).sort((a, b) => a.name.localeCompare(b.name, "fr"))
  } catch (error) {
    console.error("PUBLIC MARKETPLACE RESTAURANTS ERROR", error)
    loadError = true
  }
  return <MarketplaceClient restaurants={restaurants} loadError={loadError} />
}

function toPublicRestaurant(id: string, data: FirebaseFirestore.DocumentData): PublicRestaurantSummary | null {
  const name = typeof data.name === "string" ? data.name.trim() : ""
  const slug = typeof data.slug === "string" ? data.slug.trim() : ""
  if (!name || !isSafeSlug(slug) || data.deletedAt || data.isActive === false) return null
  return {
    id,
    name,
    slug,
    logoUrl: firstString(data.logoUrl, data.logo),
    coverUrl: firstString(data.coverImage, data.coverImageUrl, data.coverUrl),
    description: firstString(data.shortDescription, data.description, data.tagline, data.welcomeMessage),
    location: [firstString(data.address), firstString(data.city), firstString(data.country)].filter(Boolean).join(", ") || null,
    cuisineTypes: stringList(data.cuisineTypes ?? data.cuisineType),
    services: stringList(data.services),
  }
}

function firstString(...values: unknown[]) { for (const value of values) if (typeof value === "string" && value.trim()) return value.trim(); return null }
function stringList(value: unknown) { return (Array.isArray(value) ? value : typeof value === "string" ? [value] : []).filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()) }
function isSafeSlug(value: string) { return /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(value) && !["ai-tools", "api", "checkout", "contact", "customers", "dashboard", "images", "invite", "kitchen", "landing", "login", "manager", "menu", "order", "orders", "owner", "platform", "platform-init", "pos", "r", "restaurant", "settings", "setup", "tables"].includes(value.toLowerCase()) }
