import {
  collection,
  getDocs,
  limit,
  query,
  where,
  type Firestore,
} from "firebase/firestore"

import { COLLECTION_NAMES } from "@/lib/constants"
import { generatePaymentLinkOrUSSD } from "@/lib/payment-generation"

export type PaymentChannel = "pos" | "qr" | "delivery"
export type AvailablePaymentMethodType = "cash" | "mobile_money"

export type AvailablePaymentMethod = {
  code: string
  name: string
  type: AvailablePaymentMethodType
  enabled: boolean
  channels: PaymentChannel[]
  hasExplicitChannels: boolean
  rawChannels?: unknown
  logoUrl: string
  customName?: string | null
  customLogo?: string | null
  merchantNumber?: string | null
  paymentCode: string
  paymentCodeType?: "ussd" | "link" | null
}

export async function getAvailablePaymentMethods(
  db: Firestore,
  restaurantId: string,
  channel: PaymentChannel,
  options: { countryCode?: string; amount?: number; debug?: boolean; debugLabel?: string } = {}
): Promise<AvailablePaymentMethod[]> {
  if (!restaurantId) return []

  const [configsSnapshot, platformMethodsSnapshot] = await Promise.all([
    getDocs(
      query(
        collection(db, COLLECTION_NAMES.RESTAURANT_PAYMENT_CONFIGS),
        where("restaurantId", "==", restaurantId),
        where("isActive", "==", true),
        limit(50)
      )
    ),
    getDocs(
      query(
        collection(db, COLLECTION_NAMES.PLATFORM_PAYMENT_METHODS),
        where("isActive", "==", true),
        limit(50)
      )
    ),
  ])

  const platformMethods = platformMethodsSnapshot.docs.map((methodDoc) => ({
    id: methodDoc.id,
    ...methodDoc.data(),
  })) as Array<Record<string, any>>
  const configs = configsSnapshot.docs.map((configDoc) => ({
    id: configDoc.id,
    ...configDoc.data(),
  })) as Array<Record<string, any>>

  if (options.debug) {
    console.log(`[${options.debugLabel || "payment-methods"}] raw Firestore`, {
      restaurantId,
      channel,
      restaurantPaymentConfigs: configs,
      platformPaymentMethods: platformMethods,
    })
  }

  const methods: AvailablePaymentMethod[] = [
    {
      code: "cash",
      name: "Espèces",
      type: "cash",
      enabled: true,
      channels: ["pos", "qr"],
      hasExplicitChannels: true,
      rawChannels: ["pos", "qr"],
      logoUrl: "",
      merchantNumber: null,
      paymentCode: "",
      paymentCodeType: null,
    },
  ]

  const mobileMethods = await Promise.all(
    configs.map(async (config) => {
      if (!config.methodCode || !config.merchantNumber) return null

      const platformMethod = platformMethods.find((method) => method.code === config.methodCode)
      const type = normalizePaymentMethodType(config.type || platformMethod?.type || "mobile_money")
      const enabled = Boolean(config.enabled ?? config.isActive ?? true) && platformMethod?.isActive !== false
      const rawChannels = config.channels ?? platformMethod?.channels
      const hasExplicitChannels = Array.isArray(rawChannels)
      const channels = normalizePaymentChannels(rawChannels, type)
      let paymentCode = ""
      let paymentCodeType: "ussd" | "link" | null = null

      if (type === "mobile_money" && Number(options.amount || 0) > 0) {
        const result = await generatePaymentLinkOrUSSD({
          methodCode: config.methodCode,
          countryCode: options.countryCode || "ML",
          merchant: config.merchantNumber,
          amount: Number(options.amount || 0),
          db,
        })
        paymentCode = result.value
        paymentCodeType = result.type
      }

      return {
        code: config.methodCode,
        name: config.customName || platformMethod?.name || config.methodCode,
        type,
        enabled,
        channels,
        hasExplicitChannels,
        rawChannels,
        logoUrl: config.customLogo || platformMethod?.logoUrl || "",
        customName: config.customName || null,
        customLogo: config.customLogo || null,
        merchantNumber: config.merchantNumber,
        paymentCode,
        paymentCodeType,
      } satisfies AvailablePaymentMethod
    })
  )

  methods.push(...(mobileMethods.filter(Boolean) as AvailablePaymentMethod[]))

  const filteredMethods = methods.filter((method) => {
    if (!method.enabled) return false
    if (!method.hasExplicitChannels) return true
    return method.channels.includes(channel)
  })

  if (options.debug) {
    console.log(`[${options.debugLabel || "payment-methods"}] normalized before channel filter`, methods)
    console.log(`[${options.debugLabel || "payment-methods"}] after channel filter`, filteredMethods)
  }

  return filteredMethods
}

function normalizePaymentMethodType(value: unknown): AvailablePaymentMethodType {
  return value === "cash" ? "cash" : "mobile_money"
}

function normalizePaymentChannels(value: unknown, type: AvailablePaymentMethodType): PaymentChannel[] {
  if (Array.isArray(value)) {
    const channels = value.filter((channel): channel is PaymentChannel => {
      return channel === "pos" || channel === "qr" || channel === "delivery"
    })
    if (channels.length > 0) return channels
  }

  return type === "cash" ? ["pos", "qr"] : ["pos", "qr", "delivery"]
}
