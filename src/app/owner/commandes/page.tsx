import { OwnerSectionPage } from "@/app/owner/_components/OwnerSectionPage"

export default function OwnerCommandesPage() {
  return (
    <OwnerSectionPage
      title="Commandes"
      description="Suivi des commandes avec le filtre global owner conservé."
      detailHref="/manager/commandes"
    />
  )
}

