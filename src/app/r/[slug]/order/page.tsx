import { redirect } from "next/navigation"

export default async function LegacyPublicTableOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ t?: string }>
}) {
  const { slug } = await params
  const { t } = await searchParams

  redirect(`/${slug}${t ? `?t=${encodeURIComponent(t)}` : ""}`)
}
