"use client"

import * as React from "react"
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where, writeBatch } from "firebase/firestore"
import {
  Banknote,
  Bell,
  CheckCircle,
  CheckCircle2,
  ChefHat,
  ClipboardList,
  CreditCard,
  Info,
  Phone,
  ShoppingBag,
  Utensils,
  type LucideIcon,
} from "lucide-react"
import { useParams, useRouter, useSearchParams } from "next/navigation"

import { OrderStepper } from "@/components/OrderStepper"
import { PaymentBadge } from "@/components/PaymentBadge"
import { PublicBadge, PublicBottomNavigation, PublicButton, PublicEmptyState, PublicHeader, PublicPageShell, PublicPrice, PublicStatusCard, PublicSurface } from "@/components/public-ui"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { useCollection, useDoc, useDocOnce, useFirestore, useMemoFirebase } from "@/firebase"
import { useToast } from "@/hooks/use-toast"
import { PAYMENT_STATUS } from "@/lib/constants"
import { getClientOrderStep, getClientStatusLabel } from "@/lib/getClientOrderStep"
import { getOrderDisplayId } from "@/lib/order-display-id"
import { normalizeOrderType } from "@/lib/order-lifecycle"
import { buildUssdTelHref } from "@/lib/ussd"
import { CartProvider, useCart } from "@/modules/public/cart/CartContext"
import CartDrawer from "@/modules/public/components/CartDrawer"
import PaymentModal from "@/modules/public/components/PaymentModal"
import { RestaurantReviewCard } from "@/modules/public/components/RestaurantReviewCard"
import {
  isCurrentTrackedOrderExpired,
  rememberTrackedOrder,
  TRACKING_RETENTION_HOURS,
} from "@/modules/public/orderTrackingStorage"
import { getStoredOrderReviewAccess as getStoredReviewToken, rememberOrderReviewAccess as rememberReviewToken } from "@/lib/reputation/review-access-token"
import type { RestaurantOrder } from "@/modules/restaurant/types"
import {
  getAvailablePaymentMethods,
  type AvailablePaymentMethod,
} from "@/services/payment-methods.service"

type ClientOrderType = "dine_in" | "pickup" | "delivery"

export default function ClientOrderTrackingPage() {
  return (
    <CartProvider>
      <ClientOrderTrackingContent />
    </CartProvider>
  )
}

