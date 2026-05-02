"use client"

import * as React from "react"
import { ChefHat, X } from "lucide-react"

import DishCard from "./DishCard"
import SearchBar from "./SearchBar"

export default function CategoryModal({
  category,
  products,
  search,
  onSearchChange,
  onClose,
  onOpenProduct,
}: {
  category: any
  products: any[]
  search: string
  onSearchChange: (value: string) => void
  onClose: () => void
  onOpenProduct: (product: any) => void
}) {
  React.useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }

    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", handleEsc)

    return () => {
      document.body.style.overflow = "unset"
      window.removeEventListener("keydown", handleEsc)
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 bg-background text-foreground flex flex-col">

      {/* HEADER */}
      <div className="sticky top-0 z-10 bg-background border-b">

        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-lg font-extrabold truncate">
            {category.name}
          </h2>

          <button
            onClick={onClose}
            className="h-10 w-10 rounded-full bg-muted flex items-center justify-center active:scale-95"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* IMAGE (RÉDUITE) */}
        {category.imageUrl && (
          <div className="px-4 pb-3">
            <div className="relative h-24 w-full rounded-xl overflow-hidden">
              <img
                src={category.imageUrl}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/20" />
              <div className="absolute bottom-1 left-2 text-white text-[10px] font-bold">
                {products.length} plats
              </div>
            </div>
          </div>
        )}

        <div className="px-4 pb-3">
          <SearchBar value={search} onChange={onSearchChange} />
        </div>
      </div>

      {/* PRODUITS */}
      <div className="flex-1 overflow-y-auto px-3 pb-28">

        {products.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 pt-3">
            {products.map((product) => (
              <DishCard
                key={product.id}
                product={product}
                onOpenDetails={() => onOpenProduct(product)}
              />
            ))}
          </div>
        ) : (
          <div className="flex min-h-[45vh] flex-col items-center justify-center text-center">
            <ChefHat className="mb-3 h-10 w-10 text-muted-foreground/60" />
            <p className="text-sm font-bold text-muted-foreground">
              Aucun plat trouvé
            </p>
          </div>
        )}
      </div>
    </div>
  )
}