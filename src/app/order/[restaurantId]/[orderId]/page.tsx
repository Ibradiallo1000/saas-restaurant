"use client"

import * as React from "react"
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where, writeBatch } from "firebase/firestore"
import { Banknote, CheckCircle, CreditCard, Utensils } from "lucide-react"
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

        setOrder({
          ...(docSnap.data() as Omit<RestaurantOrder, "id">),
          id: docSnap.id,
        })
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
  const homePath = slug ? `/${slug}` : "/"
  const goHome = () => router.push(homePath)

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
  
  console.log("ORDERS:", orders)
  console.log("MAIN ORDER:", mainOrder)

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
  const rawOrderType = (safeOrder as any).type || safeOrder.orderType
  const orderType = normalizeOrderType(safeOrder.orderType) as ClientOrderType
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
  const effectivePaymentStatus =
    tableSession?.paymentRequest?.status === "validated" ||
    isPaidPaymentStatus(safeOrder.paymentStatus) ||
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

  const handleCashPaymentSession = async () => {
    if (!safeOrder.tableSessionId) {
      console.error("NO TABLE SESSION ID â€“ BLOCK PAYMENT")
      return
    }
    if (!db || !restaurantId || isCashPaying) return

    setIsCashPaying(true)
    try {
      console.log("SESSION USED:", safeOrder.tableSessionId)
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

    console.log("SESSION USED:", safeOrder.tableSessionId)
    console.log("SESSION WRITE:", safeOrder.tableSessionId)
    console.log("PAYMENT REQUEST:", paymentRequest)

    setIsMobilePaying(true)
    updateDoc(sessionRef, { paymentRequest })
      .catch(console.error)
      .finally(() => {
        setIsMobilePaying(false)
        setMobilePaymentOpen(false)
      })
  }

  const handleConfirmMobilePayment = async () => {
    if (!safeOrder.tableSessionId) {
      console.error("NO TABLE SESSION ID â€“ BLOCK PAYMENT")
      return
    }
    if (!db || !restaurantId || isConfirming) return
    setIsConfirming(true)
    try {
      const paymentRequest = {
        status: "pending_confirmation",
        method: "mobile",
        provider: tableSession?.paymentRequest?.provider || "Mobile Money",
        confirmedByClientAt: serverTimestamp(),
      }
      console.log("SESSION USED:", safeOrder.tableSessionId)
      console.log("SESSION WRITE:", safeOrder.tableSessionId)
      console.log("PAYMENT REQUEST:", paymentRequest)
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
      onHome={goHome}
    >
      <div className="mx-auto max-w-md space-y-5">
        <section className={TRACKING_CARD_CLASS}>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">
            Suivi commande
          </p>
          <h1 className="mt-1 text-2xl font-bold">
            Suivi de commande
          </h1>
          <p className="mt-2 text-sm font-black text-muted-foreground">{orderDisplayId}</p>
          {shouldShowPhone && orderPhone ? (
            <p className="mt-1 text-sm text-muted-foreground">TÃ©lÃ© phone : {orderPhone}</p>
          ) : null}
        </section>

        {mainOrder && (
          <section className={TRACKING_CARD_CLASS}>
            <OrderStepper 
              orderType={mainOrder.orderType} 
              kitchenStatus={mainOrder.kitchenStatus} 
              legacyStatus={mainOrder.status}
              createdAt={mainOrder.createdAt}
              timestamps={mainOrder.timestamps}
            />
          </section>
        )}

        {shouldShowPostServicePayment ? (
          <section className="rounded-2xl border-2 border-orange-200 bg-orange-50 p-5 text-orange-950 shadow-lg dark:border-orange-400/30 dark:bg-orange-500/10 dark:text-orange-100">
            <p className="text-xs font-black uppercase tracking-wide text-orange-700 dark:text-orange-300">
              Total à payer
            </p>
            <p className="mt-2 text-4xl font-black text-orange-900 dark:text-orange-100">
              {formatMoney(sessionTotal)} FCFA
            </p>
            
            {tableSession?.paymentRequest?.status === "validated" ? (
               <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-4 text-green-800 dark:border-green-400/30 dark:bg-green-500/10 dark:text-green-200">
                 <div className="flex items-center gap-2 text-sm font-black">
                   <CheckCircle className="h-5 w-5" />
                   Paiement confirmé
                 </div>
                 <p className="mt-2 text-sm font-semibold text-green-700 dark:text-green-200/90">
                   Merci pour votre confiance. Nous espérons vous revoir très bientôt.
                 </p>
               </div>
            ) : tableSession?.paymentRequest?.status === "requested" && tableSession?.paymentRequest?.method === "cash" ? (
               <div className="mt-5 rounded-xl border border-orange-300 bg-orange-100 p-4 text-center text-orange-800 dark:bg-orange-950/30 dark:text-orange-300">
                 <p className="font-black text-lg animate-pulse">Un serveur arrive pour encaisser</p>
               </div>
            ) : tableSession?.paymentRequest?.status === "requested" && tableSession?.paymentRequest?.method === "mobile" ? (
               <div className="mt-5">
                 <button
                   onClick={handleConfirmMobilePayment}
                   disabled={isConfirming}
                   className="w-full flex items-center justify-center h-14 rounded-xl bg-[var(--color-primary)] text-white text-sm font-black shadow-sm transition active:scale-[0.98] disabled:opacity-60 uppercase"
                 >
                   {isConfirming ? "..." : "J’ai payé"}
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
                 
                 <div className="flex gap-3 overflow-x-auto pb-2">
                   <button
                     type="button"
                     onClick={handleCashPaymentSession}
                     disabled={isCashPaying}
                     className="flex h-14 min-w-[120px] flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 text-sm font-black text-white shadow-sm transition active:scale-[0.98] disabled:opacity-60 whitespace-nowrap"
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
                       className="flex h-14 min-w-[120px] flex-1 items-center justify-center gap-2 rounded-xl border border-orange-300 bg-background px-4 text-sm font-black text-foreground transition hover:bg-muted active:scale-[0.98] disabled:opacity-60 whitespace-nowrap"
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
           </section>
        ) : shouldShowPrepaidCompletion ? (
          <section className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-5 text-emerald-950 shadow-lg dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-100">
            <p className="text-xs font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              Commande servie
            </p>
            <p className="mt-2 text-2xl font-black text-emerald-900 dark:text-emerald-100">
              Merci, votre commande est prête.
            </p>
            <p className="mt-3 text-sm font-semibold text-emerald-900/80 dark:text-emerald-100/80">
              {prepaidPaymentConfirmed
                ? "Paiement confirmé. Aucun autre paiement n’est nécessaire."
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

