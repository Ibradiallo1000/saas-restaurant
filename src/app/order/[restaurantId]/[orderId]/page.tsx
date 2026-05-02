"use client"

import * as React from "react"
import { onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore"
import { doc } from "firebase/firestore"
import { useParams, useRouter, useSearchParams } from "next/navigation"

import { useDoc, useFirestore, useMemoFirebase } from "@/firebase"
import { ORDER_STATUS, PAYMENT_STATUS } from "@/lib/constants"
import { restaurantOrdersRef } from "@/lib/restaurant-firestore-paths"
import { normalizeOrderStatus, type OrderStatus } from "@/lib/order-status"
import { CartProvider, useCart } from "@/modules/public/cart/CartContext"
import CartDrawer from "@/modules/public/components/CartDrawer"
import Header from "@/modules/public/components/Header"
import PaymentModal from "@/modules/public/components/PaymentModal"
import { PublicBottomNavigation } from "@/modules/public/PublicPage"
import type { RestaurantOrder } from "@/modules/restaurant/types"

type TrackingStatus = OrderStatus

const ORDER_STEPS: TrackingStatus[] = [
  "nouvelle",
  "preparation",
  "prete",
  "servie",
  "payee",
]

const STATUS_LABELS: Record<TrackingStatus, string> = {
  nouvelle: "Commande reçue",
  preparation: "En préparation",
  prete: "Prête",
  servie: "Servie",
  payee: "Payée",
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
  const searchParams = useSearchParams()
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

  const { data: restaurant } = useDoc(restaurantRef)

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

    const sessionId =
      searchParams?.get("sessionId") ||
      window.localStorage.getItem(getOrderSessionStorageKey(restaurantId))

    if (!sessionId) {
      setOrder(null)
      setError("Session de commande introuvable.")
      setIsLoading(false)
      return
    }

    const unsubscribe = onSnapshot(
      query(
        restaurantOrdersRef(db, restaurantId),
        where("sessionId", "==", sessionId)
      ),
      (snapshot) => {
        if (snapshot.empty) {
          setOrder(null)
          setIsLoading(false)
          return
        }

        const sessionOrders = snapshot.docs
          .map((orderDoc) => ({
            ...(orderDoc.data() as Omit<RestaurantOrder, "id">),
            id: orderDoc.id,
          }))
          .sort((a, b) => getCreatedAtMs(b) - getCreatedAtMs(a))

        setOrder(
          sessionOrders.find((sessionOrder) => sessionOrder.id === orderId) ??
            sessionOrders[0]
        )
        setIsLoading(false)
      },
      (snapshotError) => {
        console.error(snapshotError)
        setError("Impossible de charger le suivi de commande.")
        setIsLoading(false)
      }
    )

    return () => unsubscribe()
  }, [db, restaurantId, orderId, searchParams])

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
        <div className="mx-auto max-w-md rounded-2xl bg-card p-6 text-center text-card-foreground shadow">
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
        <div className="mx-auto max-w-md rounded-2xl bg-card p-6 text-center text-card-foreground shadow">
          <h1 className="text-lg font-semibold">Commande introuvable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {error || "Le lien de suivi ne correspond a aucune commande."}
          </p>
        </div>
      </PublicTrackingLayout>
    )
  }

  const normalizedStatus = normalizeTrackingStatus(order.status)
  const activeIndex = ORDER_STEPS.indexOf(normalizedStatus)
  const showPaymentSection = normalizedStatus === ORDER_STATUS.SERVIE
  const paymentMethods = Array.isArray(restaurant?.settings?.paymentMethods)
    ? restaurant.settings.paymentMethods.filter((method: any) => method?.name && method?.code)
    : []

  const handleCashPayment = async () => {
    if (!db || !restaurantId || !order?.id || isCashPaying) return

    setIsCashPaying(true)
    try {
      await updateDoc(doc(restaurantOrdersRef(db, restaurantId), order.id), {
        paymentMethod: "cash",
        paymentStatus: PAYMENT_STATUS.VALIDATED,
        paidAt: serverTimestamp(),
        status: ORDER_STATUS.PAYEE,
        updatedAt: serverTimestamp(),
      })
    } catch (paymentError) {
      console.error(paymentError)
      setError("Impossible de valider le paiement.")
    } finally {
      setIsCashPaying(false)
    }
  }

  const handleMobilePayment = async () => {
    if (!db || !restaurantId || !order?.id || isMobilePaying) return

    setIsMobilePaying(true)
    try {
      await updateDoc(doc(restaurantOrdersRef(db, restaurantId), order.id), {
        paymentMethod: "mobile",
        paymentStatus: PAYMENT_STATUS.PENDING,
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

        <section className="rounded-2xl bg-card p-5 text-card-foreground shadow">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">
            Suivi commande
          </p>
          <h1 className="mt-1 text-2xl font-bold">
            {STATUS_LABELS[normalizedStatus]}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Commande #{order.id.slice(-6)}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Client: {order.customer?.name || "Client"}
          </p>
        </section>

        <section className="rounded-2xl bg-card p-5 text-card-foreground shadow">
          <div className="space-y-4">
            {ORDER_STEPS.map((status, index) => {
              const isActive = index <= activeIndex
              const isCurrent = status === normalizedStatus

              return (
                <div key={status} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                        isActive
                          ? "bg-[var(--color-primary)] text-white"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {index + 1}
                    </div>
                    {index < ORDER_STEPS.length - 1 && (
                      <div
                        className={`h-8 w-0.5 ${
                          index < activeIndex ? "bg-[var(--color-primary)]" : "bg-muted"
                        }`}
                      />
                    )}
                  </div>

                  <div className="pt-1">
                    <p
                      className={`font-medium ${
                        isActive ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {STATUS_LABELS[status]}
                    </p>
                    {isCurrent && (
                      <p className="text-xs text-[var(--color-primary)]">Etape actuelle</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="rounded-2xl bg-card p-5 text-card-foreground shadow">
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
          <section className="rounded-2xl bg-card p-5 text-card-foreground shadow">
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
    <div className="min-h-screen bg-background pb-32 text-foreground">
      <Header
        restaurant={restaurant}
        cartCount={count}
        onCartClick={() => setCartOpen(true)}
      />

      <main className="px-4 py-5">{children}</main>

      <PublicBottomNavigation
        active="tracking"
        count={count}
        onHome={onHome}
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

function normalizeTrackingStatus(status: RestaurantOrder["status"]): TrackingStatus {
  return normalizeOrderStatus(status)
}

function getCreatedAtMs(order: RestaurantOrder) {
  return (
    order.createdAt?.toMillis?.() ??
    order.createdAt?.toDate?.().getTime?.() ??
    0
  )
}

function getOrderSessionStorageKey(restaurantId: string) {
  return `restaurant_order_session_${restaurantId}`
}
