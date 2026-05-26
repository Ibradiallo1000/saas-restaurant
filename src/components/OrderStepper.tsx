"use client"

import * as React from "react"
import { Bell, CheckCircle2, ChefHat, Clock, ReceiptText, type LucideIcon } from "lucide-react"

import { getClientOrderStep, getClientStatusLabel } from "@/lib/getClientOrderStep"
import { cn } from "@/lib/utils"

type OrderStepperProps = {
  orderType?: string | null
  kitchenStatus?: string | null
  legacyStatus?: string | null
  currentStep?: number
  currentStatusLabel?: string
  createdAt?: unknown
  timestamps?: {
    preparingAt?: unknown
    readyAt?: unknown
    servedAt?: unknown
    pickedUpAt?: unknown
    finalAt?: unknown
  } | null
}

type StepKey = "pending" | "preparing" | "ready" | "final"
type TrackingStep = {
  key: StepKey
  label: string
  icon: LucideIcon
  at: Date | null
  deltaMs: number | null
}

export function OrderStepper({
  orderType,
  kitchenStatus,
  legacyStatus,
  currentStep,
  currentStatusLabel,
  createdAt,
  timestamps,
}: OrderStepperProps) {
  const [now, setNow] = React.useState(() => Date.now())

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(id)
  }, [])

  const normalizedType = normalizeTrackingOrderType(orderType)
  const step = currentStep ?? getClientOrderStep({ kitchenStatus, status: legacyStatus })
  const progress = Math.min(100, Math.max(25, step * 25))
  const currentIndex = Math.min(3, Math.max(0, step - 1))
  const statusLabel = currentStatusLabel ?? getClientStatusLabel({ kitchenStatus, status: legacyStatus })
  const createdDate = toDate(createdAt)
  const steps = getTrackingSteps(normalizedType, createdDate, timestamps)

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-background p-3">
        <div className="relative">
          <div className="absolute left-[12.5%] right-[12.5%] top-5 h-1 rounded-full bg-muted" />
          <div
            className="absolute left-[12.5%] top-5 h-1 rounded-full bg-green-500 transition-all"
            style={{ width: `calc(75% * ${Math.max(0, currentIndex) / 3})` }}
          />

          <div className="relative grid grid-cols-4 gap-2">
            {steps.map((step, index) => {
              const Icon = step.icon
              const isCompleted = index < currentIndex
              const isCurrent = index === currentIndex
              const isFuture = index > currentIndex

              return (
                <div key={step.key} className="flex min-w-0 flex-col items-center gap-2 text-center">
                  <div
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-full border-2 shadow-sm transition",
                      isCompleted && "border-green-500 bg-green-500 text-white",
                      isCurrent && "border-orange-500 bg-orange-500 text-white",
                      isFuture && "border-muted bg-muted text-muted-foreground"
                    )}
                  >
                    {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <div className="min-h-[54px]">
                    <p
                      className={cn(
                        "text-[10px] font-black leading-tight sm:text-xs",
                        isFuture ? "text-muted-foreground" : "text-foreground"
                      )}
                    >
                      {step.label}
                    </p>
                    {step.at ? (
                      <p className="mt-1 text-[10px] font-semibold leading-tight text-muted-foreground">
                        {formatTime(step.at)}
                        {step.deltaMs !== null ? <span className="block">+{formatDuration(step.deltaMs)}</span> : null}
                      </p>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-orange-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-background px-3 py-2 text-sm font-black">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-muted-foreground" />
          {createdDate ? formatDuration(now - createdDate.getTime()) : "Temps non disponible"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
          {statusLabel}
        </span>
      </div>
    </div>
  )
}

function getTrackingSteps(
  type: string | null | undefined,
  createdAt: Date | null,
  timestamps: OrderStepperProps["timestamps"]
): TrackingStep[] {
  const preparingAt = toDate(timestamps?.preparingAt)
  const readyAt = toDate(timestamps?.readyAt)
  const finalAt = toDate(timestamps?.servedAt) || toDate(timestamps?.pickedUpAt) || toDate(timestamps?.finalAt)

  const steps: TrackingStep[] = [
    {
      key: "pending",
      label: "Commande reçue",
      icon: ReceiptText,
      at: createdAt,
      deltaMs: null,
    },
    {
      key: "preparing",
      label: "En préparation",
      icon: ChefHat,
      at: preparingAt,
      deltaMs: createdAt && preparingAt ? preparingAt.getTime() - createdAt.getTime() : null,
    },
    {
      key: "ready",
      label: "Prête",
      icon: Bell,
      at: readyAt,
      deltaMs: preparingAt && readyAt ? readyAt.getTime() - preparingAt.getTime() : null,
    },
    {
      key: "final",
      label: getFinalStepLabel(type),
      icon: CheckCircle2,
      at: finalAt,
      deltaMs: readyAt && finalAt ? finalAt.getTime() - readyAt.getTime() : null,
    },
  ]

  return steps.map((step) => ({
    ...step,
    deltaMs: step.deltaMs !== null && Number.isFinite(step.deltaMs) && step.deltaMs >= 0 ? step.deltaMs : null,
  }))
}

function getFinalStepLabel(type: string | null | undefined) {
  if (type === "sur_place") return "Servie"
  if (type === "emporter") return "Récupérée"
  if (type === "livraison") return "Récupérée"
  return "Terminée"
}

function normalizeTrackingOrderType(type: string | null | undefined) {
  if (type === "sur_place" || type === "dine_in" || type === "dine-in" || type === "table") return "sur_place"
  if (type === "emporter" || type === "a_emporter" || type === "takeaway" || type === "pickup") return "emporter"
  if (type === "livraison" || type === "delivery") return "livraison"
  return type || null
}

function toDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  if (typeof value === "object" && value && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate()
  }
  return null
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
}

function formatDuration(ms: number) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours > 0) return `${hours}h ${minutes}min`
  if (minutes > 0) return `${minutes}min`
  return "moins d'une minute"
}
