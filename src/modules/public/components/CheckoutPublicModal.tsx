"use client"

import * as React from "react"
import { addDoc, doc, getDoc, serverTimestamp } from "firebase/firestore"
import { useRouter } from "next/navigation"
import { ArrowRight, Banknote, CheckCircle, ChevronLeft, CreditCard, MapPin, Phone, ShoppingBag, Truck, X } from "lucide-react"

import { useDocOnce, useFirestore, useMemoFirebase } from "@/firebase"
import { COLLECTION_NAMES } from "@/lib/constants"
import { recalculateConfiguredUnitPrice } from "@/lib/order-pricing"
import { ORDER_PAYMENT_STATUS } from "@/lib/order-lifecycle"
import { restaurantOrdersRef } from "@/lib/restaurant-firestore-paths"
import { ORDER_OPERATION_STATUS } from "@/lib/order-lifecycle"
import { orderHasKitchenItems, resolveProductPreparationMode } from "@/utils/preparation-logic"
import { buildUssdTelHref } from "@/lib/ussd"
import {
  getAvailablePaymentMethods,
  type AvailablePaymentMethod,
} from "@/services/payment-methods.service"
import { useCart } from "../cart/CartContext"

type OrderFlowStep = "cart" | "delivery" | "recap" | "payment"
type PublicOrderType = "pickup" | "delivery"
type ConfiguredPaymentMethod = AvailablePaymentMethod

type OrderFlowState = {
  step: OrderFlowStep
  orderType: PublicOrderType | null
  address: string
  phone: string
  secondaryPhone: string
  instructions: string
  customerNote: string
  paymentMethodCode: string
  paymentCode: string
  paymentInstruction: string
  paymentReference: string
}

interface RestaurantFeatures {
  takeaway: boolean
  delivery: boolean
}

const DEFAULT_FLOW_STATE: OrderFlowState = {
  step: "cart",
  orderType: null,
  address: "",
  phone: "",
  secondaryPhone: "",
  instructions: "",
  customerNote: "",
  paymentMethodCode: "",
  paymentCode: "",
  paymentInstruction: "",
  paymentReference: "",
}

