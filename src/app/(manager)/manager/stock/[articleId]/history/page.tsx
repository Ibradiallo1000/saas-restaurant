import { ControlledStockScreen } from "@/modules/stock/controlled-stock/ui/ControlledStockScreen"

export default async function StockArticleHistoryPage({ params }: { params: Promise<{ articleId: string }> }) {
  const { articleId } = await params
  return <ControlledStockScreen mode="history" articleId={articleId} />
}
