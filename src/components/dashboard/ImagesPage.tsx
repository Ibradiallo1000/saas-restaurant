"use client"

import * as React from "react"
import { ImageIcon, Loader2, UploadCloud } from "lucide-react"

import ImageGallery from "@/components/ImageGallery"
import ImageUploader from "@/components/ImageUploader"
import { Card, PageHeader } from "@/design-system/components"
import { useRestaurant } from "@/design-system/context/RestaurantContext"

export default function ImagesPage() {
  const { restaurantId, loading } = useRestaurant()

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2
          className="h-8 w-8 animate-spin"
          style={{ color: "var(--color-primary)" }}
        />
      </div>
    )
  }

  if (!restaurantId) {
    return (
      <div className="rounded-lg border border-dashed bg-white p-8 text-center text-sm text-muted-foreground">
        Aucun restaurant rattache a ce compte.
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <PageHeader
        icon={ImageIcon}
        title="Bibliotheque d'images"
        subtitle="Centralisez les photos utilisees dans vos menus, cartes et offres."
      />

      <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card className="h-fit">
          <div className="mb-6 flex items-center gap-2 text-xl font-black italic uppercase">
            <UploadCloud className="h-5 w-5" style={{ color: "var(--color-primary)" }} />
            Ajouter une image
          </div>
          <ImageUploader restaurantId={restaurantId} />
        </Card>

        <Card>
          <div className="mb-6 flex items-center gap-2 text-xl font-black italic uppercase">
            <ImageIcon className="h-5 w-5" style={{ color: "var(--color-primary)" }} />
            Galerie
          </div>
          <ImageGallery restaurantId={restaurantId} />
        </Card>
      </section>
    </div>
  )
}
