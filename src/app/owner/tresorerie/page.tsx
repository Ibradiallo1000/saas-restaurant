import { OwnerSectionPage } from "@/app/owner/_components/OwnerSectionPage"

export default function OwnerTresoreriePage() {
  return (
    <OwnerSectionPage
      title="Trésorerie"
      description="Synthèse de trésorerie avec le filtre global owner conservé."
      detailHref="/manager/tresorerie"
    />
  )
}
