"use client"

import * as React from "react"
import { onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore"
import { doc } from "firebase/firestore"
import { useParams, useRouter } from "next/navigation"

import { useDocOnce, useFirestore, useMemoFirebase } from "@/firebase"
import { ORDER_STATUS, PAYMENT_STATUS } from "@/lib/constants"
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

const TRACKING_CARD_CLASS =
  "rounded-2xl bg-white p-5 text-slate-950 shadow ring-1 ring-slate-200/80"

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

  const normalizedStatus = normalizeTrackingStatus(order.status)
  const activeIndex = ORDER_STEPS.indexOf(normalizedStatus)
  const showPaymentSection = normalizedStatus === ORDER_STATUS.SERVIE && order.paymentMethod !== "cash"
  const showCashMessage = normalizedStatus === ORDER_STATUS.SERVIE && order.paymentMethod === "cash"
  const showMobilePendingMessage = normalizedStatus === ORDER_STATUS.NOUVELLE
  const paymentMethods = Array.isArray(restaurant?.settings?.paymentMethods)
    ? restaurant.settings.paymentMethods.filter((method: any) => method?.name && method?.code)
    : []

  const handleCashPayment = async () => {
    if (!db || !restaurantId || !order?.id || isCashPaying) return

    setIsCashPaying(true)
    try {
      await updateDoc(doc(db, "restaurants", restaurantId, "orders", order.id), {
        paymentMethod: "cash",
        // Ne change pas le statut vers payee (sécurité)
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
        paymentStatus: PAYMENT_STATUS.PENDING,
        status: ORDER_STATUS.NOUVELLE,
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
            {STATUS_LABELS[normalizedStatus]}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Commande #{order.id.slice(-6)}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Client: {order.customer?.name || "Client"}
          </p>
        </section>

        <section className={TRACKING_CARD_CLASS}>
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

        {showCashMessage && (
          <section className="rounded-2xl border-2 border-orange-200 bg-orange-50 p-5 text-slate-950 shadow">
            <h2 className="text-lg font-black text-orange-600 dark:text-orange-400">Règlement à la caisse</h2>
            <p className="mt-2 text-sm text-orange-700/80 dark:text-orange-300/80">
              Veuillez vous diriger vers la caisse pour finaliser votre règlement de {order.total.toLocaleString()} FCFA.
            </p>
          </section>
        )}

        {showMobilePendingMessage && (
          <section className="rounded-2xl border-2 border-purple-200 bg-purple-50 p-5 text-slate-950 shadow">
            <h2 className="text-lg font-black text-purple-600 dark:text-purple-400">Vérification en cours</h2>
            <p className="mt-2 text-sm text-purple-700/80 dark:text-purple-300/80">
              Votre paiement mobile est en cours de validation par la caisse.
            </p>
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

function normalizeTrackingStatus(status: RestaurantOrder["status"]): TrackingStatus {
  return normalizeOrderStatus(status)
}
