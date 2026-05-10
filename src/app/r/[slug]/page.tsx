import { redirect } from "next/navigation"

export default async function LegacyPublicOrderingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ t?: string; table?: string }>
}) {
  const { slug } = await params
  const { t, table } = await searchParams
  const tableId = t || table

  redirect(`/${slug}${tableId ? `?t=${encodeURIComponent(tableId)}` : ""}`)
}