export default function CheckoutPublicModal({
  open,
  onClose,
  restaurantId,
  restaurantFeatures = { takeaway: true, delivery: true },
}: {
  open: boolean
  onClose: () => void
  restaurantId: string
  restaurantFeatures?: RestaurantFeatures
}) {
  const db = useFirestore()
  const router = useRouter()
  const { items, total, clear } = useCart()

  const [flow, setFlow] = React.useState<OrderFlowState>(DEFAULT_FLOW_STATE)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState("")

  const deliveryFee = flow.orderType === "delivery" ? 0 : 0
  const finalTotal = total + deliveryFee

  const restaurantRef = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return doc(db, COLLECTION_NAMES.RESTAURANTS, restaurantId)
  }, [db, restaurantId])
  const { data: restaurant } = useDocOnce<any>(restaurantRef)

  const countryCode = React.useMemo(() => {
    const value = restaurant?.countryCode || restaurant?.country || restaurant?.countryIso
    return typeof value === "string" && value.trim() ? value.trim().toUpperCase() : "ML"
  }, [restaurant])

  const [paymentMethods, setPaymentMethods] = React.useState<ConfiguredPaymentMethod[]>([])
  const [loadingPaymentMethods, setLoadingPaymentMethods] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false

    async function loadPaymentMethods() {
      if (!db || !restaurantId || finalTotal <= 0 || !flow.orderType) {
        setPaymentMethods((current) => (current.length === 0 ? current : []))
        return
      }

      setLoadingPaymentMethods(true)

      try {
        const channel = flow.orderType === "delivery" ? "delivery" : "qr"
        const finalMethods = await getAvailablePaymentMethods(db, restaurantId, channel, {
          countryCode,
          amount: finalTotal,
        })

        if (!cancelled) {
          setPaymentMethods(finalMethods.filter((method) => method.type === "mobile_money"))
        }
      } catch (paymentError) {
        console.error(paymentError)
        if (!cancelled) setPaymentMethods([])
      } finally {
        if (!cancelled) setLoadingPaymentMethods(false)
      }
    }

    loadPaymentMethods()

    return () => {
      cancelled = true
    }
  }, [countryCode, db, finalTotal, flow.orderType, restaurantId])

  React.useEffect(() => {
    if (!open) return

    setFlow(DEFAULT_FLOW_STATE)
    setError("")
  }, [open])

  if (!open) return null

  const updateFlow = (patch: Partial<OrderFlowState>) => {
    setFlow((current) => ({ ...current, ...patch }))
    setError("")
  }

  const goNext = () => {
    const validation = validateCurrentStep(flow, items.length)
    if (validation) {
      setError(validation)
      return
    }

    if (flow.step === "cart") {
      updateFlow({ step: flow.orderType === "delivery" ? "delivery" : "recap" })
      return
    }

    if (flow.step === "delivery") {
      updateFlow({ step: "recap" })
      return
    }

    if (flow.step === "recap") {
      updateFlow({
        step: "payment",
        paymentMethodCode: flow.paymentMethodCode,
      })
    }
  }

  const goBack = () => {
    setError("")

    if (flow.step === "payment") {
      updateFlow({ step: "recap" })
      return
    }

    if (flow.step === "recap") {
      updateFlow({ step: flow.orderType === "delivery" ? "delivery" : "cart" })
      return
    }

    if (flow.step === "delivery") {
      updateFlow({ step: "cart" })
    }
  }

  const submitOrder = async () => {
    const validation = validateCurrentStep(flow, items.length)
    if (validation) {
      setError(validation)
      return
    }

    setLoading(true)
    setError("")

    try {
      const orderItems = await Promise.all(
        items.map(async (item, index) => {
          const productSnap = await getDoc(
            doc(db, "restaurants", restaurantId, "products", item.productId)
          )

          if (!productSnap.exists()) {
            throw new Error(`Produit introuvable: ${item.productId}`)
          }

          const product = { id: productSnap.id, ...productSnap.data() } as any
          const unitPrice = recalculateConfiguredUnitPrice(product, item.selectedOptions ?? [])

          let categoryName = item.categoryName || ""
          if (!product.preparationMode && !categoryName && product.categoryId) {
            const categorySnap = await getDoc(
              doc(db, "restaurants", restaurantId, "categories", product.categoryId)
            )
            categoryName = categorySnap.data()?.name || ""
          }

          return {
            id: `${item.productId}-${Date.now()}-${index}`,
            productId: item.productId,
            name: item.name,
            status: "pending",
            createdAt: new Date(),
            unitPrice,
            quantity: item.quantity,
            total: unitPrice * item.quantity,
            selectedOptions: item.selectedOptions ?? [],
            preparationMode: item.preparationMode || resolveProductPreparationMode(product, categoryName),
          }
        })
      )

      const recalculatedSubtotal = orderItems.reduce((sum, item) => sum + item.total, 0)
      const normalizedOrderType = flow.orderType === "pickup" ? "pickup" : "delivery"
      const orderTotal = recalculatedSubtotal + deliveryFee
      const requiresKitchen = orderHasKitchenItems(orderItems)

      if (process.env.NODE_ENV !== "production") {
        console.info("[preparationMode][public_checkout]", {
          restaurantId,
          orderType: normalizedOrderType,
          paymentMethodCode: flow.paymentMethodCode,
          items: orderItems.map((item) => ({
            productId: item.productId,
            name: item.name,
            preparationMode: item.preparationMode,
            sentToKitchen: item.preparationMode === "kitchen",
          })),
          kitchenItems: orderItems
            .filter((item) => item.preparationMode === "kitchen")
            .map((item) => item.productId),
          requiresKitchen,
        })
      }

      const order = {
        restaurantId,
        orderType: normalizedOrderType,
        publicOrderType: flow.orderType,
        source: "manual",
        kitchenStatus: requiresKitchen ? ORDER_OPERATION_STATUS.PENDING : ORDER_OPERATION_STATUS.COMPLETED,
        orderStatus: requiresKitchen ? ORDER_OPERATION_STATUS.PENDING : ORDER_OPERATION_STATUS.COMPLETED,
        sessionId: null,
        tableId: null,
        zoneId: null,
        customer: {
          phone: flow.phone.trim() || null,
          name: null,
        },
        phoneNumber: flow.phone.trim() || null,
        table: null,
        ...(flow.orderType === "delivery" && {
          deliveryAddress: flow.address.trim(),
          deliveryInstructions: flow.instructions.trim() || null,
        }),
        customerNote: flow.customerNote.trim() || null,
        items: orderItems,
        subtotal: recalculatedSubtotal,
        deliveryFee,
        total: orderTotal,
        paymentMethod: flow.paymentMethodCode,
        paymentMethodCode: flow.paymentMethodCode === "cash" ? null : flow.paymentMethodCode,
        paymentType: flow.paymentMethodCode === "cash" ? "offline" : "mobile",
        paymentIntentStatus: flow.paymentMethodCode === "cash" ? "pending" : "submitted",
        paymentCode: flow.paymentCode || null,
        paymentInstruction: flow.paymentInstruction || null,
        paymentReference: null,
        paymentStatus: flow.paymentMethodCode === "cash" ? "pending_cash" : "pending_mobile",
        paidAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }

      const orderRef = await addDoc(restaurantOrdersRef(db, restaurantId), order)

      clear()
      onClose()

      if (orderRef.id) {
        window.localStorage.setItem(`restaurant_latest_order_${restaurantId}`, orderRef.id)
      }

      router.push(`/order/${restaurantId}/${orderRef.id}`)
    } catch (checkoutError) {
      console.error(checkoutError)
      setError(checkoutError instanceof Error ? checkoutError.message : "Erreur lors de la commande")
    } finally {
      setLoading(false)
    }
  }

  const title = getStepTitle(flow.step)
  const isPaymentStep = flow.step === "payment"
  const canGoBack = flow.step !== "cart"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-background text-foreground shadow-2xl ring-1 ring-border">
        <div className="flex items-center justify-between border-b border-border bg-card/70 p-5">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-wide text-[var(--color-primary)]">
              Commande
            </p>
            <h2 className="text-xl font-black">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted transition hover:bg-muted/80 active:scale-95"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {flow.step === "cart" ? (
            <CartStep
              orderType={flow.orderType}
              restaurantFeatures={restaurantFeatures}
              onSelect={(orderType) => updateFlow({ orderType, paymentMethodCode: "", paymentCode: "", paymentInstruction: "" })}
            />
          ) : null}

          {flow.step === "delivery" ? (
            <DeliveryStep
              address={flow.address}
              phone={flow.phone}
              secondaryPhone={flow.secondaryPhone}
              onChange={updateFlow}
            />
          ) : null}

          {flow.step === "recap" ? (
            <RecapStep
              items={items}
              subtotal={total}
              deliveryFee={deliveryFee}
              total={finalTotal}
              orderType={flow.orderType}
              address={flow.address}
              phone={flow.phone}
              customerNote={flow.customerNote}
              onChange={updateFlow}
            />
          ) : null}

          {flow.step === "payment" ? (
            <PaymentStepCompact
              orderType={flow.orderType}
              paymentMethodCode={flow.paymentMethodCode}
              paymentMethods={paymentMethods}
              loadingPaymentMethods={loadingPaymentMethods}
              paymentCode={flow.paymentCode}
              paymentInstruction={flow.paymentInstruction}
              paymentReference={flow.paymentReference}
              onChange={updateFlow}
            />
          ) : null}

          {error ? (
            <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3">
              <p className="text-sm font-semibold text-red-600">{error}</p>
            </div>
          ) : null}
        </div>

        <div className="border-t border-border bg-background/95 p-5">
          <div className="flex gap-3">
            {canGoBack ? (
              <button
                type="button"
                onClick={goBack}
                className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted font-bold transition hover:bg-muted/80 active:scale-95"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            ) : null}

            <button
              type="button"
              onClick={isPaymentStep ? submitOrder : goNext}
              disabled={loading || (isPaymentStep && !flow.paymentMethodCode)}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 text-sm font-black uppercase tracking-wide text-white shadow-[0_8px_24px_var(--color-primary)]/30 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Validation...
                </>
              ) : (
                <>
                  {isPaymentStep
                    ? "Valider le paiement"
                    : flow.step === "recap"
                      ? "Passer au paiement"
                      : "Suivant"}
                  {!isPaymentStep ? <ArrowRight className="h-4 w-4" /> : null}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CartStep({
  orderType,
  restaurantFeatures,
  onSelect,
}: {
  orderType: PublicOrderType | null
  restaurantFeatures: RestaurantFeatures
  onSelect: (type: PublicOrderType) => void
}) {
  const modes = [
    restaurantFeatures.delivery
      ? {
          id: "delivery" as const,
          label: "Livraison",
          icon: Truck,
        }
      : null,
    restaurantFeatures.takeaway
      ? {
          id: "pickup" as const,
          label: "À emporter",
          icon: ShoppingBag,
        }
      : null,
  ].filter(Boolean) as Array<{
    id: PublicOrderType
    label: string
    icon: React.ElementType
  }>

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-black">Mode de commande *</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Choisissez comment vous voulez recevoir votre commande.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {modes.map((mode) => {
          const Icon = mode.icon
          const active = orderType === mode.id

          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => onSelect(mode.id)}
              className={`flex h-14 items-center justify-center rounded-xl border-2 px-3 text-center transition ${
                active
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10"
                  : "border-border bg-card hover:bg-muted"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    active ? "bg-[var(--color-primary)] text-white" : "bg-muted text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <p className="font-black">{mode.label}</p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DeliveryStep({
  address,
  phone,
  secondaryPhone,
  onChange,
}: {
  address: string
  phone: string
  secondaryPhone: string
  onChange: (patch: Partial<OrderFlowState>) => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex h-14 items-center gap-3 rounded-xl border border-border bg-card px-4 focus-within:ring-2 focus-within:ring-[var(--color-primary)]/30">
        <MapPin className="h-5 w-5 shrink-0 text-muted-foreground" />
        <input
          value={address}
          onChange={(event) => onChange({ address: event.target.value })}
          placeholder="Quartier / adresse *"
          className="h-full min-w-0 flex-1 bg-transparent text-base outline-none"
        />
      </div>
      <div className="flex h-14 items-center gap-3 rounded-xl border border-border bg-card px-4 focus-within:ring-2 focus-within:ring-[var(--color-primary)]/30">
        <Phone className="h-5 w-5 shrink-0 text-muted-foreground" />
        <input
          type="tel"
          value={phone}
          onChange={(event) => onChange({ phone: event.target.value })}
          placeholder="Téléphone *"
          className="h-full min-w-0 flex-1 bg-transparent text-base outline-none"
        />
      </div>
      <div className="flex h-14 items-center gap-3 rounded-xl border border-border bg-card px-4 focus-within:ring-2 focus-within:ring-[var(--color-primary)]/30">
        <Phone className="h-5 w-5 shrink-0 text-muted-foreground" />
        <input
          type="tel"
          value={secondaryPhone}
          onChange={(event) => onChange({ secondaryPhone: event.target.value })}
          placeholder="Deuxième numéro de téléphone (optionnel)"
          className="h-full min-w-0 flex-1 bg-transparent text-base outline-none"
        />
      </div>
    </div>
  )
}

function RecapStep({
  items,
  subtotal,
  deliveryFee,
  total,
  orderType,
  address,
  phone,
  customerNote,
  onChange,
}: {
  items: any[]
  subtotal: number
  deliveryFee: number
  total: number
  orderType: PublicOrderType | null
  address: string
  phone: string
  customerNote: string
  onChange: (patch: Partial<OrderFlowState>) => void
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-black">Ajouter une note pour la cuisine</label>
        <textarea
          value={customerNote}
          onChange={(event) => onChange({ customerNote: event.target.value })}
          placeholder="Ex: sans piment, allergie arachide..."
          className="min-h-20 w-full resize-none rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
        />
      </div>
      <div className="rounded-2xl bg-muted/60 p-4">
        <p className="text-sm font-black">Votre commande</p>
        <div className="mt-3 space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex justify-between gap-3 text-sm">
              <div>
                <p className="font-bold">{item.quantity}x {item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {Number(item.unitPrice ?? 0).toLocaleString()} FCFA
                </p>
              </div>
              <span className="font-black">{Number(item.total ?? 0).toLocaleString()} FCFA</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Mode</span>
          <span className="font-bold">{orderType === "delivery" ? "Livraison" : "A emporter"}</span>
        </div>
        {orderType === "delivery" ? (
          <>
            <div className="mt-2 flex justify-between gap-4">
              <span className="text-muted-foreground">Adresse</span>
              <span className="text-right font-bold">{address}</span>
            </div>
            <div className="mt-2 flex justify-between">
              <span className="text-muted-foreground">Telephone</span>
              <span className="font-bold">{phone}</span>
            </div>
          </>
        ) : null}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Sous-total</span>
          <span className="font-bold">{subtotal.toLocaleString()} FCFA</span>
        </div>
        {orderType === "delivery" ? (
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-muted-foreground">Frais livraison</span>
            <span className="font-bold">{deliveryFee.toLocaleString()} FCFA</span>
          </div>
        ) : null}
        <div className="mt-3 flex justify-between border-t border-border pt-3 text-lg font-black">
          <span>Total</span>
          <span className="text-[var(--color-primary)]">{total.toLocaleString()} FCFA</span>
        </div>
      </div>
    </div>
  )
}

function PaymentStepCompact({
  orderType,
  paymentMethodCode,
  paymentMethods,
  loadingPaymentMethods,
  paymentCode,
  onChange,
}: {
  orderType: PublicOrderType | null
  paymentMethodCode: string
  paymentMethods: ConfiguredPaymentMethod[]
  loadingPaymentMethods: boolean
  paymentCode: string
  paymentInstruction: string
  paymentReference: string
  onChange: (patch: Partial<OrderFlowState>) => void
}) {
  const selectedMethod = paymentMethods.find((method) => method.code === paymentMethodCode)
  const selectedPaymentCode = selectedMethod?.paymentCode || paymentCode
  const canPayCash = orderType === "pickup"

  const selectMethod = (method: ConfiguredPaymentMethod) => {
    onChange({
      paymentMethodCode: method.code,
      paymentCode: method.paymentCode,
      paymentInstruction: "",
    })

    if (method.paymentCodeType === "ussd" && method.paymentCode && typeof window !== "undefined") {
      window.location.href = buildUssdTelHref(method.paymentCode)
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="font-black">Choisissez un moyen de paiement</h3>

      <div className="flex flex-wrap gap-3">
        {canPayCash ? (
          <button
            type="button"
            onClick={() =>
              onChange({
                paymentMethodCode: "cash",
                paymentCode: "",
                paymentInstruction: "",
              })
            }
            className={`flex h-12 min-w-[120px] flex-1 items-center justify-center gap-2 rounded-xl border px-4 text-center transition hover:border-orange-500 ${
              paymentMethodCode === "cash"
                ? "border-orange-500 bg-orange-50 text-slate-950"
                : "border-border bg-card hover:bg-muted"
            }`}
          >
            <Banknote className="h-5 w-5 shrink-0" />
            <span className="truncate text-sm font-black">Espèces</span>
          </button>
        ) : null}

        {loadingPaymentMethods ? (
          <div className="w-full rounded-lg border bg-muted p-3 text-sm font-semibold text-muted-foreground">
            Chargement des moyens de paiement...
          </div>
        ) : paymentMethods.length > 0 ? (
          paymentMethods.map((method) => {
            const active = paymentMethodCode === method.code

            return (
              <button
                key={method.code}
                type="button"
                onClick={() => selectMethod(method)}
                className={`flex h-12 min-w-[120px] flex-1 items-center justify-center gap-2 rounded-xl border px-4 text-center transition hover:border-orange-500 ${
                  active
                    ? "border-orange-500 bg-orange-50 text-slate-950"
                    : "border-border bg-card hover:bg-muted"
                }`}
              >
                <div className="h-6 w-6 shrink-0 overflow-hidden rounded bg-card">
                  {method.logoUrl ? (
                    <img src={method.logoUrl} alt={method.name} className="h-full w-full object-contain" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <span className="truncate text-sm font-black">{method.name}</span>
              </button>
            )
          })
        ) : (
          <div className="w-full rounded-lg border bg-muted p-3 text-sm font-semibold text-muted-foreground">
            Aucun moyen de paiement configure.
          </div>
        )}
      </div>

      {selectedMethod && selectedPaymentCode ? (
        <div className="rounded-lg bg-muted p-3 text-sm">
          <p className="break-all font-mono font-black text-[var(--color-primary)]">
            {selectedPaymentCode}
          </p>
        </div>
      ) : null}
    </div>
  )
}

function PaymentStep({
  orderType,
  paymentMethodCode,
  paymentMethods,
  loadingPaymentMethods,
  paymentCode,
  paymentInstruction,
  paymentReference,
  onChange,
}: {
  orderType: PublicOrderType | null
  paymentMethodCode: string
  paymentMethods: ConfiguredPaymentMethod[]
  loadingPaymentMethods: boolean
  paymentCode: string
  paymentInstruction: string
  paymentReference: string
  onChange: (patch: Partial<OrderFlowState>) => void
}) {
  const selectedMethod = paymentMethods.find((method) => method.code === paymentMethodCode)
  const selectedPaymentCode = selectedMethod?.paymentCode || paymentCode
  const canPayCash = orderType === "pickup"

  const selectMethod = (method: ConfiguredPaymentMethod) => {
    onChange({
      paymentMethodCode: method.code,
      paymentCode: method.paymentCode,
      paymentInstruction:
        method.paymentCodeType === "ussd"
          ? "La composition du code de paiement a ete ouverte automatiquement."
          : "Suivez les instructions du moyen de paiement selectionne.",
    })

    if (method.paymentCodeType === "ussd" && method.paymentCode && typeof window !== "undefined") {
      window.location.href = buildUssdTelHref(method.paymentCode)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-black">Choisissez un moyen de paiement</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Comment souhaitez-vous régler votre commande ?
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {canPayCash ? (
        <button
          type="button"
          onClick={() => onChange({
            paymentMethodCode: "cash",
            paymentCode: "",
            paymentInstruction: "Reglez en especes au comptoir.",
          })}
          className={`flex min-h-14 items-center gap-2 rounded-xl border p-3 text-left transition hover:border-orange-500 ${
            paymentMethodCode === 'cash'
              ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10"
              : "border-border bg-card hover:bg-muted"
          }`}
        >
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/20 text-[10px] font-black">
            <span className="text-xl">💵</span>
          </div>
          <div>
            <p className="font-black">Payer à la caisse</p>
            <p className="text-xs font-semibold text-muted-foreground">
              Réglez en espèces lors du retrait ou de la livraison
            </p>
          </div>
        </button>
        ) : null}

        {false ? (
        <button
          type="button"
          onClick={() => onChange({ paymentMethodCode: 'mobile_money' })}
          className={`rounded-xl border p-4 text-left transition flex items-center gap-4 ${
            paymentMethodCode === 'mobile_money'
              ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10"
              : "border-border bg-card hover:bg-muted"
          }`}
        >
          <div className="h-10 w-10 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
            <span className="text-xl">📱</span>
          </div>
          <div>
            <p className="font-black">Choisir mobile money</p>
            <p className="text-xs font-semibold text-muted-foreground">
              Paiement par Orange Money, MTN, Wave...
            </p>
          </div>
        </button>
        ) : null}

        {loadingPaymentMethods ? (
          <div className="rounded-xl border bg-muted p-4 text-sm font-semibold text-muted-foreground">
            Chargement des moyens de paiement...
          </div>
        ) : paymentMethods.length > 0 ? (
          paymentMethods.map((method) => {
            const active = paymentMethodCode === method.code

            return (
              <button
                key={method.code}
                type="button"
                onClick={() => selectMethod(method)}
                className={`flex min-h-14 items-center gap-2 rounded-xl border p-3 text-left transition hover:border-orange-500 ${
                  active
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10"
                    : "border-border bg-card hover:bg-muted"
                }`}
              >
                <div className="h-6 w-6 shrink-0 overflow-hidden rounded-md border border-border bg-card">
                  {method.logoUrl ? (
                    <img src={method.logoUrl} alt={method.name} className="h-full w-full object-contain" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">{method.name}</p>
                </div>
              </button>
            )
          })
        ) : (
          <div className="rounded-xl border bg-muted p-4 text-sm font-semibold text-muted-foreground">
            Aucun moyen de paiement configure.
          </div>
        )}
      </div>

      {selectedMethod && selectedPaymentCode ? (
        <div className="rounded-xl bg-muted p-3 text-sm">
          <p className="font-bold">{paymentInstruction}</p>
          <p className="mt-1 break-all font-mono font-black text-[var(--color-primary)]">
            {selectedPaymentCode}
          </p>
        </div>
      ) : null}
    </div>
  )
}

function validateCurrentStep(flow: OrderFlowState, itemCount: number) {
  if (itemCount === 0) return "Commande vide."

  if (flow.step === "cart" && !flow.orderType) {
    return "Choisissez un mode de commande."
  }

  if (flow.step === "delivery") {
    if (!flow.address.trim()) return "Adresse de livraison obligatoire."
    if (!flow.phone.trim()) return "Telephone obligatoire."
  }

  if (flow.step === "payment") {
    if (!flow.paymentMethodCode) return "Choisissez un moyen de paiement."
    if (flow.paymentMethodCode !== "cash" && !flow.paymentCode) {
      return "Moyen de paiement indisponible."
    }
  }

  return ""
}

function getStepTitle(step: OrderFlowStep) {
  if (step === "cart") return "Mode de commande"
  if (step === "delivery") return "Adresse de livraison"
  if (step === "recap") return "Recapitulatif"
  return "Paiement"
}