function ClientOrderTrackingContent() {
  const db = useFirestore()
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const routeParams = params ?? {}
  const { count } = useCart()
  const { toast } = useToast()
  const restaurantId = routeParams.restaurantId as string | undefined
  const orderId = routeParams.orderId as string | undefined
  const queryReviewToken = searchParams?.get("access")?.trim() || null
  const storedReviewToken = restaurantId && orderId ? getStoredReviewToken(restaurantId, orderId) : null
  const reviewToken = queryReviewToken || storedReviewToken

  const [order, setOrder] = React.useState<RestaurantOrder | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [cartOpen, setCartOpen] = React.useState(false)
  const [isCashPaying, setIsCashPaying] = React.useState(false)
  const [isMobilePaying, setIsMobilePaying] = React.useState(false)
  const [isConfirming, setIsConfirming] = React.useState(false)
  const [mobilePaymentOpen, setMobilePaymentOpen] = React.useState(false)
  const [trackingExpired, setTrackingExpired] = React.useState(false)
  const [paymentProofSms, setPaymentProofSms] = React.useState("")
  const [paymentMethods, setPaymentMethods] = React.useState<AvailablePaymentMethod[]>([])
  const [paymentMethodsLoading, setPaymentMethodsLoading] = React.useState(false)
  const [highlightedOrderIds, setHighlightedOrderIds] = React.useState<Set<string>>(new Set())
  const feedbackInitializedRef = React.useRef(false)
  const lastFeedbackAtRef = React.useRef(0)
  const hasInteractedRef = React.useRef(false)
  const ordersEndRef = React.useRef<HTMLDivElement | null>(null)
  const feedbackTimeoutsRef = React.useRef<Set<number>>(new Set())

  React.useEffect(() => () => {
    feedbackTimeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout))
    feedbackTimeoutsRef.current.clear()
  }, [])

  const restaurantRef = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return doc(db, "restaurants", restaurantId)
  }, [db, restaurantId])

  const { data: restaurant } = useDocOnce(restaurantRef)
  const activeTableSessionId = ((order as any)?.tableSessionId as string | undefined) || null

  React.useEffect(() => {
    const handleInteraction = () => {
      hasInteractedRef.current = true
      document.removeEventListener("click", handleInteraction)
      document.removeEventListener("keydown", handleInteraction)
      document.removeEventListener("touchstart", handleInteraction)
    }

    document.addEventListener("click", handleInteraction)
    document.addEventListener("keydown", handleInteraction)
    document.addEventListener("touchstart", handleInteraction)

    return () => {
      document.removeEventListener("click", handleInteraction)
      document.removeEventListener("keydown", handleInteraction)
      document.removeEventListener("touchstart", handleInteraction)
    }
  }, [])

  const tableSessionOrdersQuery = useMemoFirebase(() => {
    if (!db || !restaurantId || !activeTableSessionId) return null
    return query(
      collection(db, "restaurants", restaurantId, "orders"),
      where("tableSessionId", "==", activeTableSessionId),
      orderBy("createdAt", "desc")
    )
  }, [activeTableSessionId, db, restaurantId])

  const { data: tableSessionOrdersData } = useCollection(tableSessionOrdersQuery)

  const tableSessionQuery = useMemoFirebase(() => {
    if (!db || !restaurantId || !activeTableSessionId) return null
    return doc(db, "restaurants", restaurantId, "tableSessions", activeTableSessionId)
  }, [activeTableSessionId, db, restaurantId])
  const { data: tableSession } = useDoc(tableSessionQuery)

  const localTableUserId = getLocalTableUserId()

  React.useEffect(() => {
    if (!db || !restaurantId || !orderId) return

    setIsLoading(true)
    setError(null)

    const orderRef = doc(db, "restaurants", restaurantId, "orders", orderId)

    const unsubscribe = onSnapshot(
      orderRef,
      (docSnap) => {
        if (!docSnap.exists()) {
          setOrder(null)
          setIsLoading(false)
          return
        }

        const nextOrder = {
          ...(docSnap.data() as Omit<RestaurantOrder, "id">),
          id: docSnap.id,
        }
        const isCompleted = isClientTrackingComplete(nextOrder)

        rememberTrackedOrder({
          restaurantId,
          orderId: docSnap.id,
          tableSessionId: (nextOrder as any).tableSessionId,
          isCompleted,
        })

        setTrackingExpired(isCompleted && isCurrentTrackedOrderExpired(restaurantId, docSnap.id))
        setOrder(nextOrder)
        setIsLoading(false)
      },
      (snapshotError) => {
        console.error(snapshotError)
        setError("Impossible de charger le suivi de commande.")
        setIsLoading(false)
      }
    )

    return () => unsubscribe()
  }, [db, restaurantId, orderId])

  React.useEffect(() => {
    if (!restaurantId || !orderId || !queryReviewToken) return
    rememberReviewToken({ restaurantId, orderId, reviewToken: queryReviewToken })
  }, [orderId, queryReviewToken, restaurantId])
  React.useEffect(() => {
    if (!db || !restaurantId || !order?.id) return

    let cancelled = false

    async function loadPaymentMethods() {
      setPaymentMethodsLoading(true)
      try {
        const availableMethods = await getAvailablePaymentMethods(db, restaurantId as string, "qr", {
          amount: getOrderTotal(order),
        })
        if (!cancelled) {
          setPaymentMethods(availableMethods.filter((method) => method.type !== "cash"))
        }
      } catch (paymentError) {
        console.error(paymentError)
        if (!cancelled) setPaymentMethods([])
      } finally {
        if (!cancelled) setPaymentMethodsLoading(false)
      }
    }

    loadPaymentMethods()

    return () => {
      cancelled = true
    }
  }, [db, order, restaurantId])

  React.useEffect(() => {
    feedbackInitializedRef.current = false
    setHighlightedOrderIds(new Set())
  }, [activeTableSessionId])

  React.useEffect(() => {
    if (!tableSessionOrdersQuery || !localTableUserId) return

    const unsubscribe = onSnapshot(tableSessionOrdersQuery, (snapshot) => {
      if (!feedbackInitializedRef.current) {
        feedbackInitializedRef.current = true
        return
      }

      snapshot.docChanges().forEach((change) => {
        const changedOrder = { id: change.doc.id, ...change.doc.data() } as any
        if (changedOrder.createdBy === localTableUserId) return

        if (change.type === "added") {
          triggerOrderFeedback({
            orderId: changedOrder.id,
            title: "Nouvelle commande ajoutée",
            description: "Une personne de la table vient de commander.",
          })
          return
        }

        if (change.type === "modified") {
          triggerOrderFeedback({
            orderId: changedOrder.id,
            title: "Commande mise à jour",
            description: getClientStatusLabel(changedOrder),
          })
        }
      })
    })

    return () => unsubscribe()
  }, [localTableUserId, tableSessionOrdersQuery])

  function triggerOrderFeedback(input: { orderId: string; title: string; description: string }) {
    const now = Date.now()
    if (now - lastFeedbackAtRef.current < 2500) return
    lastFeedbackAtRef.current = now

    toast({
      title: input.title,
      description: input.description,
    })

    setHighlightedOrderIds((previous) => {
      const next = new Set(previous)
      next.add(input.orderId)
      return next
    })

    const feedbackTimeout = window.setTimeout(() => {
      setHighlightedOrderIds((previous) => {
        const next = new Set(previous)
        next.delete(input.orderId)
        return next
      })
      feedbackTimeoutsRef.current.delete(feedbackTimeout)
    }, 5000)
    feedbackTimeoutsRef.current.add(feedbackTimeout)

    ordersEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })

    if (hasInteractedRef.current && window.navigator?.vibrate) {
      window.navigator.vibrate(80)
    }
  }

  const slug = restaurant?.slug
  const goHome = () => router.push(slug ? `/${slug}` : "/")

  if (isLoading) {
    return (
      <PublicTrackingLayout
        restaurant={restaurant}
        restaurantId={restaurantId}
        count={count}
        cartOpen={cartOpen}
        setCartOpen={setCartOpen}
        onHome={goHome}
      >
        <div className="mx-auto max-w-[480px] space-y-3" role="status" aria-label="Chargement du suivi de commande">
          <PublicSurface level="card" border="subtle" radius="xl" padding="comfortable" className="space-y-3">
            <div className="h-6 w-2/3 animate-pulse rounded bg-[var(--surface-public-muted)] motion-reduce:animate-none" />
            <div className="h-4 w-full animate-pulse rounded bg-[var(--surface-public-muted)] motion-reduce:animate-none" />
            <div className="h-4 w-4/5 animate-pulse rounded bg-[var(--surface-public-muted)] motion-reduce:animate-none" />
          </PublicSurface>
          <PublicSurface level="card" border="subtle" radius="lg" padding="standard" className="h-28 animate-pulse motion-reduce:animate-none" />
          <span className="sr-only">Chargement du suivi...</span>
        </div>
      </PublicTrackingLayout>
    )
  }

  const tableSessionOrders = mergeOrdersById(tableSessionOrdersData, order)
  const orders = tableSessionOrders
  const mainOrder = orders[0] || (order as any)
  
  if (trackingExpired) {
    return (
      <PublicTrackingLayout
        restaurant={restaurant}
        restaurantId={restaurantId}
        count={count}
        cartOpen={cartOpen}
        setCartOpen={setCartOpen}
        onHome={goHome}
      >
        <PublicStatusCard className="mx-auto max-w-[480px]" headingAs="h1" title="Suivi terminé" description={`Cette commande finalisée reste disponible pendant ${TRACKING_RETENTION_HOURS}h, puis elle est masquée sur cet appareil.`} icon={<CheckCircle />} variant="neutral" emphasis="primary" action={<PublicButton variant="outline" size="standard" onClick={goHome}>Retour au menu</PublicButton>} />
      </PublicTrackingLayout>
    )
  }

  if (!mainOrder) {
    return (
      <PublicTrackingLayout
        restaurant={restaurant}
        restaurantId={restaurantId}
        count={count}
        cartOpen={cartOpen}
        setCartOpen={setCartOpen}
        onHome={goHome}
      >
        <PublicEmptyState className="mx-auto max-w-[480px]" variant="error" headingAs="h1" title="Commande introuvable" description={error || "Le lien de suivi ne correspond à aucune commande."} primaryAction={<PublicButton variant="outline" onClick={goHome}>Retour au menu</PublicButton>} />
      </PublicTrackingLayout>
    )
  }

  const safeOrder = order || mainOrder
  const paymentProofSmsPlaceholder = buildPaymentProofSmsPlaceholder(restaurant)
  const rawOrderType = (safeOrder as any).type || safeOrder.orderType
  const orderType = normalizeOrderType(safeOrder.orderType) as ClientOrderType
  const isDeliveryOrder = orderType === "delivery"
  const isPickupOrder = orderType === "pickup"
  const isQrTableOrder = orderType === "dine_in" && (safeOrder.source === "qr_table" || safeOrder.source === "qr")
  const step = getClientOrderStep(mainOrder)
  const label = getClientStatusLabel(mainOrder)
  const visibleTableSessionOrders = buildVisibleSessionOrders(tableSessionOrders, localTableUserId)
  const activeOrders = tableSessionOrders.filter((sessionOrder: any) => getClientOrderStep(sessionOrder) !== 4)
  const servedOrders = tableSessionOrders.filter((sessionOrder: any) => getClientOrderStep(sessionOrder) === 4)
  const allServed = tableSessionOrders.length > 0 && activeOrders.length === 0
  const sessionTotal = tableSessionOrders.reduce((sum: number, sessionOrder: any) => sum + getOrderTotal(sessionOrder), 0)
  const paymentTargetOrders = tableSessionOrders.filter((sessionOrder: any) => sessionOrder.paymentStatus !== "paid")
  const hasPendingPayment = paymentTargetOrders.length > 0
  const shouldShowPostServicePayment = allServed && isQrTableOrder
  const shouldShowPrepaidCompletion = allServed && !isQrTableOrder
  const prepaidPaymentConfirmed = tableSessionOrders.every((sessionOrder: any) => isPaidPaymentStatus(sessionOrder.paymentStatus))
  const sessionPaymentConfirmed =
    tableSession?.paymentRequest?.status === "validated" ||
    tableSession?.status === "closed" ||
    (tableSessionOrders.length > 0 && tableSessionOrders.every((sessionOrder: any) => isPaidPaymentStatus(sessionOrder.paymentStatus))) ||
    isPaidPaymentStatus(safeOrder.paymentStatus)
  
  // ✅ CRITICAL: Condition pour l'écran final QR - uniquement pour les commandes sur place
  // Le paiement confirmé ne marque la fin que pour le parcours QR
  const shouldShowQrTableFinalScreen =
    isQrTableOrder &&
    allServed &&
    sessionPaymentConfirmed

  const effectivePaymentStatus =
    sessionPaymentConfirmed ||
    tableSessionOrders.some((sessionOrder: any) => isPaidPaymentStatus(sessionOrder.paymentStatus))
      ? "paid"
      : safeOrder.paymentStatus
  const isProductionComplete = step === 4
  const isTrackingComplete = isClientTrackingComplete(mainOrder) || allServed
  const orderWithPaymentVerification = safeOrder as RestaurantOrder & {
    paymentIntentStatus?: string | null
    paymentVerificationStatus?: string | null
  }
  const orderDisplayId = getOrderDisplayId(safeOrder)
  const orderPhone = safeOrder.customer?.phone?.trim()
  const shouldShowPhone = isDeliveryOrderType(rawOrderType) || Boolean(orderPhone)
  const statusSummary = getTrackingStatusSummary({
    order: mainOrder,
    orderType: rawOrderType,
    step,
    label,
  })
  const canContinueOrdering =
    Boolean(slug) &&
    isQrTableOrder &&
    tableSession?.status === "active" &&
    Boolean(safeOrder.tableId) &&
    !["requested", "pending_confirmation", "validated"].includes(tableSession?.paymentRequest?.status)
  const continueOrdering = () => {
    router.push(buildContinueOrderingPath(slug, safeOrder))
  }

  // ✅ Condition pour l'avis client hors QR
  // Pour la livraison et l'emporté, l'avis apparaît uniquement lorsque la commande est terminée ET payée
  const shouldShowNonQrReview =
    !isQrTableOrder &&
    isTrackingComplete &&
    sessionPaymentConfirmed

  const handleCashPaymentSession = async () => {
    if (!safeOrder.tableSessionId) {
      console.error("NO TABLE SESSION ID – BLOCK PAYMENT")
      return
    }
    if (!db || !restaurantId || isCashPaying) return

    setIsCashPaying(true)
    try {
      await updateDoc(doc(db, "restaurants", restaurantId, "tableSessions", safeOrder.tableSessionId), {
        "paymentRequest.status": "requested",
        "paymentRequest.method": "cash",
        "paymentRequest.requestedAt": serverTimestamp(),
      })
    } catch (paymentError) {
      console.error(paymentError)
      setError("Impossible de signaler le paiement en caisse.")
    } finally {
      setIsCashPaying(false)
    }
  }

  const handleMobilePaymentSession = (method: AvailablePaymentMethod) => {
    if (!safeOrder.tableSessionId) {
      console.error("NO TABLE SESSION ID – BLOCK PAYMENT")
      return
    }
    if (!db || !restaurantId || isMobilePaying) return

    const sessionRef = doc(db, "restaurants", restaurantId, "tableSessions", safeOrder.tableSessionId)
    const paymentRequest = {
      status: "requested",
      method: "mobile",
      provider: method.name || method.code,
      requestedAt: serverTimestamp(),
    }

    if (method.paymentCode && typeof window !== "undefined") {
      window.location.href =
        method.paymentCodeType === "ussd"
          ? buildUssdTelHref(method.paymentCode)
          : method.paymentCode
    }

    setIsMobilePaying(true)
    updateDoc(sessionRef, { paymentRequest })
      .catch(console.error)
      .finally(() => {
        setIsMobilePaying(false)
        setPaymentProofSms("")
        setMobilePaymentOpen(false)
      })
  }

  const handleConfirmMobilePayment = async () => {
    if (!safeOrder.tableSessionId) {
      console.error("NO TABLE SESSION ID – BLOCK PAYMENT")
      return
    }
    if (!db || !restaurantId || isConfirming) return
    const proofSms = paymentProofSms.trim()
    if (!proofSms) {
      setError("Collez le SMS de confirmation reçu après votre paiement.")
      return
    }
    setIsConfirming(true)
    try {
      const paymentRequest = {
        status: "pending_confirmation",
        method: "mobile",
        provider: tableSession?.paymentRequest?.provider || "Mobile Money",
        paymentProofSms: proofSms,
        paymentProofSubmittedAt: serverTimestamp(),
        paymentProofStatus: "submitted",
        confirmedByClientAt: serverTimestamp(),
      }
      await updateDoc(doc(db, "restaurants", restaurantId, "tableSessions", safeOrder.tableSessionId), {
        paymentRequest,
      })
    } catch (e) {
      console.error(e)
    } finally {
      setIsConfirming(false)
    }
  }

  // ✅ Écran final QR - UNIQUEMENT pour les commandes sur place servies et payées
  if (shouldShowQrTableFinalScreen) {
    return (
      <PublicTrackingLayout
        restaurant={restaurant}
        restaurantId={restaurantId}
        tableContext={buildTableContextFromOrder(order)}
        count={count}
        cartOpen={cartOpen}
        setCartOpen={setCartOpen}
        onHome={goHome}
      >
        <div className="mx-auto max-w-[480px] space-y-3">
          <h1 className="text-[22px] font-public-extrabold leading-7 text-[var(--text-primary)] sm:text-[28px] sm:leading-[34px]">
            Paiement confirmé
          </h1>

          <PaymentConfirmedSummary amount={sessionTotal} />

          {restaurantId ? (
            <RestaurantReviewCard
              restaurantId={restaurantId}
              order={mainOrder}
              reviewToken={reviewToken}
            />
          ) : null}
        </div>
      </PublicTrackingLayout>
    )
  }

  // ✅ Parcours normal de suivi (sans l'écran final QR)
  // Cela concerne : livraison, emporté, et sur place avant paiement
  return (
    <PublicTrackingLayout
      restaurant={restaurant}
      restaurantId={restaurantId}
      tableContext={buildTableContextFromOrder(order)}
      count={count}
      cartOpen={cartOpen}
      setCartOpen={setCartOpen}
      onHome={canContinueOrdering ? continueOrdering : goHome}
    >
      <div className="mx-auto max-w-[480px] space-y-3">
        <h1 className="text-[22px] font-public-extrabold leading-7 text-[var(--text-primary)] sm:text-[28px] sm:leading-[34px]">Suivez votre commande</h1>

        <TrackingStatusCard summary={statusSummary} step={step} />

        {error ? <PublicStatusCard role="alert" title="Une action n’a pas abouti" description={error} icon={<Info />} variant="danger" emphasis="subtle" /> : null}

        {mainOrder && (
          <PublicSurface as="section" level="card" border="subtle" radius="lg" padding="standard" elevation="xs">
            <h2 className="mb-4 text-public-md font-public-bold text-[var(--text-primary)]">
              Évolution de votre commande
            </h2>
            <OrderStepper 
              appearance="public"
              orderType={mainOrder.orderType} 
              kitchenStatus={mainOrder.kitchenStatus} 
              legacyStatus={mainOrder.status}
              createdAt={mainOrder.createdAt}
              timestamps={mainOrder.timestamps}
            />
          </PublicSurface>
        )}

        <TrackingHeaderCard orderDisplayId={orderDisplayId} orderPhone={shouldShowPhone ? orderPhone : ""} order={safeOrder} restaurantName={restaurant?.name} />

        {!isTrackingComplete ? <TrackingInfoCard /> : null}

        {shouldShowPostServicePayment ? (
          <PublicStatusCard 
            title="Paiement de la table" 
            description="Choisissez une méthode lorsque toutes les commandes auront été servies."
            icon={<CreditCard />} 
            variant={sessionPaymentConfirmed ? "success" : tableSession?.paymentRequest?.status === "rejected" ? "danger" : "warning"} 
            emphasis="standard" 
            badge={sessionPaymentConfirmed ? <PublicBadge label="Confirmé" variant="success" /> : <PublicBadge label="À régler" variant="warning" />}
          >
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border-public-subtle)] pb-4">
              <span className="text-public-sm font-public-semibold text-[var(--text-secondary)]">Total à payer</span>
              <PublicPrice role="total" value={formatMoney(sessionTotal)} suffix="FCFA" aria-label={`Total à payer ${formatMoney(sessionTotal)} FCFA`} />
            </div>

            {sessionPaymentConfirmed ? (
              <PaymentConfirmedPanel />
            ) : tableSession?.paymentRequest?.status === "requested" && tableSession?.paymentRequest?.method === "cash" ? (
               <PublicSurface role="status" className="mt-4 text-center text-public-sm font-public-bold" level="muted" radius="md" padding="standard">Un serveur arrive pour encaisser</PublicSurface>
            ) : tableSession?.paymentRequest?.status === "requested" && tableSession?.paymentRequest?.method === "mobile" ? (
               <div className="mt-5 space-y-3">
                 <label htmlFor="tracking-payment-proof" className="block text-public-sm font-public-semibold text-[var(--text-primary)]">
                   Collez le SMS de confirmation reçu après votre paiement.
                 </label>
                 <textarea
                   id="tracking-payment-proof"
                   value={paymentProofSms}
                   onChange={(event) => setPaymentProofSms(event.target.value)}
                   placeholder={paymentProofSmsPlaceholder}
                   className="min-h-28 w-full resize-none rounded-[var(--radius-public-md)] border border-[var(--border-public-default)] bg-[var(--surface-public-card)] px-4 py-3 font-publicBody text-public-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus-visible:border-[var(--focus-ring)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--focus-ring)_28%,transparent)]"
                 />
                 <PublicButton fullWidth size="action" onClick={handleConfirmMobilePayment} disabled={!paymentProofSms.trim()} loading={isConfirming} loadingLabel="Envoi en cours">Envoyer la preuve SMS</PublicButton>
               </div>
            ) : tableSession?.paymentRequest?.status === "pending_confirmation" ? (
               <PublicSurface role="status" className="mt-4 text-center text-public-sm font-public-bold" level="muted" radius="md" padding="standard">Paiement effectué, en attente de validation</PublicSurface>
            ) : (
               <div className="mt-5 space-y-3">
                 {tableSession?.paymentRequest?.status === "rejected" ? (
                    <PublicSurface role="alert" level="card" border="default" radius="md" padding="compact" className="border-[var(--danger)] text-public-sm font-public-bold text-[var(--danger)]">Paiement refusé, veuillez réessayer.</PublicSurface>
                 ) : null}
                 <p className="text-public-sm font-public-semibold text-[var(--text-primary)]">Choisissez votre moyen de paiement</p>
                 
                 <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                   <PublicButton
                     variant="primary"
                     size="standard"
                     onClick={handleCashPaymentSession}
                     loading={isCashPaying}
                     loadingLabel="Demande en cours"
                     className="flex items-center justify-center gap-2 px-3"
                   >
                     <Banknote
                       className="size-5 shrink-0"
                       aria-hidden="true"
                     />
                     <span className="truncate">Espèces</span>
                   </PublicButton>

                   {paymentMethods.map((method) => (
                     <PublicButton
                       key={method.code}
                       variant="outline"
                       size="standard"
                       onClick={() => handleMobilePaymentSession(method)}
                       disabled={isMobilePaying || paymentMethodsLoading}
                       className="flex items-center justify-center gap-2 px-3"
                     >
                       {method.logoUrl ? (
                         <img
                           src={method.logoUrl}
                           alt=""
                           aria-hidden="true"
                           className="h-5 w-auto max-w-8 shrink-0 object-contain"
                         />
                       ) : (
                         <CreditCard
                           className="size-5 shrink-0"
                           aria-hidden="true"
                         />
                       )}
                       <span className="truncate">{method.name}</span>
                     </PublicButton>
                   ))}
                 </div>
               </div>
             )}

            {!sessionPaymentConfirmed && canContinueOrdering ? (
              <PublicButton className="mt-4" fullWidth variant="outline" size="standard" onClick={continueOrdering}>Commander encore</PublicButton>
            ) : null}
           </PublicStatusCard>
        ) : shouldShowPrepaidCompletion ? (
          <PublicStatusCard title="Merci pour votre commande." icon={<CheckCircle2 />} variant="success" emphasis="standard">
            <p className="text-public-sm font-public-semibold text-[var(--text-secondary)]">
              {prepaidPaymentConfirmed
                ? isDeliveryOrder
                  ? "Un livreur vous contactera très bientôt pour effectuer la livraison."
                  : "Votre commande est prête à être récupérée."
                : "Paiement déjà initié. La caisse finalise la validation si besoin."}
            </p>
          </PublicStatusCard>
        ) : null}
        
        {!shouldShowPostServicePayment ? (
          <PaymentBadge
            appearance="public"
            paymentStatus={effectivePaymentStatus}
            paymentIntentStatus={orderWithPaymentVerification.paymentIntentStatus}
            paymentVerificationStatus={orderWithPaymentVerification.paymentVerificationStatus}
          />
        ) : null}

        {/* ✅ Avis client hors QR - UNIQUEMENT quand la commande est terminée ET payée */}
        {shouldShowNonQrReview && restaurantId ? (
          <RestaurantReviewCard
            restaurantId={restaurantId}
            order={mainOrder}
            reviewToken={reviewToken}
          />
        ) : null}
      </div>
    </PublicTrackingLayout>
  )
}

