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
      <div className="rounded-lg border border-dashed border-gray-200 bg-card p-8 text-center text-sm text-muted-foreground dark:border-gray-700 dark:bg-[#1E293B] dark:text-gray-400">
        Aucun restaurant rattache a ce compte.
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500 dark:bg-[#0F172A]">
      <PageHeader
        icon={ImageIcon}
        title="Bibliotheque d'images"
        subtitle="Centralisez les photos utilisees dans vos menus, cartes et offres."
      />

      <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card className="h-fit border border-gray-200 bg-card shadow-sm dark:border-gray-700 dark:bg-[#1E293B] dark:shadow-md">
          <div className="mb-6 flex items-center gap-2 text-xl font-black italic uppercase dark:text-white">
            <UploadCloud className="h-5 w-5" style={{ color: "var(--color-primary)" }} />
            Ajouter une image
          </div>
          <ImageUploader restaurantId={restaurantId} />
        </Card>

        <Card className="border border-gray-200 bg-card shadow-sm dark:border-gray-700 dark:bg-[#1E293B] dark:shadow-md">
          <div className="mb-6 flex items-center gap-2 text-xl font-black italic uppercase dark:text-white">
            <ImageIcon className="h-5 w-5" style={{ color: "var(--color-primary)" }} />
            Galerie
          </div>
          <ImageGallery restaurantId={restaurantId} />
        </Card>
      </section>
    </div>
  )
}
