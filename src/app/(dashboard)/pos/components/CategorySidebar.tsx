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
  return <PosCategoryRail className="overflow-y-hidden rounded-[var(--radius-dashboard-widget)] border border-[var(--pos-border)] bg-[var(--pos-panel)] p-1.5 [&>button]:min-h-12 [&>button]:min-w-[4.25rem] [&>button]:gap-1 [&>button]:px-1.5 [&>button]:py-1 [&>button_img]:size-6 md:p-2 md:[&>button]:min-h-[4.75rem] md:[&>button]:min-w-[5rem] md:[&>button]:gap-1.5 md:[&>button]:px-2 md:[&>button]:py-2 md:[&>button_img]:size-8" items={items} value={selectedCategoryId ?? "__all__"} onValueChange={(id) => onSelectCategory(id === "__all__" ? null : id)} />
}