function getOrderTotal(order: any) {
  const explicit = Number(order?.total ?? order?.totalAmount)
  if (Number.isFinite(explicit) && explicit > 0) return explicit

  return (order?.items || []).reduce((sum: number, item: any) => sum + getItemTotal(item), 0)
}

type TrackingStatusSummary = {
  title: string
  description: string
  icon: LucideIcon
  remainingLabel: string
  readyAtLabel: string
}

function getTrackingStatusSummary({
  order,
  orderType,
  step,
  label,
}: {
  order: any
  orderType?: string | null
  step: number
  label: string
}): TrackingStatusSummary {
  const createdAt = toTrackingDate(order?.createdAt)
  const now = Date.now()
  const estimatedReadyAt = getEstimatedReadyAt(order, createdAt, step)
  const remainingMinutes = estimatedReadyAt
    ? Math.max(0, Math.ceil((estimatedReadyAt.getTime() - now) / 60000))
    : getFallbackRemainingMinutes(step)
  const readyAtLabel = estimatedReadyAt ? formatTrackingTime(estimatedReadyAt) : "--:--"

  if (step <= 1) {
    return {
      title: "Commande reçue",
      description: "Commande transmise au restaurant.",
      icon: ClipboardList,
      remainingLabel: `${remainingMinutes} min`,
      readyAtLabel,
    }
  }

  if (step === 2) {
    return {
      title: "Préparation en cours",
      description: "Votre commande est en cuisine.",
      icon: ChefHat,
      remainingLabel: `${remainingMinutes} min`,
      readyAtLabel,
    }
  }

  if (step === 3) {
    return {
      title: "Commande prête",
      description: getReadyDescription(orderType),
      icon: Bell,
      remainingLabel: `${remainingMinutes} min`,
      readyAtLabel,
    }
  }

  return {
    title: getFinalStatusTitle(orderType, label),
    description: getFinalStatusDescription(orderType),
    icon: CheckCircle2,
    remainingLabel: "0 min",
    readyAtLabel,
  }
}

