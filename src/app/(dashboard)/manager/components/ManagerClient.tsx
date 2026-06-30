"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
  serverTimestamp,
} from "firebase/firestore"

import { Store, Plus, Search, X, MoreVertical, Edit2, Trash2, Power, PowerOff, Eye, ImageIcon, ArrowLeft, AlertTriangle, Clock, ShieldCheck, Banknote, ReceiptText, Wallet, ClipboardList, BookOpen, MapPin, PackageCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { useRestaurant } from "@/design-system/context/RestaurantContext"
import { useTenant } from "@/design-system/context/TenantProvider"
import { getOptimizedImage } from "@/lib/image"
import { cn } from "@/lib/utils"
import { COLLECTION_NAMES } from "@/lib/constants"
import { getOrderDisplayId } from "@/lib/order-display-id"
import { getFinancialSummary, getSupportedBusinessTimeZone } from "@/lib/finance/financial-summary"
import {
  assertValidComponentMultiplier,
  buildComponentsFromLegacy,
  computeEstimatedCost,
  hasComplexConsumption,
  hasTrackedConsumption,
} from "@/lib/product-components"
import {
  ORDER_OPERATION_STATUS,
  getOrderStatus,
  isOrderPaid,
} from "@/lib/order-lifecycle"
import { useRestaurantLiveData } from "@/modules/restaurant-live/RestaurantLiveDataProvider"
import { getDateRange, useTimeFilter } from "@/contexts/time-filter-context"
import { PreparationBadge } from "@/components/PreparationBadge"
import {
  getDefaultPreparationMode,
  PREPARATION_MODES,
  type PreparationMode,
} from "@/utils/preparation-logic"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import OptionEditor from "@/components/menu/OptionEditor"
import LinkedOptionsEditor from "@/components/menu/LinkedOptionsEditor"
import {
  sanitizeLinkedOptionGroups,
  type LinkedOptionGroup,
} from "@/lib/linked-option-groups"
import ImagePickerModal from "@/components/ImagePickerModal"
import { CatalogProvider, useCatalog } from "@/modules/catalog/CatalogProvider"
import MenuLibraryImportDialog from "@/modules/menu-library/MenuLibraryImportDialog"

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
  const isComplexConsumption = product.hasComplexConsumption === true || hasComplexConsumption(product)
  const isTracked = hasTrackedConsumption(product)

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
                  className="h-7 w-7 bg-background/90 hover:bg-background shadow-md"
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
              {product.basePrice > 0 ? `${product.basePrice} FCFA` : "Prix sur option"}
            </span>
          </div>

          <div className="flex gap-1 flex-wrap">
            {isComplexConsumption ? (
              <Badge variant="secondary" className="text-[10px] bg-orange-100 text-orange-700">
                🔥 Consommation variable
              </Badge>
            ) : null}
            {!isTracked ? (
              <Badge variant="secondary" className="text-[10px] bg-yellow-100 text-yellow-800">
                ⚠️ Recette non configurée
              </Badge>
            ) : null}
            <Badge variant="secondary" className="text-[10px] bg-gray-100 text-gray-700">
              {category?.name || "Sans catégorie"}
            </Badge>
            <PreparationBadge
              item={{
                preparationMode: product.preparationMode,
                categoryName: category?.name,
              }}
            />
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
              
              {!isInactive && product.basePrice > 0 && (
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
type ManagerMode = "dashboard" | "orders" | "menu"

export default function ManagerDashboard({ mode = "dashboard" }: { mode?: ManagerMode }) {
  const { restaurantId } = useRestaurant()

  if (mode === "dashboard") {
    return <ManagerDashboardPage restaurantId={restaurantId} />
  }

  if (mode === "orders") {
    return <ManagerOrdersPage restaurantId={restaurantId} />
  }

  return (
    <CatalogProvider restaurantId={restaurantId}>
      <ManagerDashboardContent mode={mode} />
    </CatalogProvider>
  )
}

function ManagerDashboardContent({ mode }: { mode: ManagerMode }) {
  const db = useFirestore()
  const { restaurantId } = useRestaurant()
  const { products, categories, isLoadingVisible, refreshCatalog } = useCatalog()
  const { toast } = useToast()
  const inventoryItemsQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, "inventoryItems")
  }, [db, restaurantId])
  const { data: inventoryItems } = useCollection<any>(inventoryItemsQuery)

  const [searchTerm, setSearchTerm] = React.useState("")
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null)
  const [viewMode, setViewMode] = React.useState<"categories" | "products">("categories")

  const [isProductOpen, setIsProductOpen] = React.useState(false)
  const [isCategoryOpen, setIsCategoryOpen] = React.useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false)
  const [isLibraryImportOpen, setIsLibraryImportOpen] = React.useState(false)
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
    imageId: "",
    preparationMode: "kitchen" as PreparationMode,
  })

  const [options, setOptions] = React.useState<any[]>([])
  const [linkedOptionGroups, setLinkedOptionGroups] = React.useState<LinkedOptionGroup[]>([])
  const [recipe, setRecipe] = React.useState<any[]>([])
  const draftProductForConsumption = React.useMemo(() => {
    const components = buildComponentsFromLegacy({ recipe, options })
    return { recipe, options, components }
  }, [recipe, options])
  const draftEstimatedCost = React.useMemo(
    () => computeEstimatedCost(draftProductForConsumption, inventoryItems || []),
    [draftProductForConsumption, inventoryItems]
  )
  const draftHasComplexConsumption = React.useMemo(
    () => hasComplexConsumption(draftProductForConsumption),
    [draftProductForConsumption]
  )
  const draftHasTrackedConsumption = React.useMemo(
    () => hasTrackedConsumption(draftProductForConsumption),
    [draftProductForConsumption]
  )

  const validateLinkedOptionGroupDrafts = React.useCallback((groups: LinkedOptionGroup[]) => {
    for (const [index, group] of groups.entries()) {
      const label = `Groupe lié #${index + 1}`

      if (!group.title?.trim()) {
        return `${label}: ajoute un titre avant de sauvegarder.`
      }

      if (group.sourceType === "category" && (group.categoryIds?.filter(Boolean).length || 0) === 0) {
        return `${label}: sélectionne au moins une catégorie source.`
      }

      if (group.sourceType === "products" && (group.productIds?.filter(Boolean).length || 0) === 0) {
        return `${label}: sélectionne au moins un produit source.`
      }

      if (Number(group.minSelect) > Number(group.maxSelect)) {
        return `${label}: le minimum ne peut pas dépasser le maximum.`
      }
    }

    return null
  }, [])

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

  // 🔥 SANITIZE OPTIONS WITH MULTIPLE SUPPORT
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

            // Prix final, pas un supplément
            let price = Number(choice.price)
            if (isNaN(price)) price = 0
            price = Math.round(price)

            const recipe = sanitizeRecipe(choice.recipe)
            const multiplier = assertValidComponentMultiplier(choice.multiplier ?? 1)

            return {
              name: choice.name.trim(),
              price,
              multiplier,
              recipe,
            }
          })
          .filter((choice: any) => choice !== null)

        if (validChoices.length === 0) return null

        return {
          name: option.name.trim(),
          required: option.required === true,
          multiple: option.multiple === true, // 🔥 Support multi-sélection
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

  // 🔥 CREATE OR UPDATE PRODUCT (WITH NEW VALIDATION)
  const handleSaveProduct = async () => {
    if (!restaurantId) return

    if (!productForm.name || productForm.name.trim() === "") {
      toast({ title: "Nom du produit requis", variant: "destructive" })
      return
    }

    const basePrice = Number(productForm.price)
    
    // 🔥 Vérifier si le produit a des options avec prix
    const hasOptionsWithPrice = options.some(opt =>
      opt.choices?.some((c: any) => Number(c.price) > 0)
    )

    // 🔥 Nouvelle validation : prix requis seulement si pas d'options avec prix
    if (!hasOptionsWithPrice && (isNaN(basePrice) || basePrice <= 0)) {
      toast({ 
        title: "Prix requis", 
        description: "Ajoute un prix de base ou des options avec prix",
        variant: "destructive" 
      })
      return
    }

    // Si basePrice est valide, on l'arrondit, sinon 0
    const sanitizedBasePrice = !isNaN(basePrice) && basePrice > 0 ? Math.round(basePrice) : 0
    let sanitizedOptions: any[] = []
    let sanitizedRecipe: any[] = []
    let sanitizedComponents: any[] = []
    let productHasComplexConsumption = false

    try {
      sanitizedOptions = sanitizeOptions(options)
      sanitizedRecipe = sanitizeRecipe(recipe)
      sanitizedComponents = buildComponentsFromLegacy({
        recipe: sanitizedRecipe,
        options: sanitizedOptions,
      })
      productHasComplexConsumption = hasComplexConsumption({
        recipe: sanitizedRecipe,
        options: sanitizedOptions,
        components: sanitizedComponents,
      })
    } catch (error: any) {
      toast({
        title: "Configuration produit invalide",
        description: error?.message || "Vérifie les variantes et suppléments.",
        variant: "destructive",
      })
      return
    }

    const linkedOptionGroupsError = validateLinkedOptionGroupDrafts(linkedOptionGroups)
    if (linkedOptionGroupsError) {
      toast({
        title: "Options liées invalides",
        description: linkedOptionGroupsError,
        variant: "destructive",
      })
      return
    }

    const sanitizedLinkedOptionGroups = sanitizeLinkedOptionGroups(linkedOptionGroups)

    const payload = {
      name: productForm.name.trim(),
      description: productForm.description?.trim() || "",
      categoryId: productForm.categoryId || null,
      imageUrl: productForm.imageUrl?.trim() || "",
      imageId: productForm.imageId || "",
      basePrice: sanitizedBasePrice,
      options: sanitizedOptions,
      recipe: sanitizedRecipe,
      components: sanitizedComponents,
      linkedOptionGroups: sanitizedLinkedOptionGroups,
      hasComplexConsumption: productHasComplexConsumption,
      preparationMode: productForm.preparationMode,
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
        const updatedProductSnapshot = await getDoc(productRef)
        if (!updatedProductSnapshot.exists()) {
          throw new Error("Vérification Firestore impossible: le produit mis à jour est introuvable.")
        }
        const updatedLinkedOptionGroups = sanitizeLinkedOptionGroups(
          updatedProductSnapshot.data()?.linkedOptionGroups
        )
        if (
          sanitizedLinkedOptionGroups.length > 0 &&
          JSON.stringify(updatedLinkedOptionGroups) !== JSON.stringify(sanitizedLinkedOptionGroups)
        ) {
          throw new Error("Vérification Firestore impossible: les options liées n'ont pas été relues après sauvegarde.")
        }
        refreshCatalog()
        toast({
          title: "Produit mis à jour",
          description: sanitizedLinkedOptionGroups.length
            ? "Options liées sauvegardées."
            : "Produit sauvegardé sans options liées.",
        })
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
        imageId: "",
        preparationMode: "kitchen",
      })
      setOptions([])
      setLinkedOptionGroups([])
      setRecipe([])
    } catch (error) {
      console.error("Erreur sauvegarde produit:", error)
      toast({
        title: "Erreur lors de la sauvegarde",
        description: error instanceof Error ? error.message : "Le produit n'a pas été sauvegardé.",
        variant: "destructive",
      })
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
    const categoryName = categories?.find((c: any) => c.id === product.categoryId)?.name || ""
    setEditingProduct(product)
    setProductForm({
      name: product.name,
      price: product.basePrice?.toString() || "",
      description: product.description || "",
      categoryId: product.categoryId || "",
      imageUrl: product.imageUrl || "",
      imageId: product.imageId || "",
      preparationMode: product.preparationMode || getDefaultPreparationMode(categoryName),
    })
    setOptions(product.options || [])
    setLinkedOptionGroups(sanitizeLinkedOptionGroups(product.linkedOptionGroups))
    setRecipe(normalizeRecipe(product.recipe))
    setIsProductOpen(true)
  }

  // OPEN CREATE MODAL
  const openCreateModal = () => {
    const categoryName = categories?.find((c: any) => c.id === selectedCategory)?.name || ""
    setEditingProduct(null)
    setProductForm({
      name: "",
      price: "",
      description: "",
      categoryId: selectedCategory || "",
      imageUrl: "",
      imageId: "",
      preparationMode: getDefaultPreparationMode(categoryName),
    })
    setOptions([])
    setLinkedOptionGroups([])
    setRecipe([])
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

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={() => setIsLibraryImportOpen(true)}
              variant="outline"
              className="h-12 rounded-xl border-primary/20 font-black uppercase italic text-primary"
            >
              <BookOpen className="mr-2 h-4 w-4" />
              Importer depuis la bibliotheque
            </Button>
            <Button onClick={openCreateModal} className="h-12 rounded-xl bg-primary hover:bg-primary/90 font-black uppercase italic shadow-lg">
              <Plus className="mr-2 h-4 w-4" />
              Ajouter produit
            </Button>
          </div>
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
          <div className="h-full w-full space-y-4 overflow-y-auto bg-card p-4 shadow-2xl sm:h-auto sm:w-[400px] sm:rounded-2xl sm:p-6">
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
                    src={getOptimizedImage(selectedCategoryImage!.url, 120)}
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
                      {selectedCategoryImage!.url}
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

      {/* MODAL PRODUCT - 🔥 MODIFIED PLACEHOLDER */}
      {isProductOpen && (
        <div className="fixed inset-0 bg-[color:color-mix(in_srgb,var(--bg-main)_68%,transparent)] flex items-center justify-center z-50">
          <div className="h-full max-h-dvh w-full space-y-4 overflow-y-auto bg-card p-4 shadow-2xl sm:h-auto sm:max-h-[90vh] sm:w-[550px] sm:rounded-2xl sm:p-6">
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
              placeholder="Prix (ou laisser vide si options avec prix) *"
              type="number"
              min="0"
              step="1"
              value={productForm.price}
              onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
              className="h-12 rounded-xl bg-secondary/30 border-none"
            />

            <select
              className="w-full border-none bg-secondary/30 p-3 rounded-xl"
              value={productForm.categoryId}
              onChange={(e) => {
                const categoryId = e.target.value
                const category = categories?.find((cat: any) => cat.id === categoryId)
                setProductForm({
                  ...productForm,
                  categoryId,
                  preparationMode: getDefaultPreparationMode(category?.name || ""),
                })
              }}
            >
              <option value="">Sélectionner une catégorie</option>
              {categories?.map((cat: any) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>

            <div className="space-y-2 rounded-xl bg-secondary/30 p-3">
              <label htmlFor="preparationMode" className="text-sm font-semibold">
                Mode de traitement du produit
              </label>
              <select
                id="preparationMode"
                className="w-full border-none bg-background p-3 rounded-xl"
                value={productForm.preparationMode}
                onChange={(e) =>
                  setProductForm({
                    ...productForm,
                    preparationMode: e.target.value as PreparationMode,
                  })
                }
              >
                {PREPARATION_MODES.map((mode) => (
                  <option key={mode.value} value={mode.value}>
                    {mode.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Cuisine : envoyé en cuisine. Service direct : servi immédiatement (eau, soda…). Bar : préparé au bar (jus, café…).
              </p>
            </div>

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

            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                  💰 Coût estimé : {Math.round(draftEstimatedCost)} FCFA
                </Badge>
                {draftHasComplexConsumption ? (
                  <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                    🔥 Consommation variable
                  </Badge>
                ) : null}
                {!draftHasTrackedConsumption ? (
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                    ⚠️ Recette non configurée
                  </Badge>
                ) : null}
              </div>
              {!draftHasTrackedConsumption ? (
                <p className="text-xs font-medium text-yellow-800">Inventaire non suivi pour ce produit.</p>
              ) : null}
            </div>

            <div className="border-t pt-4">
              <RecipeEditor
                recipe={recipe}
                setRecipe={setRecipe}
                inventoryItems={inventoryItems || []}
              />
            </div>

            <div className="border-t pt-4">
              <OptionEditor options={options} setOptions={setOptions} inventoryItems={inventoryItems || []} />
            </div>

            <LinkedOptionsEditor
              groups={linkedOptionGroups}
              setGroups={setLinkedOptionGroups}
              categories={(categories || []).map((category: any) => ({
                id: category.id,
                name: category.name,
              }))}
              products={(products || []).map((product: any) => ({
                id: product.id,
                name: product.name,
                categoryId: product.categoryId,
                isActive: product.isActive,
              }))}
            />

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

      {/* PREVIEW MODAL - 🔥 MODIFIED TO SHOW FINAL PRICES */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="h-dvh max-h-dvh max-w-none overflow-y-auto sm:h-auto sm:max-h-[90vh] sm:max-w-2xl">
          {previewProduct && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold">Aperçu produit</DialogTitle>
                <DialogDescription>
                  Prévisualisation du produit tel qu'il apparaît dans le menu client.
                </DialogDescription>
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
                    {previewProduct.basePrice > 0 && (
                      <span className="text-2xl font-bold text-primary">{previewProduct.basePrice} FCFA</span>
                    )}
                  </div>

                  {previewProduct.description && (
                    <p className="text-gray-600 leading-relaxed">{previewProduct.description}</p>
                  )}

                  <div className="pt-2 flex flex-wrap gap-2">
                    <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                      {categories?.find((c: any) => c.id === previewProduct.categoryId)?.name || "Sans catégorie"}
                    </Badge>
                    <PreparationBadge
                      item={{
                        preparationMode: previewProduct.preparationMode,
                        categoryName: categories?.find((c: any) => c.id === previewProduct.categoryId)?.name,
                      }}
                    />
                  </div>
                </div>

                {previewProduct.options && previewProduct.options.length > 0 && (
                  <div className="space-y-4 border-t pt-4">
                    <h4 className="font-semibold text-lg">Options disponibles</h4>
                    
                    {previewProduct.options.map((option: any, idx: number) => (
                      <div key={idx} className="space-y-2 bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-900">{option.name}</span>
                          {option.required && (
                            <Badge variant="destructive" className="text-xs bg-red-100 text-red-700">
                              Obligatoire
                            </Badge>
                          )}
                          {option.multiple && (
                            <Badge variant="outline" className="text-xs">
                              Multi-sélection
                            </Badge>
                          )}
                        </div>
                        
                        <div className="space-y-1 pl-2">
                          {option.choices.map((choice: any, cIdx: number) => (
                            <div key={cIdx} className="flex justify-between items-center text-sm">
                              <span className="text-gray-600">{choice.name}</span>
                              <span className="text-primary font-medium">{choice.price} FCFA</span>
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

      {restaurantId && (
        <MenuLibraryImportDialog
          open={isLibraryImportOpen}
          restaurantId={restaurantId}
          existingCategories={categories || []}
          existingProducts={products || []}
          onClose={() => setIsLibraryImportOpen(false)}
          onImported={refreshCatalog}
        />
      )}

      {/* IMAGE PICKER MODALS */}
      {restaurantId && (
        <ImagePickerModal
          open={isCategoryImagePickerOpen}
          restaurantId={restaurantId!}
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
          restaurantId={restaurantId!}
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

function ManagerDashboardPage({ restaurantId }: { restaurantId: string | null }) {
  const db = useFirestore()
  const now = useLiveNow()
  const { restaurant } = useRestaurant()
  const { filter } = useTimeFilter()
  const orderRange = React.useMemo(() => getDateRange(filter), [filter])
  const {
    cashSessionRequests,
    cashSessions,
    pendingCashValidationCount,
    payments,
  } = useRestaurantLiveData()
  const {
    counts: orderCounts,
    error: ordersError,
    isLoading,
  } = useManagerOperationalOrders(db, restaurantId, orderRange, now)

  const cashMovementsQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.CASH_MOVEMENTS)
  }, [db, restaurantId])
  const { data: cashMovements } = useCollection<any>(cashMovementsQuery)
  const inventoryItemsQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, "inventoryItems")
  }, [db, restaurantId])
  const { data: dashboardInventoryItems } = useCollection<any>(inventoryItemsQuery)
  const inventoryAlertsQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return query(
      collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, "inventoryAlerts"),
      where("resolved", "==", false)
    )
  }, [db, restaurantId])
  const { data: dashboardInventoryAlerts } = useCollection<any>(inventoryAlertsQuery)

  React.useEffect(() => {
    if (ordersError) {
      console.error("Failed to load manager dashboard operational orders", ordersError)
    }
  }, [ordersError])

  const activeCashSession = cashSessions.find((session: any) => session.status === "open") ?? null
  const activeCashSessionId = activeCashSession?.id ?? null
  const financialScope = React.useMemo(
    () =>
      activeCashSessionId
        ? ({ mode: "session", sessionId: activeCashSessionId } as const)
        : ({ mode: "global", sessionId: null } as const),
    [activeCashSessionId]
  )
  const businessTimeZone = getSupportedBusinessTimeZone(restaurant?.timezone)
  const pendingSessionRequests = cashSessionRequests
  const activeOperationalCount = orderCounts.pending + orderCounts.preparing + orderCounts.ready
  const inventorySummary = React.useMemo(
    () => getDashboardInventorySummary(dashboardInventoryItems || [], dashboardInventoryAlerts || []),
    [dashboardInventoryAlerts, dashboardInventoryItems]
  )
  const financialSummary = React.useMemo(
    () =>
      getFinancialSummary({
        movements: cashMovements || [],
        payments: payments || [],
        scope: financialScope,
        businessTimeZone,
        nowMs: now,
      }),
    [businessTimeZone, cashMovements, financialScope, now, payments]
  )

  if (!restaurantId) {
    return <div className="p-6 text-muted-foreground">Restaurant non disponible.</div>
  }

  return (
    <main className="space-y-4 pb-20 md:pb-6">
      <section className="rounded-xl border bg-card p-3 shadow-sm md:p-4">
        <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight text-primary md:text-2xl">Dashboard</h1>
            <p className="text-xs font-semibold text-muted-foreground md:text-sm">
              Situation du restaurant et points d'intervention.
            </p>
          </div>
          <Button asChild variant="outline" className="mt-2 h-9 w-full font-black md:mt-0 md:w-auto">
            <Link href="/manager/commandes">Ouvrir Commandes</Link>
          </Button>
        </div>
      </section>

      {ordersError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700 md:text-sm">
          Impossible de charger les commandes de la periode. Consultez la console pour le detail Firestore.
        </div>
      ) : null}

      <DashboardSection title="Activité du restaurant">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <DashboardPilotCard href="/manager/commandes" icon={ClipboardList} label="Commandes actives" value={activeOperationalCount} />
          <DashboardPilotCard href="/manager/caisse?filter=payments" icon={Wallet} label="À encaisser" value={orderCounts.cash_due} danger={orderCounts.cash_due > 0} />
          <DashboardPilotCard href="/manager/commandes?status=late" icon={AlertTriangle} label="Retards" value={orderCounts.late} danger={orderCounts.late > 0} />
          <DashboardPilotCard href="/manager/commandes?status=completed" icon={ShieldCheck} label="Terminées aujourd'hui" value={orderCounts.completed} />
        </div>
      </DashboardSection>

      <DashboardSection title="Finances">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <DashboardPilotCard href="/manager/caisse" icon={ReceiptText} label="CA du jour" value={`${financialSummary.todayDeposits.toLocaleString()} FCFA`} />
          <DashboardPilotCard href="/manager/depenses" icon={Banknote} label="Dépenses du jour" value={`${financialSummary.todayExpenses.toLocaleString()} FCFA`} danger={financialSummary.todayExpenses > 0} />
          <DashboardPilotCard href="/manager/tresorerie" icon={Wallet} label="Solde caisse" value={`${financialSummary.balance.toLocaleString()} FCFA`} danger={financialSummary.balance < 0} />
        </div>
      </DashboardSection>

      <DashboardSection title="Inventaire" action={<Button asChild variant="outline" size="sm" className="font-black"><Link href="/manager/inventory">Voir Inventaire</Link></Button>}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <DashboardPilotCard href="/manager/inventory" icon={PackageCheck} label="Produits en rupture" value={inventorySummary.outOfStockCount} danger={inventorySummary.outOfStockCount > 0} />
          <DashboardPilotCard href="/manager/inventory" icon={AlertTriangle} label="Stock faible" value={inventorySummary.lowStockCount} danger={inventorySummary.lowStockCount > 0} />
          <DashboardPilotCard href="/manager/inventory" icon={Banknote} label="Valeur estimée du stock" value={`${inventorySummary.stockValue.toLocaleString()} FCFA`} />
        </div>
      </DashboardSection>

      <DashboardSection title="Alertes">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          <DashboardAlert href="/manager/commandes?status=late" label="Commande en retard" value={orderCounts.late} active={orderCounts.late > 0} />
          <DashboardAlert href="/manager/caisse" label="Demande ouverture caisse" value={pendingSessionRequests.length} active={pendingSessionRequests.length > 0} />
          <DashboardAlert href="/manager/caisse" label="Caisse à valider" value={pendingCashValidationCount} active={pendingCashValidationCount > 0} />
          <DashboardAlert href="/manager/inventory" label="Stock faible" value={inventorySummary.lowStockCount} active={inventorySummary.lowStockCount > 0} />
          <DashboardAlert href="/manager/inventory" label="Rupture stock" value={inventorySummary.outOfStockCount} active={inventorySummary.outOfStockCount > 0} />
        </div>
      </DashboardSection>

      <DashboardSection title="Accès rapides">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <DashboardQuickLink href="/manager/commandes" icon={ClipboardList} label="Commandes" />
          <DashboardQuickLink href="/manager/caisse" icon={Wallet} label="Caisse" />
          <DashboardQuickLink href="/manager/tresorerie" icon={Banknote} label="Trésorerie" />
          <DashboardQuickLink href="/manager/depenses" icon={ReceiptText} label="Dépenses" />
          <DashboardQuickLink href="/manager/inventory" icon={PackageCheck} label="Inventaire" />
        </div>
      </DashboardSection>

      {isLoading ? (
        <div className="rounded-xl border bg-card p-6 text-center text-muted-foreground md:rounded-2xl md:p-8">Chargement...</div>
      ) : null}
    </main>
  )
}

function DashboardSection({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="space-y-2 rounded-xl border bg-card/95 p-3 shadow-sm md:p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-black uppercase tracking-tight">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function DashboardPilotCard({
  href,
  icon: Icon,
  label,
  value,
  danger,
}: {
  href: string
  icon: React.ElementType
  label: string
  value: React.ReactNode
  danger?: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-xl border bg-background p-3 shadow-sm transition hover:border-primary/40 hover:bg-muted/30",
        danger && "border-red-300 bg-red-50/80 hover:border-red-400 dark:border-red-900 dark:bg-red-950/20"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-black uppercase text-muted-foreground">{label}</p>
          <p className={cn("mt-1 truncate text-xl font-black leading-tight", danger && "text-red-600")}>{value}</p>
        </div>
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary", danger && "bg-red-100 text-red-600 dark:bg-red-500/15")}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </Link>
  )
}

function DashboardAlert({
  href,
  label,
  value,
  active,
}: {
  href: string
  label: string
  value: number
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-12 items-center justify-between gap-3 rounded-xl border bg-background px-3 py-2 text-sm font-bold transition hover:border-primary/40 hover:bg-muted/30",
        active && "border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300"
      )}
    >
      <span className="min-w-0 truncate">{label}</span>
      <span className={cn("rounded-full bg-muted px-2.5 py-1 text-xs font-black text-foreground", active && "bg-red-600 text-white")}>
        {value}
      </span>
    </Link>
  )
}

function DashboardQuickLink({
  href,
  icon: Icon,
  label,
}: {
  href: string
  icon: React.ElementType
  label: string
}) {
  return (
    <Button asChild variant="outline" className="h-12 justify-start gap-2 rounded-xl font-black">
      <Link href={href}>
        <Icon className="h-4 w-4" />
        {label}
      </Link>
    </Button>
  )
}

function getDashboardInventorySummary(items: any[], alerts: any[]) {
  const outOfStockAlertIds = new Set(
    alerts
      .filter((alert) => alert.type === "out_of_stock" || alert.type === "rupture")
      .map((alert) => alert.itemId)
      .filter(Boolean)
  )
  const lowStockAlertIds = new Set(
    alerts
      .filter((alert) => alert.type === "low_stock")
      .map((alert) => alert.itemId)
      .filter(Boolean)
  )
  const outOfStockCount = items.filter((item) => Number(item.stockEstimated || 0) <= 0 || outOfStockAlertIds.has(item.id)).length
  const lowStockCount = items.filter((item) => {
    const stock = Number(item.stockEstimated || 0)
    const threshold = Number(item.minThreshold || 0)
    return stock > 0 && ((threshold > 0 && stock <= threshold) || lowStockAlertIds.has(item.id))
  }).length
  const stockValue = items.reduce((sum, item) => {
    return sum + Math.max(0, Number(item.stockEstimated || 0)) * Math.max(0, Number(item.costPerUnit || 0))
  }, 0)

  return {
    outOfStockCount,
    lowStockCount,
    stockValue: Math.round(stockValue),
  }
}

function useManagerOperationalOrders(
  db: ReturnType<typeof useFirestore>,
  restaurantId: string | null,
  orderRange: ManagerOrderDateRange,
  now: number
) {
  const periodOrdersQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return query(
      collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.ORDERS),
      where("createdAt", ">=", Timestamp.fromDate(orderRange.startDate)),
      where("createdAt", "<=", Timestamp.fromDate(orderRange.endDate)),
      orderBy("createdAt", "desc"),
      limit(MANAGER_ORDERS_QUERY_LIMIT)
    )
  }, [db, orderRange.endDate, orderRange.startDate, restaurantId])
  const activeKitchenStatusOrdersQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return query(
      collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.ORDERS),
      where("kitchenStatus", "in", [
        ORDER_OPERATION_STATUS.PENDING,
        ORDER_OPERATION_STATUS.IN_PREPARATION,
        ORDER_OPERATION_STATUS.READY,
        ORDER_OPERATION_STATUS.SERVED,
        ORDER_OPERATION_STATUS.PICKED_UP,
      ]),
      limit(MANAGER_OPERATIONAL_ORDERS_QUERY_LIMIT)
    )
  }, [db, restaurantId])
  const activeStatusOrdersQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return query(
      collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.ORDERS),
      where("status", "in", [
        ORDER_OPERATION_STATUS.PENDING,
        ORDER_OPERATION_STATUS.IN_PREPARATION,
        ORDER_OPERATION_STATUS.READY,
        ORDER_OPERATION_STATUS.SERVED,
        ORDER_OPERATION_STATUS.PICKED_UP,
      ]),
      limit(MANAGER_OPERATIONAL_ORDERS_QUERY_LIMIT)
    )
  }, [db, restaurantId])
  const activeOrderStatusOrdersQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return query(
      collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.ORDERS),
      where("orderStatus", "in", [
        ORDER_OPERATION_STATUS.PENDING,
        ORDER_OPERATION_STATUS.IN_PREPARATION,
        ORDER_OPERATION_STATUS.READY,
        ORDER_OPERATION_STATUS.SERVED,
        ORDER_OPERATION_STATUS.PICKED_UP,
      ]),
      limit(MANAGER_OPERATIONAL_ORDERS_QUERY_LIMIT)
    )
  }, [db, restaurantId])
  const { data: periodOrders, error: periodOrdersError, isLoading: isPeriodLoading } = useCollection<any>(periodOrdersQuery)
  const { data: activeKitchenStatusOrders, error: activeKitchenStatusOrdersError, isLoading: isActiveKitchenStatusLoading } = useCollection<any>(activeKitchenStatusOrdersQuery)
  const { data: activeStatusOrders, error: activeStatusOrdersError, isLoading: isActiveStatusLoading } = useCollection<any>(activeStatusOrdersQuery)
  const { data: activeOrderStatusOrders, error: activeOrderStatusOrdersError, isLoading: isActiveOrderStatusLoading } = useCollection<any>(activeOrderStatusOrdersQuery)
  const error = periodOrdersError || activeKitchenStatusOrdersError || activeStatusOrdersError || activeOrderStatusOrdersError
  const isLoading = isPeriodLoading || isActiveKitchenStatusLoading || isActiveStatusLoading || isActiveOrderStatusLoading
  const mergedOrders = React.useMemo(
    () => mergeManagerOrders(periodOrders || [], activeKitchenStatusOrders || [], activeStatusOrders || [], activeOrderStatusOrders || []),
    [activeKitchenStatusOrders, activeOrderStatusOrders, activeStatusOrders, periodOrders]
  )
  const orderedOrders = React.useMemo(() => sortManagerOrders(mergedOrders, now, orderRange), [mergedOrders, now, orderRange])
  const counts = React.useMemo(() => getManagerOrderCountsFromOrders(orderedOrders, now, orderRange), [now, orderedOrders, orderRange])

  return {
    counts,
    error,
    isLoading,
    orderedOrders,
  }
}

