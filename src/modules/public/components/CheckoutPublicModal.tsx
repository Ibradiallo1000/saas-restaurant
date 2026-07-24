"use client"

import * as React from "react"
import { doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore"
import { useRouter } from "next/navigation"
import { ArrowRight, Banknote, CheckCircle, ChefHat, ChevronLeft, CreditCard, MapPin, Phone, ShoppingBag, Truck } from "lucide-react"

import { PublicButton, PublicCheckoutModal, PublicOptionChoice, PublicOptionGroup, PublicPrice, PublicSurface, PublicTextField } from "@/components/public-ui"
import { useDocOnce, useFirestore, useMemoFirebase } from "@/firebase"
import { COLLECTION_NAMES } from "@/lib/constants"
import { getOptimizedImage } from "@/lib/image"
import { recalculateConfiguredUnitPrice } from "@/lib/order-pricing"
import { ORDER_PAYMENT_STATUS } from "@/lib/order-lifecycle"
import { restaurantOrdersRef } from "@/lib/restaurant-firestore-paths"
import { ORDER_OPERATION_STATUS } from "@/lib/order-lifecycle"
import { generateReviewAccessToken, rememberOrderReviewAccess, restaurantReviewAccessRef, REVIEW_ACCESS_TOKEN_VERSION } from "@/lib/reputation/review-access-token"
import { orderHasKitchenItems, resolveProductPreparationMode } from "@/utils/preparation-logic"
import { buildUssdTelHref } from "@/lib/ussd"
import {
  getAvailablePaymentMethods,
  type AvailablePaymentMethod,
} from "@/services/payment-methods.service"
import { useCart } from "../cart/CartContext"
import { rememberTrackedOrder } from "../orderTrackingStorage"

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
  paymentProofSms: string
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
  paymentProofSms: "",
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
  const stepTransitionTimeoutRef = React.useRef<number | null>(null)

  const deliveryFee = flow.orderType === "delivery" ? 0 : 0
  const finalTotal = total + deliveryFee

  const restaurantRef = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return doc(db, COLLECTION_NAMES.RESTAURANTS, restaurantId)
  }, [db, restaurantId])
  const { data: restaurant } = useDocOnce<any>(restaurantRef)
  const paymentProofSmsPlaceholder = buildPaymentProofSmsPlaceholder(restaurant)

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

  React.useEffect(() => () => {
    if (stepTransitionTimeoutRef.current !== null) {
      window.clearTimeout(stepTransitionTimeoutRef.current)
    }
  }, [])

  const currentStepBlocked = isCurrentStepBlocked(flow, items.length)
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

  const selectOrderType = (orderType: PublicOrderType) => {
    if (items.length === 0) {
      setError("Commande vide.")
      return
    }

    updateFlow({
      orderType,
      paymentMethodCode: "",
      paymentCode: "",
      paymentInstruction: "",
      paymentProofSms: "",
    })

    if (stepTransitionTimeoutRef.current !== null) {
      window.clearTimeout(stepTransitionTimeoutRef.current)
    }
    stepTransitionTimeoutRef.current = window.setTimeout(() => {
      updateFlow({ step: orderType === "delivery" ? "delivery" : "recap" })
      stepTransitionTimeoutRef.current = null
    }, 180)
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

      const primaryPhone = cleanPhone(flow.phone)
      const secondaryPhone = cleanPhone(flow.secondaryPhone)

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
          phone: primaryPhone || null,
          name: null,
        },
        phoneNumber: primaryPhone || null,
        secondaryPhoneNumber: secondaryPhone || null,
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
        ...(flow.paymentMethodCode !== "cash" && {
          paymentProofSms: flow.paymentProofSms.trim(),
          paymentProofSubmittedAt: serverTimestamp(),
          paymentProofStatus: "submitted",
        }),
        paymentStatus: flow.paymentMethodCode === "cash" ? "pending_cash" : "pending_mobile",
        paidAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }

      const orderRef = doc(restaurantOrdersRef(db, restaurantId))
      const reviewToken = generateReviewAccessToken()
      const reviewAccessRef = restaurantReviewAccessRef(db, restaurantId, orderRef.id)
      const batch = writeBatch(db)
      batch.set(orderRef, order)
      batch.set(reviewAccessRef, {
        restaurantId,
        orderId: orderRef.id,
        reviewToken,
        createdAt: serverTimestamp(),
        expiresAt: null,
        version: REVIEW_ACCESS_TOKEN_VERSION,
      })
      await batch.commit()

      clear()
      onClose()

      if (orderRef.id) {
        rememberOrderReviewAccess({
          restaurantId,
          orderId: orderRef.id,
          reviewToken,
        })
        rememberTrackedOrder({
          restaurantId,
          orderId: orderRef.id,
        })
      }

      router.push(`/order/${restaurantId}/${orderRef.id}?access=${encodeURIComponent(reviewToken)}`)
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
  const stepDescription = getStepDescription(flow.step)
  const stepNumber = flow.step === "cart" ? 1 : flow.step === "delivery" ? 2 : flow.step === "recap" ? (flow.orderType === "delivery" ? 3 : 2) : (flow.orderType === "delivery" ? 4 : 3)

  return (
    <PublicCheckoutModal
      open={open}
      onOpenChange={(nextOpen) => !nextOpen && onClose()}
      title={title}
      description={stepDescription}
      stepLabel={`Étape ${stepNumber}`}
      closeOnOverlayClick={!loading}
      footer={flow.step !== "cart" ? (
        <div className="flex gap-3">
          {canGoBack ? (
            <PublicButton variant="secondary" size="action" onClick={goBack} aria-label="Revenir à l’étape précédente" className="w-[52px] px-0">
              <ChevronLeft aria-hidden="true" />
            </PublicButton>
          ) : null}
          <PublicButton fullWidth size="action" onClick={isPaymentStep ? submitOrder : goNext} disabled={currentStepBlocked} loading={loading} loadingLabel="Validation en cours">
            {isPaymentStep ? "Valider le paiement" : flow.step === "recap" ? "Passer au paiement" : "Suivant"}
            {!isPaymentStep && !loading ? <ArrowRight aria-hidden="true" /> : null}
          </PublicButton>
        </div>
      ) : undefined}
    >
      <div>
          {flow.step === "cart" ? (
            <CartStep
              orderType={flow.orderType}
              restaurantFeatures={restaurantFeatures}
              onSelect={selectOrderType}
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
              secondaryPhone={flow.secondaryPhone}
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
              paymentProofSms={flow.paymentProofSms}
              paymentProofSmsPlaceholder={paymentProofSmsPlaceholder}
              onChange={updateFlow}
            />
          ) : null}

          {error ? <PublicSurface role="alert" level="card" border="default" radius="md" padding="compact" className="mt-4 border-[var(--danger)] text-public-sm font-public-semibold text-[var(--danger)]">{error}</PublicSurface> : null}
      </div>
    </PublicCheckoutModal>
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
    <PublicOptionGroup title="Mode de commande" description="Choisissez comment vous voulez recevoir votre commande." required min={1} max={1} selectedCount={orderType ? 1 : 0}>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {modes.map((mode) => {
          const Icon = mode.icon
          const active = orderType === mode.id

          return (
            <PublicOptionChoice
              key={mode.id}
              name="public-order-type"
              value={mode.id}
              label={mode.label}
              icon={<Icon />}
              selected={active}
              controlType="radio"
              presentation="card"
              onSelect={() => onSelect(mode.id)}
            />
          )
        })}
      </div>
    </PublicOptionGroup>
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
      <PublicTextField label="Quartier / adresse" required leftIcon={<MapPin />} value={address} onChange={(event) => onChange({ address: event.target.value })} autoComplete="street-address" placeholder="Indiquez votre adresse de livraison" fieldSize="comfortable" />
      <PublicTextField label="Téléphone" required leftIcon={<Phone />} type="tel" inputMode="numeric" maxLength={11} value={formatPhone(phone)} onChange={(event) => onChange({ phone: cleanPhone(event.target.value) })} autoComplete="tel" placeholder="Votre numéro de téléphone" fieldSize="comfortable" />
      <PublicTextField label="Deuxième numéro de téléphone" helpText="Facultatif" leftIcon={<Phone />} type="tel" inputMode="numeric" maxLength={11} value={formatPhone(secondaryPhone)} onChange={(event) => onChange({ secondaryPhone: cleanPhone(event.target.value) })} autoComplete="tel" placeholder="Un autre numéro pour vous joindre" fieldSize="comfortable" />
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
  secondaryPhone,
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
  secondaryPhone: string
  customerNote: string
  onChange: (patch: Partial<OrderFlowState>) => void
}) {
  return (
    <div className="space-y-4">
      <PublicSurface level="muted" radius="lg" padding="standard">
        <p className="text-public-sm font-public-bold">Votre commande</p>
        <div className="mt-3 divide-y divide-[var(--border-public-subtle)]">
          {items.map((item) => (
            <div key={item.id} className="grid grid-cols-[58px_minmax(0,1fr)_auto] gap-3 py-3 first:pt-0 last:pb-0">
              <CheckoutLineImage src={item.imageUrl} alt={item.name} />

              <div className="min-w-0">
                <p className="line-clamp-2 text-public-sm font-public-bold leading-tight">
                  {item.quantity} × {item.name}
                </p>
                {item.selectedOptions?.map((option: any, index: number) => (
                  <p
                    key={`${item.id}-recap-option-${index}`}
                    className="truncate text-public-xs font-public-semibold text-[var(--text-muted)]"
                  >
                    {option.optionName}: {option.choiceName}
                  </p>
                ))}
                {item.selections &&
                  Object.entries(item.selections).map(([option, values]: [string, any]) => (
                    <p
                      key={`${item.id}-recap-selection-${option}`}
                      className="truncate text-public-xs font-public-semibold text-[var(--text-muted)]"
                    >
                      {Array.isArray(values) ? values.join(", ") : String(values)}
                    </p>
                  ))}
              </div>

              <PublicPrice role="card" value={Number(item.total ?? 0).toLocaleString()} suffix="FCFA" />
            </div>
          ))}
        </div>
      </PublicSurface>

      <div className="space-y-2">
        <label htmlFor="checkout-customer-note" className="text-public-sm font-public-semibold text-[var(--text-primary)]">Ajouter une note pour la cuisine</label>
        <textarea
          id="checkout-customer-note"
          value={customerNote}
          onChange={(event) => onChange({ customerNote: event.target.value })}
          placeholder="Ex. : sans piment, allergie arachide..."
          className="min-h-20 w-full resize-none rounded-[var(--radius-public-md)] border border-[var(--border-public-control)] bg-[var(--surface-public-card)] px-4 py-3 font-publicBody text-public-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus-visible:border-[var(--focus-ring)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--focus-ring)_28%,transparent)]"
          rows={3}
        />
      </div>

      <PublicSurface level="card" border="subtle" radius="lg" padding="standard" className="text-public-sm">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4">
          <span className="text-[var(--text-secondary)]">Mode</span>
          <span className="font-public-bold">{orderType === "delivery" ? "Livraison" : "A emporter"}</span>
        </div>
        {orderType === "delivery" ? (
          <>
            <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-4">
              <span className="text-[var(--text-secondary)]">Adresse</span>
              <span className="break-words text-right font-public-bold">{address}</span>
            </div>
          </>
        ) : null}
        <div className={`mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-4 ${phone ? "" : "hidden"}`}>
          <span className="text-[var(--text-secondary)]">Téléphone</span>
          <span className="font-public-bold">{formatPhone(phone)}</span>
        </div>
        {secondaryPhone ? (
          <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-4">
            <span className="text-[var(--text-secondary)]">Second téléphone</span>
            <span className="font-public-bold">{formatPhone(secondaryPhone)}</span>
          </div>
        ) : null}
      </PublicSurface>

      <PublicSurface level="card" border="subtle" radius="lg" padding="standard">
        <div className="flex justify-between text-sm">
          <span className="text-[var(--text-secondary)]">Sous-total</span>
          <PublicPrice role="card" value={subtotal.toLocaleString()} suffix="FCFA" />
        </div>
        {orderType === "delivery" ? (
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-[var(--text-secondary)]">Frais de livraison</span>
            <PublicPrice role="card" value={deliveryFee.toLocaleString()} suffix="FCFA" />
          </div>
        ) : null}
        <div className="mt-3 flex items-center justify-between border-t border-[var(--border-public-subtle)] pt-3">
          <strong className="text-public-lg">Total</strong>
          <PublicPrice role="total" value={total.toLocaleString()} suffix="FCFA" aria-label={`Total ${total.toLocaleString()} FCFA`} />
        </div>
      </PublicSurface>
    </div>
  )
}

