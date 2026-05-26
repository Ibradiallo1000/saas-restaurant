"use client"

import { cn } from "@/lib/utils"

type PaymentBadgeProps = {
  paymentStatus?: string | null
  paymentIntentStatus?: string | null
  paymentVerificationStatus?: string | null
  className?: string
}

export function PaymentBadge({
  paymentStatus,
  paymentIntentStatus,
  paymentVerificationStatus,
  className,
}: PaymentBadgeProps) {
  if (
    paymentStatus === "paid" ||
    paymentStatus === "verified" ||
    paymentStatus === "paye" ||
    paymentStatus === "validated"
  ) {
    return (
      <div className={cn("w-fit rounded-full bg-green-500/10 px-3 py-1 text-sm font-bold text-green-700 dark:text-green-300", className)}>
        Paiement confirmé
      </div>
    )
  }

  if (paymentIntentStatus === "pending" || paymentVerificationStatus === "pending_manual_review") {
    return (
      <div className={cn("w-fit rounded-full bg-purple-500/10 px-3 py-1 text-sm font-bold text-purple-700 dark:text-purple-300", className)}>
        Vérification en cours
      </div>
    )
  }

  return null
}