function TrackingHeaderCard({
  orderDisplayId,
  orderPhone,
  order,
  restaurantName,
}: {
  orderDisplayId: string
  orderPhone?: string | null
  order: any
  restaurantName?: string | null
}) {
  const createdAt = toTrackingDate(order?.createdAt)
  const normalizedType = normalizeOrderType(order?.orderType)
  const orderTypeLabel = normalizedType === "dine_in" ? "Sur place" : normalizedType === "delivery" ? "Livraison" : "À emporter"

  return (
    <PublicSurface as="section" level="card" border="subtle" radius="lg" padding="standard" elevation="xs">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-public-md font-public-bold text-[var(--text-primary)]">Informations de commande</h2>
          <p className="mt-1 text-public-sm text-[var(--text-secondary)]">Commande n° <strong className="text-[var(--text-primary)]">{orderDisplayId}</strong></p>
        </div>
        <PublicBadge label={orderTypeLabel} variant="neutral" />
      </div>
      <dl className="mt-4 grid gap-2.5 text-public-sm">
        {restaurantName ? <TrackingInfoRow label="Restaurant" value={restaurantName} /> : null}
        {order?.table ? <TrackingInfoRow label="Table" value={order.table} /> : null}
        {order?.deliveryAddress ? <TrackingInfoRow label="Adresse" value={order.deliveryAddress} /> : null}
        {orderPhone ? <TrackingInfoRow label="Téléphone" value={orderPhone} icon={<Phone />} /> : null}
        {createdAt ? <TrackingInfoRow label="Commandée à" value={formatTrackingTime(createdAt)} /> : null}
      </dl>
    </PublicSurface>
  )
}

