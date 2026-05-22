import PublicPage from "@/modules/public/PublicPage"

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ t?: string; table?: string; sessionId?: string; mode?: string; orderId?: string }>
}) {
  const { slug } = await params
  const { t, table, sessionId, mode, orderId } = await searchParams

  return (
    <PublicPage
      slug={slug}
      tableId={t ?? table ?? null}
      sessionId={sessionId ?? null}
      mode={mode ?? null}
      orderId={orderId ?? null}
    />
  )
}
