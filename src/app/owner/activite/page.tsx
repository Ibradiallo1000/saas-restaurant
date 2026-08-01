import { OWNER_SIDEBAR_SECTIONS } from "@/config/owner-navigation"
import { OwnerNavigationHub } from "@/modules/owner-navigation/OwnerNavigationHub"

const activityItems =
  OWNER_SIDEBAR_SECTIONS.find((section) => section.label === "Activité")?.items.filter(
    (item) => item.id === "orders" || item.id === "reviews"
  ) ?? []

export default function OwnerActivityPage() {
  return (
    <OwnerNavigationHub
      title="Activité"
      items={activityItems}
    />
  )
}
