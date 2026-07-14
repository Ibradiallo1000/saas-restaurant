"use client"

import * as React from "react"
import { ShoppingCart, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  ProductCommerceModal,
  PublicButton,
  PublicOptionChoice,
  PublicOptionGroup,
} from "@/components/public-ui"
import { getOptimizedImage } from "@/lib/image"
import { getProductConfigGroups } from "@/lib/product-configurator"
import {
  getActiveLinkedOptionGroups,
  getLinkedSelectionUnitPrice,
  resolveLinkedGroupProducts,
  validateLinkedOptionSelections,
  type LinkedOptionGroup,
  type LinkedOptionSelection,
} from "@/lib/linked-option-groups"
import { cn } from "@/lib/utils"
import type { SelectedCartOption } from "@/modules/restaurant/types"

type ProductConfiguratorModalProps = {
  product: any
  catalogProducts: any[]
  embeddedSelections: Record<string, SelectedCartOption>
  linkedSelections: LinkedOptionSelection[]
  unitPrice: number
  onToggleEmbeddedChoice: (
    group: { name: string; multiple?: boolean },
    choice: { name: string; price?: number }
  ) => void
  onToggleLinkedProduct: (group: LinkedOptionGroup, productId: string) => void
  onClose: () => void
  onAdd: () => void
  validationError?: string | null
  publicCommerceShell?: boolean
}

