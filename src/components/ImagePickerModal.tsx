"use client"

import * as React from "react"
import { collection, onSnapshot } from "firebase/firestore"
import { Check, ImageIcon, Loader2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useFirestore } from "@/firebase"
import { cn } from "@/lib/utils"

type RestaurantImage = {
  id: string
  url: string
  publicId?: string
}

type ImagePickerModalProps = {
  open: boolean
  restaurantId: string
  selectedImageId?: string
  onClose: () => void
  onSelect: (image: RestaurantImage) => void
}

export default function ImagePickerModal({
  open,
  restaurantId,
  selectedImageId,
  onClose,
  onSelect,
}: ImagePickerModalProps) {
  const db = useFirestore()
  const [images, setImages] = React.useState<RestaurantImage[]>([])
  const [selectedImage, setSelectedImage] = React.useState<RestaurantImage | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)

  React.useEffect(() => {
    if (!open || !db || !restaurantId) return

    setIsLoading(true)

    return onSnapshot(
      collection(db, "restaurants", restaurantId, "images"),
      (snapshot) => {
        const nextImages = snapshot.docs.map((imageDoc) => ({
          id: imageDoc.id,
          ...(imageDoc.data() as Omit<RestaurantImage, "id">),
        }))

        setImages(nextImages)
        setSelectedImage(
          nextImages.find((image) => image.id === selectedImageId) ?? null
        )
        setIsLoading(false)
      },
      (error) => {
        console.error(error)
        setImages([])
        setIsLoading(false)
      }
    )
  }, [db, open, restaurantId, selectedImageId])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[color:color-mix(in_srgb,var(--bg-main)_72%,transparent)] p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <header className="flex items-center justify-between border-b p-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <ImageIcon className="h-5 w-5 text-primary" />
              Choisir une image
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Selectionnez une image existante pour ce produit.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex h-56 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : images.length === 0 ? (
            <div className="flex h-56 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
              Aucune image disponible.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {images.map((image) => {
                const isSelected = selectedImage?.id === image.id

                return (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => setSelectedImage(image)}
                    className={cn(
                      "group relative aspect-square overflow-hidden rounded-lg border-2 bg-gray-100 transition",
                      isSelected
                        ? "border-primary ring-4 ring-primary/20"
                        : "border-transparent hover:border-primary/40"
                    )}
                  >
                    <img
                      src={image.url}
                      alt=""
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                    {isSelected && (
                      <div className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white shadow">
                        <Check className="h-4 w-4" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t p-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button
            type="button"
            disabled={!selectedImage}
            onClick={() => {
              if (!selectedImage) return
              onSelect(selectedImage)
              onClose()
            }}
          >
            Utiliser cette image
          </Button>
        </footer>
      </div>
    </div>
  )
}
