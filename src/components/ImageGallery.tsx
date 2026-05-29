"use client"

import { useEffect, useState } from "react"
import {
  collection,
  getDocs,
  limit,
  query,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore"
import { useFirestore } from "@/firebase"
import { ImageIcon, MoreVertical, Trash2, Edit2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Props = {
  restaurantId: string
}

type ImageType = {
  id: string
  url: string
  name?: string
  publicId?: string
}

export default function ImageGallery({ restaurantId }: Props) {
  const db = useFirestore()
  const [images, setImages] = useState<ImageType[]>([])
  const [loading, setLoading] = useState(true)

  const [editingImage, setEditingImage] = useState<ImageType | null>(null)
  const [newName, setNewName] = useState("")

  // 🔁 LOAD
  const loadImages = async () => {
    if (!db || !restaurantId) return

    setLoading(true)

    try {
      const snapshot = await getDocs(
        query(collection(db, "restaurants", restaurantId, "images"), limit(50))
      )

      const data = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as any),
      }))

      setImages(data)
    } catch (error) {
      console.error(error)
      setImages([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadImages()
  }, [db, restaurantId])

  // ✏️ RENAME
  const handleRename = async () => {
    if (!editingImage || !newName.trim()) return

    try {
      await updateDoc(
        doc(db, "restaurants", restaurantId, "images", editingImage.id),
        {
          name: newName.trim(),
        }
      )

      setEditingImage(null)
      setNewName("")
      loadImages()
    } catch (err) {
      console.error(err)
      alert("Erreur renommage")
    }
  }

  // 🗑 DELETE
  const handleDelete = async (img: ImageType) => {
    if (!confirm("Supprimer cette image ?")) return

    try {
      await deleteDoc(
        doc(db, "restaurants", restaurantId, "images", img.id)
      )

      // ⚠️ BONUS: supprimer aussi Cloudinary (à faire côté backend)
      // await fetch("/api/delete-image", { method: "POST", body: JSON.stringify({ publicId: img.publicId }) })

      loadImages()
    } catch (err) {
      console.error(err)
      alert("Erreur suppression")
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="aspect-square animate-pulse rounded-2xl bg-secondary/40" />
        ))}
      </div>
    )
  }

  if (images.length === 0) {
    return (
      <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
        <ImageIcon className="mb-2 h-8 w-8 opacity-50" />
        Aucune image importée
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((img) => (
          <div
            key={img.id}
            className="group relative overflow-hidden rounded-2xl border bg-secondary/40"
          >
            <img
              src={img.url}
              className="h-full w-full object-cover transition group-hover:scale-105"
            />

            {/* 🔥 ACTIONS */}
            <div className="absolute top-2 right-2">
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={() => {
                    setEditingImage(img)
                    setNewName(img.name || "")
                  }}
                >
                  <Edit2 size={14} />
                </Button>

                <Button
                  size="icon"
                  variant="destructive"
                  onClick={() => handleDelete(img)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>

            {/* 🔥 NAME */}
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-2 truncate">
              {img.name || "Sans nom"}
            </div>
          </div>
        ))}
      </div>

      {/* ✏️ MODAL RENAME */}
      {editingImage && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-card p-5 rounded-xl w-[300px] space-y-3">
            <h2 className="font-bold text-sm">Renommer l’image</h2>

            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditingImage(null)}>
                Annuler
              </Button>
              <Button onClick={handleRename}>
                Enregistrer
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
