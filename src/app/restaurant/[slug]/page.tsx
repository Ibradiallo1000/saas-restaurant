import { redirect } from "next/navigation"

export default async function RestaurantQrPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ table?: string }>
}) {
  const { slug } = await params
  const { table } = await searchParams
  redirect(`/${slug}${table ? `?t=${encodeURIComponent(table)}` : ""}`)
}
