"use client"

import * as React from "react"
import {
  collection,
  doc,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Timestamp,
} from "firebase/firestore"
import { ImageIcon, Loader2, Pencil, Plus, Search, Tags } from "lucide-react"

import { PlatformHeader, PlatformPage } from "@/components/platform-ui"
import { MediaSelector } from "@/components/platform/MediaSelector"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useCollectionOnce, useFirestore, useMemoFirebase } from "@/firebase"
import { useToast } from "@/hooks/use-toast"
import { COLLECTION_NAMES } from "@/lib/constants"
import { normalizeMarketplaceSearch } from "@/lib/marketplace-discovery/marketplace-discovery-core"

type MarketplaceFoodCategory = {
  id: string
  schemaVersion: 1
  name: string
  slug: string
  normalizedName: string
  imageUrl: string | null
  sortOrder: number
  active: boolean
  aliases?: string[]
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

type CategoryForm = {
  name: string
  slug: string
  imageUrl: string
  sortOrder: string
  active: boolean
}

const EMPTY_FORM: CategoryForm = {
  name: "",
  slug: "",
  imageUrl: "",
  sortOrder: "0",
  active: true,
}

export default function PlatformMarketplaceCategoriesClient() {
  const db = useFirestore()
  const { toast } = useToast()
  const [form, setForm] = React.useState<CategoryForm>(EMPTY_FORM)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [pendingId, setPendingId] = React.useState<string | null>(null)

  const categoriesQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, COLLECTION_NAMES.MARKETPLACE_FOOD_CATEGORIES), orderBy("sortOrder", "asc"), orderBy("name", "asc"))
  }, [db])

  const { data, isLoading, refetch } = useCollectionOnce<MarketplaceFoodCategory>(categoriesQuery)
  const categories = data ?? []
  const filteredCategories = React.useMemo(() => {
    const normalized = normalizeMarketplaceSearch(search)
    if (!normalized) return categories
    return categories.filter((category) => normalizeMarketplaceSearch(`${category.name} ${category.slug}`).includes(normalized))
  }, [categories, search])

  const saveCategory = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!db || !form.name.trim()) return

    const slug = slugify(form.slug || form.name)
    if (!slug) {
      toast({ title: "Slug invalide", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      const payload = {
        schemaVersion: 1,
        name: form.name.trim(),
        slug,
        normalizedName: normalizeMarketplaceSearch(form.name),
        imageUrl: form.imageUrl.trim() || null,
        sortOrder: toInteger(form.sortOrder),
        active: form.active,
        aliases: [],
        updatedAt: serverTimestamp(),
      }

      if (editingId) {
        await updateDoc(doc(db, COLLECTION_NAMES.MARKETPLACE_FOOD_CATEGORIES, editingId), payload)
        toast({ title: "Catégorie marketplace mise à jour" })
      } else {
        await setDoc(doc(db, COLLECTION_NAMES.MARKETPLACE_FOOD_CATEGORIES, slug), {
          ...payload,
          createdAt: serverTimestamp(),
        })
        toast({ title: "Catégorie marketplace créée" })
      }

      setForm(EMPTY_FORM)
      setEditingId(null)
      refetch()
    } catch (error) {
      console.error(error)
      toast({ title: "Enregistrement impossible", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (category: MarketplaceFoodCategory) => {
    setEditingId(category.id)
    setForm({
      name: category.name || "",
      slug: category.slug || category.id,
      imageUrl: category.imageUrl || "",
      sortOrder: String(category.sortOrder ?? 0),
      active: category.active !== false,
    })
  }

  const toggleCategory = async (category: MarketplaceFoodCategory) => {
    if (!db) return
    setPendingId(category.id)
    try {
      await updateDoc(doc(db, COLLECTION_NAMES.MARKETPLACE_FOOD_CATEGORIES, category.id), {
        active: category.active === false,
        updatedAt: serverTimestamp(),
      })
      refetch()
    } catch (error) {
      console.error(error)
      toast({ title: "Changement de statut impossible", variant: "destructive" })
    } finally {
      setPendingId(null)
    }
  }

  return (
    <PlatformPage width="full">
      <PlatformHeader
        title="Catégories marketplace"
        subtitle="Taxonomie globale utilisée uniquement par la découverte marketplace."
        meta={<Badge variant="outline"><Tags className="mr-1 size-3" />Plateforme uniquement</Badge>}
      />

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {editingId ? <Pencil className="size-5 text-primary" /> : <Plus className="size-5 text-primary" />}
              {editingId ? "Modifier une catégorie" : "Nouvelle catégorie globale"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={saveCategory}>
              <Field label="Nom">
                <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value, slug: editingId ? form.slug : slugify(event.target.value) })} />
              </Field>
              <Field label="Slug">
                <Input value={form.slug} onChange={(event) => setForm({ ...form, slug: slugify(event.target.value) })} disabled={Boolean(editingId)} />
              </Field>
              <Field label="Ordre">
                <Input type="number" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} />
              </Field>
              <div className="flex items-center justify-between rounded-xl border p-3">
                <div>
                  <Label>Active</Label>
                  <p className="text-xs text-muted-foreground">Seules les catégories actives sont lisibles publiquement.</p>
                </div>
                <Switch checked={form.active} onCheckedChange={(active) => setForm({ ...form, active })} />
              </div>
              <MediaSelector
                type="menu_template"
                label="Image"
                description="Image publique utilisée pour présenter cette catégorie globale."
                value={form.imageUrl}
                onChange={(imageUrl) => setForm({ ...form, imageUrl: imageUrl || "" })}
                onSelect={(media) => setForm({ ...form, imageUrl: media?.url || "" })}
              />
              <div className="flex justify-end gap-2">
                {editingId ? (
                  <Button type="button" variant="ghost" onClick={() => { setEditingId(null); setForm(EMPTY_FORM) }}>
                    Annuler
                  </Button>
                ) : null}
                <Button type="submit" disabled={saving || !form.name.trim()}>
                  {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  {editingId ? "Enregistrer" : "Créer"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Taxonomie globale</CardTitle>
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher" className="pl-9" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center p-12"><Loader2 className="size-7 animate-spin text-primary" /></div>
            ) : filteredCategories.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">Aucune catégorie marketplace.</div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {filteredCategories.map((category) => (
                  <div key={category.id} className="flex items-center gap-4 rounded-2xl border bg-card p-3 shadow-sm">
                    <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-secondary/40">
                      {category.imageUrl ? <img src={category.imageUrl} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="size-6 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-bold">{category.name}</p>
                        <Badge variant={category.active === false ? "outline" : "default"}>{category.active === false ? "Inactive" : "Active"}</Badge>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{category.slug}</p>
                      <p className="text-xs text-muted-foreground">Ordre {category.sortOrder ?? 0}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => startEdit(category)}>Gérer</Button>
                      <Button type="button" variant="ghost" size="sm" disabled={pendingId === category.id} onClick={() => void toggleCategory(category)}>
                        {category.active === false ? "Activer" : "Désactiver"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PlatformPage>
  )
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function slugify(value: unknown) {
  return normalizeMarketplaceSearch(value).replace(/\s+/g, "-").slice(0, 80)
}

function toInteger(value: unknown) {
  const parsed = Number.parseInt(String(value ?? "0"), 10)
  return Number.isFinite(parsed) ? parsed : 0
}
