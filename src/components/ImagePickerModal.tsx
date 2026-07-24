"use client"

import * as React from "react"
import * as Dialog from "@radix-ui/react-dialog"
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
  const [galleryError, setGalleryError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open || !db || !restaurantId) return

    let cancelled = false
    setIsLoading(true)
    setGalleryError(null)

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
        setGalleryError("Impossible de charger la galerie d’images.")
        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [db, open, restaurantId, selectedImageId])

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
    <Dialog.Root open={open} onOpenChange={(nextOpen) => { if (!nextOpen && !isUploading) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-[color:color-mix(in_srgb,var(--bg-main)_72%,transparent)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 motion-reduce:animate-none" />
        <Dialog.Content className="dashboard-focus-visible fixed inset-x-0 bottom-0 z-[71] flex max-h-[calc(100dvh-var(--safe-top,0px))] w-full flex-col overflow-hidden rounded-t-[var(--radius-dashboard-overlay)] border border-[var(--settings-border)] bg-[var(--settings-elevated)] shadow-[var(--shadow-dashboard-overlay)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom motion-reduce:animate-none sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-5xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[var(--radius-dashboard-overlay)] sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95">
        <header className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
          <div>
            <Dialog.Title className="flex items-center gap-2 text-lg font-bold dark:text-white">
              <ImageIcon className="h-5 w-5 text-primary" />
              {title}
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-xs text-muted-foreground dark:text-gray-400">
              {description}
            </Dialog.Description>
          </div>

          <Dialog.Close
            type="button"
            disabled={isUploading}
            aria-label="Fermer la galerie"
            className="dashboard-focus-visible flex size-11 shrink-0 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50 motion-reduce:transition-none dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </Dialog.Close>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <label className="mb-4 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-secondary/30 p-4 text-center shadow-sm transition hover:bg-secondary/50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700">
            {isUploading ? (
              <Loader2 aria-hidden="true" className="mb-2 h-7 w-7 animate-spin text-primary motion-reduce:animate-none" />
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
              aria-describedby={uploadError ? "settings-media-upload-error" : undefined}
            />
          </label>

          {uploadError && (
            <p id="settings-media-upload-error" role="alert" className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
              {uploadError}
            </p>
          )}

          {isLoading ? (
            <div role="status" className="flex h-56 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin text-primary motion-reduce:animate-none" />
              Chargement de la galerie
            </div>
          ) : galleryError ? (
            <div role="alert" className="flex min-h-56 items-center justify-center rounded-lg border border-[var(--settings-border)] bg-[var(--settings-state-error-bg)] p-4 text-center text-sm font-medium text-[var(--settings-state-error-fg)]">
              {galleryError}
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
                    aria-label={isSelected ? "Image sélectionnée" : "Sélectionner cette image"}
                    aria-pressed={isSelected}
                    onClick={() => handleSelectImage(image)}
                    className={cn(
                      "dashboard-focus-visible group relative aspect-square min-h-11 overflow-hidden rounded-lg border-2 bg-gray-100 transition motion-reduce:transition-none dark:bg-gray-800",
                      isSelected
                        ? "border-primary ring-4 ring-primary/20"
                        : "border-transparent hover:border-primary/40"
                    )}
                  >
                    <img
                      src={image.url}
                      alt=""
                      className="h-full w-full object-cover transition group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
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
          <Dialog.Close asChild disabled={isUploading}>
            <Button type="button" variant="ghost" className="min-h-11">
            Annuler
            </Button>
          </Dialog.Close>
        </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