function TrackingStatusCard({ summary, step }: { summary: TrackingStatusSummary; step: number }) {
  const Icon = summary.icon
  const variant = step <= 1 ? "warning" : step === 2 ? "brand" : "success"

  return (
    <PublicStatusCard title={summary.title} description={summary.description} icon={<Icon />} variant={variant} emphasis="primary" badge={step < 4 ? <PublicBadge label={summary.remainingLabel} variant={variant} /> : <PublicBadge label="Terminée" variant="success" />}>
      {step < 4 ? <p className="text-public-xs font-public-semibold text-[var(--text-muted)]">Heure estimée : {summary.readyAtLabel}</p> : null}
    </PublicStatusCard>
  )
}

function TrackingInfoCard() {
  return (
    <PublicStatusCard title="Merci pour votre commande !" description="Nous vous tiendrons informé à chaque étape." icon={<Info />} variant="info" emphasis="subtle" headingAs="h2" />
  )
}

function TrackingInfoRow({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-3"><dt className="flex items-center gap-1.5 text-[var(--text-muted)]">{icon ? <span aria-hidden="true" className="[&_svg]:size-3.5">{icon}</span> : null}{label}</dt><dd className="break-words text-right font-public-semibold text-[var(--text-primary)]">{value}</dd></div>
}

function getEstimatedReadyAt(order: any, createdAt: Date | null, step: number) {
  const explicit =
    toTrackingDate(order?.estimatedReadyAt) ||
    toTrackingDate(order?.estimatedPickupAt) ||
    toTrackingDate(order?.estimatedDeliveryAt) ||
    toTrackingDate(order?.readyAt) ||
    toTrackingDate(order?.timestamps?.readyAt)

  if (explicit) return explicit

  const base = createdAt || new Date()
  const fallbackMinutes = step <= 1 ? 18 : step === 2 ? 12 : step === 3 ? 3 : 0
  return new Date(base.getTime() + fallbackMinutes * 60000)
}

function getFallbackRemainingMinutes(step: number) {
  if (step <= 1) return 18
  if (step === 2) return 12
  if (step === 3) return 3
  return 0
}

function getReadyDescription(orderType: string | null | undefined) {
  return isDeliveryOrderType(orderType)
    ? "Votre commande est prête et sera bientôt prise en charge."
    : "Votre commande est prête. Vous serez servi dans un instant."
}

function getFinalStatusTitle(orderType: string | null | undefined, label: string) {
  if (isDeliveryOrderType(orderType)) return "Commande livrée"
  if (label.toLowerCase().includes("serv")) return "Bon appétit !"
  if (label.toLowerCase().includes("récup") || label.toLowerCase().includes("recup")) return "Commande récupérée"
  return "Commande terminée"
}

function getFinalStatusDescription(orderType: string | null | undefined) {
  if (isDeliveryOrderType(orderType)) {
    return "Merci pour votre commande. Nous espérons vous revoir bientôt."
  }

  return "Votre commande vous a été servie. Bon appétit !"
}

function toTrackingDate(value: unknown): Date | null {
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

function formatTrackingTime(date: Date) {
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
}

function PaymentConfirmedSummary({ amount }: { amount: number }) {
  return (
    <PublicStatusCard
      title="Merci pour votre visite"
      icon={<CheckCircle2 />}
      variant="success"
      emphasis="primary"
      badge={<PublicBadge label="Confirmé" variant="success" />}
    >
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border-public-subtle)] pb-4">
        <span className="text-public-sm font-public-semibold text-[var(--text-secondary)]">
          Montant payé
        </span>

        <PublicPrice
          role="total"
          value={formatMoney(amount)}
          suffix="FCFA"
          aria-label={`Montant payé ${formatMoney(amount)} FCFA`}
        />
      </div>

      <p className="mt-2 text-public-xs text-[var(--text-secondary)]">
        Nous espérons vous revoir bientôt. Vous pouvez maintenant partager votre avis sur votre expérience.
      </p>
    </PublicStatusCard>
  )
}