function ManagerMetric({
  title,
  value,
  danger,
  href,
  dominant,
}: {
  title: string
  value: React.ReactNode
  danger?: boolean
  href?: string
  dominant?: boolean
}) {
  const className = [
    "block rounded-xl border bg-card p-3 shadow-sm transition hover:border-primary/40 hover:bg-muted/30 md:rounded-2xl",
    dominant ? "md:col-span-2 md:p-5" : "",
    danger ? "border-red-300 bg-red-50/80 hover:border-red-400 dark:border-red-900 dark:bg-red-950/20" : "",
  ].filter(Boolean).join(" ")
  const content = (
    <>
      <p className={`text-xs font-black uppercase ${danger ? "text-red-700 dark:text-red-300" : "text-muted-foreground"}`}>{title}</p>
      <p className={`mt-1 font-black ${dominant ? "text-3xl md:text-5xl" : "text-2xl"} ${danger ? "text-red-600" : "text-primary"}`}>{value}</p>
    </>
  )

  if (href) {
    return (
      <Link href={href} className={className} aria-label={`Voir les commandes ${title.toLowerCase()}`}>
        {content}
      </Link>
    )
  }

  return <div className={className}>{content}</div>
}

function SectionTitle({ title }: { title: string }) {
  return <h2 className="text-sm font-black uppercase tracking-tight md:text-lg">{title}</h2>
}

