import type { PlatformDataQuality, PlatformSubscriptionState } from "@/components/platform-ui"

export interface PlatformBillingPlanSource { id: string; name?: string; code?: string; price?: number; currency?: string; features?: unknown; isActive?: boolean }
export interface PlatformBillingSubscriptionSource { id: string; restaurantId?: string; planId?: string; status?: string; isTrial?: boolean; endDate?: unknown }
export interface PlatformBillingRestaurantSource { id: string; name?: string }
export interface PlatformBillingJoinedSource { subscription: PlatformBillingSubscriptionSource; plan?: PlatformBillingPlanSource; restaurant?: PlatformBillingRestaurantSource }
export interface PlatformSubscriptionPresentation { id: string; restaurantName: string; restaurantId?: string; restaurantQuality: PlatformDataQuality; planName: string; planId?: string; planQuality: PlatformDataQuality; price: string; priceQuality: PlatformDataQuality; status: PlatformSubscriptionState; statusLabel: string; endDate: string; endDateQuality: PlatformDataQuality }
export interface PlatformBillingPlanPresentation { id: string; name: string; code?: string; price: string; activeLabel: string; features: string[]; quality: PlatformDataQuality }

export function buildPlatformBillingViewModel(joined: PlatformBillingJoinedSource[], plans: PlatformBillingPlanSource[], mounted: boolean) {
  return {
    subscriptions: joined.map(({ plan, restaurant, subscription }) => ({
      id: subscription.id,
      restaurantName: restaurant?.name?.trim() || "Restaurant non résolu",
      restaurantId: subscription.restaurantId,
      restaurantQuality: restaurant ? "complete" as const : "unavailable" as const,
      planName: plan?.name?.trim() || subscription.planId || "Plan non résolu",
      planId: subscription.planId,
      planQuality: plan ? "complete" as const : "partial" as const,
      price: plan && typeof plan.price === "number" ? `${plan.price.toLocaleString()} ${plan.currency || "XOF"}` : "Indisponible",
      priceQuality: plan && typeof plan.price === "number" ? "complete" as const : "unavailable" as const,
      status: normalizeSubscriptionStatus(subscription.status, subscription.isTrial),
      statusLabel: subscription.status || "Inconnu",
      endDate: formatDate(subscription.endDate, mounted),
      endDateQuality: subscription.endDate && mounted ? "complete" as const : "unavailable" as const,
    })),
    plans: plans.map((plan) => ({ id: plan.id, name: plan.name?.trim() || "Plan sans nom", code: plan.code, price: typeof plan.price === "number" ? `${plan.price.toLocaleString()} ${plan.currency || "XOF"}` : "Prix indisponible", activeLabel: plan.isActive === true ? "Actif" : plan.isActive === false ? "Inactif" : "État inconnu", features: normalizeFeatures(plan.features), quality: plan.name && typeof plan.price === "number" ? "complete" as const : "partial" as const })),
  }
}

function normalizeSubscriptionStatus(status?: string, isTrial?: boolean): PlatformSubscriptionState { if (isTrial || status === "trial") return "trial"; if (status === "active") return "active"; if (status === "past_due" || status === "pastDue") return "pastDue"; if (status === "expired") return "expired"; if (status === "cancelled" || status === "canceled") return "cancelled"; if (status === "suspended") return "suspended"; return "unknown" }
function normalizeFeatures(features: unknown): string[] { if (Array.isArray(features)) return features.filter((feature): feature is string => typeof feature === "string"); if (features && typeof features === "object") return Object.entries(features).filter(([, enabled]) => enabled === true).map(([feature]) => feature); return [] }
function formatDate(value: unknown, mounted: boolean) { if (!value || !mounted) return "Indisponible"; const date = typeof value === "object" && value !== null && "toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function" ? (value as { toDate: () => Date }).toDate() : new Date(value as string | number | Date); return Number.isNaN(date.getTime()) ? "Indisponible" : date.toLocaleDateString() }

