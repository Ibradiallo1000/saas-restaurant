"use client"

import * as React from "react"
import { Clock, Save } from "lucide-react"
import { doc, serverTimestamp, updateDoc } from "firebase/firestore"

import { SettingsFieldGroup, SettingsForm, SettingsSaveBar, SettingsScheduleEditor, SettingsSection, SettingsTextField } from "@/components/settings-ui"
import { useFirestore } from "@/firebase"
import { useToast } from "@/hooks/use-toast"
import { COLLECTION_NAMES } from "@/lib/constants"
import {
  RESTAURANT_WEEKDAYS,
  normalizeOpeningHours,
  normalizeRestaurantTimezone,
  type RestaurantOpeningHours,
  type RestaurantWeekday,
} from "@/lib/restaurant-hours"
import { useRestaurant } from "@/design-system/context/RestaurantContext"

type ScheduleDay = React.ComponentProps<typeof SettingsScheduleEditor>["days"][number]

export default function RestaurantHoursSettings() {
  const db = useFirestore()
  const { restaurant, restaurantId } = useRestaurant()
  const { toast } = useToast()
  const [saving, setSaving] = React.useState(false)
  const [timezone, setTimezone] = React.useState("Africa/Bamako")
  const [openingHours, setOpeningHours] = React.useState<RestaurantOpeningHours>(() => normalizeOpeningHours(null))

  React.useEffect(() => {
    setTimezone(normalizeRestaurantTimezone(restaurant?.timezone))
    setOpeningHours(normalizeOpeningHours(restaurant?.openingHours))
  }, [restaurant?.openingHours, restaurant?.timezone])

  const days = React.useMemo<ScheduleDay[]>(() => RESTAURANT_WEEKDAYS.map((day) => {
    const value = openingHours[day.id]
    return {
      id: day.id,
      label: day.label,
      enabled: !value.isClosed,
      slots: value.slots.map((slot, index) => ({
        id: `${day.id}-${index}`,
        openTime: slot.open,
        closeTime: slot.close,
      })),
      state: value.isClosed ? "closed" : "enabled",
    }
  }), [openingHours])

  const updateDay = (id: string, changes: Partial<ScheduleDay>) => {
    const dayId = id as RestaurantWeekday
    setOpeningHours((current) => {
      const currentDay = current[dayId]
      const enabled = changes.enabled ?? !currentDay.isClosed
      const slots = changes.slots
        ? changes.slots.map((slot) => ({ open: slot.openTime, close: slot.closeTime }))
        : currentDay.slots
      return {
        ...current,
        [dayId]: {
          isClosed: !enabled,
          slots: enabled ? slots : [],
        },
      }
    })
  }

  const save = async () => {
    if (!db || !restaurantId) return
    setSaving(true)
    try {
      await updateDoc(doc(db, COLLECTION_NAMES.RESTAURANTS, restaurantId), {
        openingHours: normalizeOpeningHours(openingHours),
        timezone: normalizeRestaurantTimezone(timezone),
        updatedAt: serverTimestamp(),
      })
      toast({ title: "Horaires enregistrés", description: "Le statut public du restaurant sera recalculé automatiquement." })
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de sauvegarder les horaires." })
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsSection id="settings-hours" title="Horaires" description="Configurez les plages d'ouverture utilisées par le menu public et le marketplace." icon={<Clock />}>
      <SettingsForm onSubmit={(event) => { event.preventDefault(); void save() }} saving={saving}>
        <SettingsFieldGroup columns="one">
          <SettingsTextField label="Fuseau horaire" value={timezone} onChange={(event) => setTimezone(event.target.value)} placeholder="Africa/Bamako" />
        </SettingsFieldGroup>
        <SettingsScheduleEditor days={days} onDayChange={updateDay} disabled={saving} timezoneLabel={normalizeRestaurantTimezone(timezone)} />
        <SettingsSaveBar state={saving ? "saving" : "idle"} dirty={false} saving={saving} primaryAction={{ id: "save-hours", label: <><Save aria-hidden="true" className="mr-2 size-4"/>Enregistrer les horaires</>, onSelect: () => void save(), disabled: saving }} />
      </SettingsForm>
    </SettingsSection>
  )
}