function RecipeEditor({
  recipe,
  setRecipe,
  inventoryItems,
}: {
  recipe: any[]
  setRecipe: (recipe: any[]) => void
  inventoryItems: any[]
}) {
  const addIngredient = () => {
    if (recipe.length >= 5) return
    const firstAvailable = inventoryItems.find((item) => !recipe.some((line) => line.inventoryItemId === item.id))
    setRecipe([
      ...recipe,
      {
        inventoryItemId: firstAvailable?.id || "",
        quantity: 1,
      },
    ])
  }

  const updateIngredient = (index: number, field: "inventoryItemId" | "quantity", value: string | number) => {
    const nextRecipe = [...recipe]
    nextRecipe[index] = {
      ...nextRecipe[index],
      [field]: field === "quantity" ? Number(value) : value,
    }
    setRecipe(nextRecipe)
  }

  const removeIngredient = (index: number) => {
    setRecipe(recipe.filter((_, currentIndex) => currentIndex !== index))
  }

  const estimatedCost = recipe.reduce((total, line) => {
    const item = inventoryItems.find((entry) => entry.id === line.inventoryItemId)
    return total + Number(line.quantity || 0) * Number(item?.costPerUnit || 0)
  }, 0)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black">🍳 Recette</h3>
          <p className="text-xs text-muted-foreground">
            Ingrédients déduits automatiquement après vente.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={addIngredient}
          disabled={recipe.length >= 5 || inventoryItems.length === 0}
        >
          <Plus className="mr-2 h-4 w-4" />
          Ajouter ingrédient
        </Button>
      </div>

      {recipe.length === 0 ? (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-xs font-bold text-orange-700">
          ⚠ aucune recette → inventaire non suivi
        </div>
      ) : (
        <div className="space-y-2">
          {recipe.map((line, index) => (
            <div key={`${line.inventoryItemId || "new"}-${index}`} className="grid gap-2 rounded-lg border bg-background p-2 sm:grid-cols-[1fr_120px_40px]">
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={line.inventoryItemId || ""}
                onChange={(event) => updateIngredient(index, "inventoryItemId", event.target.value)}
              >
                <option value="">Choisir ingrédient</option>
                {inventoryItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {getInventoryItemName(item)}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                min={0}
                step="0.05"
                value={line.quantity ?? ""}
                onChange={(event) => updateIngredient(index, "quantity", event.target.value)}
                placeholder="Qté"
              />
              <Button type="button" variant="ghost" size="icon" onClick={() => removeIngredient(index)}>
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {recipe.length > 0 ? (
        <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2 text-xs">
          <span className="font-bold text-muted-foreground">Coût estimé produit</span>
          <span className="font-black">{Math.round(estimatedCost).toLocaleString()} FCFA</span>
        </div>
      ) : null}
    </div>
  )
}

function AlertRow({
  label,
  context,
  action,
  value,
  danger,
  href,
}: {
  label: string
  context: string
  action: string
  value: number
  danger?: boolean
  href?: string
}) {
  const className = [
    "flex items-center justify-between gap-3 rounded-xl border bg-background px-3 py-2 transition hover:border-primary/40 hover:bg-muted/30",
    danger ? "border-red-200 bg-red-50/80 dark:border-red-400/30 dark:bg-red-500/10" : "",
  ].filter(Boolean).join(" ")
  const content = (
    <>
      <span className="min-w-0">
        <span className="block truncate text-xs font-black md:text-sm">{label}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{context}</span>
      </span>
      <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${value > 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
        {action}
      </span>
    </>
  )

  if (href) {
    return (
      <Link href={href} className={className} aria-label={label}>
        {content}
      </Link>
    )
  }

  return <div className={className}>{content}</div>
}

function KitchenProductionCard({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: "orange" | "blue" | "purple" | "green"
}) {
  const toneClassName = {
    orange: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-400/30 dark:bg-orange-500/10 dark:text-orange-300",
    blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/30 dark:bg-blue-500/10 dark:text-blue-300",
    purple: "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-400/30 dark:bg-purple-500/10 dark:text-purple-300",
    green: "border-green-200 bg-green-50 text-green-700 dark:border-green-400/30 dark:bg-green-500/10 dark:text-green-300",
  }[tone]

  return (
    <div className={`rounded-xl border p-3 ${toneClassName}`}>
      <p className="text-[10px] font-black uppercase leading-tight">{label}</p>
      <p className="mt-1 text-2xl font-black leading-none">{value}</p>
    </div>
  )
}

function ManagerOrdersPage({ restaurantId }: { restaurantId: string | null }) {
  const db = useFirestore()
  const searchParams = useSearchParams()
  const now = useLiveNow()
  const { filter } = useTimeFilter()
  const orderRange = React.useMemo(() => getDateRange(filter), [filter])
  const initialTab = normalizeOrderTab(searchParams?.get("status") ?? null)
  const [activeTab, setActiveTab] = React.useState(initialTab)
  const [selectedOrderDetailId, setSelectedOrderDetailId] = React.useState<string | null>(null)
  const [visibleLimit, setVisibleLimit] = React.useState(MANAGER_ORDERS_PAGE_SIZE)
  const {
    counts,
    error: ordersError,
    isLoading,
    orderedOrders,
  } = useManagerOperationalOrders(db, restaurantId, orderRange, now)
  const activeTabOrders = React.useMemo(
    () => orderedOrders.filter((order) => matchesManagerOrderTab(order, activeTab, now, orderRange)),
    [activeTab, now, orderedOrders, orderRange]
  )
  const visibleOrders = React.useMemo(
    () => activeTabOrders.slice(0, visibleLimit),
    [activeTabOrders, visibleLimit]
  )
  const selectedOrderDetail = React.useMemo(
    () => orderedOrders.find((order: any) => order.id === selectedOrderDetailId) ?? null,
    [orderedOrders, selectedOrderDetailId]
  )
  const hasMore = visibleOrders.length < activeTabOrders.length

  React.useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  React.useEffect(() => {
    setVisibleLimit(MANAGER_ORDERS_PAGE_SIZE)
    setSelectedOrderDetailId(null)
  }, [activeTab, orderRange.endDate, orderRange.startDate])

  React.useEffect(() => {
    if (ordersError) {
      console.error("Failed to load manager operational orders", ordersError)
    }
  }, [ordersError])

  if (!restaurantId) {
    return <div className="p-6 text-muted-foreground">Restaurant non disponible.</div>
  }

  return (
    <main className="space-y-4 pb-20 md:pb-6">
      <p className="text-xs font-bold text-muted-foreground">
        Commandes nécessitant une action, avec les commandes terminées sur la période sélectionnée.
      </p>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <ManagerOrderKpiCard active={activeTab === "pending"} label="En attente" count={counts.pending} tone="orange" onClick={() => setActiveTab("pending")} />
        <ManagerOrderKpiCard active={activeTab === "preparing"} label="En préparation" count={counts.preparing} tone="amber" onClick={() => setActiveTab("preparing")} />
        <ManagerOrderKpiCard active={activeTab === "ready"} label="Prêtes" count={counts.ready} tone="sky" onClick={() => setActiveTab("ready")} />
        <ManagerOrderKpiCard active={activeTab === "cash_due"} label="À encaisser" count={counts.cash_due} tone="indigo" onClick={() => setActiveTab("cash_due")} />
        <ManagerOrderKpiCard active={activeTab === "completed"} label="Terminées" count={counts.completed} tone="emerald" onClick={() => setActiveTab("completed")} />
        <ManagerOrderKpiCard active={activeTab === "late"} label="Retard" count={counts.late} tone="red" onClick={() => setActiveTab("late")} />
      </section>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(normalizeOrderTab(value))} className="space-y-4">
        {MANAGER_ORDER_TABS.map((tab) => (
          <TabsContent key={tab} value={tab} className="space-y-3">
            {ordersError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-700">
                Impossible de charger les commandes operationnelles. Consultez la console pour le detail Firestore.
              </div>
            ) : isLoading ? (
              <div className="rounded-xl border bg-card p-6 text-center text-muted-foreground">Chargement...</div>
            ) : visibleOrders.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
                Aucune commande dans cet etat.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {visibleOrders.map((order: any) => (
                    <ManagerOrderCard
                      key={order.id}
                      order={order}
                      now={now}
                      range={orderRange}
                      onOpenDetails={() => setSelectedOrderDetailId(order.id)}
                    />
                  ))}
                </div>
                {hasMore ? (
                  <div className="flex justify-center pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setVisibleLimit((current) => current + MANAGER_ORDERS_PAGE_SIZE)}
                      disabled={isLoading}
                    >
                      Charger plus
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <ManagerOrderDetailDialog
        order={selectedOrderDetail}
        now={now}
        range={orderRange}
        onClose={() => setSelectedOrderDetailId(null)}
      />
    </main>
  )
}

function ManagerOrderKpiCard({
  label,
  count,
  tone,
  active,
  onClick,
}: {
  label: string
  count: number
  tone: "orange" | "amber" | "sky" | "indigo" | "emerald" | "red"
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border bg-card p-3 text-left shadow-sm transition hover:bg-muted/40",
        active && "ring-2 ring-primary/30",
        tone === "orange" && "border-orange-200",
        tone === "amber" && "border-amber-200",
        tone === "sky" && "border-sky-200",
        tone === "indigo" && "border-indigo-200",
        tone === "emerald" && "border-emerald-200",
        tone === "red" && "border-red-200"
      )}
    >
      <p className="truncate text-[10px] font-black uppercase text-muted-foreground">{label}</p>
      <p className={cn(
        "mt-1 text-2xl font-black leading-none",
        tone === "orange" && "text-orange-600",
        tone === "amber" && "text-amber-600",
        tone === "sky" && "text-sky-600",
        tone === "indigo" && "text-indigo-600",
        tone === "emerald" && "text-emerald-600",
        tone === "red" && "text-red-600"
      )}>
        {count}
      </p>
    </button>
  )
}

type ManagerOrderTab = "pending" | "preparing" | "ready" | "cash_due" | "completed" | "late"

type ManagerOrderCounts = Record<ManagerOrderTab, number>

type ManagerOrderDateRange = {
  startDate: Date
  endDate: Date
}

type ManagerOperationalStateResult = {
  state: ManagerOrderTab | null
  label: string
  eventAtMs: number
}

const MANAGER_ORDER_TABS: ManagerOrderTab[] = ["pending", "preparing", "ready", "cash_due", "completed", "late"]
const MANAGER_ORDERS_PAGE_SIZE = 30
const MANAGER_ORDERS_QUERY_LIMIT = 500
const MANAGER_OPERATIONAL_ORDERS_QUERY_LIMIT = 500

const EMPTY_MANAGER_ORDER_COUNTS: ManagerOrderCounts = {
  pending: 0,
  preparing: 0,
  ready: 0,
  cash_due: 0,
  completed: 0,
  late: 0,
}

function getManagerOrderCountsFromOrders(orders: any[], now: number, range: ManagerOrderDateRange): ManagerOrderCounts {
  return orders.reduce(
    (counts, order) => {
      MANAGER_ORDER_TABS.forEach((tab) => {
        if (matchesManagerOrderTab(order, tab, now, range)) counts[tab] += 1
      })
      return counts
    },
    { ...EMPTY_MANAGER_ORDER_COUNTS }
  )
}

function matchesManagerOrderTab(order: any, tab: ManagerOrderTab, now: number, range: ManagerOrderDateRange) {
  if (tab === "late") return isLateOrder(order, now)
  return getManagerOperationalState(order, now, range).state === tab
}

function getManagerOperationalState(order: any, now: number, range: ManagerOrderDateRange): ManagerOperationalStateResult {
  const status = getOrderStatus(order)
  const type = getNormalizedManagerOrderType(order)
  const paid = isOrderPaid(order)
  const served = isKitchenServedStatus(status)

  if (served && paid) {
    const eventAtMs = getManagerCompletedEventMs(order, now)
    return isWithinManagerRange(eventAtMs, range)
      ? { state: "completed", label: "Terminée", eventAtMs }
      : { state: null, label: "Terminée", eventAtMs }
  }

  if (served && type === "dine_in" && !paid) {
    return { state: "cash_due", label: "À encaisser", eventAtMs: getManagerCashDueEventMs(order, now) }
  }

  if (status === ORDER_OPERATION_STATUS.PENDING) {
    return { state: "pending", label: "En attente", eventAtMs: getManagerOperationalEventMs(order, "pending", now) }
  }

  if (status === ORDER_OPERATION_STATUS.IN_PREPARATION) {
    return { state: "preparing", label: "En préparation", eventAtMs: getManagerOperationalEventMs(order, "preparing", now) }
  }

  if (status === ORDER_OPERATION_STATUS.READY) {
    return { state: "ready", label: "Prête", eventAtMs: getManagerOperationalEventMs(order, "ready", now) }
  }

  return { state: null, label: formatManagerStatus(status), eventAtMs: getManagerOperationalEventMs(order, "pending", now) }
}

function ManagerOrderCard({
  order,
  now,
  range,
  onOpenDetails,
}: {
  order: any
  now: number
  range: ManagerOrderDateRange
  onOpenDetails: () => void
}) {
  const operationalState = getManagerOperationalState(order, now, range)
  const minutes = getManagerEventAgeMinutes(operationalState.eventAtMs, now)
  const late = isLateOrder(order, now)
  const nearLate = isNearLateOrder(order, now)
  const items = order.items || []
  const visibleItems = items.slice(0, 2)
  const hiddenItemsCount = Math.max(0, items.length - visibleItems.length)
  const orderType = getManagerOrderType(order)
  const total = Number(order.total ?? order.totalAmount ?? 0)
  const itemCount = getManagerOrderItemCount(order)
  const location = getManagerOrderLocation(order)
  const preparationFlow = getManagerOrderPreparationFlow(order)
  const cardClassName = [
    "min-w-0 rounded-xl border bg-card p-3 shadow-sm transition",
    late ? "border-red-300 bg-red-50/70 dark:border-red-900 dark:bg-red-950/20" : "",
    !late && nearLate ? "border-orange-300 bg-orange-50/70 dark:border-orange-900 dark:bg-orange-950/20" : "",
  ].filter(Boolean).join(" ")

  return (
    <article className={cardClassName}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <h2 className="truncate text-base font-black leading-tight">{getOrderDisplayId(order)}</h2>
          </div>
          <p className="truncate text-[11px] font-bold uppercase leading-tight text-muted-foreground">
            {orderType}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-base font-black leading-tight text-primary">{total.toLocaleString()}</p>
          <p className="text-[10px] font-bold uppercase leading-tight text-muted-foreground">FCFA</p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="h-6 px-2 text-[10px] font-black leading-none">
          {operationalState.label}
        </Badge>
        <span className={cn(
          "inline-flex h-6 items-center rounded-full px-2 text-[10px] font-black uppercase",
          preparationFlow === "kitchen" && "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-200",
          preparationFlow === "direct" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
          preparationFlow === "mixed" && "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200"
        )}>
          {formatManagerPreparationFlow(preparationFlow)}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-bold text-muted-foreground">
        <span className="flex min-w-0 items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{location}</span>
        </span>
        <span className="flex items-center justify-end gap-1.5">
          <PackageCheck className="h-3.5 w-3.5 shrink-0" />
          {itemCount} article{itemCount > 1 ? "s" : ""}
        </span>
      </div>

      {late ? (
        <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] font-bold leading-tight text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Action en retard</span>
        </div>
      ) : null}

      {!late && nearLate ? (
        <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-2 py-1.5 text-[11px] font-bold leading-tight text-orange-700 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-300">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Proche retard</span>
        </div>
      ) : null}

      <div className="mt-2 space-y-1 rounded-lg bg-muted/50 px-2.5 py-2">
        {visibleItems.map((item: any, index: number) => (
          <div key={`${order.id}-${item.productId || index}-${item.name || item.nameSnapshot}`} className="flex items-center justify-between gap-2 text-xs leading-tight">
            <span className="min-w-0 truncate font-semibold">{item.quantity}x {item.name || item.nameSnapshot}</span>
            <span className="shrink-0 text-[11px] font-medium text-muted-foreground">{Number(item.total ?? ((item.priceSnapshot ?? 0) * item.quantity)).toLocaleString()}</span>
          </div>
        ))}
        {hiddenItemsCount > 0 ? (
          <p className="text-[11px] font-bold leading-tight text-muted-foreground">+{hiddenItemsCount} autres</p>
        ) : null}
        {items.length === 0 ? (
          <p className="text-[11px] font-medium leading-tight text-muted-foreground">Aucun produit liste</p>
        ) : null}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className={`inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-black ${late ? "bg-red-500/10 text-red-600" : nearLate ? "bg-orange-500/10 text-orange-600" : "bg-muted text-muted-foreground"}`}>
          <Clock className="h-3.5 w-3.5" /> {minutes} min
        </span>
        <div className="flex min-w-0 items-center gap-1.5">
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs font-black" onClick={onOpenDetails}>
            Détail
          </Button>
        </div>
      </div>
    </article>
  )
}

function ManagerOrderDetailDialog({
  order,
  now,
  range,
  onClose,
}: {
  order: any | null
  now: number
  range: ManagerOrderDateRange
  onClose: () => void
}) {
  if (!order) return null

  const operationalState = getManagerOperationalState(order, now, range)
  const items = order.items || []
  const total = Number(order.total ?? order.totalAmount ?? 0)
  const minutes = getManagerEventAgeMinutes(operationalState.eventAtMs, now)

  return (
    <Dialog open={Boolean(order)} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-black">{getOrderDisplayId(order)}</DialogTitle>
          <DialogDescription>
            Détail de supervision opérationnelle.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <ManagerOrderDetailMeta label="Type" value={getManagerOrderType(order)} />
          <ManagerOrderDetailMeta label="État manager" value={operationalState.label} />
          <ManagerOrderDetailMeta label="Emplacement" value={getManagerOrderLocation(order)} />
          <ManagerOrderDetailMeta label="Temps depuis événement" value={`${minutes} min`} />
          <ManagerOrderDetailMeta label="Paiement" value={isOrderPaid(order) ? "Validé" : "Non validé"} />
          <ManagerOrderDetailMeta label="Total" value={`${total.toLocaleString()} FCFA`} />
        </div>

        <section className="mt-4 rounded-xl border bg-muted/20 p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-sm font-black uppercase tracking-tight">Articles</h3>
            <span className="text-xs font-bold text-muted-foreground">
              {getManagerOrderItemCount(order)} article{getManagerOrderItemCount(order) > 1 ? "s" : ""}
            </span>
          </div>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun produit liste</p>
          ) : (
            <div className="space-y-2">
              {items.map((item: any, index: number) => (
                <div key={`${order.id}-detail-${item.productId || index}-${item.name || item.nameSnapshot}`} className="flex items-center justify-between gap-3 rounded-lg bg-background px-3 py-2 text-sm">
                  <span className="min-w-0 truncate font-bold">{Number(item.quantity || 1)}x {item.name || item.nameSnapshot || "Article"}</span>
                  <span className="shrink-0 font-black">{Number(item.total ?? ((item.priceSnapshot ?? item.unitPrice ?? 0) * Number(item.quantity || 1))).toLocaleString()} FCFA</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </DialogContent>
    </Dialog>
  )
}

function ManagerOrderDetailMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-[10px] font-black uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-black">{value}</p>
    </div>
  )
}

function ManagerFinancialCard({
  icon: Icon,
  title,
  value,
  priority,
  danger,
}: {
  icon: React.ElementType
  title: string
  value: number
  priority?: boolean
  danger?: boolean
}) {
  return (
    <Card className={danger ? "border-orange-300" : undefined}>
      <CardContent className="p-3">
        <Icon className={`mb-2 h-4 w-4 ${danger ? "text-orange-600" : "text-primary"}`} />
        <p className="text-xs font-black uppercase text-muted-foreground">{title}</p>
        <p className={`mt-1 font-black leading-tight ${priority ? "text-2xl md:text-4xl" : "text-xl md:text-2xl"} ${danger ? "text-orange-600" : "text-foreground"}`}>
          {value.toLocaleString()} FCFA
        </p>
      </CardContent>
    </Card>
  )
}

function getManagerOrderType(order: any) {
  const type = getNormalizedManagerOrderType(order)
  if (type === "dine_in") return "Sur place"
  if (type === "delivery") return "Livraison"
  return "A emporter"
}

function getManagerOrderLocation(order: any) {
  const type = getNormalizedManagerOrderType(order)
  if (type === "delivery") {
    return order.deliveryAddress || order.address || order.customer?.address || order.customer?.neighborhood || "Quartier non renseigné"
  }

  if (type === "dine_in") {
    return order.tableName || order.table || order.tableId || "Table non renseignée"
  }

  return "Comptoir"
}

function getManagerOrderItemCount(order: any) {
  const items = Array.isArray(order.items) ? order.items : []
  return items.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0)
}

type ManagerPreparationFlow = "kitchen" | "direct" | "mixed"

function getManagerOrderPreparationFlow(order: any): ManagerPreparationFlow {
  const items = Array.isArray(order.items) ? order.items : []
  if (items.length === 0) return "direct"

  const hasKitchen = items.some((item: any) => item.preparationMode === "kitchen")
  const hasDirect = items.some((item: any) => item.preparationMode !== "kitchen")

  if (hasKitchen && hasDirect) return "mixed"
  if (hasKitchen) return "kitchen"
  return "direct"
}

function formatManagerPreparationFlow(flow: ManagerPreparationFlow) {
  if (flow === "kitchen") return "Cuisine"
  if (flow === "mixed") return "Mixte"
  return "Service direct"
}

function getNormalizedManagerOrderType(order: any) {
  const orderType = order.orderType || (order.type === "table" ? "dine_in" : order.type)
  if (orderType === "dine-in" || orderType === "table") return "dine_in"
  if (orderType === "takeaway") return "pickup"
  if (orderType === "delivery") return "delivery"
  if (orderType === "pickup") return "pickup"
  return "dine_in"
}

function mergeManagerOrders(...groups: any[][]) {
  const byId = new Map<string, any>()
  groups.flat().forEach((order) => {
    if (!order?.id) return
    byId.set(order.id, { ...(byId.get(order.id) || {}), ...order })
  })
  return Array.from(byId.values())
}

function getManagerTimestampMs(value: any): number | null {
  if (!value) return null
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (value instanceof Date) return value.getTime()
  if (typeof value === "string") {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  if (typeof value.toMillis === "function") return value.toMillis()
  if (typeof value.toDate === "function") return value.toDate().getTime()
  if (typeof value.seconds === "number") return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1000000)
  return null
}

function getFirstManagerTimestampMs(order: any, keys: string[], fallback = Date.now()) {
  for (const key of keys) {
    const parts = key.split(".")
    const value = parts.reduce((current: any, part) => current?.[part], order)
    const timestamp = getManagerTimestampMs(value)
    if (timestamp) return timestamp
  }
  return fallback
}

function getManagerOperationalEventMs(order: any, state: ManagerOrderTab, now = Date.now()) {
  if (state === "preparing") {
    return getFirstManagerTimestampMs(order, ["timestamps.preparingAt", "preparingAt", "createdAt"], now)
  }
  if (state === "ready") {
    return getFirstManagerTimestampMs(order, ["timestamps.readyAt", "readyAt", "timestamps.preparingAt", "preparingAt", "createdAt"], now)
  }
  if (state === "cash_due") {
    return getManagerCashDueEventMs(order, now)
  }
  if (state === "completed") {
    return getManagerCompletedEventMs(order, now)
  }
  return getFirstManagerTimestampMs(order, ["createdAt", "updatedAt"], now)
}

function getManagerCashDueEventMs(order: any, now = Date.now()) {
  return getFirstManagerTimestampMs(
    order,
    ["timestamps.servedAt", "timestamps.pickedUpAt", "timestamps.completedAt", "servedAt", "pickedUpAt", "completedAt", "createdAt"],
    now
  )
}

function getManagerCompletedEventMs(order: any, now = Date.now()) {
  return getFirstManagerTimestampMs(
    order,
    ["paidAt", "paymentPaidAt", "paymentValidatedAt", "payment.validatedAt", "payment.paidAt", "timestamps.paidAt", "createdAt"],
    now
  )
}

function isWithinManagerRange(timestampMs: number, range: ManagerOrderDateRange) {
  return timestampMs >= range.startDate.getTime() && timestampMs <= range.endDate.getTime()
}

function getManagerEventAgeMinutes(eventAtMs: number, now = Date.now()) {
  return Math.max(0, Math.floor((now - eventAtMs) / 60000))
}

function useLiveNow(intervalMs = 30000) {
  const [now, setNow] = React.useState(() => Date.now())

  React.useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(interval)
  }, [intervalMs])

  return now
}

function getOrderAgeMinutes(order: any, now = Date.now()) {
  const createdAt = order.createdAt?.toDate?.().getTime?.() ?? now
  return Math.max(0, Math.floor((now - createdAt) / 60000))
}

const LATE_ORDER_THRESHOLD_MINUTES = 20
const NEAR_LATE_ORDER_THRESHOLD_MINUTES = 15

function isLateOrder(order: any, now = Date.now()) {
  const status = getOrderStatus(order)
  return [ORDER_OPERATION_STATUS.PENDING, ORDER_OPERATION_STATUS.IN_PREPARATION, ORDER_OPERATION_STATUS.READY].includes(status as any) && getOrderAgeMinutes(order, now) > LATE_ORDER_THRESHOLD_MINUTES
}

function isNearLateOrder(order: any, now = Date.now()) {
  const status = getOrderStatus(order)
  const minutes = getOrderAgeMinutes(order, now)
  return [ORDER_OPERATION_STATUS.PENDING, ORDER_OPERATION_STATUS.IN_PREPARATION, ORDER_OPERATION_STATUS.READY].includes(status as any) && minutes >= NEAR_LATE_ORDER_THRESHOLD_MINUTES && minutes <= LATE_ORDER_THRESHOLD_MINUTES
}

function sortManagerOrders(orders: any[], now = Date.now(), range: ManagerOrderDateRange) {
  const priority: Record<ManagerOrderTab, number> = {
    late: 0,
    cash_due: 1,
    ready: 2,
    preparing: 3,
    pending: 4,
    completed: 5,
  }

  return [...orders]
    .filter((order) => getManagerOperationalState(order, now, range).state)
    .sort((a, b) => {
      const aState = getManagerOperationalState(a, now, range)
      const bState = getManagerOperationalState(b, now, range)
      const aPriority = aState.state ? priority[aState.state] : 99
      const bPriority = bState.state ? priority[bState.state] : 99
      if (aPriority !== bPriority) return aPriority - bPriority
      return bState.eventAtMs - aState.eventAtMs
    })
}

function normalizeOrderTab(value: string | null): ManagerOrderTab {
  if (value === "late") return "late"
  if (value === "preparing") return "preparing"
  if (value === "ready") return "ready"
  if (value === "cash_due") return "cash_due"
  if (value === "completed") return "completed"
  return "pending"
}

function isServedForPaymentAlert(order: any) {
  const status = getOrderStatus(order)
  return isKitchenServedStatus(status)
}

function getKitchenProductionStats(orders: any[]) {
  return orders.reduce(
    (stats, order) => {
      const status = getOrderStatus(order)
      if (status === ORDER_OPERATION_STATUS.PENDING) stats.pending += 1
      if (status === ORDER_OPERATION_STATUS.IN_PREPARATION) stats.preparing += 1
      if (status === ORDER_OPERATION_STATUS.READY) stats.ready += 1
      if (isKitchenServedStatus(status)) stats.served += 1
      return stats
    },
    { pending: 0, preparing: 0, ready: 0, served: 0 }
  )
}

function isKitchenServedStatus(status: string | null | undefined) {
  return (
    status === ORDER_OPERATION_STATUS.SERVED ||
    status === ORDER_OPERATION_STATUS.PICKED_UP ||
    status === ORDER_OPERATION_STATUS.COMPLETED
  )
}

function formatManagerStatus(status: string) {
  if (status === ORDER_OPERATION_STATUS.PENDING) return "En attente"
  if (status === ORDER_OPERATION_STATUS.IN_PREPARATION) return "En preparation"
  if (status === ORDER_OPERATION_STATUS.READY) return "Pret"
  if (status === ORDER_OPERATION_STATUS.SERVED) return "Servi"
  if (status === ORDER_OPERATION_STATUS.COMPLETED) return "Termine"
  return status
}

function normalizeRecipe(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((line: any) => ({
      inventoryItemId: String(line.inventoryItemId || line.itemId || line.ingredientId || ""),
      quantity: Number(line.quantity || line.qty || 0),
    }))
    .filter((line) => line.inventoryItemId && Number.isFinite(line.quantity) && line.quantity > 0)
    .slice(0, 5)
}

function sanitizeRecipe(value: unknown) {
  return normalizeRecipe(value).map((line) => ({
    inventoryItemId: line.inventoryItemId,
    quantity: Number(line.quantity),
  }))
}

function getInventoryItemName(item: any) {
  return typeof item?.name === "string" && item.name.trim() ? item.name.trim() : "Ingrédient sans nom"
}

function getAveragePrepTime(orders: any[]) {
  const durations = orders
    .map((order) => {
      const started = order.preparingAt?.toDate?.().getTime?.() ?? order.createdAt?.toDate?.().getTime?.()
      const ready = order.readyAt?.toDate?.().getTime?.()
      if (!started || !ready || ready < started) return null
      return Math.round((ready - started) / 60000)
    })
    .filter((value): value is number => typeof value === "number")

  if (!durations.length) return null
  return Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
}
