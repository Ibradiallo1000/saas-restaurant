import { OwnerStockDetailScreen } from "@/modules/stock/owner/ui/OwnerStockDetailScreen"

export default async function OwnerStockArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const params = await searchParams
  return <OwnerStockDetailScreen mode="articles" valueBreakdown={params.view === "value"} />
}
