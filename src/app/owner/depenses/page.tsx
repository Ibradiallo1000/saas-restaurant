import { OwnerSectionPage } from "@/app/owner/_components/OwnerSectionPage"

export default function OwnerDepensesPage() {
  return (
    <OwnerSectionPage
      title="Dépenses"
      description="Vue des sorties d’argent avec le filtre global owner conservé."
      detailHref="/manager/depenses"
    />
  )
}
