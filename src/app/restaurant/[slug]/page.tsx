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
  redirect(`/r/${slug}${table ? `?table=${encodeURIComponent(table)}` : ""}`)
}
