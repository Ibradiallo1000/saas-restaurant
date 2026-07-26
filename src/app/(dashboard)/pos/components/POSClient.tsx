"use client"

import * as React from "react"
import { addDoc, collection, doc, getDocs, limit, query, serverTimestamp, updateDoc, where, writeBatch } from "firebase/firestore"
import { signOut } from "firebase/auth"
import { useSearchParams, useRouter } from "next/navigation"
import { useCollection, useFirestore, useMemoFirebase, useAuth } from "@/firebase"
import { 
  Banknote, 
  CheckCircle2,
  ShoppingCart, 
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CookingPot,
  Inbox,
  PackageCheck,
  Percent,
  Utensils,
  UserRound
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PosCatalog, PosSessionClosingDialog, PosVarianceDisplay } from "@/components/pos-ui"
import { PublicSheet } from "@/components/public-ui"
import { useToast } from "@/hooks/use-toast"
import { OrderService } from "@/services/order.service"
import {
  closeActiveTableSession,
  getOrCreateActiveTableSession,
  type RestaurantTableRecord,
} from "@/services/table-session.service"
import { cn } from "@/lib/utils"
import { getOptimizedImage } from "@/lib/image"
import { formatTableDisplayName, getRestaurantTableDisplayPrefix } from "@/lib/table-display"
import { COLLECTION_NAMES } from "@/lib/constants"
import { getOrderDisplayId } from "@/lib/order-display-id"
import {
  ORDER_OPERATION_STATUS,
  ORDER_PAYMENT_STATUS,
  isOrderPaid,
  isOrderServed,
  kitchenStatusLabel,
  orderStatusFromKitchenStatus,
  normalizeOrderType,
} from "@/lib/order-lifecycle"
import { generatePaymentLinkOrUSSD } from "@/lib/payment-generation"
import { printService, type PrintableOrder } from "@/services/print.service"
import { playNewOrderNotificationSound } from "@/services/notification-sound.service"
import {
  processOrderPaymentTransaction,
  releaseOrderTableIfNeeded,
  updateCashSessionTotals,
  validateMobilePaymentTransaction,
} from "@/services/pos-security.service"
import {
  buildPaymentIdempotencyKey,
  normalizePaymentProvider,
  PaymentLedgerService,
} from "@/services/payment-ledger.service"
import {
  getConfiguredCartItemId,
  recalculateConfiguredUnitPrice,
} from "@/lib/order-pricing"
import { buildSelectionOptionsFromComponents } from "@/lib/product-components"
import { useRestaurant } from "@/design-system/context/RestaurantContext"
import { useTenant } from "@/design-system/context/TenantProvider"
import { CatalogProvider, useCatalog } from "@/modules/catalog/CatalogProvider"
import { useRestaurantLiveData } from "@/modules/restaurant-live/RestaurantLiveDataProvider"
import type { SelectedCartOption } from "@/modules/restaurant/types"
import {
  buildBundleCartLines,
  getActiveLinkedOptionGroups,
  getCartLinesForBundleRemoval,
  productNeedsConfigurator,
  type LinkedOptionGroup,
  type LinkedOptionSelection,
} from "@/lib/linked-option-groups"
import { getDefaultConfigSelections } from "@/lib/product-configurator"
import ProductConfiguratorModal, {
  validateConfiguratorSelections,
} from "@/components/product-configurator/ProductConfiguratorModal"
import {
  getEffectivePreparationMode,
  getKitchenOrderItems,
  orderHasKitchenItems,
  resolveProductPreparationMode,
} from "@/utils/preparation-logic"
import POSLayout from "./POSLayout"
import type { POSTab } from "./POSHeader"
import CategorySidebar from "./CategorySidebar"
import ProductGrid from "./ProductGrid"
import CartPanel, { type PosPaymentMode } from "./CartPanel"
import POSPaymentFlow from "./POSPaymentFlow"

const STATUS_LABELS = {
  pending: "En attente",
  preparing: "En pr\u00e9paration",
  ready: "Pr\u00eates",
  served: "Servies",
  completed: "Termin\u00e9es",
} as const

const POS_COLUMN_UI = {
  pending: {
    icon: Clock3,
    shell: "border-slate-200/80 bg-slate-50/90 dark:border-slate-700/70 dark:bg-slate-900/45",
    iconClass: "bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    badgeClass: "bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-100",
    emptyText: "Les nouvelles commandes apparaîtront ici.",
  },
  preparing: {
    icon: CookingPot,
    shell: "border-orange-200/70 bg-orange-50/55 dark:border-orange-500/20 dark:bg-orange-500/10",
    iconClass: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
    badgeClass: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-200",
    emptyText: "Les commandes en préparation apparaîtront ici.",
  },
  ready: {
    icon: Utensils,
    shell: "border-emerald-200/70 bg-emerald-50/55 dark:border-emerald-500/20 dark:bg-emerald-500/10",
    iconClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
    emptyText: "Les commandes prêtes à servir apparaîtront ici.",
  },
  served: {
    icon: PackageCheck,
    shell: "border-sky-200/70 bg-sky-50/55 dark:border-sky-500/20 dark:bg-sky-500/10",
    iconClass: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
    badgeClass: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
    emptyText: "Les commandes servies en attente de paiement apparaîtront ici.",
  },
  completed: {
    icon: CheckCircle2,
    shell: "border-zinc-200/80 bg-zinc-50/90 dark:border-zinc-700/70 dark:bg-zinc-900/45",
    iconClass: "bg-zinc-200/80 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
    badgeClass: "bg-zinc-200/80 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-100",
    emptyText: "Les commandes encaissées apparaîtront ici.",
  },
} as const

const warnedMissingKitchenStatusOrders = new Set<string>()
const POS_PRODUCT_ROWS_PER_PAGE = 3

export default function POSPage() {
  const { restaurantId } = useRestaurant()

  return (
    <CatalogProvider restaurantId={restaurantId}>
      <POSPageContent />
    </CatalogProvider>
  )
}