function CheckoutLineImage({ src, alt }: { src?: string; alt?: string }) {
  const [failed, setFailed] = React.useState(false)
  const hasImage = Boolean(src && !failed)

  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted text-muted-foreground">
      {hasImage ? (
        <img
          src={getOptimizedImage(src || "", 160)}
          alt={alt || "Produit"}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <ChefHat className="h-5 w-5 opacity-45" />
      )}
    </div>
  )
}

function PaymentStepCompact({
  orderType,
  paymentMethodCode,
  paymentMethods,
  loadingPaymentMethods,
  paymentCode,
  paymentProofSms,
  paymentProofSmsPlaceholder,
  onChange,
}: {
  orderType: PublicOrderType | null
  paymentMethodCode: string
  paymentMethods: ConfiguredPaymentMethod[]
  loadingPaymentMethods: boolean
  paymentCode: string
  paymentInstruction: string
  paymentReference: string
  paymentProofSms: string
  paymentProofSmsPlaceholder: string
  onChange: (patch: Partial<OrderFlowState>) => void
}) {
  const selectedMethod = paymentMethods.find((method) => method.code === paymentMethodCode)
  const selectedPaymentCode = selectedMethod?.paymentCode || paymentCode
  const canPayCash = orderType === "pickup"
  const shouldShowProofSms = Boolean(selectedMethod && selectedMethod.type === "mobile_money")

  const selectMethod = (method: ConfiguredPaymentMethod) => {
    onChange({
      paymentMethodCode: method.code,
      paymentCode: method.paymentCode,
      paymentInstruction: "",
      paymentProofSms: "",
    })

    if (method.paymentCodeType === "ussd" && method.paymentCode && typeof window !== "undefined") {
      window.location.href = buildUssdTelHref(method.paymentCode)
    }
  }

  return (
    <PublicOptionGroup title="Moyen de paiement" description="Choisissez comment régler votre commande." required min={1} max={1} selectedCount={paymentMethodCode ? 1 : 0}>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {canPayCash ? (
          <PublicOptionChoice
            name="checkout-payment-method"
            value="cash"
            label="Espèces"
            description="Paiement lors du retrait"
            icon={<Banknote />}
            selected={paymentMethodCode === "cash"}
            controlType="radio"
            presentation="card"
            onSelect={() =>
              onChange({
                paymentMethodCode: "cash",
                paymentCode: "",
                paymentInstruction: "",
                paymentProofSms: "",
              })
            }
          />
        ) : null}

        {loadingPaymentMethods ? (
          <PublicSurface level="muted" radius="md" padding="compact" className="text-public-sm font-public-semibold text-[var(--text-secondary)] sm:col-span-2" role="status">
            Chargement des moyens de paiement...
          </PublicSurface>
        ) : paymentMethods.length > 0 ? (
          paymentMethods.map((method) => {
            const active = paymentMethodCode === method.code

            return (
              <PublicOptionChoice
                key={method.code}
                name="checkout-payment-method"
                value={method.code}
                label={method.name}
                description={method.paymentCodeType === "ussd" ? "Paiement USSD" : "Mobile Money"}
                icon={
                  method.logoUrl ? (
                    <img src={method.logoUrl} alt="" className="size-6 object-contain" />
                  ) : (
                    <CreditCard />
                  )
                }
                selected={active}
                controlType="radio"
                presentation="card"
                onSelect={() => selectMethod(method)}
              />
            )
          })
        ) : (
          <PublicSurface level="muted" radius="md" padding="compact" className="text-public-sm font-public-semibold text-[var(--text-secondary)] sm:col-span-2">Aucun moyen de paiement configuré.</PublicSurface>
        )}
      </div>

      {selectedMethod && selectedPaymentCode ? (
        <PublicSurface level="muted" radius="md" padding="compact" className="mt-3 text-public-sm"><p className="break-all font-mono font-public-bold text-[var(--brand-primary)]">{selectedPaymentCode}</p></PublicSurface>
      ) : null}

      {shouldShowProofSms ? (
        <PublicSurface level="card" border="subtle" radius="md" padding="compact" className="mt-3 space-y-2">
          <label htmlFor="checkout-payment-proof" className="text-public-sm font-public-semibold text-[var(--text-primary)]">
            Collez le SMS de confirmation reçu après votre paiement.
          </label>
          <textarea
            id="checkout-payment-proof"
            value={paymentProofSms}
            onChange={(event) => onChange({ paymentProofSms: event.target.value })}
            placeholder={paymentProofSmsPlaceholder}
            className="min-h-28 w-full resize-none rounded-[var(--radius-public-md)] border border-[var(--border-public-control)] bg-[var(--surface-public-card)] px-4 py-3 font-publicBody text-public-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus-visible:border-[var(--focus-ring)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--focus-ring)_28%,transparent)]"
          />
        </PublicSurface>
      ) : null}
    </PublicOptionGroup>
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
          className={`flex min-h-14 items-center gap-2 rounded-xl border p-3 text-left transition hover:border-[var(--brand-primary)] ${
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
                className={`flex min-h-14 items-center gap-2 rounded-xl border p-3 text-left transition hover:border-[var(--brand-primary)] ${
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
    if (!isPrimaryPhoneValid(flow.phone)) return "Téléphone obligatoire : 8 chiffres."
    if (!isOptionalPhoneValid(flow.secondaryPhone)) return "Deuxième numéro invalide : 8 chiffres ou vide."
  }

  if (flow.step === "payment") {
    if (!flow.paymentMethodCode) return "Choisissez un moyen de paiement."
    if (flow.paymentMethodCode !== "cash" && !flow.paymentCode) {
      return "Moyen de paiement indisponible."
    }
    if (flow.paymentMethodCode !== "cash" && !flow.paymentProofSms.trim()) {
      return "Collez le SMS de confirmation reçu après votre paiement."
    }
  }

  return ""
}

function isCurrentStepBlocked(flow: OrderFlowState, itemCount: number) {
  if (itemCount === 0) return true
  if (flow.step === "cart") return !flow.orderType
  if (flow.step === "delivery") {
    return (
      !flow.address.trim() ||
      !isPrimaryPhoneValid(flow.phone) ||
      !isOptionalPhoneValid(flow.secondaryPhone)
    )
  }
  if (flow.step === "payment") {
    return (
      !flow.paymentMethodCode ||
      (flow.paymentMethodCode !== "cash" && (!flow.paymentCode || !flow.paymentProofSms.trim()))
    )
  }
  return false
}

const cleanPhone = (value: string) =>
  value.replace(/\D/g, "").slice(0, 8)

const formatPhone = (value: string) =>
  cleanPhone(value).replace(/(\d{2})(?=\d)/g, "$1 ").trim()

function isPrimaryPhoneValid(phone: string) {
  return cleanPhone(phone).length === 8
}

function isOptionalPhoneValid(phone: string) {
  const length = cleanPhone(phone).length
  return length === 0 || length === 8
}

function buildPaymentProofSmsPlaceholder(restaurant: any) {
  const restaurantName =
    restaurant?.name ||
    restaurant?.nom ||
    restaurant?.displayName ||
    restaurant?.restaurantName ||
    "votre restaurant"

  return `Ex: Paiement de 5000 FCFA chez ${restaurantName} effectué avec succès. ID : MPXXXXXX.XXXX.XXXXXX.`
}

function getStepTitle(step: OrderFlowStep) {
  if (step === "cart") return "Mode de commande"
  if (step === "delivery") return "Adresse de livraison"
  if (step === "recap") return "Récapitulatif de commande"
  return "Paiement"
}

function getStepDescription(step: OrderFlowStep) {
  if (step === "cart") return "Choisissez le mode adapté à votre commande."
  if (step === "delivery") return "Renseignez les informations nécessaires à la livraison."
  if (step === "recap") return "Vérifiez les articles et les informations de votre commande."
  return "Sélectionnez un moyen de paiement puis validez votre commande."
}
