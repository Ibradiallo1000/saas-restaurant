"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { OwnerTimeFilterBar } from "@/app/owner/_components/OwnerTimeFilterBar"
import { useTimeFilter } from "@/contexts/time-filter-context"
import { PageHeader } from "@/design-system/components"

export function OwnerSectionPage({
  title,
  description,
  detailHref,
  children,
}: {
  title: string
  description: string
  detailHref?: string
  children?: ReactNode
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  useTimeFilter()
  const detailTarget = detailHref && searchParams && searchParams.size > 0 ? `${detailHref}?${searchParams.toString()}` : detailHref

  return (
    <main className="space-y-4 pb-20">
      <PageHeader
        title={title}
        subtitle={description}
        action={
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(searchParams && searchParams.size > 0 ? `/owner?${searchParams.toString()}` : "/owner")}
          >
            Retour analytics
          </Button>
        }
      />

      <OwnerTimeFilterBar />

      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        {children || (
          <div className="space-y-2">
            <p className="font-black">Vue filtrée prête.</p>
            <p className="text-sm text-muted-foreground">
              Cette page utilise le même filtre global que le dashboard owner.
            </p>
            {detailTarget ? (
              <Button asChild className="mt-2">
                <Link href={detailTarget}>Ouvrir la page opérationnelle</Link>
              </Button>
            ) : null}
          </div>
        )}
      </section>
    </main>
  )
}
