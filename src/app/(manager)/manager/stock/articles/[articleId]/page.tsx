import { ArticleReferentialScreen } from "@/modules/stock/articles/ui/ArticleReferentialScreen"

export default async function StockArticleDetailPage({
  params,
}: {
  params: Promise<{ articleId: string }>
}) {
  const { articleId } = await params
  return <ArticleReferentialScreen mode="detail" articleId={articleId} />
}
