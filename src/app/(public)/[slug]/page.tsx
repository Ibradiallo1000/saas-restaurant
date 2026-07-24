import PublicPage from "@/modules/public/PublicPage"
import { parseMarketplaceCategoryIntent, parseMarketplaceProductIntent } from "@/lib/marketplace-offer-navigation"

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ t?: string; table?: string; sessionId?: string; mode?: string; orderId?: string; product?: string; category?: string; source?: string }>
}) {
  const { slug } = await params
  const resolvedSearchParams = await searchParams
  const { t, table, sessionId, mode, orderId } = resolvedSearchParams
  const marketplaceIntent = parseMarketplaceProductIntent(resolvedSearchParams)
  const marketplaceCategoryIntent = parseMarketplaceCategoryIntent(resolvedSearchParams)

  return (
    <PublicPage
      slug={slug}
      tableId={t ?? table ?? null}
      sessionId={sessionId ?? null}
      mode={mode ?? null}
      orderId={orderId ?? null}
      marketplaceProductId={marketplaceIntent?.productId ?? null}
      marketplaceCategoryId={marketplaceCategoryIntent?.categoryId ?? null}
      navigationSource={marketplaceIntent?.source ?? marketplaceCategoryIntent?.source ?? null}
    />
  )
}
