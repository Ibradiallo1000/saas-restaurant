export type RestaurantWeekday = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday"

export interface RestaurantOpeningSlot {
  open: string
  close: string
}

export interface RestaurantOpeningDay {
  isClosed: boolean
  slots: RestaurantOpeningSlot[]
}

export type RestaurantOpeningHours = Record<RestaurantWeekday, RestaurantOpeningDay>

export interface RestaurantOpenStatus {
  isOpenNow: boolean
  label: "Ouvert" | "Fermé"
  detail: string
  nextOpening: Date | null
  nextClosing: Date | null
}

export const RESTAURANT_WEEKDAYS: Array<{ id: RestaurantWeekday; label: string }> = [
  { id: "monday", label: "Lundi" },
  { id: "tuesday", label: "Mardi" },
  { id: "wednesday", label: "Mercredi" },
  { id: "thursday", label: "Jeudi" },
  { id: "friday", label: "Vendredi" },
  { id: "saturday", label: "Samedi" },
  { id: "sunday", label: "Dimanche" },
]

const WEEKDAY_INDEX: RestaurantWeekday[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
const DEFAULT_TIMEZONE = "Africa/Bamako"
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

export function createDefaultOpeningHours(): RestaurantOpeningHours {
  return RESTAURANT_WEEKDAYS.reduce((hours, day) => {
    hours[day.id] = { isClosed: false, slots: [{ open: "08:00", close: "23:00" }] }
    return hours
  }, {} as RestaurantOpeningHours)
}

export function normalizeRestaurantTimezone(value: unknown) {
  const timezone = typeof value === "string" && value.trim() ? value.trim() : DEFAULT_TIMEZONE
  try {
    new Intl.DateTimeFormat("fr-FR", { timeZone: timezone }).format(new Date())
    return timezone
  } catch {
    return DEFAULT_TIMEZONE
  }
}

export function normalizeOpeningHours(value: unknown): RestaurantOpeningHours {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {}
  return RESTAURANT_WEEKDAYS.reduce((hours, day) => {
    const rawDay = source[day.id]
    const raw = rawDay && typeof rawDay === "object" ? rawDay as Record<string, unknown> : null
    const slots = Array.isArray(raw?.slots)
      ? raw.slots.map(normalizeSlot).filter((slot): slot is RestaurantOpeningSlot => Boolean(slot)).slice(0, 4)
      : []
    const isClosed = raw ? raw.isClosed === true || slots.length === 0 : false
    hours[day.id] = { isClosed, slots: isClosed ? [] : slots.length ? slots : [{ open: "08:00", close: "23:00" }] }
    return hours
  }, {} as RestaurantOpeningHours)
}

export function getRestaurantOpenStatus(input: {
  openingHours?: unknown
  timezone?: unknown
  now?: Date
}): RestaurantOpenStatus {
  const timezone = normalizeRestaurantTimezone(input.timezone)
  const openingHours = normalizeOpeningHours(input.openingHours)
  const now = input.now ?? new Date()
  const localNow = getZonedParts(now, timezone)
  const nowMinutes = localNow.hour * 60 + localNow.minute

  for (const slot of getSlotsForLocalDay(openingHours, localNow.weekday)) {
    const open = timeToMinutes(slot.open)
    const close = timeToMinutes(slot.close)
    const openNow = close > open
      ? nowMinutes >= open && nowMinutes < close
      : nowMinutes >= open || nowMinutes < close
    if (openNow) {
      const closeDate = zonedDateFromOffset(now, timezone, close <= open && nowMinutes >= open ? 1 : 0, slot.close)
      return {
        isOpenNow: true,
        label: "Ouvert",
        detail: `Ferme à ${formatTime(slot.close)}`,
        nextOpening: null,
        nextClosing: closeDate,
      }
    }
  }

  const nextOpening = findNextOpening(openingHours, timezone, now)
  return {
    isOpenNow: false,
    label: "Fermé",
    detail: nextOpening ? formatOpeningDetail(nextOpening, timezone, now) : "Aucune ouverture prévue",
    nextOpening,
    nextClosing: null,
  }
}

function normalizeSlot(value: unknown): RestaurantOpeningSlot | null {
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  const open = typeof record.open === "string" ? record.open.trim() : ""
  const close = typeof record.close === "string" ? record.close.trim() : ""
  if (!TIME_PATTERN.test(open) || !TIME_PATTERN.test(close) || open === close) return null
  return { open, close }
}

function getSlotsForLocalDay(openingHours: RestaurantOpeningHours, weekday: RestaurantWeekday) {
  const today = openingHours[weekday]
  return today.isClosed ? [] : today.slots
}

function findNextOpening(openingHours: RestaurantOpeningHours, timezone: string, now: Date) {
  const localNow = getZonedParts(now, timezone)
  const nowMinutes = localNow.hour * 60 + localNow.minute
  for (let offset = 0; offset < 8; offset += 1) {
    const weekday = WEEKDAY_INDEX[(WEEKDAY_INDEX.indexOf(localNow.weekday) + offset) % 7]
    const day = openingHours[weekday]
    if (day.isClosed) continue
    const slots = [...day.slots].sort((a, b) => timeToMinutes(a.open) - timeToMinutes(b.open))
    for (const slot of slots) {
      if (offset === 0 && timeToMinutes(slot.open) <= nowMinutes) continue
      return zonedDateFromOffset(now, timezone, offset, slot.open)
    }
  }
  return null
}

function getZonedParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date)
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? ""
  const weekdayMap: Record<string, RestaurantWeekday> = { Sun: "sunday", Mon: "monday", Tue: "tuesday", Wed: "wednesday", Thu: "thursday", Fri: "friday", Sat: "saturday" }
  return {
    weekday: weekdayMap[value("weekday")] ?? "monday",
    hour: Number(value("hour")) || 0,
    minute: Number(value("minute")) || 0,
  }
}

function zonedDateFromOffset(reference: Date, timezone: string, dayOffset: number, time: string) {
  const zoned = new Date(reference.toLocaleString("en-US", { timeZone: timezone }))
  zoned.setDate(zoned.getDate() + dayOffset)
  const [hour, minute] = time.split(":").map(Number)
  zoned.setHours(hour, minute, 0, 0)
  return zoned
}

function timeToMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number)
  return hour * 60 + minute
}

function formatTime(value: string) {
  return value.replace(":", "h")
}

function formatOpeningDetail(opening: Date, timezone: string, now: Date) {
  const openingDay = getZonedParts(opening, timezone).weekday
  const currentDay = getZonedParts(now, timezone).weekday
  const tomorrow = WEEKDAY_INDEX[(WEEKDAY_INDEX.indexOf(currentDay) + 1) % 7]
  const time = opening.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }).replace(":", "h")
  if (openingDay === currentDay) return `Ouvre à ${time}`
  if (openingDay === tomorrow) return `Ouvre demain à ${time}`
  const label = RESTAURANT_WEEKDAYS.find((day) => day.id === openingDay)?.label.toLocaleLowerCase("fr") ?? "bientôt"
  return `Ouvre ${label} à ${time}`
}