function POSPageContent() {
  const db = useFirestore()
  const auth = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { restaurantId, restaurant } = useRestaurant()
  const { user, profile } = useTenant()
  const { products, categories, isLoadingVisible } = useCatalog()
  const {
    activeOrders,
    cashSessionRequests,
    cashSessions,
    tableSessions,
    tables: liveTables,
  } = useRestaurantLiveData()
  const { toast } = useToast()
  const safeProducts = React.useMemo(() => Array.isArray(products) ? products : [], [products])
  const safeCategories = React.useMemo(() => Array.isArray(categories) ? categories : [], [categories])
  const safeActiveOrders = React.useMemo(() => Array.isArray(activeOrders) ? activeOrders : [], [activeOrders])
  const safeCashSessionRequests = React.useMemo(
    () => Array.isArray(cashSessionRequests) ? cashSessionRequests : [],
    [cashSessionRequests]
  )
  const safeCashSessions = React.useMemo(() => Array.isArray(cashSessions) ? cashSessions : [], [cashSessions])
  const safeTableSessions = React.useMemo(() => Array.isArray(tableSessions) ? tableSessions : [], [tableSessions])
  const safeTables = React.useMemo(() => Array.isArray(liveTables) ? liveTables : [], [liveTables])
  
  const [cart, setCart] = React.useState<any[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<string | null>(null)
  const [orderType, setOrderType] = React.useState<"dine-in" | "takeaway">("takeaway")
  const [tableNumber, setTableNumber] = React.useState<string | null>(null)
  const [processing, setProcessing] = React.useState(false)
  const [selectedMobileMethodCode, setSelectedMobileMethodCode] = React.useState<string | null>(null)
  const [collectingOrderId, setCollectingOrderId] = React.useState<string | null>(null)
  const [activeTab, setActiveTab] = React.useState<POSTab>("cashier")
  const [requestingSession, setRequestingSession] = React.useState(false)
  const turboMode = false
  const [discountRate, setDiscountRate] = React.useState(0)
  const [selectedPaymentMode, setSelectedPaymentMode] = React.useState<PosPaymentMode | null>(null)
  const [cashReceivedInput, setCashReceivedInput] = React.useState("")
  const [paymentDialogOpen, setPaymentDialogOpen] = React.useState(false)
  const [paymentFlowError, setPaymentFlowError] = React.useState<string | null>(null)
  const [paymentFlowSuccess, setPaymentFlowSuccess] = React.useState(false)
  const checkoutLockRef = React.useRef(false)
  const closeSessionLockRef = React.useRef(false)
  const [closeDialogOpen, setCloseDialogOpen] = React.useState(false)
  const [selectedOrderDetailId, setSelectedOrderDetailId] = React.useState<string | null>(null)
  const [mobileOrderStatus, setMobileOrderStatus] = React.useState<string>(ORDER_OPERATION_STATUS.PENDING)
  const [showAllCompletedOrders, setShowAllCompletedOrders] = React.useState(false)
  const [declaredCashInput, setDeclaredCashInput] = React.useState("")
  const [declaredMobileInput, setDeclaredMobileInput] = React.useState("")
  const [configProduct, setConfigProduct] = React.useState<any | null>(null)
  const [configSelections, setConfigSelections] = React.useState<Record<string, SelectedCartOption>>({})
  const [configLinkedSelections, setConfigLinkedSelections] = React.useState<LinkedOptionSelection[]>([])
  const [configValidationError, setConfigValidationError] = React.useState<string | null>(null)
  const previousOrderIdsRef = React.useRef<Set<string>>(new Set())
  const previousOrderStatusRef = React.useRef<Map<string, string>>(new Map())
  const hasInitializedOrderSoundRef = React.useRef(false)
  
  const [currentPage, setCurrentPage] = React.useState(0)
  const { isPhoneViewport, productsPerPage } = usePOSProductsPerPage()
  const [mobileCartOpen, setMobileCartOpen] = React.useState(false)
  const productSearch = ""

  const tables = safeTables as RestaurantTableRecord[]
  const tableLabelPrefix = getRestaurantTableDisplayPrefix(restaurant)
  const initialTableId = searchParams?.get("tableId")
  const activeCashSession = React.useMemo(() => {
    return safeCashSessions.find((session: any) => {
      const sessionUserId = session.userId || session.cashierId
      return sessionUserId === user?.uid && session.status === "open"
    }) ?? null
  }, [safeCashSessions, user?.uid])
  const pendingSessionRequest = React.useMemo(() => {
    return safeCashSessionRequests.find((request: any) => request.cashierId === user?.uid) ?? null
  }, [safeCashSessionRequests, user?.uid])
  const pendingValidationSession = React.useMemo(() => {
    return safeCashSessions.find((session: any) => {
      const sessionUserId = session.userId || session.cashierId
      return (
        sessionUserId === user?.uid &&
        (session.status === "pending_validation" || session.status === "closed") &&
        !session.validatedByManager
      )
    }) ?? null
  }, [safeCashSessions, user?.uid])
  const cashierApprovalMode = restaurant?.settings?.cashierApprovalMode === "optional" ? "optional" : "required"
  const staffSnapshot = React.useMemo(() => {
    return {
      staffId: profile?.id || user?.uid || null,
      staffName:
        profile?.nomComplet ||
        profile?.name ||
        user?.displayName ||
        user?.email?.split("@")[0] ||
        "Caissier",
      staffPhone: profile?.telephone || profile?.phone || null,
    }
  }, [profile, user?.displayName, user?.email, user?.uid])
  const posColumns = React.useMemo(() => [
    { id: ORDER_OPERATION_STATUS.PENDING, color: "border-amber-500" },
    { id: ORDER_OPERATION_STATUS.IN_PREPARATION, color: "border-blue-500" },
    { id: ORDER_OPERATION_STATUS.READY, color: "border-primary" },
    { id: ORDER_OPERATION_STATUS.SERVED, color: "border-indigo-500" },
    { id: ORDER_OPERATION_STATUS.COMPLETED, color: "border-zinc-500" },
  ], [])

  const posVisibleOrders = React.useMemo(() => {
    return safeActiveOrders.filter((order: any) => {
      if (activeCashSession?.id && order.cashSessionId === activeCashSession.id) return true
      return isPOSCollectionCandidate(order)
    })
  }, [activeCashSession?.id, safeActiveOrders])

  const posOrders = React.useMemo(() => {
    const groups: Record<string, any[]> = {
      [ORDER_OPERATION_STATUS.PENDING]: [],
      [ORDER_OPERATION_STATUS.IN_PREPARATION]: [],
      [ORDER_OPERATION_STATUS.READY]: [],
      [ORDER_OPERATION_STATUS.SERVED]: [],
      [ORDER_OPERATION_STATUS.COMPLETED]: [],
    }

    posVisibleOrders.forEach((order: any) => {
      const orderStatus = getPOSOperationStatus(order)
      const isTerminalProductionStatus =
        orderStatus === ORDER_OPERATION_STATUS.SERVED ||
        orderStatus === ORDER_OPERATION_STATUS.PICKED_UP
      const status =
        isTerminalProductionStatus && isOrderPaid(order)
          ? ORDER_OPERATION_STATUS.COMPLETED
          : isTerminalProductionStatus
            ? ORDER_OPERATION_STATUS.SERVED
            : orderStatus

      if (groups[status]) {
        groups[status].push(order)
      } else {
        groups[ORDER_OPERATION_STATUS.PENDING].push(order)
      }
    })

    Object.keys(groups).forEach(key => {
      groups[key].sort((a: any, b: any) => {
        const timeA = a.createdAt?.toMillis?.() || 0
        const timeB = b.createdAt?.toMillis?.() || 0
        return timeB - timeA
      })
    })

    return groups
  }, [posVisibleOrders])

  const servedTableSessionGroups = React.useMemo(() => {
    return buildServedTableSessionGroups(
      posOrders[ORDER_OPERATION_STATUS.SERVED] ?? [],
      safeTableSessions,
      tables,
      tableLabelPrefix
    )
  }, [posOrders, safeTableSessions, tableLabelPrefix, tables])

  const unpaidServedCount = React.useMemo(() => {
    return posVisibleOrders.filter((order: any) => {
      const orderStatus = getPOSOperationStatus(order)
      return (
        orderStatus === ORDER_OPERATION_STATUS.SERVED ||
        orderStatus === ORDER_OPERATION_STATUS.PICKED_UP
      ) && !isOrderPaid(order)
    }).length
  }, [posVisibleOrders])

  const selectedOrderDetail = React.useMemo(() => {
    if (!selectedOrderDetailId) return null
    return posVisibleOrders.find((order: any) => order.id === selectedOrderDetailId) ?? null
  }, [posVisibleOrders, selectedOrderDetailId])
  const selectedOrderPaymentSession = React.useMemo(() => {
    if (!selectedOrderDetail) return null
    return getPaymentSessionForOrder(selectedOrderDetail, safeTableSessions)
  }, [safeTableSessions, selectedOrderDetail])

  React.useEffect(() => {
    const currentOrderIds = new Set(posVisibleOrders.map((order: any) => order.id).filter(Boolean))
    const currentOrderStatuses = new Map<string, string>()

    posVisibleOrders.forEach((order: any) => {
      if (order.id) {
        currentOrderStatuses.set(order.id, getPOSOperationStatus(order))
      }
    })

    if (!hasInitializedOrderSoundRef.current) {
      previousOrderIdsRef.current = currentOrderIds
      previousOrderStatusRef.current = currentOrderStatuses
      hasInitializedOrderSoundRef.current = true
      return
    }

    const shouldAlert = posVisibleOrders.some((order: any) => {
      if (!order.id) return false

      const currentStatus = getPOSOperationStatus(order)
      const previousStatus = previousOrderStatusRef.current.get(order.id)
      const isNewPendingOrder =
        !previousOrderIdsRef.current.has(order.id) &&
        currentStatus === ORDER_OPERATION_STATUS.PENDING
      const becameServedUnpaid =
        previousStatus &&
        previousStatus !== ORDER_OPERATION_STATUS.SERVED &&
        currentStatus === ORDER_OPERATION_STATUS.SERVED &&
        !isOrderPaid(order)

      return isNewPendingOrder || becameServedUnpaid
    })

    previousOrderIdsRef.current = currentOrderIds
    previousOrderStatusRef.current = currentOrderStatuses

    if (shouldAlert) {
      playNewOrderNotificationSound()
    }
  }, [posVisibleOrders])

  const countryCode = React.useMemo(() => {
    const value = restaurant?.countryCode || restaurant?.country || restaurant?.countryIso
    return typeof value === "string" ? value.toUpperCase() : ""
  }, [restaurant])

  const paymentConfigsQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return query(
      collection(db, COLLECTION_NAMES.RESTAURANT_PAYMENT_CONFIGS),
      where("restaurantId", "==", restaurantId),
      where("isActive", "==", true),
      limit(50)
    )
  }, [db, restaurantId])
  const { data: paymentConfigsData } = useCollection<any>(paymentConfigsQuery)
  const paymentConfigs = Array.isArray(paymentConfigsData) ? paymentConfigsData : []

  const paymentMethodsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(
      collection(db, COLLECTION_NAMES.PLATFORM_PAYMENT_METHODS),
      where("isActive", "==", true),
      limit(50)
    )
  }, [db])
  const { data: paymentMethodsData } = useCollection<any>(paymentMethodsQuery)
  const paymentMethods = Array.isArray(paymentMethodsData) ? paymentMethodsData : []

  const mobilePaymentMethods = React.useMemo(() => {
    if (!Array.isArray(paymentConfigs) || !Array.isArray(paymentMethods)) return []

    return paymentConfigs
      .map((config: any) => {
        const method = paymentMethods.find((item: any) => item.code === config.methodCode)
        return {
          ...config,
          code: config.methodCode,
          name: config.customName || method?.name || config.methodCode,
          logoUrl: config.customLogo || method?.logoUrl,
        }
      })
      .filter((method: any) => method.code)
  }, [paymentConfigs, paymentMethods])

  // Filtrer les produits par categorie
  const filteredProducts = React.useMemo(() => {
    let filtered = safeProducts.filter((p: any) => p.isActive !== false)
    if (selectedCategoryId) {
      filtered = filtered.filter((p: any) => p.categoryId === selectedCategoryId)
    }
    const search = productSearch.trim().toLowerCase()
    if (search) {
      filtered = filtered.filter((p: any) => {
        const name = String(p.name || "").toLowerCase()
        const sku = String(p.sku || p.code || "").toLowerCase()
        return name.includes(search) || sku.includes(search)
      })
    }
    return filtered
  }, [productSearch, safeProducts, selectedCategoryId])

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / productsPerPage))
  const safeCurrentPage = Math.min(currentPage, totalPages - 1)
  const paginatedProducts = React.useMemo(() => {
    const start = safeCurrentPage * productsPerPage
    return filteredProducts.slice(start, start + productsPerPage)
  }, [filteredProducts, productsPerPage, safeCurrentPage])

  React.useEffect(() => {
    setCurrentPage(0)
  }, [filteredProducts.length, productSearch, selectedCategoryId])

  React.useEffect(() => {
    if (currentPage > totalPages - 1) {
      setCurrentPage(totalPages - 1)
    }
  }, [currentPage, totalPages])

  React.useEffect(() => {
    if (!initialTableId || tables.length === 0) return
    if (!tables.some((table) => table.id === initialTableId)) return

    setOrderType("dine-in")
    setTableNumber(initialTableId)
  }, [initialTableId, tables])

  const getDisplayPrice = React.useCallback((product: any) => {
    if (product.basePrice) return product.basePrice
    if (product.price) return product.price

    if (product.sizes?.length) {
      return Math.min(...product.sizes.map((s: any) => s.price || Infinity))
    }

    if (product.variants?.length) {
      return Math.min(...product.variants.map((v: any) => v.price || Infinity))
    }

    return null
  }, [])

  const formatDisplayPrice = React.useCallback((product: any) => {
    const price = getDisplayPrice(product)
    return Number.isFinite(price) ? `${Math.round(Number(price)).toLocaleString()} FCFA` : "-"
  }, [getDisplayPrice])

  const getCartItemUnitPrice = (item: any) => {
    const price = Number(item.unitPrice ?? getDisplayPrice(item) ?? 0)
    return Number.isFinite(price) ? Math.round(price) : 0
  }

  const getConfiguredUnitPrice = (product: any, selectedOptions: SelectedCartOption[]) => {
    try {
      return recalculateConfiguredUnitPrice(product, selectedOptions)
    } catch {
      const baseSelection = selectedOptions.find((option) => {
        return option.optionName === "Taille" || option.optionName === "Variante"
      })
      const basePrice = Number(baseSelection?.price ?? getDisplayPrice(product) ?? 0)
      const optionsTotal = selectedOptions.reduce((sum, option) => {
        if (option.optionName === "Taille" || option.optionName === "Variante") return sum
        return sum + Number(option.price ?? 0)
      }, 0)
      return Math.round(basePrice + optionsTotal)
    }
  }

  const updateActiveCashSessionTotals = async (method: "cash" | "mobile", amount: number) => {
    if (!db || !restaurantId || !activeCashSession?.id || amount <= 0) return

    try {
      await updateCashSessionTotals(db, restaurantId, activeCashSession.id, method, amount)
    } catch (error) {
      console.error("POS cash session total update error:", error)
    }
  }

  const addToCart = React.useCallback((product: any) => {
    if (!product?.id) return

    setCart((current) => {
      const existing = current.find(item => item.id === product.id)
      if (existing) {
        return current.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
      }

      const categoryName =
        safeCategories.find((category: any) => category.id === product.categoryId)?.name || ""

      return [
        ...current,
        {
          ...product,
          quantity: 1,
          preparationMode: resolveProductPreparationMode(product, categoryName),
        },
      ]
    })
    
    if (!turboMode) {
      toast({ title: "Ajouté", description: product.name, duration: 500 })
    }
  }, [safeCategories, toast, turboMode])

  const removeFromCart = (productId: string) => {
    setCart((current) => {
      const existing = current.find(item => item.id === productId)
      if (existing?.quantity === 1) {
        return current.filter(item => item.id !== productId)
      }

      return current.map(item => item.id === productId ? { ...item, quantity: item.quantity - 1 } : item)
    })
  }

  const increaseCartItem = (item: any) => {
    if (!item?.id) return

    if (Array.isArray(item.selectedOptions) && item.selectedOptions.length > 0) {
      setCart((current) =>
        current.map((cartItem) =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        )
      )
      return
    }

    const productId = item.productId ?? item.id
    const sourceProduct = safeProducts.find((product: any) => product.id === productId)

    if (sourceProduct) {
      addToCart(sourceProduct)
      return
    }

    setCart((current) =>
      current.map((cartItem) =>
        cartItem.id === item.id
          ? { ...cartItem, quantity: cartItem.quantity + 1 }
          : cartItem
      )
    )
  }

  const subtotal = cart.reduce((acc, item) => acc + (getCartItemUnitPrice(item) * item.quantity), 0)
  const discountAmount = Math.round(subtotal * discountRate)
  const total = Math.max(0, subtotal - discountAmount)
  const cashReceivedAmount = React.useMemo(() => normalizeMoneyInput(cashReceivedInput), [cashReceivedInput])
  const sessionPaidTotal = React.useMemo(() => {
    if (!activeCashSession?.id) return 0

    return Number(
      activeCashSession.totalConfirmed ??
      Number(activeCashSession.totalCash || 0) + Number(activeCashSession.totalMobile || 0)
    )
  }, [activeCashSession])

  const sessionCalculatedTotals = React.useMemo(() => {
    if (!activeCashSession?.id) {
      return { totalCash: 0, totalMobile: 0, totalOrders: 0 }
    }

    return {
      totalCash: Number(activeCashSession.totalCash || 0),
      totalMobile: Number(activeCashSession.totalMobile || 0),
      totalOrders: Number(activeCashSession.totalOrders || 0),
    }
  }, [activeCashSession])
  const declaredCashAmount = React.useMemo(() => normalizeMoneyInput(declaredCashInput), [declaredCashInput])
  const declaredMobileAmount = React.useMemo(() => normalizeMoneyInput(declaredMobileInput), [declaredMobileInput])
  const closeSessionDiff = React.useMemo(() => {
    const systemCash = sessionCalculatedTotals.totalCash
    const systemMobile = sessionCalculatedTotals.totalMobile
    const declaredTotal = declaredCashAmount + declaredMobileAmount
    const systemTotal = systemCash + systemMobile

    return {
      systemCash,
      systemMobile,
      systemTotal,
      declaredTotal,
      cash: declaredCashAmount - systemCash,
      mobile: declaredMobileAmount - systemMobile,
      total: declaredTotal - systemTotal,
    }
  }, [declaredCashAmount, declaredMobileAmount, sessionCalculatedTotals])

  React.useEffect(() => {
    if (!activeCashSession?.id || activeCashSession.status !== "open") return

    const message = "Une session de caisse est ouverte. Clôturez-la avant de quitter."
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = message
      return message
    }
    const handleLinkNavigation = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const link = target?.closest?.("a[href]") as HTMLAnchorElement | null
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return
      if (link.origin !== window.location.origin || link.pathname === window.location.pathname) return
      if (window.confirm(message)) return

      event.preventDefault()
      event.stopPropagation()
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    document.addEventListener("click", handleLinkNavigation, true)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      document.removeEventListener("click", handleLinkNavigation, true)
    }
  }, [activeCashSession?.id, activeCashSession?.status])

  const queuePrint = React.useCallback((
    order: PrintableOrder,
    type: "kitchen" | "client",
    options?: { automatic?: boolean }
  ) => {
    if (options?.automatic) {
      if (type === "kitchen" && order.printedKitchen) return
      if (type === "client" && order.printedClient) return
    }

    toast({ title: "Impression en cours..." })
    void printService
      .print(order, type, { restaurant })
      .then((printed) => {
        if (printed) {
          toast({ title: "Ticket imprimé" })
        } else {
          toast({ variant: "destructive", title: "Commande enregistrée", description: "Le ticket n'a pas pu être imprimé. Utilisez la réimpression sans recréer la commande." })
        }
      })
      .catch(() => {
        toast({ variant: "destructive", title: "Commande enregistrée", description: "L'impression a échoué. Utilisez la réimpression sans recréer la commande." })
      })
  }, [restaurant, toast])

  const openProductSelector = React.useCallback((product: any) => {
    if (process.env.NODE_ENV === "development") {
      console.log("POS product", product)
    }

    if (!productNeedsConfigurator(product)) {
      addToCart(product)
      return
    }

    setConfigProduct(product)
    setConfigSelections(getDefaultConfigSelections(product))
    setConfigLinkedSelections([])
    setConfigValidationError(null)
  }, [addToCart])

  const closeProductSelector = () => {
    setConfigProduct(null)
    setConfigSelections({})
    setConfigLinkedSelections([])
    setConfigValidationError(null)
  }

  const toggleConfigChoice = (
    group: { name: string; multiple?: boolean },
    choice: { name: string; price?: number }
  ) => {
    const selectedOption: SelectedCartOption = {
      optionName: group.name,
      choiceName: choice.name,
      price: Number(choice.price ?? 0),
    }

    setConfigSelections((current) => {
      if (!group.multiple) {
        return current[group.name]?.choiceName === choice.name
          ? { ...current, [group.name]: selectedOption }
          : { ...current, [group.name]: selectedOption }
      }

      const key = `${group.name}:${choice.name}`
      if (current[key]) {
        const next = { ...current }
        delete next[key]
        return next
      }

      return { ...current, [key]: selectedOption }
    })
  }

  const toggleLinkedProduct = (group: LinkedOptionGroup, productId: string) => {
    setConfigLinkedSelections((current) => {
      const inGroup = current.filter((selection) => selection.groupId === group.id)
      const exists = inGroup.some((selection) => selection.productId === productId)

      if (exists) {
        return current.filter(
          (selection) => !(selection.groupId === group.id && selection.productId === productId)
        )
      }

      let next = current.filter((selection) => selection.groupId !== group.id || group.maxSelect > 1)
      if (group.maxSelect === 1) {
        next = next.filter((selection) => selection.groupId !== group.id)
      } else if (inGroup.length >= group.maxSelect) {
        return current
      }

      return [
        ...next,
        {
          groupId: group.id,
          groupTitle: group.title,
          productId,
        },
      ]
    })
    setConfigValidationError(null)
  }

  const addConfiguredToCart = () => {
    if (!configProduct) return

    const validationError = validateConfiguratorSelections(
      configProduct,
      configSelections,
      configLinkedSelections
    )
    if (validationError) {
      setConfigValidationError(validationError)
      return
    }

    const selectedOptions = Object.values(configSelections)
    const mainUnitPrice = getConfiguredUnitPrice(configProduct, selectedOptions)
    const linkedGroups = getActiveLinkedOptionGroups(configProduct)
    const hasLinkedSelections = configLinkedSelections.length > 0

    if (hasLinkedSelections || linkedGroups.length > 0) {
      const bundleLines = buildBundleCartLines({
        mainProduct: configProduct,
        selectedOptions,
        linkedSelections: configLinkedSelections,
        linkedGroups,
        catalogProducts: safeProducts,
        mainUnitPrice,
      }).map((line: any) => {
        const productId = line.productId ?? line.id
        const product = safeProducts.find((item: any) => item.id === productId) || line
        const categoryName =
          safeCategories.find((category: any) => category.id === product.categoryId)?.name || ""

        return {
          ...line,
          preparationMode: line.preparationMode || resolveProductPreparationMode(product, categoryName),
        }
      })

      setCart((current) => [...current, ...bundleLines])
      closeProductSelector()
      if (!turboMode) {
        toast({ title: "Ajouté", description: configProduct.name, duration: 500 })
      }
      return
    }

    const productId = configProduct.id
    const cartItemId = getConfiguredCartItemId(productId, selectedOptions)

    setCart((current) => {
      const existing = current.find((cartItem) => cartItem.id === cartItemId)

      if (existing) {
        return current.map((cartItem) =>
          cartItem.id === cartItemId
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        )
      }

      return [
        ...current,
        {
          ...configProduct,
          id: cartItemId,
          productId,
          name: configProduct.name,
          imageUrl: configProduct.imageUrl,
          unitPrice: mainUnitPrice,
          quantity: 1,
          selectedOptions,
          preparationMode: resolveProductPreparationMode(
            configProduct,
            safeCategories.find((category: any) => category.id === configProduct.categoryId)?.name || ""
          ),
        },
      ]
    })

    closeProductSelector()
    if (!turboMode) {
      toast({ title: "Ajouté", description: configProduct.name, duration: 500 })
    }
  }

  const handleCheckout = async (method: "cash" | "mobile") => {
    if (!db || !restaurantId || !user || cart.length === 0 || processing || checkoutLockRef.current) return false

    if (!activeCashSession) {
      toast({
        title: "Caisse fermee",
        description: "Ouvrez une session de caisse avant de vendre.",
        variant: "destructive",
      })
      return false
    }
    
    if (orderType === "dine-in" && !tableNumber) {
      toast({
        title: "Table requise",
        description: "Veuillez sélectionner une table.",
        variant: "destructive",
      })
      return false
    }
    
    checkoutLockRef.current = true
    setProcessing(true)
    
    const orderService = new OrderService(db)
    try {
      const recalculatedItems = cart.map((item, index) => {
        const productId = item.productId ?? item.id
        const product = safeProducts.find((currentProduct: any) => currentProduct.id === productId)

        if (!product) {
          throw new Error(`Produit introuvable: ${productId}`)
        }

        let priceSnapshot = getCartItemUnitPrice(item)
        try {
          priceSnapshot = recalculateConfiguredUnitPrice(
            product,
            item.selectedOptions ?? []
          )
        } catch {
          priceSnapshot = getCartItemUnitPrice(item)
        }

        const categoryName =
          safeCategories.find((category: any) => category.id === product.categoryId)?.name || ""

        return {
          id: `${productId}-${Date.now()}-${index}`,
          productId,
          nameSnapshot: item.name,
          status: "pending",
          createdAt: new Date(),
          priceSnapshot,
          quantity: item.quantity,
          selectedOptions: item.selectedOptions ?? [],
          preparationMode: resolveProductPreparationMode(product, categoryName),
          reviewsEnabled: product.reviewsEnabled === true,
        }
      })

      const selectedMobileConfig = mobilePaymentMethods.find((paymentMethod: any) => paymentMethod.code === selectedMobileMethodCode)
      let mobilePaymentCode: string | null = null

      if (method === "mobile") {
        if (!selectedMobileConfig) {
          throw new Error("Methode mobile money non configuree")
        }
      }

      const requiresKitchen = orderHasKitchenItems(recalculatedItems)

      if (process.env.NODE_ENV !== "production") {
        console.info("[preparationMode][pos]", {
          restaurantId,
          orderType,
          items: recalculatedItems.map((item) => ({
            productId: item.productId,
            name: item.nameSnapshot,
            preparationMode: item.preparationMode,
            sentToKitchen: item.preparationMode === "kitchen",
          })),
          kitchenItems: getKitchenOrderItems(recalculatedItems).map((item) => item.productId),
          requiresKitchen,
        })
      }

      const orderData: any = {
        restaurantId: restaurantId,
        type: orderType === "dine-in" ? "table" : "takeaway",
        orderType: orderType === "dine-in" ? "dine_in" : "pickup",
        cashierId: user.uid,
        cashSessionId: activeCashSession.id,
        discountAmount,
        items: recalculatedItems
      }

      if (orderType === "takeaway") {
        orderData.sessionId = activeCashSession.id
        orderData.source = "pos"
      }

      if (orderType === "dine-in" && tableNumber) {
        const tableSession = await getOrCreateActiveTableSession(db, restaurantId, tableNumber)
        orderData.tableId = tableSession.tableId
        orderData.zoneId = tableSession.zoneId
        orderData.sessionId = tableSession.sessionId
        orderData.tableSessionId = tableSession.tableSessionId || tableSession.sessionId
        orderData.source = "pos"
      }

      const orderId = await orderService.createOrder(orderData)
      const printableOrder: PrintableOrder = {
        ...orderData,
        id: orderId,
        total,
        totalAmount: total,
        paymentMethod: method === "mobile" ? selectedMobileConfig?.code : "cash",
        paymentStatus: ORDER_PAYMENT_STATUS.PAID,
        kitchenStatus: requiresKitchen ? ORDER_OPERATION_STATUS.PENDING : ORDER_OPERATION_STATUS.COMPLETED,
        orderStatus: requiresKitchen ? ORDER_OPERATION_STATUS.PENDING : ORDER_OPERATION_STATUS.COMPLETED,
        createdAt: new Date(),
      }

      await processOrderPaymentTransaction({
        db,
        restaurantId,
        orderId,
        method,
        paymentMethod: method === "mobile" ? selectedMobileConfig?.code : "cash",
        paymentProviderName: method === "mobile" ? selectedMobileConfig?.name : null,
        paymentCode: mobilePaymentCode,
        cashSessionId: activeCashSession.id,
        amount: total,
        staff: {
          userId: user.uid,
          staffId: staffSnapshot.staffId,
          staffName: staffSnapshot.staffName,
        },
        printedClient: true,
      })

      await updateActiveCashSessionTotals(method, total)

      if (orderHasKitchenItems(recalculatedItems)) {
        const kitchenPrintOrder: PrintableOrder = {
          ...printableOrder,
          items: getKitchenOrderItems(
            (printableOrder.items || []).map((item: any) => ({
              ...item,
              name: item.name ?? item.nameSnapshot,
              preparationMode: item.preparationMode,
            }))
          ).map((item: any) => ({
            ...item,
            name: item.name ?? item.nameSnapshot,
          })),
        }
        queuePrint(kitchenPrintOrder, "kitchen", { automatic: true })
      }
      queuePrint(printableOrder, "client", { automatic: true })

      setCart([])
      setTableNumber(null)
      setOrderType("takeaway")
      setDiscountRate(0)
      setCashReceivedInput("")
      setSelectedPaymentMode(null)
      setSelectedMobileMethodCode(null)
      toast({ title: "Vente validée", description: `Encaissement ${method.toUpperCase()} terminé.` })
      
      if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(100)
      }
      return true
    } catch (error) {
      console.error("POS checkout error:", error)
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de finaliser la vente." })
      return false
    } finally {
      checkoutLockRef.current = false
      setProcessing(false)
    }
  }

  const handleTableSelect = (tableId: string) => {
    setTableNumber(tableId)
  }

  const requestCashSessionOpening = async () => {
    if (!db || !restaurantId || !user?.uid || activeCashSession || pendingSessionRequest || pendingValidationSession) return

    setRequestingSession(true)
    try {
      if (cashierApprovalMode === "optional") {
        await addDoc(collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.CASH_SESSIONS), {
          restaurantId,
          cashierId: user.uid,
          userId: user.uid,
          staffId: staffSnapshot.staffId,
          staffName: staffSnapshot.staffName,
          staffPhone: staffSnapshot.staffPhone,
          status: "open",
          openedAt: serverTimestamp(),
          closedAt: null,
          openingBalance: 0,
          closingBalance: null,
          totalCash: 0,
          totalMobile: 0,
          totalOrders: 0,
          validatedByManager: false,
          approvedBy: user.uid,
          approvedRole: "cashier",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
        toast({ title: "Caisse ouverte" })
        return
      }

      await addDoc(collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, "cashSessionRequests"), {
        restaurantId,
        cashierId: user.uid,
        userId: user.uid,
        staffId: staffSnapshot.staffId,
        staffName: staffSnapshot.staffName,
        staffPhone: staffSnapshot.staffPhone,
        cashierName: staffSnapshot.staffName,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      toast({ title: "Demande envoyee", description: "Un manager doit valider l'ouverture de caisse." })
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: error.message || "Demande impossible." })
    } finally {
      setRequestingSession(false)
    }
  }

  const openCloseCashSessionDialog = () => {
    if (!activeCashSession?.id || processing) return
    setDeclaredCashInput(String(sessionCalculatedTotals.totalCash))
    setDeclaredMobileInput(String(sessionCalculatedTotals.totalMobile))
    setCloseDialogOpen(true)
  }

  const closeMyCashSession = async () => {
    if (!db || !restaurantId || !activeCashSession?.id || processing || closeSessionLockRef.current) return

    closeSessionLockRef.current = true
    setProcessing(true)
    try {
      const ledger = new PaymentLedgerService(db)
      await ledger.snapshotSessionClose({
        restaurantId,
        sessionId: activeCashSession.id,
        closedBy: user?.uid || staffSnapshot.staffId || "cashier",
        closingBalance: declaredCashAmount + declaredMobileAmount,
        declaredCash: declaredCashAmount,
        declaredMobileMoney: declaredMobileAmount,
      })

      toast({
        title: "Caisse clôturée",
        description: "En attente de validation manager.",
      })
      setCloseDialogOpen(false)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Clôture impossible.",
      })
    } finally {
      closeSessionLockRef.current = false
      setProcessing(false)
    }
  }

  const handleCollectOrder = async (order: any, method: "cash" | "mobile") => {
    if (!db || !restaurantId || !user) return

    if (!isOrderServed(order)) {
      toast({
        title: "Commande non servie",
        description: "Seules les commandes servies peuvent etre encaissees.",
        variant: "destructive",
      })
      return
    }

    if (!activeCashSession) {
      toast({
        title: "Caisse fermee",
        description: "Ouvrez une session de caisse avant d'encaisser.",
        variant: "destructive",
      })
      return
    }

    setProcessing(true)
    try {
      let paymentCode: string | null = null
      let paymentMethod = "cash"
      let paymentProviderName: string | null = null

      if (method === "mobile") {
        const selectedMobileConfig = mobilePaymentMethods.find((item: any) => item.code === selectedMobileMethodCode)
        if (!selectedMobileConfig) {
          throw new Error("Methode mobile money non configuree")
        }

        paymentMethod = selectedMobileConfig.code
        paymentProviderName = selectedMobileConfig.name

        if (order.source !== "pos") {
          if (!countryCode) {
            throw new Error("Methode mobile money non configuree")
          }

          const result = await generatePaymentLinkOrUSSD({
            methodCode: selectedMobileConfig.code,
            countryCode,
            merchant: selectedMobileConfig.merchantNumber,
            amount: getOrderComputedTotal(order),
            db,
          })
          paymentCode = result.value
        }
      }

      const beforeOrder = await processOrderPaymentTransaction({
        db,
        restaurantId,
        orderId: order.id,
        method,
        paymentMethod,
        paymentProviderName,
        paymentCode,
        cashSessionId: activeCashSession.id,
        amount: getOrderComputedTotal(order),
        staff: {
          userId: user.uid,
          staffId: staffSnapshot.staffId,
          staffName: staffSnapshot.staffName,
        },
        printedClient: !order.printedClient,
      })

      if (method === "cash" || order.source === "pos") {
        await updateActiveCashSessionTotals(method, getOrderComputedTotal(order))
        await releaseOrderTableIfNeeded(db, restaurantId, beforeOrder)
        queuePrint(
          {
            ...order,
            paymentMethod,
            paymentStatus: "paid",
            createdAt: order.createdAt ?? new Date(),
          },
          "client",
          { automatic: true }
        )
      }

      setCollectingOrderId(null)
      toast({
        title: method === "cash" || order.source === "pos" ? "Commande encaissee" : "Paiement mobile genere",
        description: paymentCode ? `Code: ${paymentCode}` : undefined,
      })
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: error.message || "Encaissement impossible." })
    } finally {
      setProcessing(false)
    }
  }

  const markOrderPaid = async (order: any) => {
    if (!db || !restaurantId || !user || processing) return
    const isMobilePayment = isMobileMoneyOrder(order)
    const isPendingMobilePayment = (order.paymentStatus === "pending_mobile" || order.paymentStatus === "pending") && isMobilePayment
    const canValidatePayment =
      isPendingMobilePayment ||
      order.paymentStatus === "pending_verification" ||
      order.paymentStatus === "pending_cash"

    if (!canValidatePayment) {
      toast({
        variant: "destructive",
        title: "Paiement non initie",
        description: "Le client doit d'abord initier le paiement.",
      })
      return
    }

    if (!activeCashSession?.id) {
      toast({
        variant: "destructive",
        title: "Caisse fermee",
        description: "Ouvre une session caisse avant de valider un paiement.",
      })
      return
    }

    setProcessing(true)
    try {
      const beforeOrder = isMobilePayment
        ? await validateMobilePaymentTransaction({
            db,
            restaurantId,
            orderId: order.id,
            cashSessionId: activeCashSession?.id,
            amount: getOrderComputedTotal(order),
            staff: {
              userId: user.uid,
              staffId: staffSnapshot.staffId,
              staffName: staffSnapshot.staffName,
            },
            printedClient: !order.printedClient,
          })
        : await processOrderPaymentTransaction({
            db,
            restaurantId,
            orderId: order.id,
            method: "cash",
            paymentMethod: "cash",
            cashSessionId: activeCashSession?.id,
            amount: getOrderComputedTotal(order),
            staff: {
              userId: user.uid,
              staffId: staffSnapshot.staffId,
              staffName: staffSnapshot.staffName,
            },
            printedClient: !order.printedClient,
          })

      await releaseOrderTableIfNeeded(db, restaurantId, beforeOrder)
      const totalMethod = isMobilePayment ? "mobile" : "cash"
      await updateActiveCashSessionTotals(totalMethod, getOrderComputedTotal(order))
      queuePrint(
        {
          ...order,
          paymentStatus: "paid",
          paymentIntentStatus: "verified",
          paymentMethod: isMobilePayment ? "mobile_money" : "cash",
          createdAt: order.createdAt ?? new Date(),
        },
        "client",
        { automatic: true }
      )
      toast({
        title: isMobilePayment ? "Paiement mobile verifie" : "Paiement cash encaisse",
      })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Paiement impossible",
        description: error.message || "La validation du paiement a echoue.",
      })
    } finally {
      setProcessing(false)
    }
  }

  const validateTableSessionPayment = async (session: any) => {
    if (!db || !restaurantId || !user || processing) return

    if (!activeCashSession?.id) {
      toast({
        variant: "destructive",
        title: "Caisse fermee",
        description: "Ouvre une session caisse avant de valider un paiement.",
      })
      return
    }

    const paymentStatus = session?.paymentRequest?.status
    if (paymentStatus !== "requested" && paymentStatus !== "pending_confirmation") {
      toast({
        variant: "destructive",
        title: "Paiement non initie",
        description: "Le client doit d'abord initier le paiement.",
      })
      return
    }

    setProcessing(true)
    setCollectingOrderId(session.id)
    try {
      const ordersRef = collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.ORDERS)
      const [tableSessionOrdersSnap, legacySessionOrdersSnap] = await Promise.all([
        getDocs(query(ordersRef, where("tableSessionId", "==", session.id))),
        getDocs(query(ordersRef, where("sessionId", "==", session.id))),
      ])
      const orderDocs = new Map<string, (typeof tableSessionOrdersSnap.docs)[number]>()

      tableSessionOrdersSnap.docs.forEach((orderDoc) => orderDocs.set(orderDoc.id, orderDoc))
      legacySessionOrdersSnap.docs.forEach((orderDoc) => orderDocs.set(orderDoc.id, orderDoc))

      const sessionRef = doc(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.TABLE_SESSIONS, session.id)
      const method = session.paymentRequest?.method === "mobile" ? "mobile" : "cash"
      const paymentType = method === "mobile" ? "mobile_money" : "cash"
      const paymentProvider = method === "mobile" ? normalizePaymentProvider(session.paymentRequest?.provider || "mobile_money") : null
      const ledger = new PaymentLedgerService(db)

      for (const orderDoc of Array.from(orderDocs.values())) {
        const currentOrder = { id: orderDoc.id, ...orderDoc.data() } as any
        const amount = getOrderComputedTotal(currentOrder)

        await ledger.createPayment({
          restaurantId,
          orderId: orderDoc.id,
          sessionId: activeCashSession.id,
          cashierId: user.uid,
          source: "qr_table",
          type: paymentType,
          provider: paymentProvider,
          amount,
          status: "confirmed",
          idempotencyKey: buildPaymentIdempotencyKey([
            "table-session-payment",
            restaurantId,
            session.id,
            orderDoc.id,
            paymentType,
            paymentProvider,
          ]),
          orderUpdate: {
            paymentStatus: "paid",
            paymentMethod: paymentType,
            paymentType,
            paymentProvider,
            cashSessionId: activeCashSession.id,
            paidAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
        })
      }

      const batch = writeBatch(db)
      batch.update(sessionRef, {
        "paymentRequest.status": "validated",
        "paymentRequest.handledAt": serverTimestamp(),
        "paymentRequest.handledBy": user.uid,
        status: "closed",
        closedAt: serverTimestamp(),
        lastActivityAt: serverTimestamp(),
      })

      if (session.tableId) {
        const tableRef = doc(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.TABLES, session.tableId)
        batch.update(tableRef, {
          status: "free",
          currentSessionId: null,
          updatedAt: serverTimestamp(),
          lastActivityAt: serverTimestamp(),
        })
      }

      await batch.commit()
      toast({ title: "Paiement valide" })
    } catch (error: any) {
      console.error(error)
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Validation impossible.",
      })
    } finally {
      setProcessing(false)
      setCollectingOrderId(null)
    }
  }

  const markOrderCompleted = async (order: any) => {
    if (!db || !restaurantId || processing) return

    setProcessing(true)
    try {
      await updateDoc(doc(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.ORDERS, order.id), {
        sessionActive: false,
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      toast({ title: "Commande terminee" })
    } finally {
      setProcessing(false)
    }
  }

  const releaseTableIfPaidAndServed = async (order: any) => {
    if (!db || !restaurantId || !isOrderServed(order)) return
    const tableId = order.tableId
    if (!tableId) return

    await closeActiveTableSession(db, restaurantId, tableId)
    await updateDoc(doc(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.TABLES, tableId), {
      status: "free",
      currentSessionId: null,
      currentOrderId: null,
      updatedAt: serverTimestamp(),
    })
  }

  const handleOrderTypeChange = (type: "dine-in" | "takeaway") => {
    setOrderType(type)
    if (type === "takeaway") {
      setTableNumber(null)
    }
  }

  const handlePaymentModeChange = (mode: PosPaymentMode) => {
    setSelectedPaymentMode(mode)
    if (mode === "cash") {
      setSelectedMobileMethodCode(null)
      return
    }
    if (mode === "mobile") {
      setCashReceivedInput("")
    }
  }

  const handleApplyDiscount = () => {
    setDiscountRate((current) => {
      if (current === 0) return 0.05
      if (current === 0.05) return 0.1
      if (current === 0.1) return 0.15
      return 0
    })
  }

  const handleHoldCart = () => {
    if (cart.length === 0) return
    setCart([])
    setTableNumber(null)
    setOrderType("takeaway")
    setDiscountRate(0)
    setCashReceivedInput("")
    setSelectedPaymentMode(null)
    setSelectedMobileMethodCode(null)
    toast({ title: "Panier mis en attente", description: "La vente courante a ete retiree de l'ecran caisse." })
  }

  const handleCheckoutSelectedPayment = async () => {
    if (!selectedPaymentMode) {
      toast({
        title: "Mode de paiement requis",
        description: "Sélectionnez Espèces ou Mobile Money avant d'encaisser.",
        variant: "destructive",
      })
      return false
    }

    if (selectedPaymentMode === "cash") {
      if (cashReceivedAmount < total) {
        toast({
          title: "Montant insuffisant",
          description: "Le montant reçu doit couvrir le total à payer.",
          variant: "destructive",
        })
        return false
      }
      return handleCheckout("cash")
    }

    if (selectedPaymentMode === "mobile") {
      if (!selectedMobileMethodCode) {
        toast({
          title: "Canal Mobile Money requis",
          description: "Selectionnez le moyen Mobile Money utilise.",
          variant: "destructive",
        })
        return false
      }
      return handleCheckout("mobile")
    }
    return false
  }

  const openPaymentDialog = () => {
    if (processing || cart.length === 0) return
    setPaymentFlowError(null)
    setPaymentFlowSuccess(false)
    setPaymentDialogOpen(true)
  }

  const submitPayment = async () => {
    if (processing) return
    setPaymentFlowError(null)
    const succeeded = await handleCheckoutSelectedPayment()
    if (succeeded) {
      setPaymentFlowSuccess(true)
    } else {
      setPaymentFlowError("Impossible de finaliser la transaction. Vérifiez les informations puis réessayez.")
    }
  }

  const handleLogout = React.useCallback(async () => {
    try {
      await signOut(auth)
      router.push("/login")
    } catch (error) {
      console.error("Erreur lors de la déconnexion:", error)
      // Rediriger même en cas d'erreur pour éviter de laisser l'utilisateur bloqué
      router.push("/login")
    }
  }, [auth, router])

  if (isLoadingVisible || !Array.isArray(products) || !Array.isArray(categories)) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <>
    <POSLayout
      restaurantName={restaurant?.name}
      restaurantLogoUrl={restaurant?.logoUrl}
      activeTab={activeTab}
      unpaidServedCount={unpaidServedCount}
      isCashSessionOpen={Boolean(activeCashSession)}
      totalAmount={sessionPaidTotal}
      userName={staffSnapshot.staffName}
      roleLabel="Caissier"
      onTabChange={setActiveTab}
      canCloseSession={Boolean(activeCashSession) && cart.length === 0 && !processing}
      onCloseSession={openCloseCashSessionDialog}
      onLogout={handleLogout}
      center={
        activeTab === "cashier" && activeCashSession ? (
          <PosCatalog
            className="h-[calc(100%-5.5rem)] md:h-full lg:h-auto lg:self-start lg:overflow-visible"
            contentClassName="lg:h-auto lg:flex-none lg:overflow-y-visible lg:overscroll-auto lg:p-2.5"
            categories={<CategorySidebar categories={safeCategories} selectedCategoryId={selectedCategoryId} onSelectCategory={setSelectedCategoryId} />}
            footer={totalPages > 1 ? (
              <div className="flex items-center justify-center gap-2 bg-[var(--pos-catalog)] sm:gap-3">
                <Button variant="outline" size="sm" className="min-h-11 gap-1 rounded-full px-3 text-xs font-black" disabled={safeCurrentPage === 0} onClick={() => setCurrentPage((page) => page - 1)}>
                  <ChevronLeft className="h-4 w-4" />Préc.
                </Button>
                <span className="min-w-20 text-center text-xs font-black text-muted-foreground sm:min-w-24">Page {safeCurrentPage + 1} / {totalPages}</span>
                <Button variant="outline" size="sm" className="min-h-11 gap-1 rounded-full px-3 text-xs font-black" disabled={safeCurrentPage === totalPages - 1} onClick={() => setCurrentPage((page) => page + 1)}>
                  Suiv.<ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            ) : null}
          >

            <div className="min-h-0">
              <ProductGrid
                products={paginatedProducts}
                categories={safeCategories}
                loading={isLoadingVisible}
                formatPrice={formatDisplayPrice}
                onProductClick={openProductSelector}
              />
            </div>

            {configProduct ? (
              <ProductConfiguratorModal
                product={configProduct}
                catalogProducts={safeProducts}
                embeddedSelections={configSelections}
                linkedSelections={configLinkedSelections}
                unitPrice={getConfiguredUnitPrice(configProduct, Object.values(configSelections))}
                onToggleEmbeddedChoice={toggleConfigChoice}
                onToggleLinkedProduct={toggleLinkedProduct}
                onClose={closeProductSelector}
                onAdd={addConfiguredToCart}
                validationError={configValidationError}
              />
            ) : null}
          </PosCatalog>
        ) : undefined
      }
      right={
        activeTab === "cashier" && activeCashSession && !isPhoneViewport ? (
          <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
          <div className="min-h-0 flex-1 overflow-hidden"><CartPanel
            cart={cart}
            subtotal={subtotal}
            discountAmount={discountAmount}
            total={total}
            processing={processing}
            canCheckout={
              Boolean(activeCashSession) &&
              cart.length > 0 &&
              !(orderType === "dine-in" && !tableNumber)
            }
            orderType={orderType}
            tableNumber={tableNumber}
            tableLabelPrefix={tableLabelPrefix}
            tables={tables}
            onOrderTypeChange={handleOrderTypeChange}
            onTableSelect={handleTableSelect}
            onIncrease={increaseCartItem}
            onDecrease={removeFromCart}
            onRemove={(itemId) =>
              setCart((current) =>
                current.filter((item) => !getCartLinesForBundleRemoval(current, itemId).includes(item.id))
              )
            }
            onClear={() => {
              setCart([])
              setDiscountRate(0)
              setCashReceivedInput("")
              setSelectedPaymentMode(null)
              setSelectedMobileMethodCode(null)
            }}
            onHold={handleHoldCart}
            onDiscount={handleApplyDiscount}
            onCheckout={openPaymentDialog}
          /></div>
          <div aria-label="Résumé de session" className="grid shrink-0 grid-cols-3 gap-2">
            <POSFooterCard icon={<Clock3 />} label="Début" value={formatSessionDateTime(activeCashSession.openedAt)} />
            <POSFooterCard icon={<Percent />} label="Remise" value={discountRate > 0 ? `${Math.round(discountRate * 100)}%` : "0%"} />
            <POSFooterCard icon={<UserRound />} label="Caissier" value={staffSnapshot.staffName} />
          </div>
          </div>
        ) : undefined
      }
      left={
        <div className="h-full flex flex-col overflow-hidden">
          {!activeCashSession && activeTab === "cashier" ? (
            <div className="flex-shrink-0 mb-2">
              <ClosedCashSessionPanel
                pending={Boolean(pendingSessionRequest)}
                pendingValidation={Boolean(pendingValidationSession)}
                requesting={requestingSession}
                approvalMode={cashierApprovalMode}
                onRequest={requestCashSessionOpening}
              />
            </div>
          ) : null}

          <div className={cn("flex-1 flex flex-col min-h-0", activeTab !== "orders" && "hidden")}>
            <POSMobileOrders
              activeStatus={mobileOrderStatus}
              columns={posColumns.slice(0, 4)}
              ordersByStatus={posOrders}
              tableLabelPrefix={tableLabelPrefix}
              tables={tables}
              onStatusChange={setMobileOrderStatus}
              onSelectOrder={setSelectedOrderDetailId}
            />
            <div className="hidden h-full min-h-0 grid-cols-1 gap-5 overflow-y-auto p-4 md:grid xl:grid-cols-5 xl:overflow-hidden">
              {posColumns.map((column) => {
                const columnOrders = posOrders[column.id] ?? []
                const isServedColumn = column.id === ORDER_OPERATION_STATUS.SERVED
                const isCompletedColumn = column.id === ORDER_OPERATION_STATUS.COMPLETED
                const columnUi = getPOSColumnUi(column.id)
                const ColumnIcon = columnUi.icon
                const visibleColumnOrders =
                  isCompletedColumn && !showAllCompletedOrders
                    ? columnOrders.slice(0, 3)
                    : columnOrders
                const displayedCount = isServedColumn ? servedTableSessionGroups.length : columnOrders.length
                const visibleCardsCount = isServedColumn ? servedTableSessionGroups.length : visibleColumnOrders.length

                return (
                  <div
                    key={column.id}
                    className={cn(
                      "flex h-full min-h-[460px] flex-col overflow-hidden rounded-[20px] border p-3.5 text-card-foreground shadow-[0_18px_42px_rgba(15,23,42,0.08)] ring-1 ring-white/60 backdrop-blur dark:shadow-[0_18px_42px_rgba(0,0,0,0.24)] dark:ring-white/5 xl:min-h-0",
                      columnUi.shell
                    )}
                  >
                    <div className="mb-3 flex shrink-0 items-center justify-between gap-3 border-b border-white/70 pb-3 dark:border-white/10">
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-sm",
                            columnUi.iconClass
                          )}
                        >
                          <ColumnIcon className="h-5 w-5" />
                        </span>
                        <h3 className="truncate text-sm font-semibold uppercase tracking-wide text-foreground">
                          {STATUS_LABELS[column.id as keyof typeof STATUS_LABELS]}
                        </h3>
                      </div>
                      <span
                        className={cn(
                          "flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full px-2 text-sm font-black shadow-sm",
                          columnUi.badgeClass
                        )}
                      >
                        {displayedCount}
                      </span>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto space-y-3.5">
                      {visibleCardsCount === 0 ? (
                        <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-[18px] border border-dashed border-foreground/10 bg-white/45 px-5 text-center shadow-inner dark:bg-black/10">
                          <span
                            className={cn(
                              "flex h-16 w-16 items-center justify-center rounded-full",
                              columnUi.iconClass
                            )}
                          >
                            <Inbox className="h-7 w-7" />
                          </span>
                          <p className="mt-4 text-base font-semibold text-foreground">Aucune commande</p>
                          <p className="mt-1 max-w-[14rem] text-sm font-medium leading-5 text-muted-foreground">
                            {columnUi.emptyText}
                          </p>
                        </div>
                      ) : isServedColumn ? servedTableSessionGroups.map((group: any) => {
                        const paymentSession = group.paymentSession
                        const paymentRequestStatus = paymentSession?.paymentRequest?.status
                        const paymentProofSms = getPaymentProofSms(paymentSession, group.orders)
                        const mobilePaymentNeedsProof = paymentSession?.paymentRequest?.method === "mobile" && !paymentProofSms
                        const paymentMethodLabel = getConfiguredPaymentMethodLabel(group.orders[0], paymentSession, mobilePaymentMethods)
                        const hasSessionPaymentRequest =
                          paymentRequestStatus === "requested" ||
                          paymentRequestStatus === "pending_confirmation"
                        const isMobilePayment = paymentSession?.paymentRequest?.method === "mobile"
                        const canVerifyPayment = Boolean(hasSessionPaymentRequest) && !mobilePaymentNeedsProof
                        const paymentLabel = paymentRequestStatus === "requested"
                          ? "Client veut payer"
                          : paymentRequestStatus === "pending_confirmation"
                            ? "Client dit avoir paye"
                            : "En attente paiement client"
                        const sessionStatusLabel = paymentSession?.status === "active" || !paymentSession?.status
                          ? "Session active"
                          : "Session"
                        return (
                          <div
                            key={group.id}
                            className="animate-in fade-in slide-in-from-bottom-2 rounded-[18px] border border-border/70 bg-card/95 p-3.5 text-left shadow-[0_10px_26px_rgba(15,23,42,0.07)] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_16px_34px_rgba(15,23,42,0.12)] dark:shadow-[0_12px_28px_rgba(0,0,0,0.24)]"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-black">
                                  {group.tableLabel || tableLabelPrefix} / {sessionStatusLabel}
                                </p>
                              </div>
                              <p className="shrink-0 text-xs font-black text-primary">
                                {group.totalAmount.toLocaleString()} FCFA
                              </p>
                            </div>

                            <div className="mt-3 rounded-2xl bg-muted/40 p-3">
                              <div className="flex items-center justify-between gap-2 text-[9px] font-bold text-muted-foreground">
                                <span>{group.orderCount} commande(s)</span>
                                <span>{group.itemCount} article(s)</span>
                              </div>
                              <div className="mt-2 space-y-1">
                                {group.orders.slice(0, 4).map((order: any) => (
                                  <button
                                    key={order.id}
                                    type="button"
                                    className="block w-full rounded-xl border border-transparent px-2 py-1.5 text-left transition hover:border-primary/30 hover:bg-background"
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      setSelectedOrderDetailId(order.id)
                                    }}
                                  >
                                    <span className="block text-[9px] font-black text-foreground">
                                      {getOrderDisplayId(order)} - {getOrderComputedTotal(order).toLocaleString()} FCFA
                                    </span>
                                    <span className="block truncate text-[9px] font-semibold text-muted-foreground">
                                      {summarizeCashierOrderItems(order)}
                                    </span>
                                  </button>
                                ))}
                                {group.orders.length > 4 ? (
                                  <p className="px-1 text-[9px] font-bold text-muted-foreground">
                                    + {group.orders.length - 4} commande(s)
                                  </p>
                                ) : null}
                              </div>
                            </div>

                            <div className="mt-3 space-y-2 rounded-2xl bg-muted/50 p-3">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-semibold text-muted-foreground">Paiement:</span>
                                <span className="text-[10px] font-black">
                                  {paymentSession?.paymentRequest?.method === "cash"
                                    ? "Espèces"
                                    : isMobilePayment
                                      ? paymentMethodLabel
                                      : "Non initié"}
                                </span>
                              </div>
                              <p className={cn("text-right text-[10px] font-black", canVerifyPayment ? "text-amber-600" : "text-muted-foreground")}>
                                {paymentLabel}
                              </p>
                              {isMobilePayment ? (
                                <div className={cn(
                                  "rounded-full px-2 py-1 text-center text-[9px] font-black uppercase",
                                  paymentProofSms ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                                )}>
                                  {paymentProofSms ? "Preuve reçue" : "Preuve manquante"}
                                </div>
                              ) : null}
                              {paymentProofSms ? (
                                <div className="rounded-xl border bg-background p-2 text-[9px] font-semibold text-foreground">
                                  <p className="font-black uppercase text-muted-foreground">SMS client</p>
                                  <p className="mt-1 whitespace-pre-wrap break-words">{paymentProofSms}</p>
                                </div>
                              ) : null}
                              <Button
                                className="mt-2 h-9 w-full rounded-full bg-primary text-[10px] font-black hover:bg-primary/90"
                                disabled={processing || !canVerifyPayment || !paymentSession}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  if (paymentSession) validateTableSessionPayment(paymentSession)
                                }}
                              >
                                {isMobilePayment ? "Valider paiement session" : "Encaisser session"}
                              </Button>
                            </div>
                          </div>
                        )
                      }) : visibleColumnOrders.map((order: any) => {
                        const paymentSession = getPaymentSessionForOrder(order, safeTableSessions)
                        const paymentRequestStatus = paymentSession?.paymentRequest?.status
                        const paymentProofSms = getPaymentProofSms(paymentSession, [order])
                        const paymentMethodLabel = getConfiguredPaymentMethodLabel(order, paymentSession, mobilePaymentMethods)
                        const hasSessionPaymentRequest =
                          paymentRequestStatus === "requested" ||
                          paymentRequestStatus === "pending_confirmation"
                        const isPaid = isOrderPaid(order) || paymentRequestStatus === "validated"
                        const isMobilePayment = isMobileMoneyOrder(order) || paymentSession?.paymentRequest?.method === "mobile"
                        const mobilePaymentNeedsProof = isMobilePayment && !paymentProofSms
                        const isPendingMobilePayment = (order.paymentStatus === "pending_mobile" || order.paymentStatus === "pending") && isMobilePayment
                        const isPaymentVisible =
                          hasSessionPaymentRequest ||
                          order.paymentStatus === "pending_verification" ||
                          isPendingMobilePayment ||
                          order.paymentStatus === "pending_cash" ||
                          isPaid
                        const canVerifyPayment =
                          !mobilePaymentNeedsProof &&
                          (
                            hasSessionPaymentRequest ||
                            order.paymentStatus === "pending_verification" ||
                            isPendingMobilePayment ||
                            order.paymentStatus === "pending_cash"
                          )
                        const paymentLabel = paymentRequestStatus === "requested"
                          ? "Client veut payer"
                          : paymentRequestStatus === "pending_confirmation"
                          ? "Client dit avoir paye"
                          : order.paymentStatus === "pending_cash"
                          ? "cash a encaisser"
                          : order.paymentStatus === "unpaid"
                          ? "non initie"
                          : canVerifyPayment
                            ? "a verifier"
                            : isPaid
                              ? "paye"
                              : "non initie"
                        const normalizedType = normalizeOrderType(order.orderType || order.type)
                        const currentOrderStatus = getPOSOperationStatus(order)
                        const canComplete = false
                        const tableLabel = formatTableDisplayName({
                          name: tables.find((table) => table.id === order.tableId)?.name || order.tableNumber || order.table,
                          id: order.tableId,
                        }, tableLabelPrefix)
                        const orderItems = Array.isArray(order.items) ? order.items : []
                        const previewItems = orderItems.slice(0, 3)
                        const hiddenItemsCount = Math.max(0, orderItems.length - previewItems.length)
                        const oneLineProducts = previewItems
                          .map((item: any) => `${item.quantity}x ${item.name || item.nameSnapshot}`)
                          .join(" · ")

                        const orderMetaLabel = getPOSOrderMetaLabel(normalizedType, tableLabel)
                        const orderDateLabel = formatPOSOrderDateTime(order.createdAt)
                        const productLines = previewItems.map(
                          (item: any) => `${Number(item.quantity ?? 1)}x ${item.name || item.nameSnapshot || "Article"}`
                        )

                        return (
                          <div
                            key={order.id}
                            role="button"
                            tabIndex={0}
                            className={cn(
                              "animate-in fade-in slide-in-from-bottom-2 rounded-[18px] border border-border/70 bg-card/95 p-3.5 text-left shadow-[0_10px_26px_rgba(15,23,42,0.07)] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_16px_34px_rgba(15,23,42,0.12)] focus:outline-none focus:ring-2 focus:ring-primary/35 dark:shadow-[0_12px_28px_rgba(0,0,0,0.24)]",
                              isCompletedColumn && "bg-background/95"
                            )}
                            onClick={() => setSelectedOrderDetailId(order.id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault()
                                setSelectedOrderDetailId(order.id)
                              }
                            }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-black leading-tight">{getOrderDisplayId(order)}</p>
                                <p className="mt-1 line-clamp-1 text-[11px] font-bold text-muted-foreground">
                                  {orderMetaLabel}
                                </p>
                                {isCompletedColumn ? (
                                  <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">
                                    {orderDateLabel}
                                  </p>
                                ) : null}
                              </div>
                              <p className="shrink-0 text-right text-sm font-black text-primary">
                                {getOrderComputedTotal(order).toLocaleString()} FCFA
                              </p>
                            </div>

                            {isCompletedColumn ? (
                              <div className="mt-3 space-y-1 text-xs font-semibold leading-4 text-foreground">
                                {productLines.length > 0 ? (
                                  productLines.map((line: string) => (
                                    <p key={line} className="line-clamp-1">
                                      {line}
                                    </p>
                                  ))
                                ) : (
                                  <p className="text-muted-foreground">Aucun produit</p>
                                )}
                              </div>
                            ) : (
                              <p className="mt-3 line-clamp-2 text-[11px] font-semibold leading-4 text-muted-foreground">
                                {oneLineProducts || "Aucun produit"}
                              </p>
                            )}
                            <div className="mt-3 flex items-center justify-between gap-2">
                              <span className="text-[9px] font-bold text-muted-foreground">
                                {hiddenItemsCount > 0 ? `+ ${hiddenItemsCount} article(s)` : `${orderItems.length} article(s)`}
                              </span>
                              <button
                                type="button"
                                className="inline-flex h-7 items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2.5 text-[9px] font-black uppercase text-primary transition hover:border-primary/35 hover:bg-primary/10"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setSelectedOrderDetailId(order.id)
                                }}
                              >
                                Voir détails
                              </button>
                            </div>

                            <Button
                              variant="outline"
                              className="mt-3 h-8 w-full rounded-full text-[9px] font-black"
                              onClick={(event) => {
                                event.stopPropagation()
                                queuePrint(order, "client")
                              }}
                            >
                              Réimprimer
                            </Button>

                            {!isPaid ? (
                              <div className="mt-3 space-y-2 rounded-2xl bg-muted/50 p-3">
                                {isPaymentVisible ? (
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-semibold text-muted-foreground">Mode:</span>
                                    <span className="text-[10px] font-black">
                                      {paymentSession?.paymentRequest?.method === "cash"
                                        ? "Espèces"
                                        : isMobilePayment
                                          ? paymentMethodLabel
                                          : "Cash"}
                                    </span>
                                  </div>
                                ) : null}
                                <p className={cn("text-right text-[10px] font-black", canVerifyPayment ? "text-amber-600" : "text-muted-foreground")}>
                                  {paymentLabel}
                                </p>
                                {isMobilePayment ? (
                                  <div className={cn(
                                    "rounded-full px-2 py-1 text-center text-[9px] font-black uppercase",
                                    paymentProofSms ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                                  )}>
                                    {paymentProofSms ? "Preuve reçue" : "Preuve manquante"}
                                  </div>
                                ) : null}
                                {paymentProofSms ? (
                                  <div className="rounded-xl border bg-background p-2 text-[9px] font-semibold text-foreground">
                                    <p className="font-black uppercase text-muted-foreground">SMS client</p>
                                    <p className="mt-1 whitespace-pre-wrap break-words">{paymentProofSms}</p>
                                  </div>
                                ) : null}

                                {isPaymentVisible ? (
                                  <Button
                                    className="mt-2 h-8 w-full rounded-full bg-primary text-[9px] font-black hover:bg-primary/90"
                                    disabled={processing || !canVerifyPayment}
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      paymentSession ? validateTableSessionPayment(paymentSession) : markOrderPaid(order)
                                    }}
                                  >
                                    {isMobilePayment ? "Valider paiement" : "Encaisser (cash)"}
                                  </Button>
                                ) : null}
                              </div>
                            ) : isPaid && normalizedType !== "dine_in" && currentOrderStatus === ORDER_OPERATION_STATUS.PENDING ? (
                              <div className="mt-3 rounded-full bg-emerald-500/10 px-3 py-1.5 text-center text-[9px] font-black uppercase text-emerald-700 dark:text-emerald-300">
                                Payée - en attente de préparation
                              </div>
                            ) : isPaid ? (
                              <div className="mt-3 rounded-full bg-emerald-500/10 px-3 py-1.5 text-center text-[9px] font-black uppercase text-emerald-700 dark:text-emerald-300">
                                Paiement confirmé
                              </div>
                            ) : null}

                            {canComplete ? (
                              <Button
                                className="mt-2 h-8 w-full rounded-full text-[9px] font-black"
                                disabled={processing}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  markOrderCompleted(order)
                                }}
                              >
                                Terminer
                              </Button>
                            ) : null}
                          </div>
                        )
                      })}
                      {isCompletedColumn && columnOrders.length > 3 ? (
                        <div className="flex justify-center pt-1">
                          <Button
                            type="button"
                            variant="outline"
                            className="h-9 rounded-full px-5 text-[10px] font-black"
                            onClick={() => setShowAllCompletedOrders((current) => !current)}
                          >
                            {showAllCompletedOrders ? "Voir moins" : "Voir plus"}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      }
    />

    {isPhoneViewport && activeTab === "cashier" && activeCashSession ? (
      <>
        <section
          aria-label="Résumé du ticket"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--pos-border)] bg-[var(--pos-elevated)] px-[max(.75rem,var(--safe-left,0px))] pb-[max(.75rem,var(--safe-bottom,0px))] pt-2 shadow-[var(--shadow-public-top)] md:hidden"
        >
          <div className="mx-auto flex max-w-xl items-center gap-3">
            <ShoppingCart aria-hidden="true" className="size-5 shrink-0 text-[var(--brand-primary)]" />
            <div className="min-w-0 flex-1" aria-live="polite" aria-atomic="true">
              <p className="truncate text-sm font-semibold">{cart.length ? `${cart.length} article${cart.length > 1 ? "s" : ""}` : "Ticket vide"}</p>
              <p className="text-sm font-bold tabular-nums">{total.toLocaleString("fr-FR")} FCFA</p>
            </div>
            <Button
              type="button"
              className="min-h-12 shrink-0 px-4"
              disabled={!cart.length}
              onClick={() => setMobileCartOpen(true)}
              aria-label={cart.length ? `Voir le ticket, ${cart.length} article${cart.length > 1 ? "s" : ""}, total ${total.toLocaleString("fr-FR")} FCFA` : "Voir le ticket, ticket vide"}
            >
              Voir le ticket
            </Button>
          </div>
        </section>

        <PublicSheet
          open={mobileCartOpen}
          onOpenChange={setMobileCartOpen}
          title="Ticket en cours"
          description={`${cart.length} article${cart.length > 1 ? "s" : ""} · ${total.toLocaleString("fr-FR")} FCFA`}
          closeLabel="Fermer le ticket"
          className="max-h-[92dvh] w-full max-w-none md:hidden"
          contentClassName="overflow-hidden p-0"
        >
          <CartPanel
            cart={cart}
            subtotal={subtotal}
            discountAmount={discountAmount}
            total={total}
            processing={processing}
            canCheckout={
              Boolean(activeCashSession) &&
              cart.length > 0 &&
              !(orderType === "dine-in" && !tableNumber)
            }
            orderType={orderType}
            tableNumber={tableNumber}
            tableLabelPrefix={tableLabelPrefix}
            tables={tables}
            mobileSheet
            sessionInfo={
              <div aria-label="Résumé de session" className="grid grid-cols-3 gap-2">
                <POSFooterCard icon={<Clock3 />} label="Début" value={formatSessionDateTime(activeCashSession.openedAt)} />
                <POSFooterCard icon={<Percent />} label="Remise" value={discountRate > 0 ? `${Math.round(discountRate * 100)}%` : "0%"} />
                <POSFooterCard icon={<UserRound />} label="Caissier" value={staffSnapshot.staffName} />
              </div>
            }
            onOrderTypeChange={handleOrderTypeChange}
            onTableSelect={handleTableSelect}
            onIncrease={increaseCartItem}
            onDecrease={removeFromCart}
            onRemove={(itemId) =>
              setCart((current) =>
                current.filter((item) => !getCartLinesForBundleRemoval(current, itemId).includes(item.id))
              )
            }
            onClear={() => {
              setCart([])
              setDiscountRate(0)
              setCashReceivedInput("")
              setSelectedPaymentMode(null)
              setSelectedMobileMethodCode(null)
            }}
            onHold={handleHoldCart}
            onDiscount={handleApplyDiscount}
            onCheckout={openPaymentDialog}
          />
        </PublicSheet>
      </>
    ) : null}

    <POSPaymentFlow
      open={paymentDialogOpen}
      onOpenChange={(open) => {
        setPaymentDialogOpen(open)
        if (!open) {
          setPaymentFlowError(null)
          setPaymentFlowSuccess(false)
        }
      }}
      total={total}
      paymentMode={selectedPaymentMode}
      onPaymentModeChange={handlePaymentModeChange}
      mobilePaymentMethods={mobilePaymentMethods}
      selectedMobileMethodCode={selectedMobileMethodCode}
      onMobileMethodChange={setSelectedMobileMethodCode}
      cashReceivedInput={cashReceivedInput}
      cashReceivedAmount={cashReceivedAmount}
      onCashReceivedChange={setCashReceivedInput}
      processing={processing}
      success={paymentFlowSuccess}
      error={paymentFlowError}
      canSubmit={
        Boolean(activeCashSession) &&
        cart.length > 0 &&
        Boolean(selectedPaymentMode) &&
        !(selectedPaymentMode === "cash" && cashReceivedInput.trim().length === 0) &&
        !(selectedPaymentMode === "cash" && cashReceivedAmount < total) &&
        !(selectedPaymentMode === "mobile" && !selectedMobileMethodCode) &&
        !(orderType === "dine-in" && !tableNumber)
      }
      onSubmit={submitPayment}
    />

    <CashierOrderDetailDialog
      order={selectedOrderDetail}
      paymentSession={selectedOrderPaymentSession}
      paymentMethods={mobilePaymentMethods}
      tables={tables}
      tableLabelPrefix={tableLabelPrefix}
      processing={processing}
      onClose={() => setSelectedOrderDetailId(null)}
      onPrint={() => {
        if (selectedOrderDetail) queuePrint(selectedOrderDetail, "client")
      }}
      onValidatePayment={() => {
        if (!selectedOrderDetail) return
        selectedOrderPaymentSession
          ? validateTableSessionPayment(selectedOrderPaymentSession)
          : markOrderPaid(selectedOrderDetail)
      }}
      onComplete={() => {
        if (selectedOrderDetail) markOrderCompleted(selectedOrderDetail)
      }}
    />

    <PosSessionClosingDialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen} title="Clôture de caisse" description="Vérifiez le résumé système, saisissez les montants comptés, puis confirmez la fermeture." summary={<div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><CloseAmount label="Espèces attendues" value={closeSessionDiff.systemCash}/><CloseAmount label="Mobile Money" value={closeSessionDiff.systemMobile}/><CloseAmount label="Total session" value={closeSessionDiff.systemTotal} strong/></div>} expectedCash={<div><Label htmlFor="declared-cash">Espèces comptées</Label><Input autoFocus id="declared-cash" inputMode="numeric" type="number" min={0} value={declaredCashInput} onChange={(event) => setDeclaredCashInput(event.target.value)} className="mt-1 min-h-12 text-right text-xl font-bold tabular-nums" aria-invalid={closeSessionDiff.cash !== 0}/></div>} declaredCash={<div><Label htmlFor="declared-mobile">Mobile Money compté</Label><Input id="declared-mobile" inputMode="numeric" type="number" min={0} value={declaredMobileInput} onChange={(event) => setDeclaredMobileInput(event.target.value)} className="mt-1 min-h-12 text-right text-xl font-bold tabular-nums" aria-invalid={closeSessionDiff.mobile !== 0}/></div>} variance={<div className="grid grid-cols-1 gap-3 lg:grid-cols-2"><VarianceCard label="Écart espèces" expected={closeSessionDiff.systemCash} received={declaredCashAmount} variance={closeSessionDiff.cash}/><VarianceCard label="Écart Mobile Money" expected={closeSessionDiff.systemMobile} received={declaredMobileAmount} variance={closeSessionDiff.mobile}/><VarianceCard label="Écart total" expected={closeSessionDiff.systemTotal} received={closeSessionDiff.declaredTotal} variance={closeSessionDiff.total}/></div>} footer={<><Button variant="outline" className="min-h-12" disabled={processing} onClick={() => setCloseDialogOpen(false)}>Annuler</Button><Button className="min-h-12" disabled={processing} onClick={closeMyCashSession}>{processing ? <Loader2 className="mr-2 size-4 animate-spin motion-reduce:animate-none"/> : null}Confirmer clôture</Button></>} />
    </>
  )
}

