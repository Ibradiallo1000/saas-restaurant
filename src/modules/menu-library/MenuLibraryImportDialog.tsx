"use client"

import * as React from "react"
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore"
import { AlertTriangle, BookOpen, Check, ChefHat, Loader2, PackageOpen } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useFirestore, useMemoFirebase, useCollectionOnce } from "@/firebase"
import { useToast } from "@/hooks/use-toast"
import { COLLECTION_NAMES } from "@/lib/constants"
import { getMarketplaceCategoryIcon } from "@/lib/marketplace-category-icons"
import type { LinkedOptionGroup } from "@/lib/linked-option-groups"
import {
  policyFromLegacyReviewsEnabled,
  resolveProductReviewsEnabled,
} from "@/lib/product-review-policy"
import type {
  PlatformMenuCategoryTemplate,
  PlatformMenuPack,
  PlatformMenuProductTemplate,
} from "@/modules/menu-library/types"

type WithId<T> = T & { id: string }

type ImportMode = "pack" | "category" | "products"

type Props = {
  open: boolean
  restaurantId: string
  existingCategories: any[]
  existingProducts: any[]
  onClose: () => void
  onImported: () => void
}

type ImportSelection = {
  categoryTemplateIds: Set<string>
  productTemplateIds: Set<string>
}

