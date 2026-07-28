"use client"

import RestaurantHoursSettings from "@/components/restaurant-hours/RestaurantHoursSettings"
import { PageHeader } from "@/design-system/components"
import { Clock } from "lucide-react"

export default function ManagerHoursPage() {
  return (
    <main className="space-y-6 pb-20">
      <PageHeader
        icon={Clock}
        title="Horaires"
        subtitle="Configurez les plages d'ouverture utilisées par le menu public et le marketplace."
      />
      <RestaurantHoursSettings />
    </main>
  )
}
