"use client"

import * as React from "react"
import { addDoc, collection, deleteDoc, doc, query, serverTimestamp, where } from "firebase/firestore"
import { CheckCircle2, ImageIcon, Loader2, Trash2, UploadCloud } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { useToast } from "@/hooks/use-toast"
import { COLLECTION_NAMES } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { CloudinaryConfigurationError, uploadImage } from "@/services/cloudinary.service"
import { PlatformConfirmationDialog, PlatformMediaCard, PlatformMediaLibrary } from "@/components/platform-ui"

type PlatformMedia = {
  url: string
  publicId: string
  type: string
  format?: string
  width?: number
  height?: number
  createdAt?: unknown
  updatedAt?: unknown
}

type PlatformMediaSelection = PlatformMedia & {
  id: string
}

type MediaSelectorProps = {
  value?: string | null
  onChange: (url: string | null) => void
  onSelect?: (media: PlatformMediaSelection | null) => void
  activeUrl?: string | null
  onSetActive?: (media: PlatformMediaSelection) => Promise<void> | void
  onDeleteActive?: () => Promise<void> | void
  type: "logo" | "payment" | "restaurant" | string
  label?: string
  description?: string
  className?: string
}

const isPersistableImageUrl = (url: string) =>
  /^https?:\/\//.test(url) || url.startsWith("/")

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return "Une erreur inconnue est survenue."
}