export default function MenuLibraryImportDialog({
  open,
  restaurantId,
  existingCategories,
  existingProducts,
  onClose,
  onImported,
}: Props) {
  const db = useFirestore()
  const { toast } = useToast()
  const [mode, setMode] = React.useState<ImportMode>("pack")
  const [selectedPackId, setSelectedPackId] = React.useState("")
  const [selectedCategoryId, setSelectedCategoryId] = React.useState("")
  const [selectedProductIds, setSelectedProductIds] = React.useState<string[]>([])
  const [legacyImportReviewsEnabled, setLegacyImportReviewsEnabled] = React.useState<boolean | null>(null)
  const [legacyImportCategoryReviewsEnabled, setLegacyImportCategoryReviewsEnabled] = React.useState<boolean | null>(null)
  const [isImporting, setIsImporting] = React.useState(false)

  const packsQuery = useMemoFirebase(() => {
    if (!db || !open) return null
    return query(
      collection(db, COLLECTION_NAMES.PLATFORM_MENU_PACKS),
      orderBy("name", "asc"),
      limit(100)
    )
  }, [db, open])

  const categoriesQuery = useMemoFirebase(() => {
    if (!db || !open) return null
    return query(
      collection(db, COLLECTION_NAMES.PLATFORM_MENU_CATEGORIES),
      orderBy("order", "asc"),
      limit(200)
    )
  }, [db, open])

  const productsQuery = useMemoFirebase(() => {
    if (!db || !open) return null
    return query(
      collection(db, COLLECTION_NAMES.PLATFORM_MENU_PRODUCTS),
      orderBy("order", "asc"),
      limit(300)
    )
  }, [db, open])

  const { data: packs, isLoading: packsLoading } = useCollectionOnce<PlatformMenuPack>(packsQuery)
  const { data: categories, isLoading: categoriesLoading } =
    useCollectionOnce<PlatformMenuCategoryTemplate>(categoriesQuery)
  const { data: products, isLoading: productsLoading } =
    useCollectionOnce<PlatformMenuProductTemplate>(productsQuery)

  const activePacks = React.useMemo(
    () => (packs ?? []).filter((pack) => pack.isActive !== false),
    [packs]
  )
  const activeCategories = React.useMemo(
    () => (categories ?? []).filter((category) => category.isActive !== false),
    [categories]
  )
  const activeProducts = React.useMemo(
    () => (products ?? []).filter((product) => product.isActive !== false),
    [products]
  )

  const selection = React.useMemo<ImportSelection>(() => {
    if (mode === "pack" && selectedPackId) {
      const categoryTemplateIds = activeCategories
        .filter((category) => category.packIds?.includes(selectedPackId))
        .map((category) => category.id)
      const productTemplateIds = activeProducts
        .filter((product) => product.packIds?.includes(selectedPackId))
        .map((product) => product.id)

      productTemplateIds.forEach((productId) => {
        const product = activeProducts.find((item) => item.id === productId)
        if (product?.categoryTemplateId) categoryTemplateIds.push(product.categoryTemplateId)
      })

      return {
        categoryTemplateIds: new Set(categoryTemplateIds),
        productTemplateIds: new Set(productTemplateIds),
      }
    }

    if (mode === "category" && selectedCategoryId) {
      return {
        categoryTemplateIds: new Set([selectedCategoryId]),
        productTemplateIds: new Set(
          activeProducts
            .filter((product) => product.categoryTemplateId === selectedCategoryId)
            .map((product) => product.id)
        ),
      }
    }

    if (mode === "products") {
      const selectedProducts = activeProducts.filter((product) =>
        selectedProductIds.includes(product.id)
      )
      return {
        categoryTemplateIds: new Set(
          selectedProducts.map((product) => product.categoryTemplateId).filter(Boolean)
        ),
        productTemplateIds: new Set(selectedProductIds),
      }
    }

    return { categoryTemplateIds: new Set(), productTemplateIds: new Set() }
  }, [
    activeCategories,
    activeProducts,
    mode,
    selectedCategoryId,
    selectedPackId,
    selectedProductIds,
  ])

  const preview = React.useMemo(() => {
    const categoryTemplates = activeCategories.filter((category) =>
      selection.categoryTemplateIds.has(category.id)
    )
    const productTemplates = activeProducts.filter((product) =>
      selection.productTemplateIds.has(product.id)
    )

    return buildImportPreview({
      categoryTemplates,
      productTemplates,
      existingCategories,
      existingProducts,
    })
  }, [activeCategories, activeProducts, existingCategories, existingProducts, selection])

  const isLoading = packsLoading || categoriesLoading || productsLoading
  const hasLegacyProductsWithoutReviewChoice = preview.productsToCreate.some(
    (product) => typeof product.reviewsEnabled !== "boolean"
  )
  const hasLegacyCategoriesWithoutReviewChoice = preview.categoriesToCreate.some(
    (category) => typeof category.reviewsEnabled !== "boolean"
  )
  const canImport =
    (preview.categoriesToCreate.length > 0 || preview.productsToCreate.length > 0) &&
    (!hasLegacyCategoriesWithoutReviewChoice || typeof legacyImportCategoryReviewsEnabled === "boolean") &&
    (!hasLegacyProductsWithoutReviewChoice || typeof legacyImportReviewsEnabled === "boolean" || typeof legacyImportCategoryReviewsEnabled === "boolean")

  const handleImport = async () => {
    if (!db || !restaurantId || !canImport) return

    setIsImporting(true)

    try {
      const fresh = await loadRestaurantCatalog(db, restaurantId)
      const freshPreview = buildImportPreview({
        categoryTemplates: activeCategories.filter((category) =>
          selection.categoryTemplateIds.has(category.id)
        ),
        productTemplates: activeProducts.filter((product) =>
          selection.productTemplateIds.has(product.id)
        ),
        existingCategories: fresh.categories,
        existingProducts: fresh.products,
      })

      if (freshPreview.categoriesToCreate.length === 0 && freshPreview.productsToCreate.length === 0) {
        toast({
          title: "Rien a importer",
          description: "Tous les elements selectionnes existent deja dans ce menu.",
        })
        return
      }

      const batch = writeBatch(db)
      const categoryIdMap = new Map<string, string>()
      const productIdMap = new Map<string, string>()
      const existingCategoryByTemplate = new Map<string, string>()
      const existingCategoryReviewsByTemplate = new Map<string, boolean | null>()
      const existingProductByTemplate = new Map<string, string>()

      freshPreview.categoryDuplicates.forEach((duplicate) => {
        existingCategoryByTemplate.set(duplicate.template.id, duplicate.existing.id)
        existingCategoryReviewsByTemplate.set(
          duplicate.template.id,
          typeof duplicate.existing.reviewsEnabled === "boolean" ? duplicate.existing.reviewsEnabled : null
        )
      })
      freshPreview.productDuplicates.forEach((duplicate) => {
        existingProductByTemplate.set(duplicate.template.id, duplicate.existing.id)
      })

      freshPreview.categoriesToCreate.forEach((category) => {
        const categoryRef = doc(collection(db, "restaurants", restaurantId, "categories"))
        categoryIdMap.set(category.id, categoryRef.id)
        const categoryReviewsEnabled =
          typeof category.reviewsEnabled === "boolean"
            ? category.reviewsEnabled
            : legacyImportCategoryReviewsEnabled === true
        batch.set(categoryRef, {
          name: category.name,
          description: category.description || "",
          imageUrl: category.imageUrl || null,
          imageId: category.imageMediaId || "",
          iconKey: category.iconKey || null,
          marketplaceCategoryId: category.marketplaceCategoryId || null,
          reviewsEnabled: categoryReviewsEnabled,
          order: category.order ?? 0,
          isActive: category.isActive !== false,
          source: "platform_menu_library",
          sourceTemplateId: category.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      })

      const productRefs = new Map<string, ReturnType<typeof doc>>()
      freshPreview.productsToCreate.forEach((product) => {
        const productRef = doc(collection(db, "restaurants", restaurantId, "products"))
        productIdMap.set(product.id, productRef.id)
        productRefs.set(product.id, productRef)
      })

      freshPreview.productsToCreate.forEach((product) => {
        const mappedCategoryId =
          categoryIdMap.get(product.categoryTemplateId) ||
          existingCategoryByTemplate.get(product.categoryTemplateId)
        const categoryTemplate = activeCategories.find((category) => category.id === product.categoryTemplateId)

        if (!mappedCategoryId) return

        const productRef = productRefs.get(product.id)
        if (!productRef) return
        const categoryReviewsEnabled =
          existingCategoryReviewsByTemplate.get(product.categoryTemplateId) ??
          (typeof categoryTemplate?.reviewsEnabled === "boolean"
            ? categoryTemplate.reviewsEnabled
            : legacyImportCategoryReviewsEnabled)
        const sourcePolicy =
          product.reviewsPolicy === "inherit" || product.reviewsPolicy === "enabled" || product.reviewsPolicy === "disabled"
            ? product.reviewsPolicy
            : typeof product.reviewsEnabled === "boolean"
              ? policyFromLegacyReviewsEnabled(product.reviewsEnabled)
              : "inherit"
        const resolvedImportedReviewsEnabled = resolveProductReviewsEnabled({
          categoryReviewsEnabled,
          productReviewsPolicy: sourcePolicy,
        })
        const effectiveReviewsEnabled =
          typeof product.reviewsEnabled === "boolean"
            ? product.reviewsEnabled
            : resolvedImportedReviewsEnabled ?? legacyImportReviewsEnabled === true
        const reviewsPolicy =
          sourcePolicy === "inherit" || categoryReviewsEnabled === null || categoryReviewsEnabled === undefined
            ? sourcePolicy
            : effectiveReviewsEnabled === categoryReviewsEnabled
              ? "inherit"
              : effectiveReviewsEnabled
                ? "enabled"
                : "disabled"
        batch.set(productRef, {
          name: product.name,
          description: product.description || "",
          categoryId: mappedCategoryId,
          marketplaceCategoryId: product.marketplaceCategoryId || categoryTemplate?.marketplaceCategoryId || null,
          imageUrl: product.imageUrl || "",
          imageId: product.imageMediaId || "",
          basePrice: Math.max(0, Number(product.basePrice || 0)),
          price: Math.max(0, Number(product.basePrice || 0)),
          preparationMode: product.preparationMode || "kitchen",
          reviewsPolicy,
          reviewsEnabled: effectiveReviewsEnabled,
          options: Array.isArray(product.options) ? product.options : [],
          recipe: Array.isArray(product.recipe) ? product.recipe : [],
          components: Array.isArray(product.components) ? product.components : [],
          linkedOptionGroups: remapLinkedOptionGroups(
            product.linkedOptionGroups,
            categoryIdMap,
            productIdMap,
            existingCategoryByTemplate,
            existingProductByTemplate
          ),
          isActive: true,
          order: product.order ?? 0,
          source: "platform_menu_library",
          sourceTemplateId: product.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      })

      await batch.commit()
      onImported()
      toast({
        title: "Import termine",
        description: `${freshPreview.categoriesToCreate.length} categorie(s), ${freshPreview.productsToCreate.length} produit(s).`,
      })
      onClose()
    } catch (error) {
      console.error(error)
      toast({
        title: "Import impossible",
        description: "Aucun element existant n'a ete modifie.",
        variant: "destructive",
      })
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-black text-primary">
            <BookOpen className="h-6 w-6" />
            Importer depuis la bibliotheque
          </DialogTitle>
          <DialogDescription>
            Les modeles plateforme seront copies dans ce restaurant. Les menus existants ne sont pas modifies.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(value) => setMode(value as ImportMode)} className="space-y-5">
          <TabsList className="grid h-auto grid-cols-3 rounded-xl bg-secondary/30 p-1">
            <TabsTrigger value="pack" className="rounded-lg font-bold">Pack complet</TabsTrigger>
            <TabsTrigger value="category" className="rounded-lg font-bold">Categorie</TabsTrigger>
            <TabsTrigger value="products" className="rounded-lg font-bold">Produits</TabsTrigger>
          </TabsList>

          {isLoading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <TabsContent value="pack">
                <SelectableGrid
                  emptyMessage="Aucun pack actif."
                  items={activePacks}
                  selectedIds={selectedPackId ? [selectedPackId] : []}
                  onToggle={(id) => setSelectedPackId(id === selectedPackId ? "" : id)}
                  renderMeta={(pack) => {
                    const categoryCount = activeCategories.filter((category) => category.packIds?.includes(pack.id)).length
                    const productCount = activeProducts.filter((product) => product.packIds?.includes(pack.id)).length
                    return `${categoryCount} categorie(s), ${productCount} produit(s)`
                  }}
                />
              </TabsContent>

              <TabsContent value="category">
                <SelectableGrid
                  emptyMessage="Aucune categorie active."
                  items={activeCategories}
                  selectedIds={selectedCategoryId ? [selectedCategoryId] : []}
                  onToggle={(id) => setSelectedCategoryId(id === selectedCategoryId ? "" : id)}
                  renderMeta={(category) =>
                    `${activeProducts.filter((product) => product.categoryTemplateId === category.id).length} produit(s)`
                  }
                />
              </TabsContent>

              <TabsContent value="products">
                <SelectableGrid
                  multiple
                  emptyMessage="Aucun produit actif."
                  items={activeProducts}
                  selectedIds={selectedProductIds}
                  onToggle={(id) =>
                    setSelectedProductIds((current) =>
                      current.includes(id)
                        ? current.filter((item) => item !== id)
                        : [...current, id]
                    )
                  }
                  renderMeta={(product) =>
                    activeCategories.find((category) => category.id === product.categoryTemplateId)?.name || "Sans categorie"
                  }
                />
              </TabsContent>
            </>
          )}
        </Tabs>

        <ImportPreview preview={preview} />

        {hasLegacyCategoriesWithoutReviewChoice ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <p className="text-sm font-bold">Avis clients des catégories importées</p>
            <p className="mt-1 text-xs">
              Certaines catégories modèles anciennes n’ont pas encore de réglage d’avis. Choisis une règle générale à appliquer à ces catégories.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant={legacyImportCategoryReviewsEnabled === true ? "default" : "outline"}
                onClick={() => setLegacyImportCategoryReviewsEnabled(true)}
              >
                Autoriser les avis
              </Button>
              <Button
                type="button"
                variant={legacyImportCategoryReviewsEnabled === false ? "default" : "outline"}
                onClick={() => setLegacyImportCategoryReviewsEnabled(false)}
              >
                Désactiver les avis
              </Button>
            </div>
          </div>
        ) : null}

        {hasLegacyProductsWithoutReviewChoice ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <p className="text-sm font-bold">Avis clients des produits importés</p>
            <p className="mt-1 text-xs">
              Certains produits modèles anciens n’ont aucune valeur d’avis. Ce choix servira seulement aux produits qui ne peuvent pas hériter d’une catégorie configurée.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant={legacyImportReviewsEnabled === true ? "default" : "outline"}
                onClick={() => setLegacyImportReviewsEnabled(true)}
              >
                Autoriser les avis
              </Button>
              <Button
                type="button"
                variant={legacyImportReviewsEnabled === false ? "default" : "outline"}
                onClick={() => setLegacyImportReviewsEnabled(false)}
              >
                Désactiver les avis
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="button" disabled={!canImport || isImporting} onClick={handleImport}>
            {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackageOpen className="mr-2 h-4 w-4" />}
            Importer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SelectableGrid<T extends { id: string; name: string; imageUrl?: string; iconKey?: string | null; description?: string }>({
  items,
  selectedIds,
  onToggle,
  renderMeta,
  emptyMessage,
  multiple = false,
}: {
  items: T[]
  selectedIds: string[]
  onToggle: (id: string) => void
  renderMeta: (item: T) => string
  emptyMessage: string
  multiple?: boolean
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const selected = selectedIds.includes(item.id)
        const Icon = getMarketplaceCategoryIcon(item.iconKey)
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onToggle(item.id)}
            className={`overflow-hidden rounded-2xl border bg-card text-left shadow-sm transition hover:border-primary ${
              selected ? "border-primary ring-2 ring-primary/20" : "border-border"
            }`}
          >
            <div className="aspect-[16/9] bg-secondary/40">
              {item.imageUrl ? (
                <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  {item.iconKey ? <Icon className="h-8 w-8 text-primary opacity-70" /> : <ChefHat className="h-8 w-8 opacity-40" />}
                </div>
              )}
            </div>
            <div className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-black text-primary">{item.name}</p>
                  <p className="text-xs font-semibold text-muted-foreground">{renderMeta(item)}</p>
                </div>
                {selected ? (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                    <Check className="h-4 w-4" />
                  </span>
                ) : null}
              </div>
              {multiple ? <Badge variant="outline">Selection multiple</Badge> : null}
            </div>
          </button>
        )
      })}
    </div>
  )
}

