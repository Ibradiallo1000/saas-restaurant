import { ControlledStockScreen } from "@/modules/stock/controlled-stock/ui/ControlledStockScreen"

export default async function StockControlPage({ params }: { params: Promise<{ articleId: string }> }) {
  const { articleId } = await params
  return <ControlledStockScreen mode="control" articleId={articleId} />
}
