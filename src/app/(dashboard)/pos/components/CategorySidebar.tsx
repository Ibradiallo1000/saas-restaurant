"use client"

import * as React from "react"
import { PosCategoryRail } from "@/components/pos-ui"

type CategorySidebarProps = {
  categories: any[]
  selectedCategoryId: string | null
  onSelectCategory: (categoryId: string | null) => void
}

export default function CategorySidebar({
  categories,
  selectedCategoryId,
  onSelectCategory,
}: CategorySidebarProps) {
  const items = React.useMemo(() => [{ id: "__all__", label: "Tous" }, ...categories.map((category: any) => ({ id: category.id, label: category.name || "Catégorie", imageUrl: category.imageUrl, iconKey: category.iconKey }))], [categories])
  return <PosCategoryRail className="overflow-y-hidden rounded-[var(--radius-dashboard-widget)] border border-[var(--pos-border)] bg-[var(--pos-panel)] p-2" items={items} value={selectedCategoryId ?? "__all__"} onValueChange={(id) => onSelectCategory(id === "__all__" ? null : id)} />
}
