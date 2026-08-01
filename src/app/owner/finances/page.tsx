import { OWNER_SIDEBAR_SECTIONS } from "@/config/owner-navigation"
import { OwnerNavigationHub } from "@/modules/owner-navigation/OwnerNavigationHub"

const financeItems = [
  ...(OWNER_SIDEBAR_SECTIONS.find((section) => section.label === "Activité")?.items.filter(
    (item) => item.id === "cash"
  ) ?? []),
  ...(OWNER_SIDEBAR_SECTIONS.find((section) => section.label === "Finances")?.items ?? []),
]

export default function OwnerFinancesPage() {
  return (
    <OwnerNavigationHub
      title="Finances"
      items={financeItems}
    />
  )
}
