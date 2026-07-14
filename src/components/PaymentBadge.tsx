"use client"

import { CheckCircle2, Clock3 } from "lucide-react"

import { PublicBadge } from "@/components/public-ui"
import { cn } from "@/lib/utils"

type PaymentBadgeProps = {
  paymentStatus?: string | null
  paymentIntentStatus?: string | null
  paymentVerificationStatus?: string | null
  className?: string
  appearance?: "legacy" | "public"
}

export function PaymentBadge({
  paymentStatus,
  paymentIntentStatus,
  paymentVerificationStatus,
  className,
  appearance = "legacy",
}: PaymentBadgeProps) {
  if (
    paymentStatus === "paid" ||
    paymentStatus === "verified" ||
    paymentStatus === "paye" ||
    paymentStatus === "validated"
  ) {
    if (appearance === "public") {
      return <PublicBadge className={className} variant="success" label="Paiement confirmé" icon={<CheckCircle2 />} />
    }
    return (
      <div className={cn("w-fit rounded-full bg-green-500/10 px-3 py-1 text-sm font-bold text-green-700 dark:text-green-300", className)}>
        Paiement confirmé
      </div>
    )
  }

  if (paymentIntentStatus === "pending" || paymentVerificationStatus === "pending_manual_review") {
    if (appearance === "public") {
      return <PublicBadge className={className} variant="warning" label="Vérification en cours" icon={<Clock3 />} />
    }
    return (
      <div className={cn("w-fit rounded-full bg-purple-500/10 px-3 py-1 text-sm font-bold text-purple-700 dark:text-purple-300", className)}>
        Vérification en cours
      </div>
    )
  }

  return null
}
