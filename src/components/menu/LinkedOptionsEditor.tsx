"use client"

import * as React from "react"
import { Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  createLinkedOptionGroup,
  type LinkedOptionGroup,
} from "@/lib/linked-option-groups"

type LinkedOptionsEditorProps = {
  groups: LinkedOptionGroup[]
  setGroups: React.Dispatch<React.SetStateAction<LinkedOptionGroup[]>>
  categories: Array<{ id: string; name: string }>
  products: Array<{ id: string; name: string; categoryId?: string; isActive?: boolean }>
}

export default function LinkedOptionsEditor({
  groups,
  setGroups,
  categories,
  products,
}: LinkedOptionsEditorProps) {
  const activeProducts = products.filter((product) => product.isActive !== false)

  const addGroup = () => {
    setGroups((current) => [
      ...current,
      createLinkedOptionGroup({
        title: "",
        required: false,
        minSelect: 0,
        maxSelect: 1,
        sourceType: "category",
        categoryIds: [],
        productIds: [],
        pricingMode: "normal",
        active: true,
      }),
    ])
  }

  const updateGroup = (index: number, patch: Partial<LinkedOptionGroup>) => {
    setGroups((current) =>
      current.map((group, groupIndex) =>
        groupIndex === index ? { ...group, ...patch } : group
      )
    )
  }

  const removeGroup = (index: number) => {
    setGroups((current) => current.filter((_, groupIndex) => groupIndex !== index))
  }

  const toggleCategory = (index: number, categoryId: string) => {
    setGroups((current) =>
      current.map((group, groupIndex) => {
        if (groupIndex !== index) return group
        const categoryIds = new Set(group.categoryIds || [])
        if (categoryIds.has(categoryId)) categoryIds.delete(categoryId)
        else categoryIds.add(categoryId)
        return { ...group, categoryIds: Array.from(categoryIds) }
      })
    )
  }

  const toggleProduct = (index: number, productId: string) => {
    setGroups((current) =>
      current.map((group, groupIndex) => {
        if (groupIndex !== index) return group
        const productIds = new Set(group.productIds || [])
        if (productIds.has(productId)) productIds.delete(productId)
        else productIds.add(productId)
        return { ...group, productIds: Array.from(productIds) }
      })
    )
  }

  return (
    <div className="space-y-4 border-t pt-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-sm">Options liées / Suggestions</h3>
          <p className="text-xs text-muted-foreground">
            Proposez des accompagnements, boissons ou sauces sans dupliquer les produits.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addGroup}>
          <Plus className="mr-2 h-4 w-4" />
          Ajouter un groupe
        </Button>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
          Aucun groupe configuré. Le produit sera ajouté directement au panier comme aujourd&apos;hui.
        </div>
      ) : null}

      {groups.map((group, index) => {
        const scopedProducts =
          group.sourceType === "category" && (group.categoryIds?.length || 0) > 0
            ? activeProducts.filter((product) => group.categoryIds?.includes(product.categoryId || ""))
            : activeProducts

        return (
          <div key={group.id} className="space-y-3 rounded-lg border p-4">
            <div className="flex gap-2">
              <Input
                placeholder="Titre du groupe (ex: Choisir un accompagnement)"
                value={group.title}
                onChange={(event) => updateGroup(index, { title: event.target.value })}
              />
              <Button type="button" variant="destructive" size="icon" onClick={() => removeGroup(index)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={group.required}
                  onChange={(event) =>
                    updateGroup(index, {
                      required: event.target.checked,
                      minSelect: event.target.checked ? Math.max(group.minSelect, 1) : group.minSelect,
                    })
                  }
                />
                Groupe obligatoire
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={group.active}
                  onChange={(event) => updateGroup(index, { active: event.target.checked })}
                />
                Actif
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Minimum</span>
                <Input
                  type="number"
                  min={0}
                  value={group.minSelect}
                  onChange={(event) =>
                    updateGroup(index, { minSelect: Math.max(0, Number(event.target.value || 0)) })
                  }
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Maximum</span>
                <Input
                  type="number"
                  min={1}
                  value={group.maxSelect}
                  onChange={(event) =>
                    updateGroup(index, { maxSelect: Math.max(1, Number(event.target.value || 1)) })
                  }
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Source</span>
                <select
                  className="w-full rounded-md border bg-background p-2"
                  value={group.sourceType}
                  onChange={(event) =>
                    updateGroup(index, {
                      sourceType: event.target.value === "products" ? "products" : "category",
                    })
                  }
                >
                  <option value="category">Catégorie(s)</option>
                  <option value="products">Produits sélectionnés</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Prix</span>
                <select
                  className="w-full rounded-md border bg-background p-2"
                  value={group.pricingMode}
                  onChange={(event) =>
                    updateGroup(index, {
                      pricingMode: event.target.value === "included" ? "included" : "normal",
                    })
                  }
                >
                  <option value="normal">Prix normal du produit</option>
                  <option value="included">Inclus dans le plat principal</option>
                </select>
              </label>
            </div>

            {group.sourceType === "category" ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Catégories source</p>
                <div className="flex flex-wrap gap-2">
                  {categories.map((category) => {
                    const active = group.categoryIds?.includes(category.id)
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => toggleCategory(index, category.id)}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                          active ? "border-primary bg-primary/10 text-primary" : "bg-muted"
                        }`}
                      >
                        {category.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                {group.sourceType === "category"
                  ? "Produits proposés (optionnel, filtre dans la catégorie)"
                  : "Produits proposés"}
              </p>
              <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
                {(group.sourceType === "products" ? activeProducts : scopedProducts).map((product) => {
                  const active = group.productIds?.includes(product.id)
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => toggleProduct(index, product.id)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        active ? "border-primary bg-primary/10 text-primary" : "bg-muted"
                      }`}
                    >
                      {product.name}
                    </button>
                  )
                })}
              </div>
              {(group.sourceType === "products" && (group.productIds?.length || 0) === 0) ||
              (group.sourceType === "category" && (group.categoryIds?.length || 0) === 0) ? (
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                  Sélectionnez au moins une source valide
                </Badge>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}
