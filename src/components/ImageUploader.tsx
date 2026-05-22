"use client"

import { useState } from "react"
import { uploadImage } from "../services/uploadImage"
import { addDoc, collection, serverTimestamp } from "firebase/firestore"
import { db } from "../lib/firebase"
import { UploadCloud } from "lucide-react"
import { Input } from "@/components/ui/input"

type Props = {
  restaurantId: string
}

export default function ImageUploader({ restaurantId }: Props) {
  const [loading, setLoading] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [name, setName] = useState("")

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)

    try {
      // 1. Upload Cloudinary
      const data = await uploadImage(file, restaurantId)

      // 2. Nom fallback intelligent
      const finalName =
        name.trim() !== ""
          ? name.trim()
          : file.name.replace(/\.[^/.]+$/, "") || `Image ${Date.now()}`

      // 3. Sauvegarde Firestore
      await addDoc(
        collection(db, `restaurants/${restaurantId}/images`),
        {
          url: data.secure_url,
          publicId: data.public_id,
          name: finalName, // 🔥 AJOUT CRITIQUE
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      )

      // 4. Preview + reset
      setImageUrl(data.secure_url)
      setName("")
    } catch (err) {
      console.error(err)
      alert("Erreur upload")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">

      {/* 🔥 INPUT NOM */}
      <Input
        placeholder="Nom de l’image (ex: Pizza Margherita)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-11 rounded-xl bg-secondary/30 border-none"
      />

      <label
        className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-secondary/30 p-6 text-center shadow-sm transition hover:bg-secondary/50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
      >
        <UploadCloud
          className="mb-3 h-8 w-8"
          style={{ color: "var(--color-primary)" }}
        />
        <span className="text-sm font-black text-foreground dark:text-white">
          Importer une image
        </span>
        <span className="mt-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground dark:text-gray-400">
          PNG, JPG ou WEBP
        </span>

        <input
          type="file"
          accept="image/*"
          onChange={handleUpload}
          className="sr-only"
        />
      </label>

      {loading && (
        <p className="text-sm text-muted-foreground dark:text-gray-400">
          Upload en cours...
        </p>
      )}

      {imageUrl && (
        <img
          src={imageUrl}
          alt="preview"
          className="h-32 w-32 rounded-2xl border border-gray-200 object-cover shadow-sm dark:border-gray-700 dark:shadow-md"
        />
      )}
    </div>
  )
}