import { redirect } from "next/navigation"

export default async function LegacyCheckoutRedirect({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  redirect(`/${slug}`)
}