function PaymentConfirmedPanel() {
  return (
    <PublicSurface level="card" border="default" radius="lg" padding="standard" className="mt-4 border-[color:color-mix(in_srgb,var(--success)_30%,var(--border-public-subtle))] bg-[color:color-mix(in_srgb,var(--success)_8%,var(--surface-public-card))]">
      <div className="flex items-center gap-2 text-public-sm font-public-bold text-[var(--success)]"><CheckCircle className="size-5" aria-hidden="true" />Paiement confirmé</div>
      <p className="mt-2 text-public-sm font-public-semibold text-[var(--text-primary)]">Merci pour votre visite. Votre paiement a bien été enregistré et votre table a été clôturée avec succès.</p>
      <p className="mt-2 text-public-xs text-[var(--text-secondary)]">Nous espérons vous revoir bientôt. N'hésitez pas à partager votre avis avant de quitter le restaurant.</p>
    </PublicSurface>
  )
}

function buildContinueOrderingPath(slug: string | null | undefined, order: any) {
  if (!slug) return "/"

  const tableId = order?.tableId
  const tableSessionId = order?.tableSessionId || order?.sessionId
  const orderId = order?.id

  if (!tableId || !tableSessionId) return `/${slug}`

  const params = new URLSearchParams({
    t: String(tableId),
    sessionId: String(tableSessionId),
    mode: "dine_in",
  })

  if (orderId) params.set("orderId", String(orderId))

  return `/${slug}?${params.toString()}`
}

