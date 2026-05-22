"use client"

import * as React from "react"
import { onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore"
import { doc } from "firebase/firestore"
import { useParams, useRouter } from "next/navigation"

import { OrderStepper } from "@/components/OrderStepper"
import { PaymentBadge } from "@/components/PaymentBadge"
import { useDocOnce, useFirestore, useMemoFirebase } from "@/firebase"
import { PAYMENT_STATUS } from "@/lib/constants"
import {
  ORDER_OPERATION_STATUS,
  getOrderStatus,
  normalizeOrderType,
} from "@/lib/order-lifecycle"
import { CartProvider, useCart } from "@/modules/public/cart/CartContext"
import CartDrawer from "@/modules/public/components/CartDrawer"
import Header from "@/modules/public/components/Header"
import PaymentModal from "@/modules/public/components/PaymentModal"
import QRPaymentModal from "@/modules/public/components/QRPaymentModal"
import { PublicBottomNavigation } from "@/modules/public/PublicPage"
import type { RestaurantOrder } from "@/modules/restaurant/types"

const TRACKING_CARD_CLASS =
  "rounded-2xl bg-white p-5 text-slate-950 shadow ring-1 ring-slate-200/80"

type ClientOrderType = "dine_in" | "pickup" | "delivery"
type ClientStepKey = "pending" | "preparing" | "ready" | "served" | "picked_up"

function getCurrentStepKey(order: RestaurantOrder, orderType: ClientOrderType): ClientStepKey {
  const rawStatus = order.orderStatus

  const orderStatus = getOrderStatus(order)
  if (orderStatus === ORDER_OPERATION_STATUS.IN_PREPARATION) return "preparing"
  if (orderStatus === ORDER_OPERATION_STATUS.READY) return "ready"

  if (orderStatus === ORDER_OPERATION_STATUS.PICKED_UP) return "picked_up"

  if (orderStatus === ORDER_OPERATION_STATUS.SERVED || orderStatus === ORDER_OPERATION_STATUS.COMPLETED) {
    return orderType === "dine_in" ? "served" : "picked_up"
  }

  return "pending"
}

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
  const routeParams = params ?? {}
  const { count } = useCart()
  const restaurantId = routeParams.restaurantId as string | undefined
  const orderId = routeParams.orderId as string | undefined

  const [order, setOrder] = React.useState<RestaurantOrder | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [cartOpen, setCartOpen] = React.useState(false)
  const [isCashPaying, setIsCashPaying] = React.useState(false)
  const [isMobilePaying, setIsMobilePaying] = React.useState(false)
  const [mobilePaymentOpen, setMobilePaymentOpen] = React.useState(false)

  const restaurantRef = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return doc(db, "restaurants", restaurantId)
  }, [db, restaurantId])

  const { data: restaurant } = useDocOnce(restaurantRef)

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

  if (error || !order) {
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

  const orderType = normalizeOrderType(order.orderType) as ClientOrderType
  const isQrTableOrder = orderType === "dine_in" && (order.source === "qr_table" || order.source === "qr")
  const currentStepKey = getCurrentStepKey(order, orderType)
  const isProductionComplete =
    currentStepKey === "served" ||
    currentStepKey === "picked_up"
  const showPaymentSection = !isQrTableOrder && isProductionComplete && order.paymentMethod !== "cash"
  const showQrPaymentSection =
    isQrTableOrder &&
    currentStepKey === "served" &&
    order.paymentStatus === "unpaid"
  const showCashMessage =
    isProductionComplete &&
    order.paymentMethod === "cash" &&
    order.paymentStatus !== "paid"
  const orderWithPaymentVerification = order as RestaurantOrder & {
    paymentIntentStatus?: string | null
    paymentVerificationStatus?: string | null
  }
  const paymentMethods = Array.isArray(restaurant?.settings?.paymentMethods)
    ? restaurant.settings.paymentMethods.filter((method: any) => method?.name && method?.code)
    : []

  const handleCashPayment = async () => {
    if (!db || !restaurantId || !order?.id || isCashPaying) return

    setIsCashPaying(true)
    try {
      await updateDoc(doc(db, "restaurants", restaurantId, "orders", order.id), {
        paymentMethod: "cash",
        paymentMethodCode: null,
        paymentType: "cash",
        paymentStatus: "pending_cash",
        paymentIntentStatus: "pending",
        needsCashCollection: true,
        source: "qr_table",
        // Ne change pas le statut de production.
        updatedAt: serverTimestamp(),
      })
    } catch (paymentError) {
      console.error(paymentError)
      setError("Impossible de signaler le paiement en caisse.")
    } finally {
      setIsCashPaying(false)
    }
  }

  const handleMobilePayment = async () => {
    if (!db || !restaurantId || !order?.id || isMobilePaying) return

    setIsMobilePaying(true)
    try {
      await updateDoc(doc(db, "restaurants", restaurantId, "orders", order.id), {
        paymentMethod: "mobile",
        paymentStatus: "pending_mobile",
        updatedAt: serverTimestamp(),
      })
      setMobilePaymentOpen(false)
    } catch (paymentError) {
      console.error(paymentError)
      setError("Impossible d'enregistrer le paiement mobile.")
    } finally {
      setIsMobilePaying(false)
    }
  }

  return (
    <PublicTrackingLayout
      restaurant={restaurant}
      restaurantId={restaurantId}
      count={count}
      cartOpen={cartOpen}
      setCartOpen={setCartOpen}
      onHome={goHome}
    >
      <div className="mx-auto max-w-md space-y-5">
        <button
          type="button"
          onClick={goHome}
          className="text-sm font-bold text-[var(--color-primary)]"
        >
          ← Retour au menu
        </button>

        <section className={TRACKING_CARD_CLASS}>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">
            Suivi commande
          </p>
          <h1 className="mt-1 text-2xl font-bold">
            Suivi de la commande
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Commande #{order.id.slice(-6)}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Client: {order.customer?.name || "Client"}
          </p>
        </section>

        <section className={TRACKING_CARD_CLASS}>
          <OrderStepper orderType={order.orderType} orderStatus={order.orderStatus} />
        </section>

        <section className={TRACKING_CARD_CLASS}>
          <h2 className="font-semibold">Articles</h2>
          <div className="mt-3 space-y-3">
            {order.items.map((item) => (
              <div key={`${item.productId}-${item.name}`} className="flex justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.quantity} x {item.unitPrice.toLocaleString()} FCFA
                  </p>
                </div>
                <p className="text-sm font-semibold">
                  {item.total.toLocaleString()} FCFA
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-between border-t pt-4 text-lg font-bold">
            <span>Total</span>
            <span>{order.total.toLocaleString()} FCFA</span>
          </div>
        </section>

        {showPaymentSection && (
          <section className={TRACKING_CARD_CLASS}>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">
                Paiement
              </p>
              <h2 className="text-xl font-black">Choisissez votre mode de paiement</h2>
              <p className="text-sm text-muted-foreground">
                Validez le règlement pour finaliser votre commande.
              </p>
            </div>

            <div className="mt-4 grid gap-3">
              <button
                type="button"
                onClick={handleCashPayment}
                disabled={isCashPaying}
                className="h-12 rounded-xl bg-[var(--color-primary)] px-4 text-sm font-black text-white shadow-sm transition active:scale-[0.98] disabled:opacity-60"
              >
                {isCashPaying ? "Validation..." : "Payer à la caisse"}
              </button>

              <button
                type="button"
                onClick={() => setMobilePaymentOpen(true)}
                className="h-12 rounded-xl border bg-background px-4 text-sm font-black text-foreground transition hover:bg-muted active:scale-[0.98]"
              >
                Payer avec Mobile Money
              </button>
            </div>
          </section>
        )}

        {showQrPaymentSection ? (
          <section className={TRACKING_CARD_CLASS}>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">
                Paiement
              </p>
              <h2 className="text-xl font-black">Votre commande est servie</h2>
              <p className="text-sm text-muted-foreground">
                Vous pouvez maintenant choisir le mode de règlement.
              </p>
            </div>

            <QRPaymentModal
              open={showQrPaymentSection}
              restaurantId={restaurantId || ""}
              order={order}
              onClose={() => {}}
            />
          </section>
        ) : null}

        {showCashMessage && (
          <section className="rounded-2xl border-2 border-orange-200 bg-orange-50 p-5 text-slate-950 shadow">
            <h2 className="text-lg font-black text-orange-600 dark:text-orange-400">Règlement à la caisse</h2>
            <p className="mt-2 text-sm text-orange-700/80 dark:text-orange-300/80">
              Un serveur viendra à votre table pour encaisser votre commande de {order.total.toLocaleString()} FCFA.
            </p>
          </section>
        )}

        <PaymentBadge
          paymentIntentStatus={orderWithPaymentVerification.paymentIntentStatus}
          paymentVerificationStatus={orderWithPaymentVerification.paymentVerificationStatus}
        />

        <PaymentModal
          open={mobilePaymentOpen}
          methods={paymentMethods}
          loading={isMobilePaying}
          onClose={() => setMobilePaymentOpen(false)}
          onConfirm={handleMobilePayment}
        />

      </div>
    </PublicTrackingLayout>
  )
}

function PublicTrackingLayout({
  children,
  restaurant,
  restaurantId,
  count,
  cartOpen,
  setCartOpen,
  onHome,
}: {
  children: React.ReactNode
  restaurant: any
  restaurantId?: string
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

      <main className="px-4 py-5">{children}</main>

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
      />
    </div>
  )
}

