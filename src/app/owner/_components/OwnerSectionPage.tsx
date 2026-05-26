"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { OwnerTimeFilterBar } from "@/app/owner/_components/OwnerTimeFilterBar"
import { useTimeFilter } from "@/contexts/time-filter-context"

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
      <header className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(searchParams && searchParams.size > 0 ? `/owner?${searchParams.toString()}` : "/owner")}
          >
            Retour analytics
          </Button>
        </div>
      </header>

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
