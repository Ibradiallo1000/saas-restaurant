"use client"

import * as React from "react"
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore"
import {
  ImageIcon,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react"

import { MediaSelector } from "@/components/platform/MediaSelector"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useAuth, useCollectionOnce, useFirestore, useMemoFirebase } from "@/firebase"
import { useToast } from "@/hooks/use-toast"
import { COLLECTION_NAMES } from "@/lib/constants"
import { cn } from "@/lib/utils"
import type {
  MarketplaceFoodCategoryDocument,
} from "@/lib/marketplace-discovery/marketplace-discovery-types"
import type {
  PlatformMenuCategoryTemplate,
  PlatformMenuPack,
  PlatformMenuProductTemplate,
} from "@/modules/menu-library/types"
import { PREPARATION_MODES, type PreparationMode } from "@/utils/preparation-logic"
import { PlatformMenuLibraryView } from "./PlatformMenuLibraryView"

type WithId<T> = T & { id: string }

type PackForm = {
  name: string
  description: string
  imageUrl: string
  imageMediaId: string
  isActive: boolean
  tags: string
}

type CategoryForm = {
  name: string
  description: string
  imageUrl: string
  imageMediaId: string
  marketplaceCategoryId: string
  order: string
  isActive: boolean
  packIds: string[]
}

type ProductForm = {
  name: string
  description: string
  imageUrl: string
  imageMediaId: string
  categoryTemplateId: string
  basePrice: string
  preparationMode: PreparationMode
  order: string
  isActive: boolean
  packIds: string[]
  optionsJson: string
  recipeJson: string
  componentsJson: string
  linkedOptionGroupsJson: string
}

const EMPTY_PACK_FORM: PackForm = {
  name: "",
  description: "",
  imageUrl: "",
  imageMediaId: "",
  isActive: true,
  tags: "",
}

const EMPTY_CATEGORY_FORM: CategoryForm = {
  name: "",
  description: "",
  imageUrl: "",
  imageMediaId: "",
  marketplaceCategoryId: "",
  order: "0",
  isActive: true,
  packIds: [],
}

const EMPTY_PRODUCT_FORM: ProductForm = {
  name: "",
  description: "",
  imageUrl: "",
  imageMediaId: "",
  categoryTemplateId: "",
  basePrice: "0",
  preparationMode: "kitchen",
  order: "0",
  isActive: true,
  packIds: [],
  optionsJson: "[]",
  recipeJson: "[]",
  componentsJson: "[]",
  linkedOptionGroupsJson: "[]",
}

