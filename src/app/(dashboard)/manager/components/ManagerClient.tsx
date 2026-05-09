"use client"

import * as React from "react"
import { useFirestore } from "@/firebase"

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "firebase/firestore"

import { Store, Plus, Search, X, MoreVertical, Edit2, Trash2, Power, PowerOff, Eye, ImageIcon, ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { useRestaurant } from "@/design-system/context/RestaurantContext"
import { getOptimizedImage } from "@/lib/image"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import OptionEditor from "@/components/menu/OptionEditor"
import ImagePickerModal from "@/components/ImagePickerModal"
import { CatalogProvider, useCatalog } from "@/modules/catalog/CatalogProvider"

// Drag & Drop imports
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  horizontalListSortingStrategy
} from "@dnd-kit/sortable"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

// =============================================================================
// SORTABLE CATEGORY ITEM (SIDEBAR)
// =============================================================================
function SortableCategoryItem({ category, isSelected, onSelect, onEdit, disabled }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: category.id, disabled })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} className="flex items-center gap-1">
      <div
        {...listeners}
        className="cursor-grab active:cursor-grabbing px-1 text-muted-foreground hover:text-primary"
      >
        ⋮⋮
      </div>
      <Button
        variant={isSelected ? "default" : "ghost"}
        onClick={onSelect}
        className="min-w-0 flex-1 justify-start rounded-xl font-black"
      >
        {category.imageUrl ? (
          <img
            src={getOptimizedImage(category.imageUrl, 120)}
            alt=""
            loading="lazy"
            width={120}
            height={120}
            className="mr-2 h-8 w-8 rounded-lg object-cover"
          />
        ) : (
          <span className="mr-2 flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-[10px] font-black text-muted-foreground">
            IMG
          </span>
        )}
        <span className="truncate">{category.name}</span>
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-xl"
        onClick={onEdit}
      >
        <Edit2 className="h-4 w-4" />
      </Button>
    </div>
  )
}