export function MediaSelector({
  value,
  onChange,
  onSelect,
  activeUrl,
  onSetActive,
  onDeleteActive,
  type,
  label = "Image",
  description = "Choisir une image depuis la galerie plateforme.",
  className,
}: MediaSelectorProps) {
  const db = useFirestore()
  const { toast } = useToast()
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const [open, setOpen] = React.useState(false)
  const [isUploading, setIsUploading] = React.useState(false)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [activatingId, setActivatingId] = React.useState<string | null>(null)
  const [localMedia, setLocalMedia] = React.useState<PlatformMediaSelection[]>([])
  const [deletedMediaIds, setDeletedMediaIds] = React.useState<Set<string>>(() => new Set())
  const [uploadPreviewUrl, setUploadPreviewUrl] = React.useState<string | null>(null)
  const [deleteCandidate, setDeleteCandidate] = React.useState<PlatformMediaSelection | null>(null)

  const mediaQuery = useMemoFirebase(() => {
    if (!db) return null

    return query(
      collection(db, COLLECTION_NAMES.PLATFORM_MEDIA),
      where("type", "==", type)
    )
  }, [db, type])

  const { data: media, isLoading } = useCollection<PlatformMedia>(mediaQuery)
  const sortedMedia = React.useMemo(
    () => {
      const merged = new Map<string, PlatformMediaSelection>()

      for (const item of [...localMedia, ...((media ?? []) as PlatformMediaSelection[])]) {
        if (deletedMediaIds.has(item.id)) continue

        const key = item.publicId || item.url || item.id
        if (!merged.has(key)) {
          merged.set(key, item)
        }
      }

      return [...merged.values()].sort((a, b) => b.id.localeCompare(a.id))
    },
    [deletedMediaIds, localMedia, media]
  )

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !db) return

    if (!file.type.startsWith("image/")) {
      toast({
        variant: "destructive",
        title: "Fichier non valide",
        description: "Veuillez sélectionner une image.",
      })
      event.target.value = ""
      return
    }

    const previewUrl = URL.createObjectURL(file)
    setIsUploading(true)
    setUploadPreviewUrl(previewUrl)

    try {
      const uploaded = await uploadImage(file)
      const url = uploaded.secureUrl

      if (!isPersistableImageUrl(url)) {
        throw new Error("URL image non persistable")
      }

      const existingMedia = sortedMedia.find(
        (item) => (uploaded.publicId && item.publicId === uploaded.publicId) || item.url === url
      )

      if (existingMedia) {
        onChange(existingMedia.url)
        onSelect?.(existingMedia)
        toast({
          title: "Image déjà présente",
          description: "L'image existante a été sélectionnée.",
        })
        return
      }

      const docRef = await addDoc(collection(db, COLLECTION_NAMES.PLATFORM_MEDIA), {
        url,
        publicId: uploaded.publicId,
        type,
        format: uploaded.format || "",
        width: uploaded.width || 0,
        height: uploaded.height || 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      const nextMedia: PlatformMediaSelection = {
        id: docRef.id,
        url,
        publicId: uploaded.publicId,
        type,
        format: uploaded.format,
        width: uploaded.width,
        height: uploaded.height,
      }

      setDeletedMediaIds((current) => {
        const next = new Set(current)
        next.delete(nextMedia.id)
        return next
      })
      setLocalMedia((current) => [nextMedia, ...current.filter((item) => item.publicId !== nextMedia.publicId && item.url !== nextMedia.url)])
      onChange(url)
      onSelect?.(nextMedia)
      toast({
        title: "Image ajoutée",
        description: "Elle est maintenant disponible dans la galerie.",
      })
    } catch (error) {
      const isCloudinaryConfigurationError = error instanceof CloudinaryConfigurationError

      if (!isCloudinaryConfigurationError) {
        console.error(error)
      }

      toast({
        variant: "destructive",
        title: isCloudinaryConfigurationError ? "Cloudinary non configure" : "Upload impossible",
        description: isCloudinaryConfigurationError
          ? "Ajoutez NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME et NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET dans .env.local, puis redemarrez Next."
          : getErrorMessage(error),
      })
    } finally {
      setIsUploading(false)
      URL.revokeObjectURL(previewUrl)
      setUploadPreviewUrl(null)
      event.target.value = ""
    }
  }

  const handleSelect = (item: PlatformMediaSelection) => {
    onChange(item.url)
    onSelect?.(item)
  }

  const handleSetActive = async (item: PlatformMediaSelection) => {
    if (!onSetActive) {
      handleSelect(item)
      setOpen(false)
      return
    }

    setActivatingId(item.id)

    try {
      await onSetActive(item)
      handleSelect(item)
      toast({
        title: "Logo mis à jour",
        description: "Le logo actif a été modifié.",
      })
    } catch (error) {
      console.error(error)
      toast({
        variant: "destructive",
        title: "Logo non mis à jour",
        description: getErrorMessage(error),
      })
    } finally {
      setActivatingId(null)
    }
  }

  const handleDelete = async (item: PlatformMediaSelection) => {
    if (!db) return

    setDeletingId(item.id)

    try {
      await deleteDoc(doc(db, COLLECTION_NAMES.PLATFORM_MEDIA, item.id))
      setDeletedMediaIds((current) => new Set(current).add(item.id))
      setLocalMedia((current) => current.filter((mediaItem) => mediaItem.id !== item.id))

      if (value === item.url) {
        onChange(null)
        onSelect?.(null)
      }

      if (activeUrl === item.url && onDeleteActive) {
        await onDeleteActive()
      }

      toast({
        title: "Image supprimée",
        description: item.publicId
          ? "L'entrée Firestore a été supprimée. Le fichier Cloudinary reste stocké côté Cloudinary."
          : "L'entrée Firestore a été supprimée.",
      })
    } catch (error) {
      console.error(error)
      toast({
        variant: "destructive",
        title: "Suppression impossible",
        description: getErrorMessage(error),
      })
    } finally {
      setDeletingId(null)
      setDeleteCandidate(null)
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Label>{label}</Label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex flex-1 items-center gap-4 rounded-xl border border-border bg-background p-3 text-left transition hover:bg-muted"
        >
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
            {value ? (
              <img src={value} alt={label} className="h-full w-full object-cover" />
            ) : (
              <ImageIcon className="h-7 w-7 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-foreground">{value ? "Image sélectionnée" : "Aucune image"}</p>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </button>
        {value && (
          <Button
            type="button"
            variant="destructive"
            className="h-auto"
            onClick={() => {
              onChange(null)
              onSelect?.(null)
            }}
          >
            Supprimer
          </Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100dvh-var(--safe-top,0px)-var(--safe-bottom,0px)-1rem)] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Galerie média</DialogTitle>
            <DialogDescription>
              Sélectionnez une image ou ajoutez-en une depuis votre ordinateur.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Type : {type}</p>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
            />
            <Button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />
              ) : (
                <UploadCloud className="mr-2 h-4 w-4" />
              )}
              {isUploading ? "Upload en cours..." : "Upload"}
            </Button>
          </div>

          <PlatformMediaLibrary className="max-h-[420px] overflow-y-auto">
            {isUploading && uploadPreviewUrl && (
              <div className="overflow-hidden rounded-xl border border-dashed border-primary bg-card p-2">
                <div className="relative">
                  <img src={uploadPreviewUrl} alt="Upload en cours" className="aspect-square w-full rounded-lg object-cover opacity-60" />
                  <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/60">
                    <Loader2 className="h-7 w-7 animate-spin text-primary motion-reduce:animate-none" />
                  </div>
                </div>
                <p className="mt-2 text-center text-xs font-medium text-muted-foreground">Upload en cours...</p>
              </div>
            )}

            {isLoading && (
              <div className="col-span-full flex justify-center p-10">
                <Loader2 className="h-7 w-7 animate-spin text-primary motion-reduce:animate-none" />
              </div>
            )}

            {!isLoading &&
              sortedMedia.map((item) => {
                const isCurrent = activeUrl === item.url

                return (
                  <PlatformMediaCard
                    key={item.id}
                    className={cn(
                      "group relative overflow-hidden rounded-xl border bg-card p-2 text-left transition hover:border-primary",
                      value === item.url || isCurrent ? "border-primary ring-2 ring-primary/30" : "border-border"
                    )}
                    preview={<button
                      type="button"
                      onClick={() => handleSelect(item)}
                      className="dashboard-focus-visible block h-full w-full text-left"
                    >
                      <img src={item.url} alt="" className="aspect-square w-full rounded-lg object-cover" />
                    </button>}
                    name={item.publicId || "Média plateforme"}
                    meta={item.format ? `${item.format}${item.width && item.height ? ` · ${item.width}×${item.height}` : ""}` : undefined}
                    actions={<>

                    {isCurrent && (
                      <Badge className="absolute left-3 top-3 gap-1 bg-primary text-primary-foreground shadow">
                        <CheckCircle2 className="h-3 w-3" />
                        Logo actuel
                      </Badge>
                    )}

                    <Button
                      type="button"
                      size="icon"
                      variant="destructive"
                      className="absolute right-3 top-3 size-11 shadow sm:opacity-90 sm:transition sm:group-hover:opacity-100"
                      disabled={deletingId === item.id}
                      onClick={() => setDeleteCandidate(item)}
                      aria-label="Supprimer l'image"
                    >
                      {deletingId === item.id ? (
                        <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant={isCurrent ? "secondary" : "default"}
                      className="mt-2 w-full"
                      disabled={activatingId === item.id || isCurrent}
                      onClick={() => handleSetActive(item)}
                    >
                      {activatingId === item.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />
                      ) : null}
                      {isCurrent ? "Logo actuel" : onSetActive ? "Définir comme logo" : "Sélectionner"}
                    </Button>
                    </>}
                  />
                )
              })}

            {!isLoading && sortedMedia.length === 0 && (
              <div className="col-span-full rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                Aucune image disponible pour ce type.
              </div>
            )}
          </PlatformMediaLibrary>
        </DialogContent>
      </Dialog>
      <PlatformConfirmationDialog open={Boolean(deleteCandidate)} onOpenChange={(nextOpen) => { if (!nextOpen && !deletingId) setDeleteCandidate(null) }} title="Supprimer ce média de la galerie ?" description="L’entrée média sera supprimée de la plateforme." consequence="Le fichier Cloudinary restera stocké côté Cloudinary. Si ce média est actif, le callback existant de désactivation sera exécuté." confirmLabel="Supprimer" loading={Boolean(deletingId)} onConfirm={() => { if (deleteCandidate) void handleDelete(deleteCandidate) }} />
    </div>
  )
}
