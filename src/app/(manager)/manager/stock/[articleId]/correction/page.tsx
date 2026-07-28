import { ControlledStockScreen } from "@/modules/stock/controlled-stock/ui/ControlledStockScreen"

export default async function StockCorrectionPage({ params }: { params: Promise<{ articleId: string }> }) {
  const { articleId } = await params
  return <ControlledStockScreen mode="correction" articleId={articleId} />
}
