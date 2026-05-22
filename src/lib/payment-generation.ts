import {
  collection,
  getDocs,
  limit,
  query,
  where,
  type Firestore,
} from "firebase/firestore"

import { initializeFirebase } from "@/firebase"
import { COLLECTION_NAMES } from "@/lib/constants"

type GeneratePaymentInput = {
  methodCode: string
  countryCode: string
  merchant: string
  amount: number | string
  phone?: string
  db?: Firestore
}

type PlatformPaymentVariant = {
  methodCode: string
  countryCode: string
  type: "ussd" | "link"
  ussdTemplate?: string
  linkTemplate?: string
  isActive: boolean
}

export type PaymentResult = {
  type: "ussd" | "link"
  value: string
}

export async function generatePaymentLinkOrUSSD({
  methodCode,
  countryCode,
  merchant,
  amount,
  phone = "",
  db,
}: GeneratePaymentInput): Promise<PaymentResult> {
  const firestore = db ?? initializeFirebase().firestore

  const variantsQuery = query(
    collection(firestore, COLLECTION_NAMES.PLATFORM_PAYMENT_VARIANTS),
    where("methodCode", "==", methodCode),
    where("countryCode", "==", countryCode),
    where("isActive", "==", true),
    limit(1)
  )

  const snapshot = await getDocs(variantsQuery)
  const variant = snapshot.docs[0]?.data() as PlatformPaymentVariant | undefined

  if (!variant) {
    throw new Error("Aucune méthode de paiement active trouvée")
  }

  const safeAmount = String(amount)
  const safePhone = phone || ""

  // 🔥 CAS USSD
  if (variant.type === "ussd") {
    if (!variant.ussdTemplate) {
      throw new Error("Template USSD manquant")
    }

    const code = variant.ussdTemplate
      .replaceAll("{merchant}", merchant)
      .replaceAll("{amount}", safeAmount)
      .replaceAll("{phone}", safePhone)

    return {
      type: "ussd",
      value: code,
    }
  }

  // 🔥 CAS LINK (future-proof)
  if (variant.type === "link") {
    if (!variant.linkTemplate) {
      throw new Error("Template lien manquant")
    }

    const url = variant.linkTemplate
      .replaceAll("{merchant}", merchant)
      .replaceAll("{amount}", safeAmount)
      .replaceAll("{phone}", safePhone)

    return {
      type: "link",
      value: url,
    }
  }

  throw new Error("Type de paiement non supporté")
}