export default function ProductConfiguratorModal({
  product,
  catalogProducts,
  embeddedSelections,
  linkedSelections,
  unitPrice,
  onToggleEmbeddedChoice,
  onToggleLinkedProduct,
  onClose,
  onAdd,
  validationError,
  publicCommerceShell = false,
}: ProductConfiguratorModalProps) {
  const embeddedGroups = getProductConfigGroups(product)
  const linkedGroups = getActiveLinkedOptionGroups(product)
  const linkedTotal = linkedGroups.reduce((sum, group) => {
    const selected = linkedSelections.filter((selection) => selection.groupId === group.id)
    return (
      sum +
      selected.reduce((groupSum, selection) => {
        const linkedProduct = resolveLinkedGroupProducts(group, catalogProducts).find(
          (item) => item.id === selection.productId
        )
        if (!linkedProduct) return groupSum
        return groupSum + getLinkedSelectionUnitPrice(linkedProduct, group.pricingMode)
      }, 0)
    )
  }, 0)

  React.useEffect(() => {
    if (publicCommerceShell) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose, publicCommerceShell])

  const description =
    product.description || product.shortDescription || product.details || null

  if (publicCommerceShell) {
    return (
      <ProductCommerceModal
        open
        onOpenChange={(open) => { if (!open) onClose() }}
        title={product.name}
        description={description}
        imageUrl={product.imageUrl ? getOptimizedImage(product.imageUrl, 720) : undefined}
        imageAlt={product.name}
        imageFallback={<ShoppingCart className="size-10" />}
        price={`${(unitPrice + linkedTotal).toLocaleString("fr-FR")} FCFA`}
        footer={
          <PublicButton type="button" size="action" fullWidth onClick={onAdd}>
            Ajouter au panier
          </PublicButton>
        }
      >
        <ConfiguratorOptionsContent
          embeddedGroups={embeddedGroups}
          linkedGroups={linkedGroups}
          catalogProducts={catalogProducts}
          embeddedSelections={embeddedSelections}
          linkedSelections={linkedSelections}
          onToggleEmbeddedChoice={onToggleEmbeddedChoice}
          onToggleLinkedProduct={onToggleLinkedProduct}
          validationError={validationError}
        />
      </ProductCommerceModal>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="mx-auto flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-card shadow-xl">
        <div className="relative h-44 w-full shrink-0 bg-muted">
          {product.imageUrl ? (
            <img
              src={getOptimizedImage(product.imageUrl, 720)}
              className="h-44 w-full object-cover"
              alt={product.name}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <ShoppingCart className="h-10 w-10 text-muted-foreground" />
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-full bg-background/90 p-2 text-foreground shadow-sm hover:bg-background"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <div className="space-y-1">
            <h2 className="text-lg font-bold">{product.name}</h2>
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
            <p className="font-bold text-primary">
              {(unitPrice + linkedTotal).toLocaleString("fr-FR")} FCFA
            </p>
          </div>

          {embeddedGroups.map((group) => (
            <div key={group.name}>
              <p className="mb-2 text-[10px] font-black uppercase text-muted-foreground">
                {group.name}
                {group.required ? " *" : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                {group.choices.map((choice) => {
                  const active = group.multiple
                    ? Boolean(embeddedSelections[`${group.name}:${choice.name}`])
                    : embeddedSelections[group.name]?.choiceName === choice.name

                  return (
                    <button
                      key={choice.name}
                      type="button"
                      onClick={() => onToggleEmbeddedChoice(group, choice)}
                      className={cn(
                        "rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-bold text-foreground",
                        active && "border-primary bg-primary/10 text-primary"
                      )}
                    >
                      {choice.name}
                      {choice.price ? ` +${Number(choice.price).toLocaleString("fr-FR")}` : ""}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {linkedGroups.map((group) => {
            const products = resolveLinkedGroupProducts(group, catalogProducts)
            const selectedInGroup = linkedSelections.filter((selection) => selection.groupId === group.id)

            return (
              <div key={group.id}>
                <p className="mb-2 text-[10px] font-black uppercase text-muted-foreground">
                  {group.title}
                  {group.required ? " *" : ""}
                  <span className="ml-2 normal-case text-muted-foreground">
                    ({group.minSelect}-{group.maxSelect})
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {products.map((linkedProduct) => {
                    const active = selectedInGroup.some(
                      (selection) => selection.productId === linkedProduct.id
                    )
                    const price = getLinkedSelectionUnitPrice(linkedProduct, group.pricingMode)

                    return (
                      <button
                        key={linkedProduct.id}
                        type="button"
                        onClick={() => onToggleLinkedProduct(group, linkedProduct.id)}
                        className={cn(
                          "rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-bold text-foreground",
                          active && "border-primary bg-primary/10 text-primary"
                        )}
                      >
                        {linkedProduct.name}
                        {price > 0 ? ` +${price.toLocaleString("fr-FR")}` : " inclus"}
                      </button>
                    )
                  })}
                </div>
                {products.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Aucun produit disponible dans ce groupe.</p>
                ) : null}
              </div>
            )
          })}

          {validationError ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              {validationError}
            </p>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-border p-4">
          <Button type="button" className="w-full rounded-xl py-3 font-semibold" onClick={onAdd}>
            Ajouter au panier
          </Button>
        </div>
      </div>
    </div>
  )
}

function ConfiguratorOptionsContent({
  embeddedGroups,
  linkedGroups,
  catalogProducts,
  embeddedSelections,
  linkedSelections,
  onToggleEmbeddedChoice,
  onToggleLinkedProduct,
  validationError,
}: {
  embeddedGroups: ReturnType<typeof getProductConfigGroups>
  linkedGroups: LinkedOptionGroup[]
  catalogProducts: any[]
  embeddedSelections: Record<string, SelectedCartOption>
  linkedSelections: LinkedOptionSelection[]
  onToggleEmbeddedChoice: ProductConfiguratorModalProps["onToggleEmbeddedChoice"]
  onToggleLinkedProduct: ProductConfiguratorModalProps["onToggleLinkedProduct"]
  validationError?: string | null
}) {
  return (
    <div className="space-y-4">
      {embeddedGroups.map((group) => {
        const selectedCount = group.multiple
          ? Object.keys(embeddedSelections).filter((key) => key.startsWith(`${group.name}:`)).length
          : embeddedSelections[group.name] ? 1 : 0
        const groupError = validationError?.includes(group.name) ? validationError : null

        return (
          <PublicOptionGroup
            key={group.name}
            title={group.name}
            required={group.required}
            min={group.required ? 1 : 0}
            max={group.multiple ? undefined : 1}
            selectedCount={selectedCount}
            error={groupError}
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {group.choices.map((choice) => {
                const active = group.multiple
                  ? Boolean(embeddedSelections[`${group.name}:${choice.name}`])
                  : embeddedSelections[group.name]?.choiceName === choice.name

                return (
                  <PublicOptionChoice
                    key={choice.name}
                    name={`embedded-${group.name}`}
                    value={choice.name}
                    label={choice.name}
                    price={choice.price ? `+${Number(choice.price).toLocaleString("fr-FR")} FCFA` : undefined}
                    selected={active}
                    required={group.required && !group.multiple}
                    controlType={group.multiple ? "checkbox" : "radio"}
                    presentation="card"
                    onSelect={() => onToggleEmbeddedChoice(group, choice)}
                  />
                )
              })}
            </div>
          </PublicOptionGroup>
        )
      })}

      {linkedGroups.map((group) => {
        const products = resolveLinkedGroupProducts(group, catalogProducts)
        const selectedInGroup = linkedSelections.filter((selection) => selection.groupId === group.id)
        const groupError = validationError?.includes(group.title) ? validationError : null

        return (
          <PublicOptionGroup
            key={group.id}
            title={group.title}
            required={group.required}
            min={group.minSelect}
            max={group.maxSelect}
            selectedCount={selectedInGroup.length}
            error={groupError}
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {products.map((linkedProduct) => {
                const active = selectedInGroup.some(
                  (selection) => selection.productId === linkedProduct.id
                )
                const price = getLinkedSelectionUnitPrice(linkedProduct, group.pricingMode)

                return (
                  <PublicOptionChoice
                    key={linkedProduct.id}
                    name={`linked-${group.id}`}
                    value={linkedProduct.id}
                    label={linkedProduct.name}
                    price={price > 0 ? `+${price.toLocaleString("fr-FR")} FCFA` : "Inclus"}
                    selected={active}
                    required={group.required && group.maxSelect === 1}
                    controlType={group.maxSelect === 1 ? "radio" : "checkbox"}
                    presentation="card"
                    onSelect={() => onToggleLinkedProduct(group, linkedProduct.id)}
                  />
                )
              })}
            </div>
            {products.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucun produit disponible dans ce groupe.</p>
              ) : null}
          </PublicOptionGroup>
        )
      })}

      {validationError && !embeddedGroups.some((group) => validationError.includes(group.name)) && !linkedGroups.some((group) => validationError.includes(group.title)) ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {validationError}
        </p>
      ) : null}
    </div>
  )
}

export function validateConfiguratorSelections(
  product: any,
  embeddedSelections: Record<string, SelectedCartOption>,
  linkedSelections: LinkedOptionSelection[]
): string | null {
  const embeddedGroups = getProductConfigGroups(product)

  for (const group of embeddedGroups) {
    if (!group.required) continue
    const hasSelection = group.multiple
      ? Object.keys(embeddedSelections).some((key) => key.startsWith(`${group.name}:`))
      : Boolean(embeddedSelections[group.name])
    if (!hasSelection) {
      return `L'option « ${group.name} » est obligatoire`
    }
  }

  return validateLinkedOptionSelections(getActiveLinkedOptionGroups(product), linkedSelections)
}
