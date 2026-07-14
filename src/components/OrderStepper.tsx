"use client"

import { Bell, CheckCircle2, ChefHat, ReceiptText, type LucideIcon } from "lucide-react"

import { getClientOrderStep } from "@/lib/getClientOrderStep"
import { cn } from "@/lib/utils"

type OrderStepperProps = {
  appearance?: "legacy" | "public"
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
  appearance = "legacy",
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
  const isPublic = appearance === "public"

  return (
    <div className={cn("relative", isPublic && "font-publicBody")} aria-label="Progression de la commande">
      <div className={cn("absolute left-[12.5%] right-[12.5%] rounded-full", isPublic ? "top-5 h-px bg-[var(--border-public-default)]" : "top-[18px] h-0.5 bg-muted")} />
      <div
        className={cn("absolute left-[12.5%] rounded-full bg-[var(--brand-primary)] transition-all ease-out motion-reduce:transition-none", isPublic ? "top-5 h-px duration-200" : "top-[18px] h-0.5 duration-500")}
        style={{ width: `calc(75% * ${Math.max(0, currentIndex) / 3})` }}
      />

      <div className="relative grid grid-cols-4 gap-0.5">
        {steps.map((step, index) => {
          const Icon = step.icon
          const isCompleted = index < currentIndex
          const isCurrent = index === currentIndex
          const isFuture = index > currentIndex

          return (
            <div key={step.key} className="flex min-w-0 flex-col items-center gap-1.5 text-center" aria-current={isCurrent ? "step" : undefined}>
              <div
                className={cn(
                  "flex items-center justify-center rounded-full border shadow-sm transition-[background-color,border-color,color] ease-out motion-reduce:transition-none",
                  isPublic ? "size-10 duration-200" : "h-9 w-9 duration-500",
                  !isPublic && (isCompleted || isCurrent) && "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white",
                  isPublic && isCompleted && "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-[var(--text-inverse)]",
                  isPublic && isCurrent && "border-2 border-[var(--brand-primary)] bg-[var(--surface-public-elevated)] text-[var(--brand-primary)] ring-2 ring-[color:color-mix(in_srgb,var(--brand-primary)_20%,transparent)]",
                  isFuture && "border-[var(--border-public-default)] bg-[var(--surface-public-card)] text-[var(--text-muted)]"
                )}
              >
                {isCompleted ? <CheckCircle2 className={isPublic ? "size-5" : "h-4 w-4"} aria-label="Étape terminée" /> : <Icon className={isPublic ? "size-5" : "h-4 w-4"} aria-hidden="true" />}
              </div>
              <div className="min-w-0">
                <p
                  className={cn(
                    "whitespace-nowrap text-[12px] font-black leading-tight sm:text-[13px]",
                    isFuture ? "text-[var(--text-muted)]" : isCurrent ? "text-[var(--brand-primary)]" : "text-[var(--text-primary)]"
                  )}
                >
                  {step.label}
                </p>
                <p className="mt-1 text-[10px] font-public-semibold leading-tight text-[var(--text-muted)] sm:text-xs">
                  {step.at ? formatTime(step.at) : "--:--"}
                  {step.deltaMs !== null ? (
                    <span className="block text-[10px] font-medium text-muted-foreground/80">
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
