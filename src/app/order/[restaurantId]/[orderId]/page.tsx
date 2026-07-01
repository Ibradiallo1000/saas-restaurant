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
  Utensils,
  type LucideIcon,
} from "lucide-react"
import { useParams, useRouter, useSearchParams } from "next/navigation"

import { OrderStepper } from "@/components/OrderStepper"
import { PaymentBadge } from "@/components/PaymentBadge"
import { useCollection, useDoc, useDocOnce, useFirestore, useMemoFirebase } from "@/firebase"
import { useToast } from "@/hooks/use-toast"
import { PAYMENT_STATUS } from "@/lib/constants"
import { getClientOrderStep, getClientStatusLabel } from "@/lib/getClientOrderStep"
import { getOrderDisplayId } from "@/lib/order-display-id"
import { normalizeOrderType } from "@/lib/order-lifecycle"
import { buildUssdTelHref } from "@/lib/ussd"
import { CartProvider, useCart } from "@/modules/public/cart/CartContext"
import CartDrawer from "@/modules/public/components/CartDrawer"
import Header from "@/modules/public/components/Header"
import PaymentModal from "@/modules/public/components/PaymentModal"
import { PublicBottomNavigation } from "@/modules/public/PublicPage"
import {
  isCurrentTrackedOrderExpired,
  rememberTrackedOrder,
  TRACKING_RETENTION_HOURS,
} from "@/modules/public/orderTrackingStorage"
import type { RestaurantOrder } from "@/modules/restaurant/types"
import {
  getAvailablePaymentMethods,
  type AvailablePaymentMethod,
} from "@/services/payment-methods.service"