function ImportPreview({ preview }: { preview: ReturnType<typeof buildImportPreview> }) {
  const duplicateCount = preview.categoryDuplicates.length + preview.productDuplicates.length
  return (
    <div className="space-y-3 rounded-2xl border bg-secondary/20 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{preview.categoriesToCreate.length} categorie(s) a creer</Badge>
        <Badge>{preview.productsToCreate.length} produit(s) a creer</Badge>
        {duplicateCount > 0 ? (
          <Badge variant="outline" className="border-[var(--brand-primary)]/30 text-[var(--brand-primary)]">
            <AlertTriangle className="mr-1 h-3 w-3" />
            {duplicateCount} doublon(s) ignores
          </Badge>
        ) : null}
      </div>
      {duplicateCount > 0 ? (
        <div className="rounded-xl border border-[var(--brand-primary)]/20 bg-[var(--brand-primary-soft)] p-3 text-sm text-[var(--brand-primary)] dark:border-[var(--brand-primary)]/30 dark:bg-[var(--brand-primary-soft)] dark:text-[var(--brand-primary)]">
          Les doublons sont detectes par nom normalise. Ils seront ignores, sans fusion ni ecrasement.
        </div>
      ) : null}
    </div>
  )
}

function buildImportPreview({
  categoryTemplates,
  productTemplates,
  existingCategories,
  existingProducts,
}: {
  categoryTemplates: WithId<PlatformMenuCategoryTemplate>[]
  productTemplates: WithId<PlatformMenuProductTemplate>[]
  existingCategories: any[]
  existingProducts: any[]
}) {
  const existingCategoryByName = new Map(
    existingCategories.map((category) => [normalizeName(category.name), category])
  )
  const existingProductByName = new Map(
    existingProducts.map((product) => [normalizeName(product.name), product])
  )

  const categoriesToCreate: WithId<PlatformMenuCategoryTemplate>[] = []
  const categoryDuplicates: Array<{ template: WithId<PlatformMenuCategoryTemplate>; existing: any }> = []
  const seenCategoryNames = new Set<string>()

  categoryTemplates.forEach((category) => {
    const key = normalizeName(category.name)
    if (!key || seenCategoryNames.has(key)) return
    seenCategoryNames.add(key)
    const existing = existingCategoryByName.get(key)
    if (existing) categoryDuplicates.push({ template: category, existing })
    else categoriesToCreate.push(category)
  })

  const productsToCreate: WithId<PlatformMenuProductTemplate>[] = []
  const productDuplicates: Array<{ template: WithId<PlatformMenuProductTemplate>; existing: any }> = []
  const seenProductNames = new Set<string>()

  productTemplates.forEach((product) => {
    const key = normalizeName(product.name)
    if (!key || seenProductNames.has(key)) return
    seenProductNames.add(key)
    const existing = existingProductByName.get(key)
    if (existing) productDuplicates.push({ template: product, existing })
    else productsToCreate.push(product)
  })

  return {
    categoriesToCreate,
    productsToCreate,
    categoryDuplicates,
    productDuplicates,
  }
}

