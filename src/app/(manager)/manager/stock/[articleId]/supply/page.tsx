import { ControlledStockScreen } from "@/modules/stock/controlled-stock/ui/ControlledStockScreen"

export default async function StockSupplyPage({ params }: { params: Promise<{ articleId: string }> }) {
  const { articleId } = await params
  return <ControlledStockScreen mode="supply" articleId={articleId} />
}