export default function PlatformMenuLibraryClient() {
  const db = useFirestore()
  const auth = useAuth()
  const { toast } = useToast()

  const [packForm, setPackForm] = React.useState<PackForm>(EMPTY_PACK_FORM)
  const [categoryForm, setCategoryForm] = React.useState<CategoryForm>(EMPTY_CATEGORY_FORM)
  const [productForm, setProductForm] = React.useState<ProductForm>(EMPTY_PRODUCT_FORM)
  const [editingPackId, setEditingPackId] = React.useState<string | null>(null)
  const [editingCategoryId, setEditingCategoryId] = React.useState<string | null>(null)
  const [editingProductId, setEditingProductId] = React.useState<string | null>(null)
  const [savingSection, setSavingSection] = React.useState<"pack" | "category" | "product" | null>(null)
  const [pendingId, setPendingId] = React.useState<string | null>(null)
  const [deleteCandidate, setDeleteCandidate] = React.useState<{ collectionName: string; id: string; label: string } | null>(null)

  const packsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(
      collection(db, COLLECTION_NAMES.PLATFORM_MENU_PACKS),
      orderBy("name", "asc"),
      limit(100)
    )
  }, [db])

  const categoriesQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(
      collection(db, COLLECTION_NAMES.PLATFORM_MENU_CATEGORIES),
      orderBy("order", "asc"),
      limit(200)
    )
  }, [db])

  const productsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(
      collection(db, COLLECTION_NAMES.PLATFORM_MENU_PRODUCTS),
      orderBy("order", "asc"),
      limit(300)
    )
  }, [db])

  const marketplaceCategoriesQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(
      collection(db, COLLECTION_NAMES.MARKETPLACE_FOOD_CATEGORIES),
      orderBy("sortOrder", "asc"),
      limit(100)
    )
  }, [db])

  const {
    data: packs,
    isLoading: isPacksLoading,
    refetch: refetchPacks,
  } = useCollectionOnce<PlatformMenuPack>(packsQuery)
  const {
    data: categories,
    isLoading: isCategoriesLoading,
    refetch: refetchCategories,
  } = useCollectionOnce<PlatformMenuCategoryTemplate>(categoriesQuery)
  const {
    data: products,
    isLoading: isProductsLoading,
    refetch: refetchProducts,
  } = useCollectionOnce<PlatformMenuProductTemplate>(productsQuery)
  const { data: marketplaceCategories, isLoading: isMarketplaceCategoriesLoading } =
    useCollectionOnce<MarketplaceFoodCategoryDocument>(marketplaceCategoriesQuery)

  const packList = packs ?? []
  const categoryList = categories ?? []
  const productList = products ?? []
  const marketplaceCategoryList = marketplaceCategories ?? []
  const activeMarketplaceCategoryList = marketplaceCategoryList.filter((category) => category.active !== false)
  const isLoading = isPacksLoading || isCategoriesLoading || isProductsLoading || isMarketplaceCategoriesLoading

  const refetchAll = React.useCallback(() => {
    refetchPacks()
    refetchCategories()
    refetchProducts()
  }, [refetchCategories, refetchPacks, refetchProducts])

  const handleSavePack = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!db || !packForm.name.trim()) return

    setSavingSection("pack")
    const payload = {
      name: packForm.name.trim(),
      description: packForm.description.trim(),
      imageUrl: packForm.imageUrl.trim(),
      imageMediaId: packForm.imageMediaId,
      isActive: packForm.isActive,
      categoryTemplateIds: [],
      productTemplateIds: [],
      tags: splitTags(packForm.tags),
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser?.uid || "",
    }

    try {
      if (editingPackId) {
        await updateDoc(doc(db, COLLECTION_NAMES.PLATFORM_MENU_PACKS, editingPackId), payload)
        toast({ title: "Pack modele mis a jour" })
      } else {
        await addDoc(collection(db, COLLECTION_NAMES.PLATFORM_MENU_PACKS), {
          ...payload,
          createdAt: serverTimestamp(),
          createdBy: auth.currentUser?.uid || "",
        })
        toast({ title: "Pack modele cree" })
      }
      resetPackForm()
      refetchAll()
    } catch (error) {
      console.error(error)
      toast({ title: "Enregistrement impossible", variant: "destructive" })
    } finally {
      setSavingSection(null)
    }
  }

  const handleSaveCategory = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!db || !categoryForm.name.trim()) return

    setSavingSection("category")
    const payload = {
      packIds: categoryForm.packIds,
      name: categoryForm.name.trim(),
      description: categoryForm.description.trim(),
      imageUrl: categoryForm.imageUrl.trim(),
      imageMediaId: categoryForm.imageMediaId,
      marketplaceCategoryId: categoryForm.marketplaceCategoryId || null,
      order: toInt(categoryForm.order),
      isActive: categoryForm.isActive,
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser?.uid || "",
    }

    try {
      if (editingCategoryId) {
        await updateDoc(
          doc(db, COLLECTION_NAMES.PLATFORM_MENU_CATEGORIES, editingCategoryId),
          payload
        )
        toast({ title: "Categorie modele mise a jour" })
      } else {
        await addDoc(collection(db, COLLECTION_NAMES.PLATFORM_MENU_CATEGORIES), {
          ...payload,
          createdAt: serverTimestamp(),
          createdBy: auth.currentUser?.uid || "",
        })
        toast({ title: "Categorie modele creee" })
      }
      resetCategoryForm()
      refetchAll()
    } catch (error) {
      console.error(error)
      toast({ title: "Enregistrement impossible", variant: "destructive" })
    } finally {
      setSavingSection(null)
    }
  }

  const handleSaveProduct = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!db || !productForm.name.trim() || !productForm.categoryTemplateId) return

    let parsedOptions: unknown[] = []
    let parsedRecipe: unknown[] = []
    let parsedComponents: unknown[] = []
    let parsedLinkedOptionGroups: unknown[] = []

    try {
      parsedOptions = parseJsonArray(productForm.optionsJson, "Options")
      parsedRecipe = parseJsonArray(productForm.recipeJson, "Recette")
      parsedComponents = parseJsonArray(productForm.componentsJson, "Composants")
      parsedLinkedOptionGroups = parseJsonArray(productForm.linkedOptionGroupsJson, "Options liees")
    } catch (error) {
      toast({
        title: "JSON invalide",
        description: error instanceof Error ? error.message : "Verifiez les champs avances.",
        variant: "destructive",
      })
      return
    }

    setSavingSection("product")
    const payload = {
      packIds: productForm.packIds,
      name: productForm.name.trim(),
      description: productForm.description.trim(),
      categoryTemplateId: productForm.categoryTemplateId,
      imageUrl: productForm.imageUrl.trim(),
      imageMediaId: productForm.imageMediaId,
      basePrice: Math.max(0, toInt(productForm.basePrice)),
      preparationMode: productForm.preparationMode,
      options: parsedOptions,
      recipe: parsedRecipe,
      components: parsedComponents,
      linkedOptionGroups: parsedLinkedOptionGroups,
      isActive: productForm.isActive,
      order: toInt(productForm.order),
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser?.uid || "",
    }

    try {
      if (editingProductId) {
        await updateDoc(
          doc(db, COLLECTION_NAMES.PLATFORM_MENU_PRODUCTS, editingProductId),
          payload
        )
        toast({ title: "Produit modele mis a jour" })
      } else {
        await addDoc(collection(db, COLLECTION_NAMES.PLATFORM_MENU_PRODUCTS), {
          ...payload,
          createdAt: serverTimestamp(),
          createdBy: auth.currentUser?.uid || "",
        })
        toast({ title: "Produit modele cree" })
      }
      resetProductForm()
      refetchAll()
    } catch (error) {
      console.error(error)
      toast({ title: "Enregistrement impossible", variant: "destructive" })
    } finally {
      setSavingSection(null)
    }
  }

  const deleteTemplate = async (collectionName: string, id: string, label: string) => {
    if (!db) return
    setPendingId(id)
    try {
      await deleteDoc(doc(db, collectionName, id))
      toast({ title: "Element supprime" })
      refetchAll()
    } catch (error) {
      console.error(error)
      toast({ title: "Suppression impossible", variant: "destructive" })
    } finally {
      setPendingId(null)
      setDeleteCandidate(null)
    }
  }

  const startEditPack = (pack: WithId<PlatformMenuPack>) => {
    setEditingPackId(pack.id)
    setPackForm({
      name: pack.name || "",
      description: pack.description || "",
      imageUrl: pack.imageUrl || "",
      imageMediaId: pack.imageMediaId || "",
      isActive: pack.isActive !== false,
      tags: (pack.tags || []).join(", "),
    })
  }

  const startEditCategory = (category: WithId<PlatformMenuCategoryTemplate>) => {
    setEditingCategoryId(category.id)
    setCategoryForm({
      name: category.name || "",
      description: category.description || "",
      imageUrl: category.imageUrl || "",
      imageMediaId: category.imageMediaId || "",
      marketplaceCategoryId: category.marketplaceCategoryId || "",
      order: String(category.order ?? 0),
      isActive: category.isActive !== false,
      packIds: Array.isArray(category.packIds) ? category.packIds : [],
    })
  }

  const startEditProduct = (product: WithId<PlatformMenuProductTemplate>) => {
    setEditingProductId(product.id)
    setProductForm({
      name: product.name || "",
      description: product.description || "",
      imageUrl: product.imageUrl || "",
      imageMediaId: product.imageMediaId || "",
      categoryTemplateId: product.categoryTemplateId || "",
      basePrice: String(product.basePrice ?? 0),
      preparationMode: product.preparationMode || "kitchen",
      order: String(product.order ?? 0),
      isActive: product.isActive !== false,
      packIds: Array.isArray(product.packIds) ? product.packIds : [],
      optionsJson: formatJsonArray(product.options),
      recipeJson: formatJsonArray(product.recipe),
      componentsJson: formatJsonArray(product.components),
      linkedOptionGroupsJson: formatJsonArray(product.linkedOptionGroups),
    })
  }

  const resetPackForm = () => {
    setPackForm(EMPTY_PACK_FORM)
    setEditingPackId(null)
  }

  const resetCategoryForm = () => {
    setCategoryForm(EMPTY_CATEGORY_FORM)
    setEditingCategoryId(null)
  }

  const resetProductForm = () => {
    setProductForm(EMPTY_PRODUCT_FORM)
    setEditingProductId(null)
  }

  return (
    <PlatformMenuLibraryView packCount={packList.length} categoryCount={categoryList.length} productCount={productList.length} deleteLabel={deleteCandidate?.label} deleting={Boolean(pendingId)} onDeleteOpenChange={(open) => { if (!open && !pendingId) setDeleteCandidate(null) }} onConfirmDelete={() => { if (deleteCandidate) void deleteTemplate(deleteCandidate.collectionName, deleteCandidate.id, deleteCandidate.label) }}>
      <Tabs defaultValue="packs" className="space-y-6">
        <TabsList className="grid h-auto w-full grid-cols-3 rounded-xl bg-secondary/30 p-1">
          <TabsTrigger value="packs" className="rounded-lg font-bold">Packs</TabsTrigger>
          <TabsTrigger value="categories" className="rounded-lg font-bold">Categories</TabsTrigger>
          <TabsTrigger value="products" className="rounded-lg font-bold">Produits</TabsTrigger>
        </TabsList>

        <TabsContent value="packs" className="space-y-6">
          <PackFormCard
            form={packForm}
            editingId={editingPackId}
            isSaving={savingSection === "pack"}
            onSubmit={handleSavePack}
            onChange={setPackForm}
            onReset={resetPackForm}
          />
          <PackGrid
            packs={packList}
            categories={categoryList}
            products={productList}
            isLoading={isLoading}
            pendingId={pendingId}
            onEdit={startEditPack}
            onDelete={(pack) => setDeleteCandidate({ collectionName: COLLECTION_NAMES.PLATFORM_MENU_PACKS, id: pack.id, label: pack.name })}
          />
        </TabsContent>

        <TabsContent value="categories" className="space-y-6">
          <CategoryFormCard
            form={categoryForm}
            packs={packList}
            marketplaceCategories={activeMarketplaceCategoryList}
            editingId={editingCategoryId}
            isSaving={savingSection === "category"}
            onSubmit={handleSaveCategory}
            onChange={setCategoryForm}
            onReset={resetCategoryForm}
          />
          <CategoryGrid
            categories={categoryList}
            packs={packList}
            marketplaceCategories={marketplaceCategoryList}
            isLoading={isLoading}
            pendingId={pendingId}
            onEdit={startEditCategory}
            onDelete={(category) => setDeleteCandidate({ collectionName: COLLECTION_NAMES.PLATFORM_MENU_CATEGORIES, id: category.id, label: category.name })}
          />
        </TabsContent>

        <TabsContent value="products" className="space-y-6">
          <ProductFormCard
            form={productForm}
            packs={packList}
            categories={categoryList}
            editingId={editingProductId}
            isSaving={savingSection === "product"}
            onSubmit={handleSaveProduct}
            onChange={setProductForm}
            onReset={resetProductForm}
          />
          <ProductGrid
            products={productList}
            packs={packList}
            categories={categoryList}
            isLoading={isLoading}
            pendingId={pendingId}
            onEdit={startEditProduct}
            onDelete={(product) => setDeleteCandidate({ collectionName: COLLECTION_NAMES.PLATFORM_MENU_PRODUCTS, id: product.id, label: product.name })}
          />
        </TabsContent>
      </Tabs>
    </PlatformMenuLibraryView>
  )
}

