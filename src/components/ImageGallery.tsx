"use client"

import { useEffect, useState } from "react"
import { collection, onSnapshot } from "firebase/firestore"
import { db } from "../lib/firebase"
import { ImageIcon } from "lucide-react"

type Props = {
  restaurantId: string
}

type ImageType = {
  id: string
  url: string
}

export default function ImageGallery({ restaurantId }: Props) {
  const [images, setImages] = useState<ImageType[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)

    const unsub = onSnapshot(
      collection(db, `restaurants/${restaurantId}/images`),
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as { url: string }),
        }))
        setImages(data)
        setLoading(false)
      },
      (error) => {
        console.error(error)
        setImages([])
        setLoading(false)
      }
    )

    return () => unsub()
  }, [restaurantId])

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {[1, 2, 3, 4, 5, 6].map((item) => (
          <div key={item} className="aspect-square animate-pulse rounded-2xl bg-secondary/40" />
        ))}
      </div>
    )
  }

  if (images.length === 0) {
    return (
      <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed bg-white text-center text-sm font-medium text-muted-foreground">
        <ImageIcon className="mb-2 h-8 w-8 text-gray-300" />
        Aucune image importee.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {images.map((img) => (
        <div key={img.id} className="group aspect-square overflow-hidden rounded-2xl bg-secondary/40 shadow-sm">
          <img
            src={img.url}
            alt=""
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        </div>
      ))}
    </div>
  )
}