const TRACKING_CARD_CLASS =
  "rounded-2xl border bg-card p-5 text-card-foreground shadow-sm"

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
    const primary = restaurant?.theme?.primary || "#f97316"
    const secondary = restaurant?.theme?.secondary || "#1f2937"

    document.documentElement.style.setProperty("--color-primary", primary)
    document.documentElement.style.setProperty("--color-secondary", secondary)
  }, [restaurant?.theme?.primary, restaurant?.theme?.secondary])

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
            title: "Nouvelle commande ajoutÃƒÂ©e",
            description: "Une personne de la table vient de commander.",
          })
          return
        }

        if (change.type === "modified") {
          triggerOrderFeedback({
            orderId: changedOrder.id,
            title: "Commande mise ÃƒÂ  jour",
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

    window.setTimeout(() => {
      setHighlightedOrderIds((previous) => {
        const next = new Set(previous)
        next.delete(input.orderId)
        return next
      })
    }, 5000)

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
        <div className={`${TRACKING_CARD_CLASS} mx-auto max-w-md p-6 text-center`}>
          Chargement du suivi...
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
        <div className={`${TRACKING_CARD_CLASS} mx-auto max-w-md p-6 text-center`}>
          <CheckCircle className="mx-auto h-10 w-10 text-emerald-500" />
          <h1 className="mt-3 text-lg font-semibold">Suivi terminé</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Cette commande finalisée reste disponible pendant {TRACKING_RETENTION_HOURS}h, puis elle est masquée sur cet appareil.
          </p>
          <button
            type="button"
            onClick={goHome}
            className="mt-5 h-11 rounded-xl bg-[var(--color-primary)] px-5 text-sm font-black text-white shadow-sm transition active:scale-[0.98]"
          >
            Retour au menu
          </button>
        </div>
      </PublicTrackingLayout>
    )
  }

  if (error || !mainOrder) {
    return (
      <PublicTrackingLayout
        restaurant={restaurant}
        restaurantId={restaurantId}
        count={count}
        cartOpen={cartOpen}
        setCartOpen={setCartOpen}
        onHome={goHome}
      >
        <div className={`${TRACKING_CARD_CLASS} mx-auto max-w-md p-6 text-center`}>
          <h1 className="text-lg font-semibold">Commande introuvable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {error || "Le lien de suivi ne correspond a aucune commande."}
          </p>
        </div>
      </PublicTrackingLayout>
    )
  }

  const safeOrder = order || mainOrder
  const paymentProofSmsPlaceholder = buildPaymentProofSmsPlaceholder(restaurant)
  const rawOrderType = (safeOrder as any).type || safeOrder.orderType
  const orderType = normalizeOrderType(safeOrder.orderType) as ClientOrderType
  const isDeliveryOrder = orderType === "delivery"
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
  const effectivePaymentStatus =
    sessionPaymentConfirmed ||
    tableSessionOrders.some((sessionOrder: any) => isPaidPaymentStatus(sessionOrder.paymentStatus))
      ? "paid"
      : safeOrder.paymentStatus
  const isProductionComplete = step === 4
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

  const handleCashPaymentSession = async () => {
    if (!safeOrder.tableSessionId) {
      console.error("NO TABLE SESSION ID â€“ BLOCK PAYMENT")
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
      console.error("NO TABLE SESSION ID â€“ BLOCK PAYMENT")
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
      console.error("NO TABLE SESSION ID â€“ BLOCK PAYMENT")
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
      <div className="mx-auto max-w-md space-y-2.5">
        <TrackingHeaderCard
          orderDisplayId={orderDisplayId}
          orderPhone={shouldShowPhone ? orderPhone : ""}
        />

        <TrackingStatusCard summary={statusSummary} />

        {mainOrder && (
          <section className="rounded-2xl border bg-card px-3.5 py-3 text-card-foreground shadow-sm">
            <h2 className="mb-3 text-base font-black text-foreground">
              Évolution de votre commande
            </h2>
            <OrderStepper 
              orderType={mainOrder.orderType} 
              kitchenStatus={mainOrder.kitchenStatus} 
              legacyStatus={mainOrder.status}
              createdAt={mainOrder.createdAt}
              timestamps={mainOrder.timestamps}
            />
          </section>
        )}

        <TrackingInfoCard />

        {shouldShowPostServicePayment ? (
          <section className="rounded-2xl border-2 border-orange-200 bg-orange-50 p-5 text-orange-950 shadow-lg dark:border-orange-400/30 dark:bg-orange-500/10 dark:text-orange-100">
            <p className="text-xs font-black uppercase tracking-wide text-orange-700 dark:text-orange-300">
              Total à payer
            </p>
            <p className="mt-2 text-4xl font-black text-orange-900 dark:text-orange-100">
              {formatMoney(sessionTotal)} FCFA
            </p>

            {sessionPaymentConfirmed ? (
              <PaymentConfirmedPanel />
            ) : tableSession?.paymentRequest?.status === "requested" && tableSession?.paymentRequest?.method === "cash" ? (
               <div className="mt-5 rounded-xl border border-orange-300 bg-orange-100 p-4 text-center text-orange-800 dark:bg-orange-950/30 dark:text-orange-300">
                 <p className="font-black text-lg animate-pulse">Un serveur arrive pour encaisser</p>
               </div>
            ) : tableSession?.paymentRequest?.status === "requested" && tableSession?.paymentRequest?.method === "mobile" ? (
               <div className="mt-5 space-y-3">
                 <label className="block text-sm font-black text-orange-900 dark:text-orange-100">
                   Collez le SMS de confirmation reçu après votre paiement.
                 </label>
                 <textarea
                   value={paymentProofSms}
                   onChange={(event) => setPaymentProofSms(event.target.value)}
                   placeholder={paymentProofSmsPlaceholder}
                   className="min-h-28 w-full resize-none rounded-xl border border-orange-300 bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-orange-400/40"
                 />
                 <button
                   onClick={handleConfirmMobilePayment}
                   disabled={isConfirming || !paymentProofSms.trim()}
                   className="w-full flex items-center justify-center h-14 rounded-xl bg-[var(--color-primary)] text-white text-sm font-black shadow-sm transition active:scale-[0.98] disabled:opacity-60 uppercase"
                 >
                   {isConfirming ? "..." : "Envoyer la preuve SMS"}
                 </button>
               </div>
            ) : tableSession?.paymentRequest?.status === "pending_confirmation" ? (
               <div className="mt-5 rounded-xl border border-orange-300 bg-orange-100 p-4 text-center text-orange-800 dark:bg-orange-950/30 dark:text-orange-300">
                 <p className="font-black text-lg animate-pulse">Paiement effectué, en attente de validation</p>
               </div>
            ) : (
               <div className="mt-5 space-y-3">
                 {tableSession?.paymentRequest?.status === "rejected" ? (
                    <div className="mb-3 rounded-xl bg-red-500/10 p-3 text-sm font-black text-red-700 dark:text-red-300">
                      Paiement refusé, veuillez réessayer.
                    </div>
                 ) : null}
                 <p className="text-sm font-semibold text-orange-900 dark:text-orange-100">Comment souhaitez-vous payer ?</p>
                 
                 <div className="grid grid-cols-3 justify-items-start gap-2 sm:gap-3">
                   <button
                     type="button"
                     onClick={handleCashPaymentSession}
                     disabled={isCashPaying}
                     className="inline-flex h-12 max-w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-3 text-sm font-black text-white shadow-sm transition active:scale-[0.98] disabled:opacity-60 sm:px-4"
                   >
                     <Banknote className="h-5 w-5" />
                     {isCashPaying ? "..." : "Espèces"}
                   </button>
                   
                   {paymentMethods.map(method => (
                     <button
                       key={method.code}
                       type="button"
                       onClick={() => handleMobilePaymentSession(method)}
                       disabled={isMobilePaying || paymentMethodsLoading}
                       className="inline-flex h-12 max-w-full items-center justify-center gap-2 rounded-xl border border-orange-300 bg-background px-3 text-sm font-black text-foreground transition hover:bg-muted active:scale-[0.98] disabled:opacity-60 sm:px-4"
                     >
                       {method.logoUrl ? (
                         <img src={method.logoUrl} alt={method.name} className="h-6 object-contain" />
                       ) : (
                         <CreditCard className="h-5 w-5 text-orange-600" />
                       )}
                       <span>{method.name}</span>
                     </button>
                   ))}
                 </div>
               </div>
             )}

            {!sessionPaymentConfirmed && canContinueOrdering ? (
              <button
                type="button"
                onClick={continueOrdering}
                className="mt-5 flex h-12 w-full items-center justify-center rounded-xl border border-orange-300 bg-background px-4 text-sm font-black uppercase text-orange-900 shadow-sm transition hover:bg-orange-100 active:scale-[0.98] dark:text-orange-100 dark:hover:bg-orange-500/10"
              >
                Commander encore
              </button>
            ) : null}
           </section>
        ) : shouldShowPrepaidCompletion ? (
          <section className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-5 text-emerald-950 shadow-lg dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-100">
            <p className="text-xs font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              Commande servie
            </p>
            <p className="mt-2 whitespace-nowrap text-xl font-black text-emerald-900 dark:text-emerald-100">
              Merci pour votre commande.
            </p>
            <p className="mt-3 text-sm font-semibold text-muted-foreground">
              {prepaidPaymentConfirmed
                ? isDeliveryOrder
                  ? "Un livreur vous contactera très bientôt pour effectuer la livraison."
                  : "Votre commande est prête à être récupérée."
                : "Paiement déjà initié. La caisse finalise la validation si besoin."}
            </p>
          </section>
        ) : null}
        
        {!shouldShowPostServicePayment ? (
          <PaymentBadge
            paymentStatus={effectivePaymentStatus}
            paymentIntentStatus={orderWithPaymentVerification.paymentIntentStatus}
            paymentVerificationStatus={orderWithPaymentVerification.paymentVerificationStatus}
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
    description: "Commande finalisée.",
    icon: CheckCircle2,
    remainingLabel: "0 min",
    readyAtLabel,
  }
}

function TrackingHeaderCard({
  orderDisplayId,
  orderPhone,
}: {
  orderDisplayId: string
  orderPhone?: string | null
}) {
  return (
    <section className="rounded-2xl border bg-card px-3.5 py-3 text-card-foreground shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-orange-200 bg-orange-50 text-orange-600 shadow-sm dark:border-orange-400/30 dark:bg-orange-500/10 dark:text-orange-300">
          <ClipboardList className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <h1 className="whitespace-nowrap text-[22px] font-bold leading-tight text-foreground sm:text-2xl">
            Suivez votre commande
          </h1>
          <p className="mt-1 text-base font-semibold text-muted-foreground sm:text-lg">
            Commande n° <span className="text-orange-600 dark:text-orange-300">{orderDisplayId}</span>
          </p>
          {orderPhone ? (
            <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-muted-foreground sm:text-[15px]">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <span>{orderPhone}</span>
            </p>
          ) : null}
        </div>
      </div>
    </section>
  )
}

function TrackingStatusCard({ summary }: { summary: TrackingStatusSummary }) {
  const Icon = summary.icon

  return (
    <section className="rounded-2xl border border-orange-200 bg-orange-50/70 px-3.5 py-3 text-orange-950 shadow-sm dark:border-orange-400/30 dark:bg-orange-500/10 dark:text-orange-100">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-orange-600 shadow-[0_10px_24px_rgba(15,23,42,0.10)] dark:bg-slate-950/80 dark:text-orange-300">
          <Icon className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-black leading-tight text-orange-600 dark:text-orange-300 sm:text-2xl">
            {summary.title}
          </h2>
          <p className="mt-1 text-sm font-medium leading-5 text-foreground sm:text-base">
            {summary.description}
          </p>
        </div>
      </div>
    </section>
  )
}

function TrackingInfoCard() {
  return (
    <section className="rounded-2xl border border-orange-200 bg-orange-50/50 px-3.5 py-2.5 text-card-foreground shadow-sm dark:border-orange-400/25 dark:bg-orange-500/10">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-orange-200 bg-orange-50 text-orange-600 dark:border-orange-400/30 dark:bg-orange-500/10 dark:text-orange-300">
          <Info className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-black leading-tight text-foreground">Merci pour votre commande !</h2>
          <p className="mt-0.5 text-xs font-medium leading-4 text-muted-foreground">
            Nous vous tiendrons informé à chaque étape.
          </p>
        </div>
      </div>
    </section>
  )
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
    : "Votre commande est prête. Vous pouvez la récupérer."
}

function getFinalStatusTitle(orderType: string | null | undefined, label: string) {
  if (isDeliveryOrderType(orderType)) return "Commande livrée"
  if (label.toLowerCase().includes("serv")) return "Commande servie"
  if (label.toLowerCase().includes("récup") || label.toLowerCase().includes("recup")) return "Commande récupérée"
  return "Commande terminée"
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

function PaymentConfirmedPanel() {
  return (
    <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-5 text-green-900 shadow-sm dark:border-green-400/30 dark:bg-green-500/10 dark:text-green-100">
      <div className="flex items-center gap-2 text-sm font-black uppercase">
        <CheckCircle className="h-5 w-5" />
        Commande terminee
      </div>
      <h2 className="mt-3 text-2xl font-black">Paiement confirme</h2>
      <p className="mt-2 text-sm font-semibold text-green-800 dark:text-green-100/90">
        Merci pour votre visite. Votre table a ete cloturee avec succes.
      </p>
      <p className="mt-3 text-sm text-green-800/80 dark:text-green-100/80">
        Nous esperons vous revoir bientot. Vous pouvez partager votre avis avec l equipe du restaurant avant de partir.
      </p>
    </div>
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
      guestMap.set(order.createdBy, `InvitÃƒÂ© ${guestCount}`)
      guestCount += 1
    }
  })

  return orders.map((order) => {
    if (order?.createdBy && order.createdBy === localTableUserId) {
      return { ...order, createdByLabel: "Toi" }
    }

    return {
      ...order,
      createdByLabel: order?.createdBy ? guestMap.get(order.createdBy) || "InvitÃƒÂ©" : "InvitÃƒÂ©",
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
    <div className="app-background min-h-screen pb-32 text-foreground">
      <Header
        restaurant={restaurant}
        cartCount={count}
        onCartClick={() => setCartOpen(true)}
      />

      <main className="px-4 pb-5 pt-20">{children}</main>

      <PublicBottomNavigation
        active="tracking"
        count={count}
        searchValue=""
        onHome={onHome}
        onSearch={() => {}}
        onSearchChange={() => {}}
        onOrder={() => setCartOpen(true)}
        onTracking={() => {}}
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