async function loadRestaurantCatalog(db: any, restaurantId: string) {
  const [categoriesSnapshot, productsSnapshot] = await Promise.all([
    getDocs(collection(db, "restaurants", restaurantId, "categories")),
    getDocs(collection(db, "restaurants", restaurantId, "products")),
  ])

  return {
    categories: categoriesSnapshot.docs.map((categoryDoc) => ({
      id: categoryDoc.id,
      ...categoryDoc.data(),
    })),
    products: productsSnapshot.docs.map((productDoc) => ({
      id: productDoc.id,
      ...productDoc.data(),
    })),
  }
}

function remapLinkedOptionGroups(
  rawGroups: unknown,
  categoryIdMap: Map<string, string>,
  productIdMap: Map<string, string>,
  existingCategoryByTemplate: Map<string, string>,
  existingProductByTemplate: Map<string, string>
): LinkedOptionGroup[] {
  if (!Array.isArray(rawGroups)) return []

  const remappedGroups: LinkedOptionGroup[] = []

  rawGroups.forEach((group) => {
    if (!group || typeof group !== "object") return
    const source = group as LinkedOptionGroup
    const categoryIds = (source.categoryIds || [])
      .map((id) => categoryIdMap.get(id) || existingCategoryByTemplate.get(id))
      .filter((id): id is string => Boolean(id))
    const productIds = (source.productIds || [])
      .map((id) => productIdMap.get(id) || existingProductByTemplate.get(id))
      .filter((id): id is string => Boolean(id))

    if (source.sourceType === "products" && productIds.length === 0) return
    if (source.sourceType !== "products" && categoryIds.length === 0) return

    remappedGroups.push({
      ...source,
      categoryIds,
      productIds,
    })
  })

  return remappedGroups
}

function normalizeName(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
}
