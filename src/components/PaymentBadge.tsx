"use client"

import { cn } from "@/lib/utils"

type PaymentBadgeProps = {
  paymentIntentStatus?: string | null
  paymentVerificationStatus?: string | null
  className?: string
}

export function PaymentBadge({
  paymentIntentStatus,
  paymentVerificationStatus,
  className,
}: PaymentBadgeProps) {
  if (paymentVerificationStatus === "verified") {
    return (
      <div className={cn("w-fit rounded-full bg-green-500/10 px-3 py-1 text-sm font-bold text-green-600", className)}>
        ✔ Paiement confirmé
      </div>
    )
  }

  if (paymentIntentStatus === "pending") {
    return (
      <div className={cn("w-fit rounded-full bg-purple-500/10 px-3 py-1 text-sm font-bold text-purple-600", className)}>
        Vérification en cours
      </div>
    )
  }

  return null
}

