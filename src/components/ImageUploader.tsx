"use client"

import { useState } from "react"
import { uploadImage } from "../services/uploadImage"
import { addDoc, collection, serverTimestamp } from "firebase/firestore"
import { db } from "../lib/firebase"
import { UploadCloud } from "lucide-react"

type Props = {
  restaurantId: string
}

export default function ImageUploader({ restaurantId }: Props) {
  const [loading, setLoading] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)

    try {
      // 1. Upload Cloudinary
      const data = await uploadImage(file, restaurantId)

      // 2. Sauvegarde Firestore
      await addDoc(
        collection(db, `restaurants/${restaurantId}/images`),
        {
          url: data.secure_url,
          publicId: data.public_id,
          createdAt: serverTimestamp(),
        }
      )

      // 3. Preview
      setImageUrl(data.secure_url)
    } catch (err) {
      console.error(err)
      alert("Erreur upload")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <label
        className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed bg-secondary/30 p-6 text-center transition hover:bg-secondary/50"
        style={{ borderColor: "color-mix(in srgb, var(--color-primary) 24%, transparent)" }}
      >
        <UploadCloud
          className="mb-3 h-8 w-8"
          style={{ color: "var(--color-primary)" }}
        />
        <span className="text-sm font-black text-foreground">
          Importer une image
        </span>
        <span className="mt-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          PNG, JPG ou WEBP
        </span>
        <input
          type="file"
          accept="image/*"
          onChange={handleUpload}
          className="sr-only"
        />
      </label>

      {loading && <p className="text-sm text-muted-foreground">Upload en cours...</p>}

      {imageUrl && (
        <img
          src={imageUrl}
          alt="preview"
          className="h-32 w-32 rounded-2xl object-cover shadow-sm"
        />
      )}
    </div>
  )
}