function CloseAmount({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="rounded-[var(--radius-dashboard-widget)] border border-[var(--pos-border)] bg-[var(--pos-muted)] p-3">
      <p className="text-[10px] font-black uppercase text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-black", strong ? "text-base text-primary" : "text-sm")}>
        {value.toLocaleString("fr-FR")} FCFA
      </p>
    </div>
  )
}

function VarianceCard({ label, expected, received, variance }: { label: string; expected: number; received: number; variance: number }) {
  const state = variance === 0 ? "balanced" : variance > 0 ? "positive" : "negative"
  const stateLabel = variance === 0 ? `${label} · Correct` : variance > 0 ? `${label} · Excédent` : `${label} · Manque`
  return <PosVarianceDisplay label={stateLabel} expected={`${expected.toLocaleString("fr-FR")} FCFA`} received={`${received.toLocaleString("fr-FR")} FCFA`} variance={`${variance.toLocaleString("fr-FR")} FCFA`} state={state} />
}

function POSFooterCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactElement<{ className?: string }>
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex min-h-16 items-center gap-3 rounded-[1.15rem] border border-border/70 bg-card/95 px-3 py-2.5 shadow-[0_10px_26px_rgba(15,23,42,0.07)] ring-1 ring-white/60 dark:ring-white/5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary-soft)] text-[var(--brand-primary)] shadow-sm">
        {React.cloneElement(icon, { className: "h-4 w-4" })}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-0.5 truncate text-sm font-black text-foreground">{value}</p>
      </div>
    </div>
  )
}