// =============================================================================
// SORTABLE CATEGORY CARD (MAIN GRID)
// =============================================================================
function SortableCategoryCard({ category, productCount, onClick }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: category.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card
        className="group cursor-grab active:cursor-grabbing hover:scale-[1.02] transition-all duration-300 overflow-hidden rounded-2xl border-none shadow-lg hover:shadow-xl bg-card/50"
        onClick={onClick}
      >
        <div className="h-32 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center overflow-hidden">
          {category.imageUrl ? (
            <img
              src={getOptimizedImage(category.imageUrl, 300)}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              alt={category.name}
              loading="lazy"
              width={300}
              height={200}
            />
          ) : (
            <Store className="h-10 w-10 text-gray-400" />
          )}
        </div>

        <CardContent className="p-3 space-y-1">
          <h3 className="font-bold text-sm text-gray-900 truncate">
            {category.name}
          </h3>
          <p className="text-xs text-gray-500">
            {productCount} produit{productCount !== 1 ? 's' : ''}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

// =============================================================================
// SORTABLE PRODUCT CARD (MAIN GRID)
// =============================================================================
function SortableProductCard({ product, category, onPreview, onEdit, onToggle, onDelete }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: product.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const displayImage = product.imageUrl || category?.imageUrl
  const isInactive = product.isActive === false
  const hasOptions = product.options && product.options.length > 0

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card
        className="group cursor-grab active:cursor-grabbing hover:scale-[1.02] transition-all duration-300 overflow-hidden rounded-2xl border-none shadow-lg hover:shadow-xl bg-card/50 relative"
        onClick={onPreview}
      >
        <div className="relative h-32 bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
          {displayImage ? (
            <img
              src={getOptimizedImage(displayImage, 300)}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              alt={product.name}
              loading="lazy"
              width={300}
              height={200}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Store className="h-8 w-8 text-gray-400" />
            </div>
          )}

          <div className="absolute top-2 right-2 z-10" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  size="icon" 
                  variant="secondary" 
                  className="h-7 w-7 bg-white/90 hover:bg-white shadow-md"
                >
                  <MoreVertical size={14} />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onPreview}>
                  <Eye className="mr-2 h-3 w-3" />
                  Aperçu
                </DropdownMenuItem>

                <DropdownMenuItem onClick={onEdit}>
                  <Edit2 className="mr-2 h-3 w-3" />
                  Modifier
                </DropdownMenuItem>

                <DropdownMenuItem onClick={onToggle}>
                  {product.isActive ? (
                    <>
                      <PowerOff className="mr-2 h-3 w-3" />
                      Désactiver
                    </>
                  ) : (
                    <>
                      <Power className="mr-2 h-3 w-3" />
                      Activer
                    </>
                  )}
                </DropdownMenuItem>

                <DropdownMenuItem onClick={onDelete} className="text-red-500 focus:text-red-500">
                  <Trash2 className="mr-2 h-3 w-3" />
                  Supprimer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {isInactive && (
            <div className="absolute inset-0 bg-[color:color-mix(in_srgb,var(--bg-main)_68%,transparent)] flex items-center justify-center backdrop-blur-sm">
              <Badge variant="destructive" className="text-[10px] px-2 py-0.5">
                Indisponible
              </Badge>
            </div>
          )}
        </div>

        <CardContent className="p-3 space-y-1">
          <div className="flex justify-between items-start gap-1">
            <h3 className="font-bold text-sm text-gray-900 line-clamp-2 flex-1">
              {product.name}
            </h3>
            <span className="text-sm font-black italic text-primary whitespace-nowrap">
              {product.basePrice} FCFA
            </span>
          </div>

          <div className="flex gap-1 flex-wrap">
            <Badge variant="secondary" className="text-[10px] bg-gray-100 text-gray-700">
              {category?.name || "Sans catégorie"}
            </Badge>
          </div>

          {(hasOptions || !isInactive) && (
            <div className="flex justify-between items-center text-[10px] text-gray-400 pt-1">
              {hasOptions ? (
                <div className="flex items-center gap-1">
                  <div className="w-1 h-1 rounded-full bg-green-500"></div>
                  <span>{product.options.length} option(s)</span>
                </div>
              ) : (
                <div></div>
              )}
              
              {!isInactive && (
                <div className="flex items-center gap-1">
                  <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse"></div>
                  <span>Disponible</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================
export default function ManagerDashboard() {
  const { restaurantId } = useRestaurant()

  return (
    <CatalogProvider restaurantId={restaurantId}>
      <ManagerDashboardContent />
    </CatalogProvider>
  )
}

function ManagerDashboardContent() {
  const db = useFirestore()
  const { restaurantId } = useRestaurant()
  const { products, categories, isLoadingVisible, refreshCatalog } = useCatalog()
  const { toast } = useToast()

  const [searchTerm, setSearchTerm] = React.useState("")
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null)
  const [viewMode, setViewMode] = React.useState<"categories" | "products">("categories")

  const [isProductOpen, setIsProductOpen] = React.useState(false)
  const [isCategoryOpen, setIsCategoryOpen] = React.useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false)
  const [isImagePickerOpen, setIsImagePickerOpen] = React.useState(false)
  const [isCategoryImagePickerOpen, setIsCategoryImagePickerOpen] = React.useState(false)
  const [previewProduct, setPreviewProduct] = React.useState<any>(null)

  const [newCategoryName, setNewCategoryName] = React.useState("")
  const [editingCategory, setEditingCategory] = React.useState<any>(null)
  const [selectedCategoryImage, setSelectedCategoryImage] = React.useState<{
    id: string
    url: string
  } | null>(null)
  const [editingProduct, setEditingProduct] = React.useState<any>(null)

  const [productForm, setProductForm] = React.useState({
    name: "",
    price: "",
    description: "",
    categoryId: "",
    imageUrl: "",
    imageId: ""
  })

  const [options, setOptions] = React.useState<any[]>([])

  // Order states for drag & drop
  const [categoryOrder, setCategoryOrder] = React.useState<string[]>([])
  const [productOrder, setProductOrder] = React.useState<string[]>([])
  // FILTER
  const filteredProducts = React.useMemo(() => {
    if (!products) return []
    return products.filter((p: any) => {
      const matchSearch = p.name?.toLowerCase().includes(searchTerm.toLowerCase())
      const matchCategory = selectedCategory ? p.categoryId === selectedCategory : true
      return matchSearch && matchCategory
    })
  }, [products, searchTerm, selectedCategory])

  // Synchroniser l'ordre des catégories avec Firestore
  React.useEffect(() => {
    if (categories && categories.length > 0 && categoryOrder.length === 0) {
      const sorted = [...categories].sort((a: any, b: any) => {
        if (a.order !== undefined && b.order !== undefined) return a.order - b.order
        return 0
      })
      setCategoryOrder(sorted.map((c: any) => c.id))
    }
  }, [categories, categoryOrder.length])

  // Synchroniser l'ordre des produits
  React.useEffect(() => {
    if (products && products.length > 0 && productOrder.length === 0 && selectedCategory) {
      const filtered = products.filter((p: any) => p.categoryId === selectedCategory)
      const sorted = [...filtered].sort((a: any, b: any) => {
        if (a.order !== undefined && b.order !== undefined) return a.order - b.order
        return 0
      })
      setProductOrder(sorted.map((p: any) => p.id))
    }
  }, [products, selectedCategory, productOrder.length])

  // Reset product order when category changes
  React.useEffect(() => {
    if (selectedCategory && products) {
      const filtered = products.filter((p: any) => p.categoryId === selectedCategory)
      const sorted = [...filtered].sort((a: any, b: any) => {
        if (a.order !== undefined && b.order !== undefined) return a.order - b.order
        return 0
      })
      setProductOrder(sorted.map((p: any) => p.id))
    } else {
      setProductOrder([])
    }
  }, [selectedCategory, products])

  // SANITIZE OPTIONS BEFORE SAVING
  const sanitizeOptions = (rawOptions: any[]): any[] => {
    if (!rawOptions || !Array.isArray(rawOptions)) return []

    const sanitized = rawOptions
      .map(option => {
        if (!option.name || typeof option.name !== 'string' || option.name.trim() === '') {
          return null
        }

        const validChoices = (option.choices || [])
          .map((choice: any) => {
            if (!choice.name || typeof choice.name !== 'string' || choice.name.trim() === '') {
              return null
            }

            let price = Number(choice.price)
            if (isNaN(price)) price = 0
            price = Math.round(price)

            return {
              name: choice.name.trim(),
              price: price
            }
          })
          .filter((choice: any) => choice !== null)

        if (validChoices.length === 0) return null

        return {
          name: option.name.trim(),
          required: option.required === true,
          choices: validChoices
        }
      })
      .filter(opt => opt !== null)

    return sanitized
  }

  // Sauvegarder l'ordre des catégories dans Firestore
  const saveCategoryOrder = async (newOrder: string[]) => {
    if (!db || !restaurantId) return
    
    try {
      const updates = newOrder.map((id, index) => {
        const ref = doc(db, "restaurants", restaurantId, "categories", id)
        return updateDoc(ref, { order: index })
      })
      
      await Promise.all(updates)
      refreshCatalog()
      toast({ title: "Ordre des catégories mis à jour" })
    } catch (error) {
      console.error(error)
      toast({ title: "Erreur lors de la sauvegarde", variant: "destructive" })
    }
  }

  // Sauvegarder l'ordre des produits dans Firestore
  const saveProductOrder = async (newOrder: string[]) => {
    if (!db || !restaurantId || !selectedCategory) return
    
    try {
      const updates = newOrder.map((id, index) => {
        const ref = doc(db, "restaurants", restaurantId, "products", id)
        return updateDoc(ref, { order: index })
      })
      
      await Promise.all(updates)
      refreshCatalog()
      toast({ title: "Ordre des produits mis à jour" })
    } catch (error) {
      console.error(error)
      toast({ title: "Erreur lors de la sauvegarde", variant: "destructive" })
    }
  }

  // Gérer la fin du drag
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    
    if (!over || active.id === over.id) return
    
    if (viewMode === "categories") {
      const oldIndex = categoryOrder.indexOf(active.id as string)
      const newIndex = categoryOrder.indexOf(over.id as string)
      const newOrder = arrayMove(categoryOrder, oldIndex, newIndex)
      setCategoryOrder(newOrder)
      saveCategoryOrder(newOrder)
    } else if (viewMode === "products") {
      const oldIndex = productOrder.indexOf(active.id as string)
      const newIndex = productOrder.indexOf(over.id as string)
      const newOrder = arrayMove(productOrder, oldIndex, newIndex)
      setProductOrder(newOrder)
      saveProductOrder(newOrder)
    }
  }

  // Configurer les sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // ADD CATEGORY
  const handleSaveCategory = async () => {
    if (!restaurantId) return
    if (!newCategoryName.trim()) return

    const formatted =
      newCategoryName.charAt(0).toUpperCase() + newCategoryName.slice(1)

    // Get current max order
    const currentMaxOrder = categories?.reduce((max: number, cat: any) => {
      const order = cat.order !== undefined ? cat.order : -1
      return Math.max(max, order)
    }, -1) ?? -1

    const payload = {
      name: formatted,
      imageUrl: selectedCategoryImage?.url || null,
      imageId: selectedCategoryImage?.id || null,
      order: currentMaxOrder + 1,
      updatedAt: serverTimestamp()
    }

    if (editingCategory) {
      await updateDoc(
        doc(db, "restaurants", restaurantId, "categories", editingCategory.id),
        payload
      )
      toast({ title: "Catégorie mise à jour" })
    } else {
      await addDoc(
        collection(db, "restaurants", restaurantId, "categories"),
        {
          ...payload,
          createdAt: serverTimestamp()
        }
      )
      toast({ title: "Catégorie ajoutée" })
    }

    refreshCatalog()
    setNewCategoryName("")
    setEditingCategory(null)
    setSelectedCategoryImage(null)
    setIsCategoryOpen(false)
  }

  const openCreateCategoryModal = () => {
    setEditingCategory(null)
    setNewCategoryName("")
    setSelectedCategoryImage(null)
    setIsCategoryOpen(true)
  }

  const openEditCategoryModal = (category: any) => {
    setEditingCategory(category)
    setNewCategoryName(category.name || "")
    setSelectedCategoryImage(
      category.imageUrl
        ? { id: category.imageId || "", url: category.imageUrl }
        : null
    )
    setIsCategoryOpen(true)
  }

  // TOGGLE PRODUCT ACTIVE STATUS
  const handleToggleProduct = async (product: any) => {
    if (!restaurantId) return

    try {
      const productRef = doc(db, "restaurants", restaurantId, "products", product.id)
      const newStatus = !product.isActive
      
      await updateDoc(productRef, {
        isActive: newStatus,
        updatedAt: serverTimestamp()
      })
      
      refreshCatalog()
      toast({ 
        title: newStatus ? "Produit activé" : "Produit désactivé",
        description: newStatus ? `${product.name} est maintenant disponible` : `${product.name} a été masqué du menu`,
      })
    } catch (error) {
      console.error(error)
      toast({ title: "Erreur lors du changement de statut", variant: "destructive" })
    }
  }

  // CREATE OR UPDATE PRODUCT
  const handleSaveProduct = async () => {
    if (!restaurantId) return

    if (!productForm.name || productForm.name.trim() === "") {
      toast({ title: "Nom du produit requis", variant: "destructive" })
      return
    }

    const basePrice = Number(productForm.price)
    if (isNaN(basePrice) || basePrice <= 0) {
      toast({ title: "Prix invalide", description: "Le prix doit être un nombre supérieur à 0", variant: "destructive" })
      return
    }

    const sanitizedBasePrice = Math.round(basePrice)
    const sanitizedOptions = sanitizeOptions(options)

    const payload = {
      name: productForm.name.trim(),
      description: productForm.description?.trim() || "",
      categoryId: productForm.categoryId || null,
      imageUrl: productForm.imageUrl?.trim() || "",
      imageId: productForm.imageId || "",
      basePrice: sanitizedBasePrice,
      options: sanitizedOptions,
      updatedAt: serverTimestamp()
    }

    try {
      if (editingProduct) {
        const productRef = doc(
          db,
          "restaurants",
          restaurantId,
          "products",
          editingProduct.id
        )
        await updateDoc(productRef, payload)
        refreshCatalog()
        toast({ title: "Produit mis à jour" })
      } else {
        // Get current max order for this category
        const productsInCategory = products?.filter((p: any) => p.categoryId === productForm.categoryId) ?? []
        const currentMaxOrder = productsInCategory.reduce((max: number, p: any) => {
          const order = p.order !== undefined ? p.order : -1
          return Math.max(max, order)
        }, -1)

        await addDoc(
          collection(db, "restaurants", restaurantId, "products"),
          {
            ...payload,
            createdAt: serverTimestamp(),
            isActive: true,
            order: currentMaxOrder + 1
          }
        )
        refreshCatalog()
        toast({ title: "Produit ajouté" })
      }

      setEditingProduct(null)
      setIsProductOpen(false)
      setProductForm({
        name: "",
        price: "",
        description: "",
        categoryId: "",
        imageUrl: "",
        imageId: ""
      })
      setOptions([])
    } catch (error) {
      console.error(error)
      toast({ title: "Erreur lors de la sauvegarde", variant: "destructive" })
    }
  }

  // DELETE PRODUCT
  const handleDeleteProduct = async (productId: string, productName: string) => {
    if (!restaurantId) return

    try {
      await deleteDoc(doc(db, "restaurants", restaurantId, "products", productId))
      refreshCatalog()
      toast({ title: "Produit supprimé", description: `${productName} a été supprimé définitivement` })
    } catch (error) {
      console.error(error)
      toast({ title: "Erreur lors de la suppression", variant: "destructive" })
    }
  }

  // OPEN EDIT MODAL
  const openEditModal = (product: any) => {
    setEditingProduct(product)
    setProductForm({
      name: product.name,
      price: product.basePrice,
      description: product.description || "",
      categoryId: product.categoryId || "",
      imageUrl: product.imageUrl || "",
      imageId: product.imageId || ""
    })
    setOptions(product.options || [])
    setIsProductOpen(true)
  }

  // OPEN CREATE MODAL
  const openCreateModal = () => {
    setEditingProduct(null)
    setProductForm({
      name: "",
      price: "",
      description: "",
      categoryId: selectedCategory || "",
      imageUrl: "",
      imageId: ""
    })
    setOptions([])
    setIsProductOpen(true)
  }

  // OPEN PREVIEW MODAL
  const openPreviewModal = (product: any) => {
    setPreviewProduct(product)
    setIsPreviewOpen(true)
  }

  return (
    <div className="flex gap-6 pb-20 animate-in fade-in duration-500">

      {/* SIDEBAR AVEC DRAG & DROP */}
      <div className="w-64 hidden md:flex flex-col gap-2 rounded-2xl bg-card/50 p-4 shadow-lg">
        <h2 className="text-sm font-bold">Catégories</h2>

        <Button
          variant={!selectedCategory && viewMode === "categories" ? "default" : "ghost"}
          onClick={() => {
            setSelectedCategory(null)
            setViewMode("categories")
          }}
          className="justify-start rounded-xl font-black"
        >
          Tous
        </Button>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={categoryOrder}
            strategy={verticalListSortingStrategy}
          >
            {categoryOrder.map((catId) => {
              const cat = categories?.find((c: any) => c.id === catId)
              if (!cat) return null
              
              return (
                <SortableCategoryItem
                  key={cat.id}
                  category={cat}
                  isSelected={selectedCategory === cat.id && viewMode === "products"}
                  onSelect={() => {
                    setSelectedCategory(cat.id)
                    setViewMode("products")
                  }}
                  onEdit={() => openEditCategoryModal(cat)}
                />
              )
            })}
          </SortableContext>
        </DndContext>

        <Button onClick={openCreateCategoryModal} variant="outline" className="mt-2 rounded-xl border-primary/20 font-black text-primary hover:bg-primary/5">
          <Plus className="mr-2 h-4 w-4" />
          Ajouter catégorie
        </Button>
      </div>

      {/* MAIN */}
      <div className="flex-1 space-y-6">

        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            {viewMode === "products" && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setViewMode("categories")}
                className="h-10 w-10 rounded-xl"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <h1 className="text-4xl font-black italic text-primary uppercase tracking-tighter flex items-center gap-3">
              <Store className="h-10 w-10" /> 
              {viewMode === "categories" ? "Catégories" : selectedCategory ? categories?.find((c: any) => c.id === selectedCategory)?.name : "Tous les produits"}
            </h1>
          </div>

          <Button onClick={openCreateModal} className="h-12 rounded-xl bg-primary hover:bg-primary/90 font-black uppercase italic shadow-lg">
            <Plus className="mr-2 h-4 w-4" />
            Ajouter produit
          </Button>
        </div>

        {viewMode === "products" && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un produit..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-12 rounded-xl border-none bg-card/50 pl-10 shadow-sm"
            />
          </div>
        )}

        {/* GRID */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {isLoadingVisible && <ManagerCatalogSkeleton />}

          {/* MODE CATÉGORIES AVEC DRAG & DROP */}
          {!isLoadingVisible && viewMode === "categories" && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={categoryOrder}
                strategy={horizontalListSortingStrategy}
              >
                {categoryOrder.map((catId) => {
                  const cat = categories?.find((c: any) => c.id === catId)
                  if (!cat) return null
                  
                  const count = products?.filter((p: any) => p.categoryId === cat.id).length || 0
                  
                  return (
                    <SortableCategoryCard
                      key={cat.id}
                      category={cat}
                      productCount={count}
                      onClick={() => {
                        setSelectedCategory(cat.id)
                        setViewMode("products")
                      }}
                    />
                  )
                })}
              </SortableContext>
            </DndContext>
          )}

          {/* MODE PRODUITS AVEC DRAG & DROP */}
          {!isLoadingVisible && viewMode === "products" && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={productOrder}
                strategy={horizontalListSortingStrategy}
              >
                {productOrder.map((productId) => {
                  const product = products?.find((p: any) => p.id === productId)
                  if (!product) return null
                  
                  // Ne pas afficher si le filtre ne correspond pas
                  const matchSearch = product.name?.toLowerCase().includes(searchTerm.toLowerCase())
                  const matchCategory = selectedCategory ? product.categoryId === selectedCategory : true
                  if (!matchSearch || !matchCategory) return null
                  
                  const category = categories?.find((c: any) => c.id === product.categoryId)
                  
                  return (
                    <SortableProductCard
                      key={product.id}
                      product={product}
                      category={category}
                      onPreview={() => openPreviewModal(product)}
                      onEdit={() => openEditModal(product)}
                      onToggle={() => handleToggleProduct(product)}
                      onDelete={() => handleDeleteProduct(product.id, product.name)}
                    />
                  )
                })}
              </SortableContext>
            </DndContext>
          )}

          {/* MESSAGES VIDES */}
          {!isLoadingVisible && viewMode === "products" && filteredProducts.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              Aucun produit trouvé
            </div>
          )}

          {!isLoadingVisible && viewMode === "categories" && categories?.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              Aucune catégorie trouvée. Cliquez sur "Ajouter catégorie" pour commencer.
            </div>
          )}
        </div>
      </div>

      {/* MODAL CATEGORY */}
      {isCategoryOpen && (
        <div className="fixed inset-0 bg-[color:color-mix(in_srgb,var(--bg-main)_68%,transparent)] flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-2xl w-[400px] space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-lg">
                {editingCategory ? "Modifier la catégorie" : "Nouvelle catégorie"}
              </h2>
              <button
                onClick={() => {
                  setIsCategoryOpen(false)
                  setEditingCategory(null)
                  setSelectedCategoryImage(null)
                }}
                className="cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <Input
              placeholder="Nom de la catégorie"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSaveCategory()}
            />

            <div className="space-y-3 rounded-xl border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Image catégorie</p>
                  <p className="text-xs text-muted-foreground">
                    Réutilisez une image de la bibliothèque.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCategoryImagePickerOpen(true)}
                  disabled={!restaurantId}
                >
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Choisir une image
                </Button>
              </div>

              {selectedCategoryImage ? (
                <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-2">
                  <img
                    src={getOptimizedImage(selectedCategoryImage.url, 120)}
                    alt="Image catégorie"
                    loading="lazy"
                    width={120}
                    height={120}
                    className="h-16 w-16 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-gray-700">
                      Image sélectionnée
                    </p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {selectedCategoryImage.url}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedCategoryImage(null)}
                  >
                    Supprimer
                  </Button>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                  Aucune image sélectionnée
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setIsCategoryOpen(false)
                  setEditingCategory(null)
                  setSelectedCategoryImage(null)
                }}
              >
                Annuler
              </Button>
              <Button onClick={handleSaveCategory}>
                {editingCategory ? "Enregistrer" : "Ajouter"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PRODUCT */}
      {isProductOpen && (
        <div className="fixed inset-0 bg-[color:color-mix(in_srgb,var(--bg-main)_68%,transparent)] flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-2xl w-[550px] space-y-4 overflow-y-auto max-h-[90vh] shadow-2xl">
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-xl">
                {editingProduct ? "✏️ Modifier le produit" : "➕ Nouveau produit"}
              </h2>
              <button onClick={() => setIsProductOpen(false)} className="cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <Input
              placeholder="Nom du produit *"
              value={productForm.name}
              onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
              className="h-12 rounded-xl bg-secondary/30 border-none"
            />

            <Input
              placeholder="Prix de base (ex: 3000) *"
              type="number"
              min="1"
              step="1"
              value={productForm.price}
              onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
              className="h-12 rounded-xl bg-secondary/30 border-none"
            />

            <select
              className="w-full border-none bg-secondary/30 p-3 rounded-xl"
              value={productForm.categoryId}
              onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}
            >
              <option value="">Sélectionner une catégorie</option>
              {categories?.map((cat: any) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>

            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold">Image produit</p>
                  <p className="text-xs text-muted-foreground">
                    Choisissez une image depuis la bibliotheque du restaurant.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsImagePickerOpen(true)}
                  disabled={!restaurantId}
                >
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Choisir une image
                </Button>
              </div>

              {productForm.imageUrl ? (
                <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-2">
                  <img
                    src={getOptimizedImage(productForm.imageUrl, 120)}
                    alt="Image selectionnee"
                    loading="lazy"
                    width={120}
                    height={120}
                    className="h-16 w-16 rounded-md object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-gray-700">
                      Image selectionnee
                    </p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {productForm.imageUrl}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setProductForm({ ...productForm, imageUrl: "", imageId: "" })}
                  >
                    Retirer
                  </Button>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                  Aucune image choisie
                </div>
              )}
            </div>

            <textarea
              placeholder="Description du produit"
              className="w-full border p-2 rounded"
              rows={3}
              value={productForm.description}
              onChange={(e) =>
                setProductForm({ ...productForm, description: e.target.value })
              }
            />

            <div className="border-t pt-4">
              <OptionEditor options={options} setOptions={setOptions} />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="ghost" onClick={() => setIsProductOpen(false)}>
                Annuler
              </Button>

              <Button onClick={handleSaveProduct}>
                {editingProduct ? "Mettre à jour" : "Créer le produit"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* PREVIEW MODAL */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {previewProduct && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold">Aperçu produit</DialogTitle>
              </DialogHeader>

              <div className="space-y-6">
                <div className="relative h-64 rounded-xl overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
                  {(previewProduct.imageUrl || categories?.find((c: any) => c.id === previewProduct.categoryId)?.imageUrl) ? (
                    <img
                      src={getOptimizedImage(previewProduct.imageUrl || categories?.find((c: any) => c.id === previewProduct.categoryId)?.imageUrl, 600)}
                      className="w-full h-full object-cover"
                      alt={previewProduct.name}
                      width={600}
                      height={400}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Store className="h-16 w-16 text-gray-400" />
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <h3 className="text-2xl font-bold text-gray-900">{previewProduct.name}</h3>
                    <span className="text-2xl font-bold text-primary">{previewProduct.basePrice} FCFA</span>
                  </div>

                  {previewProduct.description && (
                    <p className="text-gray-600 leading-relaxed">{previewProduct.description}</p>
                  )}

                  <div className="pt-2">
                    <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                      {categories?.find((c: any) => c.id === previewProduct.categoryId)?.name || "Sans catégorie"}
                    </Badge>
                  </div>
                </div>

                {previewProduct.options && previewProduct.options.length > 0 && (
                  <div className="space-y-4 border-t pt-4">
                    <h4 className="font-semibold text-lg">Options disponibles</h4>
                    
                    {previewProduct.options.map((option: any, idx: number) => (
                      <div key={idx} className="space-y-2 bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{option.name}</span>
                          {option.required && (
                            <Badge variant="destructive" className="text-xs bg-red-100 text-red-700">
                              Obligatoire
                            </Badge>
                          )}
                        </div>
                        
                        <div className="space-y-1 pl-2">
                          {option.choices.map((choice: any, cIdx: number) => (
                            <div key={cIdx} className="flex justify-between items-center text-sm">
                              <span className="text-gray-600">{choice.name}</span>
                              {choice.price > 0 && (
                                <span className="text-primary font-medium">+{choice.price} FCFA</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="border-t pt-4">
                  <div className="flex items-center gap-2 text-sm">
                    <div className={`w-2 h-2 rounded-full ${previewProduct.isActive !== false ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                    <span className="text-gray-600">
                      {previewProduct.isActive !== false ? 'Disponible à la vente' : 'Produit indisponible'}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* IMAGE PICKER MODALS */}
      {restaurantId && (
        <ImagePickerModal
          open={isCategoryImagePickerOpen}
          restaurantId={restaurantId}
          selectedImageId={selectedCategoryImage?.id}
          onClose={() => setIsCategoryImagePickerOpen(false)}
          onSelect={(image) =>
            setSelectedCategoryImage({
              id: image.id,
              url: image.url,
            })
          }
        />
      )}

      {restaurantId && (
        <ImagePickerModal
          open={isImagePickerOpen}
          restaurantId={restaurantId}
          selectedImageId={productForm.imageId}
          onClose={() => setIsImagePickerOpen(false)}
          onSelect={(image) =>
            setProductForm({
              ...productForm,
              imageUrl: image.url,
              imageId: image.id,
            })
          }
        />
      )}

    </div>
  )
}

function ManagerCatalogSkeleton() {
  return (
    <>
      {Array.from({ length: 10 }).map((_, index) => (
        <Card key={index} className="overflow-hidden rounded-2xl border-none shadow-lg bg-card/50">
          <div className="h-32 animate-pulse bg-secondary/40" />
          <CardContent className="space-y-2 p-3">
            <div className="h-4 w-3/4 animate-pulse rounded-full bg-secondary/50" />
            <div className="h-3 w-1/2 animate-pulse rounded-full bg-secondary/40" />
          </CardContent>
        </Card>
      ))}
    </>
  )
}
