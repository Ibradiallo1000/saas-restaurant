import type { Metadata } from "next"

import { adminDb } from "@/lib/firebase-admin"
import { MarketplaceDishRepository } from "@/lib/marketplace-discovery"
import MarketplaceClient, { type PublicRestaurantSummary } from "./marketplace-client"
import MarketplaceDishClient from "./marketplace-dish-client"
import { buildMarketplaceDishHomeViewModel } from "./marketplace-dish-view-model"
import type { PlatformPublicFooter } from "@/types"

export const dynamic = "force-dynamic"

export function generateMetadata(): Metadata {
  return { title: "Restaurants par catégorie", description: "Découvrez les restaurants disponibles par envie culinaire sur Oordera.", alternates: { canonical: "/" } }
}

export default async function MarketplacePage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = searchParams ? await searchParams : {}
  const restaurantsView = firstParam(params.view) === "restaurants"
  if (!restaurantsView) return renderDishMarketplace(params)
  return renderRestaurantMarketplace()
}

async function renderDishMarketplace(params: Record<string, string | string[] | undefined>) {
  const requestedCategoryId = sanitizeQuery(firstParam(params.category), 100) || null
  const cursor = sanitizeCursor(firstParam(params.cursor))
  const repository = new MarketplaceDishRepository(adminDb)
  const categoriesResult = await Promise.resolve(repository.listActiveCategories(20)).then(
    (categories) => ({ status: "fulfilled" as const, value: categories }),
    (reason) => ({ status: "rejected" as const, reason })
  )
  if (categoriesResult.status === "rejected") console.error("MARKETPLACE FOOD CATEGORIES ERROR", normalizeError(categoriesResult.reason))
  const categories = categoriesResult.status === "fulfilled" ? categoriesResult.value : []
  const selectedCategoryId = categories.some((category) => category.id === requestedCategoryId) ? requestedCategoryId : categories[0]?.id ?? null
  const categoryOfferResults = await Promise.all(categories.map(async (category) => {
    const categoryCursor = category.id === selectedCategoryId ? cursor : null
    return Promise.resolve(repository.listRestaurantCategoryOffers({ pageSize: 24, categoryId: category.id, cursor: categoryCursor })).then(
      (page) => ({ categoryId: category.id, status: "fulfilled" as const, value: page }),
      (reason) => ({ categoryId: category.id, status: "rejected" as const, reason })
    )
  }))
  const dishOffersResult = await Promise.resolve(repository.listOffers({ pageSize: 30 })).then(
    (page) => ({ status: "fulfilled" as const, value: page.offers }),
    (reason) => ({ status: "rejected" as const, reason })
  )
  const rejectedCategoryOffers = categoryOfferResults.filter((result) => result.status === "rejected")
  const loadError = categoriesResult.status === "rejected" || rejectedCategoryOffers.length > 0 || dishOffersResult.status === "rejected"
  for (const result of rejectedCategoryOffers) console.error("MARKETPLACE RESTAURANT CATEGORY OFFERS ERROR", { categoryId: result.categoryId, ...normalizeError(result.reason) })
  if (dishOffersResult.status === "rejected") console.error("MARKETPLACE DISH OFFERS ERROR", normalizeError(dishOffersResult.reason))
  const restaurantCategoryOffersByCategory = Object.fromEntries(categoryOfferResults.map((result) => [
    result.categoryId,
    result.status === "fulfilled" ? result.value.offers : [],
  ]))
  const nextCursorByCategory = Object.fromEntries(categoryOfferResults.map((result) => [
    result.categoryId,
    result.status === "fulfilled" ? result.value.nextCursor : null,
  ]))
  const platformSettings = await getPlatformPublicSettings()
  return (
    <MarketplaceDishClient
      loadError={loadError}
      platformLogoUrl={platformSettings.logoUrl}
      platformName={platformSettings.name}
      marketplaceHeroCoverImageUrl={platformSettings.marketplaceHero.coverImageUrl}
      publicFooter={platformSettings.publicFooter}
      model={buildMarketplaceDishHomeViewModel({
        restaurantCategoryOffersByCategory,
        dishOffers: dishOffersResult.status === "fulfilled" ? dishOffersResult.value : [],
        categories,
        selectedCategoryId,
        nextCursorByCategory,
      })}
    />
  )
}

async function renderRestaurantMarketplace() {
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

function firstParam(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value }
function sanitizeQuery(value: string | undefined, maximum: number) { return typeof value === "string" ? value.trim().slice(0, maximum) : "" }
function sanitizeCursor(value: string | undefined) { return typeof value === "string" && /^[A-Za-z0-9_-]{1,512}$/.test(value) ? value : null }
function normalizeError(error: unknown) { return error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) } }

async function getPlatformPublicSettings() {
  try {
    const snapshot = await adminDb.collection("platformSettings").doc("default").get()
    const data = snapshot.exists ? snapshot.data() : null
    return {
      name: firstString(data?.name) || "Oordera",
      logoUrl: firstString(data?.logoUrl),
      marketplaceHero: normalizeMarketplaceHero(data?.marketplaceHero),
      publicFooter: normalizePublicFooter(data?.publicFooter),
    }
  } catch (error) {
    console.error("MARKETPLACE PLATFORM SETTINGS ERROR", normalizeError(error))
    return { name: "Oordera", logoUrl: null, marketplaceHero: normalizeMarketplaceHero(null), publicFooter: normalizePublicFooter(null) }
  }
}

function normalizeMarketplaceHero(value: unknown) {
  const hero = value && typeof value === "object" ? value as Record<string, any> : {}
  return {
    coverImageUrl: firstString(hero.coverImageUrl) || "",
  }
}

function normalizePublicFooter(value: unknown): PlatformPublicFooter {
  const footer = value && typeof value === "object" ? value as Record<string, any> : {}
  return {
    description: firstString(footer.description) || "",
    phone: firstString(footer.phone) || "",
    whatsapp: firstString(footer.whatsapp) || "",
    email: firstString(footer.email) || "",
    officeAddress: firstString(footer.officeAddress) || "",
    socialLinks: {
      facebook: firstString(footer.socialLinks?.facebook) || "",
      instagram: firstString(footer.socialLinks?.instagram) || "",
      tiktok: firstString(footer.socialLinks?.tiktok) || "",
      linkedin: firstString(footer.socialLinks?.linkedin) || "",
      youtube: firstString(footer.socialLinks?.youtube) || "",
      twitter: firstString(footer.socialLinks?.twitter) || "",
    },
    legalLinks: {
      privacy: firstString(footer.legalLinks?.privacy) || "/privacy",
      terms: firstString(footer.legalLinks?.terms) || "/terms",
      legalNotice: firstString(footer.legalLinks?.legalNotice) || "/legal",
    },
  }
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
