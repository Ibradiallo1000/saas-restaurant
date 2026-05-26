"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

export type TimeFilterType = "today" | "week" | "month" | "custom"

export interface TimeFilterState {
  type: TimeFilterType
  startDate?: Date
  endDate?: Date
}

type TimeFilterContextValue = {
  filter: TimeFilterState
  type: TimeFilterType
  dateRange: {
    start: string
    end: string
  }
  setFilter: (filter: TimeFilterState) => void
  setCustomRange: (startDate: Date, endDate: Date) => void
  setType: (type: TimeFilterType) => void
  setDateRange: (range: { start: string; end: string }) => void
}

const TimeFilterContext = React.createContext<TimeFilterContextValue | null>(null)

export function TimeFilterProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname() || "/owner"
  const searchParams = useSearchParams()
  const initialType = parseTimeFilterType(searchParams?.get("range") ?? null)
  const [type, setTypeState] = React.useState<TimeFilterType>(initialType)
  const [dateRange, setDateRangeState] = React.useState(() => ({
    start: searchParams?.get("start") || getInputDateValue(new Date()),
    end: searchParams?.get("end") || getInputDateValue(new Date()),
  }))
  const filter = React.useMemo<TimeFilterState>(() => {
    const range = getDateRange({
      type,
      startDate: parseInputDate(dateRange.start) || undefined,
      endDate: parseInputDate(dateRange.end) || undefined,
    })
    return { type, startDate: range.startDate, endDate: range.endDate }
  }, [dateRange.end, dateRange.start, type])

  React.useEffect(() => {
    const nextType = parseTimeFilterType(searchParams?.get("range") ?? null)
    const nextStart = searchParams?.get("start") || dateRange.start
    const nextEnd = searchParams?.get("end") || dateRange.end
    setTypeState(nextType)
    setDateRangeState({ start: nextStart, end: nextEnd })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const updateUrl = React.useCallback(
    (nextType: TimeFilterType, nextRange: { start: string; end: string }) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "")
      params.set("range", nextType)
      if (nextType === "custom") {
        params.set("start", nextRange.start)
        params.set("end", nextRange.end)
      } else {
        params.delete("start")
        params.delete("end")
      }
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  const setType = React.useCallback(
    (nextType: TimeFilterType) => {
      setTypeState(nextType)
      updateUrl(nextType, dateRange)
    },
    [dateRange, updateUrl]
  )

  const setDateRange = React.useCallback(
    (nextRange: { start: string; end: string }) => {
      setDateRangeState(nextRange)
      updateUrl("custom", nextRange)
    },
    [updateUrl]
  )

  const setFilter = React.useCallback(
    (nextFilter: TimeFilterState) => {
      const nextType = nextFilter.type
      const nextRange = {
        start: getInputDateValue(nextFilter.startDate || new Date()),
        end: getInputDateValue(nextFilter.endDate || nextFilter.startDate || new Date()),
      }
      setTypeState(nextType)
      setDateRangeState(nextRange)
      updateUrl(nextType, nextRange)
    },
    [updateUrl]
  )

  const setCustomRange = React.useCallback(
    (startDate: Date, endDate: Date) => {
      const nextRange = {
        start: getInputDateValue(startDate),
        end: getInputDateValue(endDate),
      }
      setTypeState("custom")
      setDateRangeState(nextRange)
      updateUrl("custom", nextRange)
    },
    [updateUrl]
  )

  const value = React.useMemo(
    () => ({ filter, type, dateRange, setFilter, setCustomRange, setType, setDateRange }),
    [dateRange, filter, setCustomRange, setDateRange, setFilter, setType, type]
  )

  return <TimeFilterContext.Provider value={value}>{children}</TimeFilterContext.Provider>
}

export function useTimeFilter() {
  const value = React.useContext(TimeFilterContext)
  if (!value) {
    throw new Error("useTimeFilter must be used inside TimeFilterProvider")
  }
  return value
}

function parseTimeFilterType(value: string | null): TimeFilterType {
  if (value === "week" || value === "month" || value === "custom") return value
  return "today"
}

function getInputDateValue(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function getDateRange(filter: TimeFilterState) {
  const now = new Date()
  if (filter.type === "week") {
    return { startDate: startOfDay(addDays(now, -6)), endDate: endOfDay(now) }
  }
  if (filter.type === "month") {
    return { startDate: startOfDay(addDays(now, -29)), endDate: endOfDay(now) }
  }
  if (filter.type === "custom") {
    const start = filter.startDate || now
    const end = filter.endDate || start
    return { startDate: startOfDay(start), endDate: endOfDay(end < start ? start : end) }
  }
  return { startDate: startOfDay(now), endDate: endOfDay(now) }
}

export function getPreviousDateRange(filter: TimeFilterState) {
  const current = getDateRange(filter)
  const durationMs = Math.max(1, current.endDate.getTime() - current.startDate.getTime())
  return {
    startDate: new Date(current.startDate.getTime() - durationMs - 1),
    endDate: new Date(current.startDate.getTime() - 1),
  }
}

function parseInputDate(value: string) {
  if (!value) return null
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function startOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function endOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(23, 59, 59, 999)
  return next
}

function addDays(date: Date, amount: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}
