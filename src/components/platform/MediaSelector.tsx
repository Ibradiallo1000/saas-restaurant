"use client"

import * as React from "react"
import { addDoc, collection, query, serverTimestamp, where } from "firebase/firestore"
import { ImageIcon, Loader2, UploadCloud } from "lucide-react"

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

type PlatformMedia = {
  url: string
  publicId: string
  type: string
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
  type: "logo" | "payment" | "restaurant" | string
  label?: string
  description?: string
  className?: string
}

const isPersistableImageUrl = (url: string) =>
  /^https?:\/\//.test(url) || url.startsWith("/")

export function MediaSelector({
  value,
  onChange,
  onSelect,
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

  const mediaQuery = useMemoFirebase(() => {
    if (!db) return null

    return query(
      collection(db, COLLECTION_NAMES.PLATFORM_MEDIA),
      where("type", "==", type)
    )
  }, [db, type])

  const { data: media, isLoading } = useCollection<PlatformMedia>(mediaQuery)
  const sortedMedia = React.useMemo(
    () => [...(media ?? [])].sort((a, b) => b.id.localeCompare(a.id)),
    [media]
  )

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !db) return

    setIsUploading(true)

    try {
      const url = await uploadImage(file)

      if (!isPersistableImageUrl(url)) {
        throw new Error("URL image non persistable")
      }

      const docRef = await addDoc(collection(db, COLLECTION_NAMES.PLATFORM_MEDIA), {
        url,
        publicId: "",
        type,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      onChange(url)
      onSelect?.({
        id: docRef.id,
        url,
        publicId: "",
        type,
      })
      setOpen(false)
      toast({ title: "Image ajoutée" })
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
          : "Verifiez la configuration Cloudinary.",
      })
    } finally {
      setIsUploading(false)
      event.target.value = ""
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
        <DialogContent className="max-w-3xl">
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
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UploadCloud className="mr-2 h-4 w-4" />
              )}
              Upload
            </Button>
          </div>

          <div className="grid max-h-[420px] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 md:grid-cols-4">
            {isLoading && (
              <div className="col-span-full flex justify-center p-10">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
              </div>
            )}

            {!isLoading &&
              sortedMedia.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onChange(item.url)
                    onSelect?.(item)
                    setOpen(false)
                  }}
                  className={cn(
                    "overflow-hidden rounded-xl border bg-card p-2 text-left transition hover:border-primary",
                    value === item.url ? "border-primary ring-2 ring-primary/30" : "border-border"
                  )}
                >
                  <img src={item.url} alt="" className="aspect-square w-full rounded-lg object-cover" />
                </button>
              ))}

            {!isLoading && sortedMedia.length === 0 && (
              <div className="col-span-full rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                Aucune image disponible pour ce type.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