function PackFormCard({
  form,
  editingId,
  isSaving,
  onSubmit,
  onChange,
  onReset,
}: {
  form: PackForm
  editingId: string | null
  isSaving: boolean
  onSubmit: (event: React.FormEvent) => void
  onChange: (form: PackForm) => void
  onReset: () => void
}) {
  return (
    <Card className="border-none shadow-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl font-black italic uppercase">
          {editingId ? <Pencil className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
          {editingId ? "Modifier un pack modele" : "Creer un pack modele"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-6">
          <Field className="md:col-span-2" label="Nom du pack">
            <Input value={form.name} onChange={(event) => onChange({ ...form, name: event.target.value })} />
          </Field>
          <Field className="md:col-span-2" label="Tags">
            <Input
              value={form.tags}
              placeholder="tag1, tag2"
              onChange={(event) => onChange({ ...form, tags: event.target.value })}
            />
          </Field>
          <ToggleFormField
            label="Actif"
            checked={form.isActive}
            onCheckedChange={(checked) => onChange({ ...form, isActive: checked })}
          />
          <div className="md:col-span-6">
            <MediaSelector
              type="menu_template"
              label="Image du pack"
              description="Image issue de la galerie media plateforme."
              value={form.imageUrl}
              onChange={(imageUrl) => onChange({ ...form, imageUrl: imageUrl || "", imageMediaId: imageUrl ? form.imageMediaId : "" })}
              onSelect={(media) => onChange({ ...form, imageUrl: media?.url || "", imageMediaId: media?.id || "" })}
            />
          </div>
          <Field className="md:col-span-6" label="Description">
            <Textarea value={form.description} onChange={(event) => onChange({ ...form, description: event.target.value })} />
          </Field>
          <FormActions isSaving={isSaving} editing={Boolean(editingId)} onReset={onReset} />
        </form>
      </CardContent>
    </Card>
  )
}

function CategoryFormCard({
  form,
  packs,
  marketplaceCategories,
  editingId,
  isSaving,
  onSubmit,
  onChange,
  onReset,
}: {
  form: CategoryForm
  packs: WithId<PlatformMenuPack>[]
  marketplaceCategories: WithId<MarketplaceFoodCategoryDocument>[]
  editingId: string | null
  isSaving: boolean
  onSubmit: (event: React.FormEvent) => void
  onChange: (form: CategoryForm) => void
  onReset: () => void
}) {
  return (
    <Card className="border-none shadow-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl font-black italic uppercase">
          {editingId ? <Pencil className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
          {editingId ? "Modifier une categorie modele" : "Creer une categorie modele"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-6">
          <Field className="md:col-span-2" label="Nom">
            <Input value={form.name} onChange={(event) => onChange({ ...form, name: event.target.value })} />
          </Field>
          <Field label="Ordre">
            <Input
              type="number"
              value={form.order}
              onChange={(event) => onChange({ ...form, order: event.target.value })}
            />
          </Field>
          <ToggleFormField
            label="Actif"
            checked={form.isActive}
            onCheckedChange={(checked) => onChange({ ...form, isActive: checked })}
          />
          <Field className="md:col-span-2" label="Catégorie marketplace">
            <select
              value={form.marketplaceCategoryId}
              onChange={(event) => onChange({ ...form, marketplaceCategoryId: event.target.value })}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Aucun mapping</option>
              {marketplaceCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="md:col-span-6">
            <PackCheckboxes
              packs={packs}
              selectedIds={form.packIds}
              onChange={(packIds) => onChange({ ...form, packIds })}
            />
          </div>
          <div className="md:col-span-6">
            <MediaSelector
              type="menu_template"
              label="Image categorie"
              description="Image issue de la galerie media plateforme."
              value={form.imageUrl}
              onChange={(imageUrl) => onChange({ ...form, imageUrl: imageUrl || "", imageMediaId: imageUrl ? form.imageMediaId : "" })}
              onSelect={(media) => onChange({ ...form, imageUrl: media?.url || "", imageMediaId: media?.id || "" })}
            />
          </div>
          <Field className="md:col-span-6" label="Description">
            <Textarea value={form.description} onChange={(event) => onChange({ ...form, description: event.target.value })} />
          </Field>
          <FormActions isSaving={isSaving} editing={Boolean(editingId)} onReset={onReset} />
        </form>
      </CardContent>
    </Card>
  )
}

function ProductFormCard({
  form,
  packs,
  categories,
  editingId,
  isSaving,
  onSubmit,
  onChange,
  onReset,
}: {
  form: ProductForm
  packs: WithId<PlatformMenuPack>[]
  categories: WithId<PlatformMenuCategoryTemplate>[]
  editingId: string | null
  isSaving: boolean
  onSubmit: (event: React.FormEvent) => void
  onChange: (form: ProductForm) => void
  onReset: () => void
}) {
  return (
    <Card className="border-none shadow-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl font-black italic uppercase">
          {editingId ? <Pencil className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
          {editingId ? "Modifier un produit modele" : "Creer un produit modele"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-6">
          <Field className="md:col-span-2" label="Nom">
            <Input value={form.name} onChange={(event) => onChange({ ...form, name: event.target.value })} />
          </Field>
          <Field className="md:col-span-2" label="Categorie modele">
            <select
              value={form.categoryTemplateId}
              onChange={(event) => onChange({ ...form, categoryTemplateId: event.target.value })}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Selectionner</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Prix modele">
            <Input
              type="number"
              min="0"
              value={form.basePrice}
              onChange={(event) => onChange({ ...form, basePrice: event.target.value })}
            />
          </Field>
          <Field label="Ordre">
            <Input
              type="number"
              value={form.order}
              onChange={(event) => onChange({ ...form, order: event.target.value })}
            />
          </Field>
          <Field className="md:col-span-2" label="Mode de preparation">
            <select
              value={form.preparationMode}
              onChange={(event) =>
                onChange({ ...form, preparationMode: event.target.value as PreparationMode })
              }
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {PREPARATION_MODES.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
          </Field>
          <ToggleFormField
            label="Actif"
            checked={form.isActive}
            onCheckedChange={(checked) => onChange({ ...form, isActive: checked })}
          />
          <div className="md:col-span-6">
            <PackCheckboxes
              packs={packs}
              selectedIds={form.packIds}
              onChange={(packIds) => onChange({ ...form, packIds })}
            />
          </div>
          <div className="md:col-span-6">
            <MediaSelector
              type="menu_template"
              label="Image produit"
              description="Image issue de la galerie media plateforme."
              value={form.imageUrl}
              onChange={(imageUrl) => onChange({ ...form, imageUrl: imageUrl || "", imageMediaId: imageUrl ? form.imageMediaId : "" })}
              onSelect={(media) => onChange({ ...form, imageUrl: media?.url || "", imageMediaId: media?.id || "" })}
            />
          </div>
          <Field className="md:col-span-6" label="Description">
            <Textarea value={form.description} onChange={(event) => onChange({ ...form, description: event.target.value })} />
          </Field>
          <AdvancedJsonFields form={form} onChange={onChange} />
          <FormActions isSaving={isSaving} editing={Boolean(editingId)} onReset={onReset} />
        </form>
      </CardContent>
    </Card>
  )
}

function AdvancedJsonFields({
  form,
  onChange,
}: {
  form: ProductForm
  onChange: (form: ProductForm) => void
}) {
  const fields: Array<{ key: keyof ProductForm; label: string }> = [
    { key: "optionsJson", label: "Options JSON" },
    { key: "recipeJson", label: "Recette JSON" },
    { key: "componentsJson", label: "Composants JSON" },
    { key: "linkedOptionGroupsJson", label: "Options liees JSON" },
  ]

  return (
    <div className="grid gap-4 md:col-span-6 md:grid-cols-2">
      {fields.map((field) => (
        <Field key={field.key} label={field.label}>
          <Textarea
            value={String(form[field.key] || "[]")}
            rows={5}
            className="font-mono text-xs"
            onChange={(event) => onChange({ ...form, [field.key]: event.target.value })}
          />
        </Field>
      ))}
    </div>
  )
}

function PackGrid({
  packs,
  categories,
  products,
  isLoading,
  pendingId,
  onEdit,
  onDelete,
}: {
  packs: WithId<PlatformMenuPack>[]
  categories: WithId<PlatformMenuCategoryTemplate>[]
  products: WithId<PlatformMenuProductTemplate>[]
  isLoading: boolean
  pendingId: string | null
  onEdit: (pack: WithId<PlatformMenuPack>) => void
  onDelete: (pack: WithId<PlatformMenuPack>) => void
}) {
  if (isLoading) return <LoadingCard />
  if (packs.length === 0) return <EmptyCard message="Aucun pack modele." />

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {packs.map((pack) => {
        const categoryCount = categories.filter((category) => category.packIds?.includes(pack.id)).length
        const productCount = products.filter((product) => product.packIds?.includes(pack.id)).length

        return (
          <TemplateCard
            key={pack.id}
            title={pack.name}
            description={pack.description}
            imageUrl={pack.imageUrl}
            isActive={pack.isActive}
            pending={pendingId === pack.id}
            meta={`${categoryCount} categories - ${productCount} produits`}
            badges={pack.tags || []}
            onEdit={() => onEdit(pack)}
            onDelete={() => onDelete(pack)}
          />
        )
      })}
    </div>
  )
}

function CategoryGrid({
  categories,
  packs,
  marketplaceCategories,
  isLoading,
  pendingId,
  onEdit,
  onDelete,
}: {
  categories: WithId<PlatformMenuCategoryTemplate>[]
  packs: WithId<PlatformMenuPack>[]
  marketplaceCategories: WithId<MarketplaceFoodCategoryDocument>[]
  isLoading: boolean
  pendingId: string | null
  onEdit: (category: WithId<PlatformMenuCategoryTemplate>) => void
  onDelete: (category: WithId<PlatformMenuCategoryTemplate>) => void
}) {
  if (isLoading) return <LoadingCard />
  if (categories.length === 0) return <EmptyCard message="Aucune categorie modele." />

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {categories.map((category) => (
        <TemplateCard
          key={category.id}
          title={category.name}
          description={category.description}
          imageUrl={category.imageUrl}
          isActive={category.isActive}
          pending={pendingId === category.id}
          meta={`Ordre ${category.order ?? 0} - ${getMarketplaceCategoryName(marketplaceCategories, category.marketplaceCategoryId)}`}
          badges={getPackNames(packs, category.packIds)}
          onEdit={() => onEdit(category)}
          onDelete={() => onDelete(category)}
        />
      ))}
    </div>
  )
}

function ProductGrid({
  products,
  packs,
  categories,
  isLoading,
  pendingId,
  onEdit,
  onDelete,
}: {
  products: WithId<PlatformMenuProductTemplate>[]
  packs: WithId<PlatformMenuPack>[]
  categories: WithId<PlatformMenuCategoryTemplate>[]
  isLoading: boolean
  pendingId: string | null
  onEdit: (product: WithId<PlatformMenuProductTemplate>) => void
  onDelete: (product: WithId<PlatformMenuProductTemplate>) => void
}) {
  if (isLoading) return <LoadingCard />
  if (products.length === 0) return <EmptyCard message="Aucun produit modele." />

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {products.map((product) => (
        <TemplateCard
          key={product.id}
          title={product.name}
          description={product.description}
          imageUrl={product.imageUrl}
          isActive={product.isActive}
          pending={pendingId === product.id}
          meta={`${getCategoryName(categories, product.categoryTemplateId)} - ${product.preparationMode}`}
          badges={getPackNames(packs, product.packIds)}
          onEdit={() => onEdit(product)}
          onDelete={() => onDelete(product)}
        />
      ))}
    </div>
  )
}

function TemplateCard({
  title,
  description,
  imageUrl,
  isActive,
  pending,
  meta,
  badges,
  onEdit,
  onDelete,
}: {
  title: string
  description?: string
  imageUrl?: string
  isActive: boolean
  pending: boolean
  meta: string
  badges: string[]
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <Card className="overflow-hidden border-none shadow-xl">
      <div className="aspect-[16/9] bg-secondary/40">
        {imageUrl ? (
          <img src={imageUrl} alt={title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ImageIcon className="h-10 w-10 opacity-40" />
          </div>
        )}
      </div>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-lg font-black text-primary">{title}</p>
            <p className="text-xs font-bold uppercase text-muted-foreground">{meta}</p>
          </div>
          <Badge variant={isActive ? "default" : "secondary"}>{isActive ? "Actif" : "Inactif"}</Badge>
        </div>
        {description ? <p className="line-clamp-2 text-sm text-muted-foreground">{description}</p> : null}
        {badges.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {badges.map((badge) => (
              <Badge key={badge} variant="outline">{badge}</Badge>
            ))}
          </div>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="icon" disabled={pending} onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="icon" disabled={pending} onClick={onDelete}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function PackCheckboxes({
  packs,
  selectedIds,
  onChange,
}: {
  packs: WithId<PlatformMenuPack>[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}) {
  return (
    <div className="space-y-2 rounded-xl bg-secondary/30 p-4">
      <Label>Packs associes</Label>
      {packs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Creez d'abord un pack modele.</p>
      ) : (
        <div className="grid gap-2 md:grid-cols-3">
          {packs.map((pack) => {
            const checked = selectedIds.includes(pack.id)
            return (
              <label key={pack.id} className="flex items-center gap-2 rounded-lg bg-background p-3 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => {
                    const nextIds = event.target.checked
                      ? [...selectedIds, pack.id]
                      : selectedIds.filter((id) => id !== pack.id)
                    onChange(nextIds)
                  }}
                />
                <span className="truncate">{pack.name}</span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ToggleFormField({
  label,
  checked,
  onCheckedChange,
}: {
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  const id = React.useId()
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex h-10 items-center">
        <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
      </div>
    </div>
  )
}

function Field({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  const id = React.useId()
  const control = React.isValidElement(children) ? React.cloneElement(children as React.ReactElement<{ id?: string }>, { id }) : children
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {control}
    </div>
  )
}

function FormActions({
  isSaving,
  editing,
  onReset,
}: {
  isSaving: boolean
  editing: boolean
  onReset: () => void
}) {
  return (
    <div className="flex flex-col gap-2 md:col-span-6 md:flex-row">
      <Button type="submit" disabled={isSaving} className="h-12 font-bold">
        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
        {editing ? "Enregistrer" : "Creer"}
      </Button>
      {editing ? (
        <Button type="button" variant="outline" className="h-12 font-bold" onClick={onReset}>
          <X className="mr-2 h-4 w-4" />
          Annuler
        </Button>
      ) : null}
    </div>
  )
}

function LoadingCard() {
  return (
    <Card className="border-none shadow-xl">
      <CardContent className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </CardContent>
    </Card>
  )
}

function EmptyCard({ message }: { message: string }) {
  return (
    <Card className="border-none shadow-xl">
      <CardContent className="p-12 text-center text-muted-foreground">{message}</CardContent>
    </Card>
  )
}

function splitTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function toInt(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.round(parsed) : 0
}

function parseJsonArray(value: string, label: string): unknown[] {
  const parsed = JSON.parse(value || "[]")
  if (!Array.isArray(parsed)) {
    throw new Error(`${label} doit etre un tableau JSON.`)
  }
  return parsed
}

function formatJsonArray(value: unknown) {
  return JSON.stringify(Array.isArray(value) ? value : [], null, 2)
}

function getPackNames(packs: WithId<PlatformMenuPack>[], packIds: string[] = []) {
  return packIds
    .map((packId) => packs.find((pack) => pack.id === packId)?.name)
    .filter((name): name is string => Boolean(name))
}

function getCategoryName(
  categories: WithId<PlatformMenuCategoryTemplate>[],
  categoryTemplateId: string
) {
  return categories.find((category) => category.id === categoryTemplateId)?.name || "Sans categorie"
}

function getMarketplaceCategoryName(
  categories: WithId<MarketplaceFoodCategoryDocument>[],
  categoryId?: string | null
) {
  if (!categoryId) return "Sans mapping marketplace"
  return categories.find((category) => category.id === categoryId)?.name || "Mapping marketplace inconnu"
}