function buildTableContextFromOrder(order: any) {
  if (!order?.tableId) return undefined

  return {
    id: order.tableId,
    name: order.table || order.tableName || order.tableId,
    zoneId: order.zoneId || "main",
    status: "occupied",
    currentSessionId: order.tableSessionId || null,
  }
}

function getLocalTableUserId() {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem("tableUserId")
}

function buildVisibleSessionOrders(orders: any[], localTableUserId: string | null) {
  const guestMap = new Map<string, string>()
  let guestCount = 1

  orders.forEach((order) => {
    if (!order?.createdBy || order.createdBy === localTableUserId) return
    if (!guestMap.has(order.createdBy)) {
      guestMap.set(order.createdBy, `Invitée ${guestCount}`)
      guestCount += 1
    }
  })

  return orders.map((order) => {
    if (order?.createdBy && order.createdBy === localTableUserId) {
      return { ...order, createdByLabel: "Toi" }
    }

    return {
      ...order,
      createdByLabel: order?.createdBy ? guestMap.get(order.createdBy) || "Invitée" : "Invitée",
    }
  })
}

function OrderItemImage({ item }: { item: any }) {
  const imageUrl = item.imageUrl || item.image || item.productImageUrl || item.imageSnapshot

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={item.name || "Article"}
        className="h-10 w-10 shrink-0 rounded-md object-cover"
      />
    )
  }

  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
      <Utensils className="h-4 w-4" />
    </div>
  )
}

