"use client"

import * as React from "react"
import { addDoc, collection, getDocs, limit, query, serverTimestamp } from "firebase/firestore"
import { Check, ImageIcon, Loader2, UploadCloud, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useFirestore } from "@/firebase"
import { cn } from "@/lib/utils"
import { uploadImage } from "@/services/uploadImage"

type RestaurantImage = {
  id: string
  url: string
  publicId?: string
}

type ImagePickerModalProps = {
  open: boolean
  restaurantId: string
  selectedImageId?: string
  selectedImageUrl?: string
  title?: string
  description?: string
  onClose: () => void
  onSelect: (image: RestaurantImage) => void
}

export default function ImagePickerModal({
  open,
  restaurantId,
  selectedImageId,
  selectedImageUrl,
  title = "Choisir une image",
  description = "Selectionnez une image depuis la bibliotheque interne.",
  onClose,
  onSelect,
}: ImagePickerModalProps) {
  const db = useFirestore()
  const [images, setImages] = React.useState<RestaurantImage[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [isUploading, setIsUploading] = React.useState(false)
  const [uploadError, setUploadError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open || !db || !restaurantId) return

    let cancelled = false
    setIsLoading(true)

    getDocs(query(collection(db, "restaurants", restaurantId, "images"), limit(50)))
      .then((snapshot) => {
        if (cancelled) return
        const nextImages = snapshot.docs.map((imageDoc) => ({
          id: imageDoc.id,
          ...(imageDoc.data() as Omit<RestaurantImage, "id">),
        }))

        setImages(nextImages)
        setIsLoading(false)
      })
      .catch((error) => {
        if (cancelled) return
        console.error(error)
        setImages([])
        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [db, open, restaurantId, selectedImageId])

  if (!open) return null

  const handleSelectImage = (image: RestaurantImage) => {
    onSelect(image)
    onClose()
  }

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file || !db || !restaurantId) return

    setIsUploading(true)
    setUploadError(null)

    try {
      const uploaded = await uploadImage(file, restaurantId)
      const docRef = await addDoc(collection(db, "restaurants", restaurantId, "images"), {
        url: uploaded.secure_url,
        publicId: uploaded.public_id,
        createdAt: serverTimestamp(),
      })
      const image = {
        id: docRef.id,
        url: uploaded.secure_url,
        publicId: uploaded.public_id,
      }

      setImages((current) => [image, ...current])
      handleSelectImage(image)
    } catch (error) {
      console.error(error)
      setUploadError("Impossible d'importer cette image.")
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[color:color-mix(in_srgb,var(--bg-main)_72%,transparent)] p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-t-2xl border border-gray-200 bg-background shadow-2xl dark:border-gray-700 dark:bg-[#1E293B] dark:shadow-md sm:rounded-2xl">
        <header className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold dark:text-white">
              <ImageIcon className="h-5 w-5 text-primary" />
              {title}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground dark:text-gray-400">
              {description}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <label className="mb-4 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-secondary/30 p-4 text-center shadow-sm transition hover:bg-secondary/50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700">
            {isUploading ? (
              <Loader2 className="mb-2 h-7 w-7 animate-spin text-primary" />
            ) : (
              <UploadCloud className="mb-2 h-7 w-7 text-primary" />
            )}
            <span className="text-sm font-black text-foreground dark:text-white">
              {isUploading ? "Import en cours..." : "Importer une nouvelle image"}
            </span>
            <span className="mt-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground dark:text-gray-400">
              PNG, JPG ou WEBP
            </span>
            <input
              type="file"
              accept="image/*"
              disabled={isUploading}
              onChange={handleUpload}
              className="sr-only"
            />
          </label>

          {uploadError && (
            <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
              {uploadError}
            </p>
          )}

          {isLoading ? (
            <div className="flex h-56 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : images.length === 0 ? (
            <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-gray-200 text-sm text-muted-foreground dark:border-gray-700 dark:text-gray-400">
              Aucune image disponible.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {images.map((image) => {
                const isSelected = selectedImageId === image.id || selectedImageUrl === image.url

                return (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => handleSelectImage(image)}
                    className={cn(
                      "group relative aspect-square overflow-hidden rounded-lg border-2 bg-gray-100 transition dark:bg-gray-800",
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

        <footer className="flex flex-col-reverse gap-2 border-t border-gray-200 p-4 dark:border-gray-700 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
        </footer>
      </div>
    </div>
  )
}
