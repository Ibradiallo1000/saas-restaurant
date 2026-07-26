"use client"

import * as React from "react"
import { useFirestore } from "@/firebase"
import { collection, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import ImagePickerModal from "@/components/ImagePickerModal"
import {
  normalizeProductReviewsPolicy,
  policyFromLegacyReviewsEnabled,
  resolveProductReviewsEnabled,
  type ProductReviewsPolicy,
} from "@/lib/product-review-policy"

type Props = {
  restaurantId: string
  categories: any[]
  product?: any
  onClose: () => void
}

export default function ProductEditor({
  restaurantId,
  categories,
  product,
  onClose
}: Props) {
  const db = useFirestore()

  const [name, setName] = React.useState(product?.name || "")
  const [price, setPrice] = React.useState(product?.price || 0)
  const [categoryId, setCategoryId] = React.useState(product?.categoryId || "")
  const [description, setDescription] = React.useState(product?.description || "")
  const [imageUrl, setImageUrl] = React.useState(product?.imageUrl || "")
  const [imageId, setImageId] = React.useState(product?.imageId || "")
  const [reviewsPolicy, setReviewsPolicy] = React.useState<ProductReviewsPolicy>(
    product?.reviewsPolicy === "inherit" || product?.reviewsPolicy === "enabled" || product?.reviewsPolicy === "disabled"
      ? product.reviewsPolicy
      : policyFromLegacyReviewsEnabled(product?.reviewsEnabled)
  )
  const [isImagePickerOpen, setIsImagePickerOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)

  const isEdit = !!product
  const selectedCategory = React.useMemo(
    () => categories.find((item) => item.id === categoryId) ?? null,
    [categories, categoryId]
  )
  const resolvedReviewsEnabled = resolveProductReviewsEnabled({
    categoryReviewsEnabled: selectedCategory?.reviewsEnabled,
    productReviewsPolicy: reviewsPolicy,
  })

  const handleSave = async () => {
    if (!name || !price || !categoryId || resolvedReviewsEnabled === null) return

    setLoading(true)

    try {
      if (isEdit) {
        await updateDoc(
          doc(db, "restaurants", restaurantId, "products", product.id),
          {
            name,
            price,
            categoryId,
            description,
            imageUrl,
            imageId,
            reviewsPolicy: normalizeProductReviewsPolicy(reviewsPolicy),
            reviewsEnabled: resolvedReviewsEnabled,
            updatedAt: serverTimestamp()
          }
        )
      } else {
        await addDoc(
          collection(db, "restaurants", restaurantId, "products"),
          {
            name,
            price,
            categoryId,
            description,
            imageUrl,
            imageId,
            reviewsPolicy: normalizeProductReviewsPolicy(reviewsPolicy),
            reviewsEnabled: resolvedReviewsEnabled,
            isAvailable: true,
            createdAt: serverTimestamp()
          }
        )
      }

      onClose()
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-[color:color-mix(in_srgb,var(--bg-main)_68%,transparent)] flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-xl p-6 w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-lg">
            {isEdit ? "Modifier produit" : "Nouveau produit"}
          </h2>

          <button onClick={onClose} className="text-xl">✕</button>
        </div>

        {/* FORM */}
        <div className="space-y-4">

          <Input
            placeholder="Nom du produit"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <Input
            type="number"
            placeholder="Prix (FCFA)"
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
          />

          <select
            className="w-full border rounded-lg p-2"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">Choisir catégorie</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          <Textarea
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="space-y-2 rounded-xl border p-3">
            <p className="text-sm font-semibold">Avis clients *</p>
            <div className="grid gap-2">
              <Button
                type="button"
                variant={reviewsPolicy === "inherit" ? "default" : "outline"}
                disabled={typeof selectedCategory?.reviewsEnabled !== "boolean"}
                onClick={() => setReviewsPolicy("inherit")}
              >
                Utiliser la catégorie
              </Button>
              <Button type="button" variant={reviewsPolicy === "enabled" ? "default" : "outline"} onClick={() => setReviewsPolicy("enabled")}>
                Toujours autoriser
              </Button>
              <Button type="button" variant={reviewsPolicy === "disabled" ? "default" : "outline"} onClick={() => setReviewsPolicy("disabled")}>
                Toujours désactiver
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {reviewsPolicy === "inherit"
                ? typeof selectedCategory?.reviewsEnabled === "boolean"
                  ? `Hérite de « ${selectedCategory.name} » — avis actuellement ${selectedCategory.reviewsEnabled ? "autorisés" : "désactivés"}.`
                  : "Configurez d’abord les avis de la catégorie."
                : resolvedReviewsEnabled
                  ? "Exception : ce produit peut actuellement être noté."
                  : "Exception : ce produit ne peut actuellement pas être noté."}
            </p>
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Image produit</p>
                <p className="text-xs text-muted-foreground">
                  Choisir une image existante.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsImagePickerOpen(true)}
              >
                Choisir une image
              </Button>
            </div>

            {imageUrl ? (
              <div className="flex items-center gap-3 rounded bg-gray-50 p-2">
                <img
                  src={imageUrl}
                  alt="Image selectionnee"
                  className="h-16 w-16 rounded object-cover"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setImageUrl("")
                    setImageId("")
                  }}
                >
                  Retirer
                </Button>
              </div>
            ) : (
              <div className="rounded border border-dashed p-3 text-center text-xs text-muted-foreground">
                Aucune image choisie
              </div>
            )}
          </div>

        </div>

        {/* ACTIONS */}
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>

          <Button onClick={handleSave} disabled={loading}>
            {loading ? "..." : "Sauvegarder"}
          </Button>
        </div>
      </div>

      <ImagePickerModal
        open={isImagePickerOpen}
        restaurantId={restaurantId}
        selectedImageId={imageId}
        onClose={() => setIsImagePickerOpen(false)}
        onSelect={(image) => {
          setImageUrl(image.url)
          setImageId(image.id)
        }}
      />
    </div>
  )
}
