"use client"

import { ORDER_STEPS, type OrderStepKey, type OrderTypeKey } from "@/config/orderSteps"
import { normalizeOrderType, normalizeOperationStatus } from "@/lib/order-lifecycle"
import { cn } from "@/lib/utils"

type OrderStepperProps = {
  orderType?: string | null
  orderStatus?: string | null
}

function getStepOrderType(orderType?: string | null): OrderTypeKey {
  const normalized = normalizeOrderType(orderType)
  if (normalized === "delivery") return "delivery"
  if (normalized === "pickup") return "pickup"
  return "dine_in"
}

function getCurrentStepKey(orderType: OrderTypeKey, orderStatus?: string | null): OrderStepKey {
  if ((orderType === "pickup" || orderType === "delivery") && orderStatus === "picked_up") {
    return "picked_up"
  }

  const normalized = normalizeOperationStatus(orderStatus)
  if (normalized === "preparing") return "preparing"
  if (normalized === "ready") return "ready"
  if (normalized === "served") return orderType === "dine_in" ? "served" : "picked_up"

  return "pending"
}

export function OrderStepper({ orderType, orderStatus }: OrderStepperProps) {
  const normalizedType = getStepOrderType(orderType)
  const steps = ORDER_STEPS[normalizedType]
  const currentStepKey = getCurrentStepKey(normalizedType, orderStatus)
  const currentIndex = Math.max(0, steps.findIndex((step) => step.key === currentStepKey))

  return (
    <div className="space-y-4">
      {steps.map((step, index) => {
        const isCompleted = index < currentIndex
        const isCurrent = index === currentIndex
        const isFuture = index > currentIndex

        return (
          <div key={step.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold",
                  isCompleted && "bg-green-500 text-white",
                  isCurrent && "bg-orange-500 text-white",
                  isFuture && "bg-muted text-muted-foreground"
                )}
              >
                {index + 1}
              </div>
              {index < steps.length - 1 ? (
                <div
                  className={cn(
                    "h-8 w-0.5",
                    index < currentIndex ? "bg-green-500" : "bg-muted"
                  )}
                />
              ) : null}
            </div>

            <div className="pt-1">
              <p className={cn("font-medium", isFuture ? "text-muted-foreground" : "text-foreground")}>
                {step.label}
              </p>
              {isCurrent ? (
                <p className="text-xs text-orange-500">Étape actuelle</p>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}
