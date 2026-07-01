"use client"

import { Bell, CheckCircle2, ChefHat, ReceiptText, type LucideIcon } from "lucide-react"

import { getClientOrderStep } from "@/lib/getClientOrderStep"
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
  createdAt,
  timestamps,
}: OrderStepperProps) {
  const normalizedType = normalizeTrackingOrderType(orderType)
  const step = currentStep ?? getClientOrderStep({ kitchenStatus, status: legacyStatus })
  const currentIndex = Math.min(3, Math.max(0, step - 1))
  const createdDate = toDate(createdAt)
  const steps = getTrackingSteps(normalizedType, createdDate, timestamps)

  return (
    <div className="relative">
      <div className="absolute left-[12.5%] right-[12.5%] top-[18px] h-0.5 rounded-full bg-muted" />
      <div
        className="absolute left-[12.5%] top-[18px] h-0.5 rounded-full bg-orange-500 transition-all duration-500 ease-out"
        style={{ width: `calc(75% * ${Math.max(0, currentIndex) / 3})` }}
      />

      <div className="relative grid grid-cols-4 gap-1">
        {steps.map((step, index) => {
          const Icon = step.icon
          const isCompleted = index < currentIndex
          const isCurrent = index === currentIndex
          const isFuture = index > currentIndex

          return (
            <div key={step.key} className="flex min-w-0 flex-col items-center gap-2 text-center">
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition-all duration-500 ease-out",
                  (isCompleted || isCurrent) && "border-orange-500 bg-orange-500 text-white",
                  isFuture && "border-muted bg-background text-muted-foreground"
                )}
              >
                {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <div>
                <p
                  className={cn(
                    "whitespace-nowrap text-[10px] font-black leading-tight sm:text-xs",
                    isFuture ? "text-muted-foreground" : "text-orange-600 dark:text-orange-300"
                  )}
                >
                  {step.label}
                </p>
                <p className="mt-2 text-[10px] font-semibold leading-tight text-muted-foreground">
                  {step.at ? formatTime(step.at) : "--:--"}
                  {step.deltaMs !== null ? (
                    <span className="block text-[9px] font-medium text-muted-foreground/80">
                      +{formatStepDelta(step.deltaMs)}
                    </span>
                  ) : null}
                </p>
              </div>
            </div>
          )
        })}
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
      label: "Reçue",
      icon: ReceiptText,
      at: createdAt,
      deltaMs: null,
    },
    {
      key: "preparing",
      label: "Préparation",
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

function formatStepDelta(ms: number) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000))

  if (totalMinutes < 1) return "<1 min"
  return `${totalMinutes} min`
}
