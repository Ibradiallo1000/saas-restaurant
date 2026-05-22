"use client"

import CategoryCard from "./CategoryCard"

export default function CategoriesGrid({
  categories,
  onSelect,
}: {
  categories: any[]
  onSelect: (category: any) => void
}) {
  return (
    <div className="grid grid-cols-3 gap-4 sm:grid-cols-4">
      {categories.map((category) => (
        <CategoryCard key={category.id} category={category} onSelect={onSelect} />
      ))}
    </div>
  )
}
