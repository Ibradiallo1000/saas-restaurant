"use client"

import * as React from "react"
import { Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  MARKETPLACE_CATEGORY_ICON_FAMILIES,
  MARKETPLACE_CATEGORY_ICON_FAMILY_LABELS,
  type MarketplaceCategoryIconKey,
} from "@/lib/marketplace-category-icons"
import type { LucideIcon } from "lucide-react"

export interface MarketplaceCategoryIconSelectorProps {
  value: MarketplaceCategoryIconKey | ""
  onChange: (iconKey: MarketplaceCategoryIconKey | "") => void
  label?: string
  description?: string
  clearLabel?: string
}

export function MarketplaceCategoryIconSelector({
  clearLabel = "Aucun pictogramme",
  description = "L'image configurée reste prioritaire sur l'icône.",
  label = "Icône",
  onChange,
  value,
}: MarketplaceCategoryIconSelectorProps) {
  const [search, setSearch] = React.useState("")
  const normalizedSearch = normalizeIconSearch(search)

  const families = React.useMemo(() => {
    return MARKETPLACE_CATEGORY_ICON_FAMILIES.map((family) => {
      const familyLabel = MARKETPLACE_CATEGORY_ICON_FAMILY_LABELS[family.key]
      const options = [...(family.options as readonly FamilyIconOption[])]
        .sort((a, b) => a.label.localeCompare(b.label, "fr"))
        .filter((option) => {
          if (!normalizedSearch) return true
          return normalizeIconSearch([
            option.key,
            option.label,
            familyLabel,
            ...(option.keywords ?? []),
          ].join(" ")).includes(normalizedSearch)
        })
      return { ...family, familyLabel, options }
    }).filter((family) => family.options.length > 0)
  }, [normalizedSearch])

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Rechercher une icône..."
          className="pl-9"
        />
      </div>
      <div className="max-h-96 space-y-4 overflow-y-auto rounded-2xl border bg-background p-3">
        {families.length > 0 ? (
          families.map((family) => (
            <div key={family.key} className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{family.familyLabel}</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {family.options.map((option) => {
                  const selected = value === option.key
                  return (
                    <button
                      key={option.key}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => onChange(option.key as MarketplaceCategoryIconKey)}
                      className={[
                        "flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl border px-2 py-3 text-center text-xs font-semibold transition",
                        selected
                          ? "border-primary bg-primary/10 text-primary shadow-sm"
                          : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
                      ].join(" ")}
                    >
                      <option.Icon aria-hidden="true" className="size-5" />
                      <span className="line-clamp-2 leading-4">{option.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Aucune icône ne correspond à cette recherche.
          </div>
        )}
      </div>
      <Button type="button" variant="ghost" size="sm" className="px-0 text-xs" onClick={() => onChange("")} disabled={!value}>
        {clearLabel}
      </Button>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
    </div>
  )
}

function normalizeIconSearch(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

type FamilyIconOption = {
  key: string
  label: string
  Icon: LucideIcon
  keywords?: readonly string[]
}