function POSMobileOrders({
  activeStatus,
  columns,
  ordersByStatus,
  tableLabelPrefix,
  tables,
  onStatusChange,
  onSelectOrder,
}: {
  activeStatus: string
  columns: Array<{ id: string }>
  ordersByStatus: Record<string, any[]>
  tableLabelPrefix: string
  tables: RestaurantTableRecord[]
  onStatusChange: (status: string) => void
  onSelectOrder: (orderId: string) => void
}) {
  const visibleOrders = ordersByStatus[activeStatus] ?? []
  const activeUi = getPOSColumnUi(activeStatus)

  return (
    <section aria-label="Commandes du point de vente" className="flex h-full min-h-0 flex-col md:hidden">
      <div className="shrink-0 border-b border-[var(--pos-divider)] bg-[var(--pos-canvas)] px-3 pb-2 pt-1">
        <div role="tablist" aria-label="Statut des commandes" className="flex gap-2 overflow-x-auto pb-1">
          {columns.map((column) => {
            const selected = activeStatus === column.id
            const count = ordersByStatus[column.id]?.length ?? 0
            const servedWithOrders = column.id === ORDER_OPERATION_STATUS.SERVED && count > 0
            const label = getMobileOrderTabLabel(column.id)

            return (
              <button
                key={column.id}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="pos-mobile-orders-panel"
                onClick={() => onStatusChange(column.id)}
                className={cn(
                  "dashboard-focus-visible flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-semibold",
                  selected
                    ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-[var(--action-primary-fg)]"
                    : "border-[var(--pos-border)] bg-[var(--pos-panel)] text-[var(--dashboard-title)]"
                )}
              >
                <span>{label}</span>
                <span
                  aria-label={`${count} commande${count > 1 ? "s" : ""}`}
                  className={cn(
                    "flex min-h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums",
                    selected ? "bg-white/20 text-current" : "bg-[var(--pos-muted)]",
                    servedWithOrders && "bg-orange-500 text-white motion-safe:animate-pulse"
                  )}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div
        id="pos-mobile-orders-panel"
        role="tabpanel"
        aria-label={getMobileOrderTabLabel(activeStatus)}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3"
      >
        {visibleOrders.length ? (
          <div className="space-y-3">
            {visibleOrders.map((order: any) => {
              const normalizedType = normalizeOrderType(order.orderType || order.type)
              const tableLabel = formatTableDisplayName({
                name: tables.find((table) => table.id === order.tableId)?.name || order.tableNumber || order.table,
                id: order.tableId,
              }, tableLabelPrefix)
              const locationLabel = getPOSOrderMetaLabel(normalizedType, tableLabel)
              const itemCount = countOrderItems(order)
              const orderTotal = getOrderComputedTotal(order)

              return (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => onSelectOrder(order.id)}
                  className="dashboard-focus-visible block min-h-32 w-full rounded-[var(--radius-dashboard-widget)] border border-[var(--pos-border)] bg-[var(--pos-panel)] p-4 text-left shadow-[var(--shadow-dashboard-surface)] transition-colors hover:border-[var(--brand-primary)]"
                  aria-label={`${getOrderDisplayId(order)}, ${locationLabel}, ${itemCount} article${itemCount > 1 ? "s" : ""}, ${orderTotal.toLocaleString("fr-FR")} FCFA`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-base font-bold">{getOrderDisplayId(order)}</span>
                      <span className="mt-1 block truncate text-sm font-semibold text-[var(--dashboard-subtitle)]">{locationLabel}</span>
                    </span>
                    <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold", activeUi.badgeClass)}>
                      {getMobileOrderTabLabel(activeStatus)}
                    </span>
                  </span>
                  <span className="mt-4 grid grid-cols-[1fr_auto] items-end gap-3">
                    <span>
                      <span className="block text-sm text-[var(--dashboard-muted)]">
                        {itemCount} article{itemCount > 1 ? "s" : ""} · {formatPOSOrderTime(order.createdAt)}
                      </span>
                      <span className="mt-1 block text-lg font-bold tabular-nums">{orderTotal.toLocaleString("fr-FR")} FCFA</span>
                    </span>
                    <span className="text-sm font-semibold text-[var(--brand-primary)]">Voir →</span>
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="flex h-full min-h-72 flex-col items-center justify-center rounded-[var(--radius-dashboard-widget)] border border-dashed border-[var(--pos-border)] bg-[var(--pos-panel)] px-6 text-center">
            <span className={cn("flex size-14 items-center justify-center rounded-full", activeUi.iconClass)}>
              <Inbox aria-hidden="true" className="size-6" />
            </span>
            <p className="mt-4 text-base font-semibold">Aucune commande</p>
            <p className="mt-1 text-sm text-[var(--dashboard-muted)]">{activeUi.emptyText}</p>
          </div>
        )}
      </div>
    </section>
  )
}

function getMobileOrderTabLabel(status: string) {
  if (status === ORDER_OPERATION_STATUS.IN_PREPARATION) return "Préparation"
  if (status === ORDER_OPERATION_STATUS.READY) return "Prêt"
  if (status === ORDER_OPERATION_STATUS.SERVED) return "Servi"
  return "En attente"
}

function formatPOSOrderTime(value: any) {
  const date = value?.toDate?.() ?? (value ? new Date(value) : null)
  if (!date || Number.isNaN(date.getTime())) return "--:--"
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
}

function CashierOrderDetailDialog({
  order,
  paymentSession,
  paymentMethods,
  tables,
  tableLabelPrefix,
  processing,
  onClose,
  onPrint,
  onValidatePayment,
}: {
  order: any | null
  paymentSession: any | null
  paymentMethods: any[]
  tables: RestaurantTableRecord[]
  tableLabelPrefix: string
  processing: boolean
  onClose: () => void
  onPrint: () => void
  onValidatePayment: () => void
  onComplete: () => void
}) {
  if (!order) return null

  const items = Array.isArray(order.items) ? order.items : []
  const groupedItems = groupCashierOrderItems(items)
  const normalizedType = normalizeOrderType(order.orderType || order.type)
  const paymentRequestStatus = paymentSession?.paymentRequest?.status
  const isPaid = isOrderPaid(order) || paymentRequestStatus === "validated"
  const isMobilePayment = isMobileMoneyOrder(order) || paymentSession?.paymentRequest?.method === "mobile"
  const paymentProofSms = getPaymentProofSms(paymentSession, [order])
  const paymentProofSubmittedAt = getPaymentProofSubmittedAt(paymentSession, [order])
  const paymentMethodLabel = getConfiguredPaymentMethodLabel(order, paymentSession, paymentMethods)
  const mobilePaymentNeedsProof = isMobilePayment && !paymentProofSms
  const canValidatePayment =
    !isPaid &&
    !mobilePaymentNeedsProof &&
    (
      paymentRequestStatus === "requested" ||
      paymentRequestStatus === "pending_confirmation" ||
      order.paymentStatus === "pending_verification" ||
      order.paymentStatus === "pending_mobile" ||
      order.paymentStatus === "pending_cash" ||
      order.paymentStatus === "pending"
    )
  const tableLabel = formatTableDisplayName({
    name: tables.find((table) => table.id === order.tableId)?.name || order.tableNumber || order.table,
    id: order.tableId,
  }, tableLabelPrefix)
  const phone = order.customer?.phone || order.customerPhone || order.phoneNumber
  const deliveryAddress = formatDeliveryAddress(order.deliveryAddress)

  return (
    <Dialog open={Boolean(order)} onOpenChange={(open) => {
      if (!open) onClose()
    }}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden p-0">
        <DialogHeader className="border-b px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle>{getOrderDisplayId(order)}</DialogTitle>
              <DialogDescription>
                {getCashierOrderTypeLabel(order)}
                {normalizedType === "dine_in" && tableLabel ? ` · ${tableLabel}` : ""}
              </DialogDescription>
            </div>
            <div className="text-right">
              <p className="text-lg font-black text-primary">
                {getOrderComputedTotal(order).toLocaleString("fr-FR")} FCFA
              </p>
              <p className="text-[10px] font-black uppercase text-muted-foreground">
                {items.length} article(s)
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[64vh] overflow-y-auto px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DetailMeta label="Type" value={getCashierOrderTypeLabel(order)} />
            <DetailMeta label="Paiement" value={formatCashierPaymentStatus(order, paymentSession)} />
            <DetailMeta label="Préparation" value={formatCashierOrderStatus(order)} />
            <DetailMeta label="Mode paiement" value={paymentMethodLabel} />
          </div>

          {(phone || deliveryAddress) ? (
            <div className="mt-3 rounded-lg border bg-muted/30 p-3 text-sm">
              {phone ? <p><span className="font-black">Téléphone:</span> {phone}</p> : null}
              {deliveryAddress ? <p className="mt-1"><span className="font-black">Adresse:</span> {deliveryAddress}</p> : null}
            </div>
          ) : null}

          {isMobilePayment ? (
            <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
              <p className="font-black uppercase">Preuve de paiement</p>
              <div className="mt-2 space-y-1">
                <p><span className="font-black">Moyen :</span> {paymentMethodLabel}</p>
                {paymentProofSubmittedAt ? <p><span className="font-black">Envoyée le :</span> {formatSessionDateTime(paymentProofSubmittedAt)}</p> : null}
              </div>
              {paymentProofSms ? (
                <p className="mt-3 whitespace-pre-wrap break-words rounded-md bg-white/70 p-2 font-semibold">{paymentProofSms}</p>
              ) : (
                <p className="mt-3 rounded-md bg-red-100 p-2 font-black text-red-700">Preuve manquante</p>
              )}
            </div>
          ) : null}

          <div className="mt-5 space-y-5">
            {groupedItems.map((group) => (
              <section key={group.mode} className="space-y-2">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-sm font-black uppercase">{group.label}</h3>
                  <span className="text-xs font-bold text-muted-foreground">{group.items.length} ligne(s)</span>
                </div>

                <div className="space-y-2">
                  {group.items.map((item: any, index: number) => {
                    const quantity = Number(item.quantity ?? 1)
                    const unitPrice = getCashierOrderItemUnitPrice(item)
                    const lineTotal = getCashierOrderItemLineTotal(item)
                    const options = getCashierOrderItemOptions(item)

                    return (
                      <div key={item.id || `${item.productId}-${index}`} className="rounded-lg border bg-card p-3">
                        <div className="grid grid-cols-[auto_1fr_auto] gap-3">
                          <span className="flex h-8 min-w-8 items-center justify-center rounded-md bg-primary/10 px-2 text-sm font-black text-primary">
                            {quantity}x
                          </span>
                          <div className="min-w-0">
                            <p className="break-words text-sm font-black">
                              {item.name || item.nameSnapshot || "Article"}
                            </p>
                            <p className="mt-1 text-[10px] font-bold uppercase text-muted-foreground">
                              {getPreparationModeLabel(group.mode)}
                            </p>
                            {options.length > 0 ? (
                              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                                {options.map((option, optionIndex) => (
                                  <li key={`${option}-${optionIndex}`}>- {option}</li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold text-muted-foreground">
                              {unitPrice.toLocaleString("fr-FR")} FCFA
                            </p>
                            <p className="mt-1 text-sm font-black">
                              {lineTotal.toLocaleString("fr-FR")} FCFA
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>

        <DialogFooter className="border-t px-5 py-4">
          <Button variant="outline" onClick={onClose}>Fermer</Button>
          <Button variant="outline" onClick={onPrint}>Réimprimer ticket</Button>
          {!isPaid ? (
            <Button disabled={processing || !canValidatePayment} onClick={onValidatePayment}>
              {isMobilePayment ? "Valider paiement" : "Encaisser"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DetailMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-[10px] font-black uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-black">{value}</p>
    </div>
  )
}

function normalizeMoneyInput(value: string) {
  const amount = Math.round(Number(value || 0))
  return Number.isFinite(amount) && amount > 0 ? amount : 0
}

function groupCashierOrderItems(items: any[]) {
  const groups = [
    { mode: "kitchen" as const, label: "Cuisine", items: [] as any[] },
    { mode: "direct" as const, label: "Service direct", items: [] as any[] },
    { mode: "bar" as const, label: "Bar / Comptoir", items: [] as any[] },
  ]
  const groupByMode = new Map(groups.map((group) => [group.mode, group]))

  items.forEach((item) => {
    const mode = getEffectivePreparationMode({
      preparationMode: item.preparationMode,
      categoryName: item.categoryName,
    })
    groupByMode.get(mode)?.items.push(item)
  })

  return groups.filter((group) => group.items.length > 0)
}

function getPreparationModeLabel(mode: "kitchen" | "direct" | "bar") {
  if (mode === "direct") return "Service direct"
  if (mode === "bar") return "Bar / Comptoir"
  return "Cuisine"
}

function getCashierOrderItemUnitPrice(item: any) {
  const unitPrice = Number(item.priceSnapshot ?? item.price ?? item.unitPrice ?? 0)
  return Number.isFinite(unitPrice) ? Math.round(unitPrice) : 0
}

function getCashierOrderItemLineTotal(item: any) {
  const explicitTotal = Number(item.total ?? item.subtotal)
  if (Number.isFinite(explicitTotal) && explicitTotal > 0) return Math.round(explicitTotal)

  return getCashierOrderItemUnitPrice(item) * Number(item.quantity ?? 1)
}

function getCashierOrderItemOptions(item: any) {
  const options: string[] = []

  if (item.variant) {
    options.push(`Variante: ${typeof item.variant === "string" ? item.variant : item.variant.name || item.variant.label || "sélectionnée"}`)
  }

  if (item.linkedGroupTitle) {
    options.push(`Option liée: ${item.linkedGroupTitle}`)
  }

  if (Array.isArray(item.selectedOptions)) {
    item.selectedOptions.forEach((option: any) => {
      const optionName = option.optionName || option.name || "Option"
      const choiceName = option.choiceName || option.label || option.value
      const price = Number(option.price ?? 0)
      options.push(`${optionName}: ${choiceName || "sélection"}${price > 0 ? ` (+${price.toLocaleString("fr-FR")} FCFA)` : ""}`)
    })
  }

  if (Array.isArray(item.addons)) {
    item.addons.forEach((addon: any) => {
      const name = addon.name || addon.label || addon
      const price = Number(addon.price ?? 0)
      options.push(`Supplément: ${name}${price > 0 ? ` (+${price.toLocaleString("fr-FR")} FCFA)` : ""}`)
    })
  }

  if (item.selectedOptionsText) {
    options.push(String(item.selectedOptionsText))
  }

  return options
}

function formatCashierPaymentStatus(order: any, paymentSession: any | null) {
  const paymentRequestStatus = paymentSession?.paymentRequest?.status
  if (isOrderPaid(order) || paymentRequestStatus === "validated") return "Payé"
  if (paymentRequestStatus === "pending_confirmation") return "Confirmation client"
  if (paymentRequestStatus === "requested") return "Paiement demandé"
  if (order.paymentStatus === "pending_mobile") return "Mobile en attente"
  if (order.paymentStatus === "pending_cash") return "Cash à encaisser"
  if (order.paymentStatus === "pending_verification") return "À vérifier"
  if (order.paymentStatus === "unpaid") return "Non payé"
  return order.paymentStatus || "Non défini"
}

function formatDeliveryAddress(value: any) {
  if (!value) return ""
  if (typeof value === "string") return value

  return [
    value.label,
    value.street,
    value.address,
    value.city,
    value.zone,
  ].filter(Boolean).join(", ")
}

// Compact closed session panel
function ClosedCashSessionPanel({
  pending,
  pendingValidation,
  requesting,
  approvalMode,
  onRequest,
}: {
  pending: boolean
  pendingValidation: boolean
  requesting: boolean
  approvalMode: "required" | "optional"
  onRequest: () => void
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-2">
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-full bg-red-100 flex items-center justify-center">
          <Banknote className="h-3.5 w-3.5 text-red-600" />
        </div>
        <div>
          <p className="text-xs font-black">{pendingValidation ? "Session clôturée" : "Caisse fermée"}</p>
          <p className="text-[9px] text-muted-foreground">
            {pendingValidation
              ? "En attente de validation manager"
              : pending
                ? "Demande en attente"
                : approvalMode === "optional"
                  ? "Ouvrez pour vendre"
                  : "Demandez ouverture"}
          </p>
        </div>
      </div>
      <Button
        size="sm"
        className="h-7 px-3 text-[10px] font-bold"
        disabled={pending || pendingValidation || requesting}
        onClick={onRequest}
      >
        {requesting ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : pendingValidation ? (
          "Validation"
        ) : pending ? (
          "En attente"
        ) : (
          "Ouvrir"
        )}
      </Button>
    </div>
  )
}

function getCashierOrderTypeLabel(order: any) {
  const type = order.orderType || (order.type === "table" ? "dine_in" : order.type)
  if (type === "dine_in") return "Sur place"
  if (type === "delivery") return "Livraison"
  return "À emporter"
}

function calculateSessionTotals(orders: any[], sessionId: string) {
  return orders.reduce(
    (totals, order) => {
      if (order.cashSessionId !== sessionId || !isOrderPaid(order)) return totals

      const amount = getOrderComputedTotal(order)
      const isMobile =
        order.paymentType === "mobile" ||
        Boolean(order.paymentMethod && order.paymentMethod !== "cash")

      if (isMobile) {
        totals.totalMobile += amount
      } else {
        totals.totalCash += amount
      }

      totals.totalOrders += 1
      return totals
    },
    { totalCash: 0, totalMobile: 0, totalOrders: 0 }
  )
}

function isMobileMoneyOrder(order: any) {
  return (
    order.paymentMethod === "mobile_money" ||
    order.paymentType === "mobile" ||
    order.paymentType === "mobile_money" ||
    order.paymentIntentStatus === "submitted" ||
    Boolean(order.paymentMethod && order.paymentMethod !== "cash")
  )
}

function getPaymentSessionForOrder(order: any, tableSessions: any[]) {
  const sessionId = order?.tableSessionId || order?.sessionId
  if (!sessionId) return null

  return tableSessions.find((session) => session.id === sessionId) ?? null
}

function getPaymentProofSms(paymentSession: any | null, orders: any[]) {
  const sessionProof = paymentSession?.paymentRequest?.paymentProofSms
  if (typeof sessionProof === "string" && sessionProof.trim()) return sessionProof.trim()

  const orderWithProof = orders.find((order: any) => {
    return typeof order?.paymentProofSms === "string" && order.paymentProofSms.trim()
  })

  return orderWithProof?.paymentProofSms?.trim() || ""
}

function getPaymentProofSubmittedAt(paymentSession: any | null, orders: any[]) {
  if (paymentSession?.paymentRequest?.paymentProofSubmittedAt) {
    return paymentSession.paymentRequest.paymentProofSubmittedAt
  }

  const orderWithProofDate = orders.find((order: any) => order?.paymentProofSubmittedAt)
  return orderWithProofDate?.paymentProofSubmittedAt ?? null
}

function getConfiguredPaymentMethodLabel(order: any, paymentSession: any | null, paymentMethods: any[]) {
  const sessionProvider = paymentSession?.paymentRequest?.provider
  if (sessionProvider && sessionProvider !== "mobile_money") return formatCashierPaymentMethod(sessionProvider)

  const code =
    order?.paymentMethodCode ||
    order?.paymentProvider ||
    order?.paymentMethod ||
    paymentSession?.paymentRequest?.provider ||
    paymentSession?.paymentRequest?.method

  const configuredMethod = paymentMethods.find((method: any) => {
    return method.code === code || method.methodCode === code || method.name === code
  })

  if (configuredMethod?.name) return configuredMethod.name
  return formatCashierPaymentMethod(code)
}

function buildServedTableSessionGroups(orders: any[], tableSessions: any[], tables: RestaurantTableRecord[], tableLabelPrefix: string) {
  const groups = new Map<string, any>()

  orders.forEach((order: any) => {
    const sessionId = order?.tableSessionId || order?.sessionId || `order:${order?.id}`
    const paymentSession = tableSessions.find((session: any) => session.id === sessionId) ?? null
    const tableId = paymentSession?.tableId || order?.tableId || null
    const tableLabel = formatTableDisplayName({
      name: tables.find((table) => table.id === tableId)?.name || paymentSession?.tableNumber || paymentSession?.tableName || order?.tableNumber || order?.table,
      id: tableId,
    }, tableLabelPrefix)

    if (!groups.has(sessionId)) {
      groups.set(sessionId, {
        id: sessionId,
        paymentSession,
        tableLabel,
        orders: [],
        orderCount: 0,
        itemCount: 0,
        totalAmount: 0,
      })
    }

    const group = groups.get(sessionId)
    group.paymentSession = group.paymentSession || paymentSession
    group.tableLabel = group.tableLabel || tableLabel
    group.orders.push(order)
    group.orderCount += 1
    group.itemCount += countOrderItems(order)
    group.totalAmount += getOrderComputedTotal(order)
  })

  return Array.from(groups.values()).sort((a: any, b: any) => {
    const timeA = Math.max(...a.orders.map((order: any) => order.createdAt?.toMillis?.() || 0))
    const timeB = Math.max(...b.orders.map((order: any) => order.createdAt?.toMillis?.() || 0))
    return timeB - timeA
  })
}

function countOrderItems(order: any) {
  const items = Array.isArray(order?.items) ? order.items : []
  return items.reduce((sum: number, item: any) => sum + Number(item.quantity ?? 1), 0)
}

function summarizeCashierOrderItems(order: any) {
  const items = Array.isArray(order?.items) ? order.items : []
  if (items.length === 0) return "Aucun produit"

  const visibleItems = items.slice(0, 3)
  const summary = visibleItems
    .map((item: any) => `${Number(item.quantity ?? 1)}x ${item.name || item.nameSnapshot || "Article"}`)
    .join(", ")
  const hiddenCount = Math.max(0, items.length - visibleItems.length)

  return hiddenCount > 0 ? `${summary}, + ${hiddenCount} article(s)` : summary
}

function getPOSColumnUi(status: string) {
  return POS_COLUMN_UI[status as keyof typeof POS_COLUMN_UI] ?? POS_COLUMN_UI.pending
}

function getPOSOrderMetaLabel(type: string, tableLabel?: string | null) {
  if (type === "dine_in") return `Sur place${tableLabel ? ` • ${tableLabel}` : ""}`
  if (type === "delivery") return "Livraison"
  return "A emporter"
}

function formatPOSOrderDateTime(value: any) {
  const date = value?.toDate?.() ?? (value ? new Date(value) : null)
  if (!date || Number.isNaN(date.getTime())) return "-"

  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function usePOSProductsPerPage() {
  const [productsPerPage, setProductsPerPage] = React.useState(10)
  const [isPhoneViewport, setIsPhoneViewport] = React.useState(false)

  React.useEffect(() => {
    const updateProductsPerPage = () => {
      const width = window.innerWidth
      setIsPhoneViewport(width < 768)
      if (width >= 1440) {
        setProductsPerPage(12)
      } else if (width >= 1180) {
        setProductsPerPage(10)
      } else if (width >= 1024) {
        setProductsPerPage(8)
      } else {
        const columns = width >= 768 ? 3 : 2
        setProductsPerPage(columns * POS_PRODUCT_ROWS_PER_PAGE)
      }
    }

    updateProductsPerPage()
    window.addEventListener("resize", updateProductsPerPage)
    return () => {
      window.removeEventListener("resize", updateProductsPerPage)
    }
  }, [])

  return { isPhoneViewport, productsPerPage }
}

function formatSessionDateTime(value: any) {
  const date = value?.toDate?.() ?? (value ? new Date(value) : null)
  if (!date) return "-"
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatCashierPaymentMethod(method?: string | null) {
  if (!method) return "Non définie"
  if (method === "cash") return "Espèces"
  if (method === "orange_money") return "Orange"
  if (method === "mtn_money") return "MTN"
  if (!method) return "Non définie"
  if (method === "cash") return "Espèces"
  if (method === "orange_money") return "Orange"
  if (method === "mtn_money") return "MTN"
  if (method === "wave") return "Wave"
  if (method === "mobile") return "Mobile Money"
  return method
}

function formatCashierOrderStatus(order: any) {
  return kitchenStatusLabel(order.kitchenStatus ?? order.status)
}

function getPOSOperationStatus(order: any) {
  if (!order?.kitchenStatus && order?.id && !warnedMissingKitchenStatusOrders.has(order.id)) {
    warnedMissingKitchenStatusOrders.add(order.id)
    console.warn("Missing kitchenStatus", order?.id)
  }

  return orderStatusFromKitchenStatus(order?.kitchenStatus ?? order?.status)
}

function isPOSCollectionCandidate(order: any) {
  if (isOrderPaid(order)) return false

  const status = getPOSOperationStatus(order)
  return (
    status === ORDER_OPERATION_STATUS.SERVED ||
    status === ORDER_OPERATION_STATUS.PICKED_UP ||
    order.paymentStatus === "pending_cash" ||
    order.paymentStatus === "pending_mobile" ||
    order.paymentStatus === "pending_verification"
  )
}

export function getOrderComputedTotal(order: any) {
  if (Array.isArray(order.items) && order.items.length > 0) {
    return order.items.reduce((sum: number, item: any) => sum + (Number(item.priceSnapshot ?? item.price ?? item.unitPrice ?? 0) * Number(item.quantity ?? 1)), 0)
  }
  return order.totalAmount ?? order.total ?? 0
}