function isDeliveryOrderType(type: string | null | undefined) {
  return type === "delivery" || type === "livraison"
}

function isClientTrackingComplete(order: any) {
  if (getClientOrderStep(order) === 4) return true

  const finalStatuses = new Set([
    "served",
    "picked_up",
    "delivered",
    "completed",
    "complete",
    "closed",
  ])

  return [
    order?.status,
    order?.kitchenStatus,
    order?.orderStatus,
    order?.deliveryStatus,
    order?.pickupStatus,
    order?.fulfillmentStatus,
  ].some((status) => finalStatuses.has(String(status || "").toLowerCase()))
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

function isPaidPaymentStatus(status: string | null | undefined) {
  return status === "paid" || status === "verified" || status === "paye" || status === PAYMENT_STATUS.VALIDATED
}

function getItemUnitPrice(item: any) {
  return Number(item.unitPrice ?? item.price ?? item.priceSnapshot ?? 0)
}

function getItemTotal(item: any) {
  const explicitTotal = Number(item.total)
  if (Number.isFinite(explicitTotal) && explicitTotal > 0) return explicitTotal
  return getItemUnitPrice(item) * Number(item.quantity || 0)
}

function formatMoney(value: unknown) {
  const amount = Number(value || 0)
  if (!Number.isFinite(amount)) return "0"
  return Math.round(amount).toLocaleString("fr-FR")
}

function PublicTrackingLayout({
  children,
  restaurant,
  restaurantId,
  tableContext,
  count,
  cartOpen,
  setCartOpen,
  onHome,
}: {
  children: React.ReactNode
  restaurant: any
  restaurantId?: string
  tableContext?: any
  count: number
  cartOpen: boolean
  setCartOpen: React.Dispatch<React.SetStateAction<boolean>>
  onHome: () => void
}) {
  return (
    <div className="app-background min-h-screen text-foreground">
      <PublicHeader
        variant="tracking"
        restaurantName={restaurant?.name || "Restaurant"}
        logoUrl={restaurant?.logoUrl || restaurant?.logo}
        themeAction={<ThemeToggle />}
        cartCount={count}
        onCartClick={() => setCartOpen(true)}
      />

      <PublicPageShell
        background="transparent"
        width="transaction"
        bottomReserve="navigation"
        contentClassName="py-2"
      >
        {children}
      </PublicPageShell>

      <PublicBottomNavigation
        variant="tracking"
        activeId="tracking"
        items={[
          { id: "home", label: "Menu", icon: <Utensils />, onSelect: onHome },
          {
            id: "order",
            label: "Panier",
            icon: <ShoppingBag />,
            onSelect: () => setCartOpen(true),
            badge: count,
            ariaLabel: count > 0 ? `Panier, ${count} article${count > 1 ? "s" : ""}` : "Panier",
          },
          { id: "tracking", label: "Suivi", icon: <ClipboardList />, active: true, disabled: true, ariaLabel: "Suivi, page actuelle" },
        ]}
      />

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        restaurantId={restaurantId}
        tableContext={tableContext}
      />
    </div>
  )
}

function mergeOrdersById(...arrays: any[]) {
  const map = new Map<string, any>()
  for (const item of arrays) {
    if (!item) continue
    if (Array.isArray(item)) {
      item.forEach((order) => {
        if (order?.id) map.set(order.id, order)
      })
    } else if (item?.id) {
      map.set(item.id, item)
    }
  }
  return Array.from(map.values())
}