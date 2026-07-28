import { ControlledStockScreen } from "@/modules/stock/controlled-stock/ui/ControlledStockScreen"

export default async function StockArticlePage({ params }: { params: Promise<{ articleId: string }> }) {
  const { articleId } = await params
  return <ControlledStockScreen mode="detail" articleId={articleId} />
}
