"use client"

import * as React from "react"
import { addDoc, arrayUnion, collection, doc, getDocs, limit, query, serverTimestamp, updateDoc, where, writeBatch } from "firebase/firestore"
import { signOut } from "firebase/auth"
import { useSearchParams, useRouter } from "next/navigation"
import { useCollection, useDoc, useFirestore, useMemoFirebase, useAuth } from "@/firebase"
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
import { PosCatalog, PosSearchField, PosSessionClosingDialog, PosVarianceDisplay } from "@/components/pos-ui"
import { PublicSheet } from "@/components/public-ui"
import { useToast } from "@/hooks/use-toast"
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
  aggregateFinancialEntries,
  type FinancialLedgerEntry,
} from "@/lib/finance/payment-ledger-domain"
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
import { PreparationIssuesAlert } from "@/modules/preparation/PreparationIssuesAlert"
import {
  processOrderPaymentTransaction,
  releaseOrderTableIfNeeded,
} from "@/services/pos-security.service"
import {
  getConfiguredCartItemId,
  recalculateConfiguredUnitPrice,
} from "@/lib/order-pricing"
import { buildSelectionOptionsFromComponents } from "@/lib/product-components"
import { useRestaurant } from "@/design-system/context/RestaurantContext"
import { useTenant } from "@/design-system/context/TenantProvider"
import { CatalogProvider, useCatalog } from "@/modules/catalog/CatalogProvider"
import { useRestaurantLiveData } from "@/modules/restaurant-live/RestaurantLiveDataProvider"
import { markOrderItemAsServedAndDeductStock } from "@/modules/stock/automatic-simple/infrastructure/mark-order-item-served"
import { usePosStockAvailability } from "@/modules/stock/use-pos-stock-availability"
import {
  createCanonicalPosOrder,
  confirmTableSessionPayment,
  executePosCommand,
  getCanonicalMobileMoneyProvider,
  getCanonicalPaymentAmount,
  isPosCollectionCandidate,
  posCommandIdempotencyKey,
  resolvePosOrderColumn,
  resolvePosCanonicalMode,
  useCanonicalPosOrders,
} from "@/modules/pos/canonical"
import { closeCashSessionV2, openCashSession } from "@/modules/pos/canonical/cash-session-command-client"
import { DEFAULT_POS_STATION, isProductAllowedAtPosStation, resolvePaymentBalances, resolvePosStation, resolveStaffDefaultPosStationId, resolveStaffPosStationIds } from "@/lib/pos-stations"
import { resolveStaffDisplayName } from "@/lib/staff-identity"
import type { SelectedCartOption } from "@/modules/restaurant/types"
import {
  productUnavailableMessage,
  resolveEffectiveProductAvailability,
} from "@/lib/product-availability"
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
  getPreparationModeLabel,
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
    payments,
    tableSessions,
    tables: liveTables,
  } = useRestaurantLiveData()
  const { toast } = useToast()
  const stationsQuery = useMemoFirebase(() => db && restaurantId
    ? query(collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, "posStations"), limit(100))
    : null, [db, restaurantId])
  const staffRef = useMemoFirebase(() => db && restaurantId && user?.uid
    ? doc(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, "staff", user.uid)
    : null, [db, restaurantId, user?.uid])
  const stationsResult = useCollection<any>(stationsQuery)
  const staffResult = useDoc<any>(staffRef)
  const configuredStations = React.useMemo(() => (stationsResult.data || []).map((station: any) => resolvePosStation(station)), [stationsResult.data])
  const allowedStationIds = React.useMemo(() => resolveStaffPosStationIds(staffResult.data || profile), [profile, staffResult.data])
  const allowedStations = React.useMemo(() => allowedStationIds.map((stationId) => stationId === "DEFAULT" ? { ...DEFAULT_POS_STATION } : configuredStations.find((station) => station.id === stationId)).filter((station): station is NonNullable<typeof station> => Boolean(station?.isActive)), [allowedStationIds, configuredStations])
  const [selectedPosStationId, setSelectedPosStationId] = React.useState("")
  React.useEffect(() => {
    if (selectedPosStationId && allowedStations.some((station) => station.id === selectedPosStationId)) return
    const preferred = resolveStaffDefaultPosStationId(staffResult.data || profile)
    setSelectedPosStationId(allowedStations.find((station) => station.id === preferred)?.id || allowedStations[0]?.id || "DEFAULT")
  }, [allowedStations, profile, selectedPosStationId, staffResult.data])
  const safeProducts = React.useMemo(() => Array.isArray(products) ? products : [], [products])
  const previousAvailabilityRef = React.useRef<Map<string, string> | null>(null)
  React.useEffect(() => {
    const next = new Map(safeProducts.map((product: any) => [product.id, resolveEffectiveProductAvailability(product).operationalState]))
    const previous = previousAvailabilityRef.current
    if (previous) {
      safeProducts.forEach((product: any) => {
        const state = next.get(product.id)
        if (previous.get(product.id) === "AVAILABLE" && (state === "SOLD_OUT" || state === "PAUSED")) {
          toast({
            title: state === "SOLD_OUT" ? "Produit épuisé" : "Produit mis en pause",
            description: `${product.name} ne peut plus être ajouté au ticket.`,
            variant: "destructive",
          })
        }
      })
    }
    previousAvailabilityRef.current = next
  }, [safeProducts, toast])
  const safeCategories = React.useMemo(() => Array.isArray(categories) ? categories : [], [categories])
  const legacyActiveOrders = React.useMemo(() => Array.isArray(activeOrders) ? activeOrders : [], [activeOrders])
  const posCanonicalMode = resolvePosCanonicalMode(restaurantId ?? "")
  const canonicalPos = useCanonicalPosOrders({
    restaurantId: restaurantId ?? "",
    enabled: posCanonicalMode !== "legacy",
    parentOrders: legacyActiveOrders,
  })
  const safeActiveOrders = React.useMemo(
    () => posCanonicalMode === "canonical" ? canonicalPos.orders : legacyActiveOrders,
    [canonicalPos.orders, legacyActiveOrders, posCanonicalMode]
  )
  React.useEffect(() => {
    if (posCanonicalMode !== "compare" || process.env.NODE_ENV === "production") return
    const legacyLineCount = legacyActiveOrders.reduce(
      (total, order: any) => total + (Array.isArray(order.items) ? order.items.length : 0),
      0
    )
    if (legacyLineCount !== canonicalPos.items.length) {
      console.warn("POS_CANONICAL_COMPARE_MISMATCH", {
        restaurantId,
        legacyLineCount,
        canonicalLineCount: canonicalPos.items.length,
      })
    }
  }, [canonicalPos.items.length, legacyActiveOrders, posCanonicalMode, restaurantId])
  const safeCashSessionRequests = React.useMemo(
    () => Array.isArray(cashSessionRequests) ? cashSessionRequests : [],
    [cashSessionRequests]
  )
  const safeCashSessions = React.useMemo(() => Array.isArray(cashSessions) ? cashSessions : [], [cashSessions])
  const safePayments = React.useMemo(() => Array.isArray(payments) ? payments : [], [payments])
  const safeTableSessions = React.useMemo(() => Array.isArray(tableSessions) ? tableSessions : [], [tableSessions])
  const safeTables = React.useMemo(() => Array.isArray(liveTables) ? liveTables : [], [liveTables])
  const { availabilityByProduct: stockByProduct } = usePosStockAvailability(
    restaurantId,
    safeProducts
  )
  
  const [cart, setCart] = React.useState<any[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<string | null>(null)
  const [orderType, setOrderType] = React.useState<"dine-in" | "takeaway">("takeaway")
  const [tableNumber, setTableNumber] = React.useState<string | null>(null)
  const [processing, setProcessing] = React.useState(false)
  const [pendingOrderActionIds, setPendingOrderActionIds] = React.useState<Set<string>>(() => new Set())
  const pendingOrderActionIdsRef = React.useRef<Set<string>>(new Set())
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
  const checkoutLockRef = React.useRef(false)
  const closeSessionLockRef = React.useRef(false)
  const [closeDialogOpen, setCloseDialogOpen] = React.useState(false)
  const [selectedOrderDetailId, setSelectedOrderDetailId] = React.useState<string | null>(null)
  const [mobileOrderStatus, setMobileOrderStatus] = React.useState<string>(ORDER_OPERATION_STATUS.PENDING)
  const [showAllCompletedOrders, setShowAllCompletedOrders] = React.useState(false)
  const [declaredCashInput, setDeclaredCashInput] = React.useState("")
  const [retainedFloatInput, setRetainedFloatInput] = React.useState("")
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
  const [productSearch, setProductSearch] = React.useState("")

  const tables = safeTables as RestaurantTableRecord[]
  const tableLabelPrefix = getRestaurantTableDisplayPrefix(restaurant)
  const initialTableId = searchParams?.get("tableId")
  const activeCashSession = React.useMemo(() => {
    return safeCashSessions.find((session: any) => {
      const sessionUserId = session.userId || session.cashierId
      return sessionUserId === user?.uid && session.status === "open"
    }) ?? null
  }, [safeCashSessions, user?.uid])
  const stationProducts = React.useMemo(
    () => activeCashSession
      ? safeProducts.filter((product: any) => isProductAllowedAtPosStation(activeCashSession, product))
      : safeProducts,
    [activeCashSession, safeProducts]
  )
  const stationCategoryIds = React.useMemo(
    () => new Set(stationProducts.map((product: any) => String(product.categoryId || "")).filter(Boolean)),
    [stationProducts]
  )
  const stationCategories = React.useMemo(
    () => safeCategories.filter((category: any) => stationCategoryIds.has(category.id)),
    [safeCategories, stationCategoryIds]
  )
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
      staffName: resolveStaffDisplayName(staffResult.data || profile?.staffProfile || profile, user, "Caissier"),
      staffPhone: profile?.telephone || profile?.phone || null,
    }
  }, [profile, staffResult.data, user])
  const posColumns = React.useMemo(() => [
    { id: ORDER_OPERATION_STATUS.PENDING, color: "border-amber-500" },
    { id: ORDER_OPERATION_STATUS.IN_PREPARATION, color: "border-blue-500" },
    { id: ORDER_OPERATION_STATUS.READY, color: "border-primary" },
    { id: ORDER_OPERATION_STATUS.SERVED, color: "border-indigo-500" },
    { id: ORDER_OPERATION_STATUS.COMPLETED, color: "border-zinc-500" },
  ], [])

  const posVisibleOrders = React.useMemo(() => {
    const productImages = new Map(
      safeProducts.map((product: any) => [
        String(product.id),
        product.imageUrl || product.image || product.photoUrl || null,
      ])
    )
    return safeActiveOrders
      .filter((order: any) => {
        return isPosCollectionCandidate(
          order,
          getPOSOperationStatus(order),
          activeCashSession?.id
        )
      })
      .map((order: any) => ({
        ...order,
        items: Array.isArray(order.items)
          ? order.items.map((item: any) => ({
              ...item,
              imageUrl:
                item.imageUrl ||
                item.imageSnapshot ||
                productImages.get(String(item.productId ?? "")) ||
                null,
            }))
          : order.items,
      }))
  }, [activeCashSession?.id, safeActiveOrders, safeProducts])
  const collectingOrder = React.useMemo(() => {
    if (!collectingOrderId) return null
    return posVisibleOrders.find((order: any) => order.id === collectingOrderId) ?? null
  }, [collectingOrderId, posVisibleOrders])

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
      const status = resolvePosOrderColumn(order, orderStatus)

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

  const pendingOrderCount = posOrders[ORDER_OPERATION_STATUS.PENDING]?.length ?? 0

  const selectedOrderDetail = React.useMemo(() => {
    if (!selectedOrderDetailId) return null
    return posVisibleOrders.find((order: any) => order.id === selectedOrderDetailId) ?? null
  }, [posVisibleOrders, selectedOrderDetailId])
  const selectedOrderPaymentSession = React.useMemo(() => {
    if (!selectedOrderDetail) return null
    return getPaymentSessionForOrder(selectedOrderDetail, safeTableSessions)
  }, [safeTableSessions, selectedOrderDetail])
  const startOrderAction = React.useCallback((id: string) => {
    pendingOrderActionIdsRef.current.add(id)
    setPendingOrderActionIds(new Set(pendingOrderActionIdsRef.current))
  }, [])
  const finishOrderAction = React.useCallback((id: string) => {
    pendingOrderActionIdsRef.current.delete(id)
    setPendingOrderActionIds(new Set(pendingOrderActionIdsRef.current))
  }, [])

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
    let filtered = stationProducts.filter((p: any) => p.isActive !== false)
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
  }, [productSearch, selectedCategoryId, stationProducts])

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

  const addToCart = React.useCallback((product: any) => {
    if (!product?.id) return
    if (activeCashSession && !isProductAllowedAtPosStation(activeCashSession, product)) {
      toast({ variant: "destructive", title: "Produit non vendu", description: `${product.name || "Ce produit"} n’est pas vendu par cette caisse.` })
      return
    }
    const operationalAvailability = resolveEffectiveProductAvailability(product)
    if (!operationalAvailability.orderable) {
      toast({
        variant: "destructive",
        title: operationalAvailability.operationalState === "SOLD_OUT" ? "Produit épuisé" : "Produit indisponible",
        description: productUnavailableMessage(product.name || "Ce produit", operationalAvailability.operationalState),
      })
      return
    }
    if ((stockByProduct.get(product.id)?.quantity ?? 1) <= 0) {
      toast({
        variant: "destructive",
        title: "Rupture de stock",
        description: `${product.name || "Ce produit"} ne peut pas être ajouté.`,
      })
      return
    }

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
  }, [activeCashSession, safeCategories, stockByProduct, toast, turboMode])

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
  const unavailableCartItems = React.useMemo(() => {
    const productById = new Map(safeProducts.map((product: any) => [product.id, product]))
    return cart.flatMap((item: any) => {
      const product = productById.get(item.productId ?? item.id)
      if (!product) return [{ id: item.id, message: `${item.name} n'est plus disponible.` }]
      const availability = resolveEffectiveProductAvailability(product)
      return availability.orderable ? [] : [{
        id: item.id,
        message: productUnavailableMessage(item.name, availability.operationalState),
      }]
    })
  }, [cart, safeProducts])
  const hasUnavailableCartItems = unavailableCartItems.length > 0
  const discountAmount = Math.round(subtotal * discountRate)
  const total = Math.max(0, subtotal - discountAmount)
  const cashReceivedAmount = React.useMemo(() => normalizeMoneyInput(cashReceivedInput), [cashReceivedInput])
  const authoritativeSessionAggregate = React.useMemo(() => {
    if (!activeCashSession?.id) return null
    const entries = safePayments.filter((payment: any) => payment.sessionId === activeCashSession.id)
    if (entries.length === 0) return null
    return aggregateFinancialEntries(entries as FinancialLedgerEntry[])
  }, [activeCashSession?.id, safePayments])
  const sessionPaidTotal = React.useMemo(() => {
    if (!activeCashSession?.id) return 0

    return Number(
      authoritativeSessionAggregate?.totalConfirmed ??
      activeCashSession.totalConfirmed ??
      Number(activeCashSession.totalCash || 0) + Number(activeCashSession.totalMobile || 0)
    )
  }, [activeCashSession, authoritativeSessionAggregate])

  const sessionCalculatedTotals = React.useMemo(() => {
    if (!activeCashSession?.id) {
      return { totalCash: 0, totalMobile: 0, totalOrders: 0 }
    }

    return {
      totalCash: Number(authoritativeSessionAggregate?.totalCash ?? activeCashSession.totalCash ?? 0),
      totalMobile: Number(authoritativeSessionAggregate?.totalMobileMoney ?? activeCashSession.totalMobile ?? 0),
      totalOrders: Number(authoritativeSessionAggregate?.totalOrders ?? activeCashSession.totalOrders ?? 0),
    }
  }, [activeCashSession, authoritativeSessionAggregate])
  const declaredCashAmount = React.useMemo(() => normalizeMoneyInput(declaredCashInput), [declaredCashInput])
  const retainedFloatAmount = React.useMemo(() => normalizeMoneyInput(retainedFloatInput), [retainedFloatInput])
  const closeSessionDiff = React.useMemo(() => {
    const openingBalance = Number(activeCashSession?.openingBalance || 0)
    const systemCash = openingBalance + sessionCalculatedTotals.totalCash
    const systemMobile = sessionCalculatedTotals.totalMobile
    const systemTotal = systemCash + systemMobile
    const paymentBalanceRows = buildPaymentBalanceRows(
      activeCashSession?.openingPaymentBalances,
      authoritativeSessionAggregate?.totalsByProvider ?? activeCashSession?.totalsByProvider,
      mobilePaymentMethods,
      safePayments,
      activeCashSession?.id
    )

    return {
      openingBalance,
      systemCash,
      systemMobile,
      systemTotal,
      paymentBalanceRows,
      cash: declaredCashAmount - systemCash,
      expectedHandover: Math.max(0, declaredCashAmount - retainedFloatAmount),
    }
  }, [activeCashSession?.id, activeCashSession?.openingBalance, activeCashSession?.openingPaymentBalances, activeCashSession?.totalsByProvider, authoritativeSessionAggregate?.totalsByProvider, declaredCashAmount, mobilePaymentMethods, retainedFloatAmount, safePayments, sessionCalculatedTotals])

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
    const selectedProductIds = new Set([
      configProduct.id,
      ...configLinkedSelections.map((selection) => selection.productId),
    ])
    const unavailableSelection = safeProducts.find((product: any) =>
      selectedProductIds.has(product.id) && !resolveEffectiveProductAvailability(product).orderable
    )
    if (unavailableSelection) {
      const availability = resolveEffectiveProductAvailability(unavailableSelection)
      setConfigValidationError(productUnavailableMessage(unavailableSelection.name, availability.operationalState))
      return
    }
    const forbiddenSelection = safeProducts.find((product: any) =>
      selectedProductIds.has(product.id) && activeCashSession && !isProductAllowedAtPosStation(activeCashSession, product)
    )
    if (forbiddenSelection) {
      setConfigValidationError(`${forbiddenSelection.name} n’est pas vendu par cette caisse.`)
      return
    }

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

  const handleCheckout = async (method?: "cash" | "mobile") => {
    if (!db || !restaurantId || !user || cart.length === 0 || processing || checkoutLockRef.current) return false
    if (hasUnavailableCartItems) {
      toast({
        variant: "destructive",
        title: "Ticket à corriger",
        description: `${unavailableCartItems[0].message} Retirez ce produit avant de confirmer.`,
      })
      return false
    }

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
          instructions: item.instructions ?? item.note ?? item.notes ?? item.specialInstructions ?? null,
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

      const canonicalCreateKey = posCommandIdempotencyKey([
        "pos-create",
        restaurantId,
        user.uid,
        Date.now(),
      ])
      // All POS presentation modes use the canonical write boundary. The legacy
      // flag now affects reads/comparison only and can no longer restore the
      // direct Firestore creation path.
      const canonicalCreation = await createCanonicalPosOrder({
            user,
            restaurantId,
            idempotencyKey: canonicalCreateKey,
            body: {
              schemaVersion: 1,
              channel: "pos",
              serviceMode: orderType === "dine-in" ? "dine_in" : "takeaway",
              clientRequestId: canonicalCreateKey,
              items: recalculatedItems.map((item) => ({
                clientLineId: item.id,
                productId: item.productId,
                quantity: item.quantity,
                options: (item.selectedOptions ?? []).map((option: any) => ({
                  optionName: option.optionName,
                  choiceName: option.choiceName,
                })),
                instructions: item.instructions?.trim?.() || null,
              })),
              tableContext: orderType === "dine-in"
                ? {
                    tableId: orderData.tableId,
                    tableSessionId: orderData.tableSessionId,
                    capability: null,
                  }
                : null,
              customer: null,
              delivery: null,
              cashSessionId: activeCashSession.id,
              notes: null,
            },
          })
      const orderId = canonicalCreation.orderId
      const isDineInCreation = orderType === "dine-in"
      const printableOrder: PrintableOrder = {
        ...orderData,
        id: orderId,
        total,
        totalAmount: total,
        paymentMethod: isDineInCreation ? null : method === "mobile" ? selectedMobileConfig?.code : "cash",
        paymentStatus: isDineInCreation ? ORDER_PAYMENT_STATUS.UNPAID : ORDER_PAYMENT_STATUS.PAID,
        kitchenStatus: requiresKitchen ? ORDER_OPERATION_STATUS.PENDING : ORDER_OPERATION_STATUS.READY,
        orderStatus: requiresKitchen ? ORDER_OPERATION_STATUS.PENDING : ORDER_OPERATION_STATUS.READY,
        createdAt: new Date(),
      }

      if (!isDineInCreation) {
        await executePosCommand({
        user,
        restaurantId,
        orderId,
        command: "CONFIRM_ORDER_PAYMENT",
        payload: {
          expectedPaymentVersion: 1,
          expectedAmount: Number(canonicalCreation?.total ?? total),
          receivedAmount: method === "cash"
            ? Math.max(cashReceivedAmount, Number(canonicalCreation?.total ?? total))
            : Number(canonicalCreation?.total ?? total),
          method: method === "cash" ? "cash" : "mobile_money",
          provider: method === "mobile" ? selectedMobileConfig?.code ?? null : null,
          paymentAccountId: method === "mobile" ? selectedMobileConfig?.paymentAccountId ?? null : null,
          externalReference: mobilePaymentCode,
          cashSessionId: activeCashSession.id,
          idempotencyKey: posCommandIdempotencyKey([
            "pos-payment",
            orderId,
            1,
            method,
          ]),
        },
        })
        console.info("[DIRECT][PAYMENT_CONFIRMED]", {
        restaurantId,
        orderId,
        requiresKitchen,
        directItems: recalculatedItems
          .filter((item) => item.preparationMode === "direct")
          .map((item) => ({
            orderItemId: item.id,
            productId: item.productId,
            quantity: item.quantity,
            status: item.status,
          })),
        stockEngineCalled: false,
        })
      }

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
      toast(isDineInCreation
        ? { title: "Commande envoyée", description: "La commande est transmise aux postes de préparation." }
        : { title: "Vente validée", description: `Encaissement ${method?.toUpperCase()} terminé.` })
      
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
        const result = await openCashSession({ restaurantId, user, posStationId: selectedPosStationId || "DEFAULT", deviceInstanceId: getPosDeviceInstanceId() })
        if (result.replayed && result.session?.deviceInstanceId && result.session.deviceInstanceId !== getPosDeviceInstanceId()) {
          toast({ title: "Session déjà active", description: `La session ${result.session.posStationName || "Caisse principale"} est aussi utilisée sur un autre appareil.` })
        }
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
        posStationId: selectedPosStationId || "DEFAULT",
        deviceInstanceId: getPosDeviceInstanceId(),
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
    setDeclaredCashInput(String(Number(activeCashSession.openingBalance || 0) + sessionCalculatedTotals.totalCash))
    setRetainedFloatInput(String(Number(activeCashSession.openingBalance || 0)))
    setCloseDialogOpen(true)
  }

  const closeMyCashSession = async () => {
    if (!restaurantId || !user || !activeCashSession?.id || processing || closeSessionLockRef.current) return

    closeSessionLockRef.current = true
    setProcessing(true)
    try {
      await closeCashSessionV2({
        restaurantId,
        sessionId: activeCashSession.id,
        user,
        countedPhysicalCash: declaredCashAmount,
        retainedFloat: retainedFloatAmount,
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

  const confirmCanonicalPayment = async (
    order: any,
    method: "cash" | "mobile",
    receivedAmount = getCanonicalPaymentAmount(order)
  ) => {
    if (!user || !activeCashSession?.id) {
      throw new Error("Une session de caisse ouverte est obligatoire.")
    }
    const selectedMobileConfig = mobilePaymentMethods.find(
      (item: any) => item.code === selectedMobileMethodCode
    )
    const expectedAmount = getCanonicalPaymentAmount(order)
    const mobileMoneyProvider = getCanonicalMobileMoneyProvider(
      order,
      selectedMobileConfig?.code
    )
    return executePosCommand({
      user,
      restaurantId: restaurantId ?? "",
      orderId: order.id,
      command: "CONFIRM_ORDER_PAYMENT",
      payload: {
        expectedPaymentVersion: Number(order.paymentVersion ?? 1),
        expectedAmount,
        receivedAmount,
        method: method === "cash" ? "cash" : "mobile_money",
        provider: method === "mobile" ? mobileMoneyProvider : null,
        paymentAccountId: method === "mobile" ? order.paymentAccountId ?? order.paymentRequest?.paymentAccountId ?? null : null,
        externalReference: null,
        cashSessionId: activeCashSession.id,
        idempotencyKey: posCommandIdempotencyKey([
          "pos-payment",
          order.id,
          order.paymentVersion ?? 1,
          method,
        ]),
      },
    })
  }

  const handleCollectOrder = async (order: any, method: "cash" | "mobile") => {
    if (!db || !restaurantId || !user || pendingOrderActionIdsRef.current.has(order.id)) return false

    if (!isOrderServed(order)) {
      toast({
        title: "Commande non servie",
        description: "Seules les commandes servies peuvent etre encaissees.",
        variant: "destructive",
      })
      return false
    }

    if (!activeCashSession) {
      toast({
        title: "Caisse fermee",
        description: "Ouvrez une session de caisse avant d'encaisser.",
        variant: "destructive",
      })
      return false
    }

    startOrderAction(order.id)
    try {
      if (posCanonicalMode === "canonical") {
        if (order.__legacyReadOnly) {
          throw new Error("Cette commande historique est en lecture seule.")
        }
        await confirmCanonicalPayment(order, method)
        await releaseOrderTableIfNeeded(db, restaurantId, order)
        toast({ title: "Commande encaissée" })
        return true
      }
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

      if (method === "cash" || order.source === "pos") {
        await confirmCanonicalPayment(order, method)
        await releaseOrderTableIfNeeded(db, restaurantId, order)
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
        toast({ title: "Commande encaissée" })
        return true
      }

      await processOrderPaymentTransaction({
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

      toast({
        title: "Paiement mobile genere",
        description: paymentCode ? `Code: ${paymentCode}` : undefined,
      })
      return true
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: error.message || "Encaissement impossible." })
      return false
    } finally {
      finishOrderAction(order.id)
    }
  }

  const markOrderPaid = async (order: any) => {
    if (!db || !restaurantId || !user || pendingOrderActionIdsRef.current.has(order.id)) return
    const isMobilePayment = isMobileMoneyOrder(order)
    const isPendingMobilePayment = (order.paymentStatus === "pending_mobile" || order.paymentStatus === "pending") && isMobilePayment
    const canValidatePayment =
      (posCanonicalMode === "canonical" && order.paymentStatus === "unpaid") ||
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

    startOrderAction(order.id)
    try {
      await confirmCanonicalPayment(order, isMobilePayment ? "mobile" : "cash")
      await releaseOrderTableIfNeeded(db, restaurantId, order)
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
      console.info("[DIRECT][PAYMENT_CONFIRMED]", {
        restaurantId,
        orderId: order.id,
        requiresKitchen: orderHasKitchenItems(order.items ?? []),
        directItems: (order.items ?? [])
          .filter((item: any) => item.preparationMode === "direct")
          .map((item: any) => ({
            orderItemId: item.id ?? item.orderItemId,
            productId: item.productId,
            quantity: item.quantity,
            status: item.status,
            servedQuantity: item.servedQuantity,
          })),
        stockEngineCalled: false,
      })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Paiement impossible",
        description: error.message || "La validation du paiement a echoue.",
      })
    } finally {
      finishOrderAction(order.id)
    }
  }

  const validateTableSessionPayment = async (session: any) => {
    if (!db || !restaurantId || !user || pendingOrderActionIdsRef.current.has(session.id)) return

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

    startOrderAction(session.id)
    setCollectingOrderId(session.id)
    try {
      const method = session.paymentRequest?.method === "mobile" ? "mobile" : "cash"
      const provider = method === "mobile"
        ? String(session.paymentRequest?.provider || "").trim() || null
        : null
      await confirmTableSessionPayment({
        user,
        restaurantId,
        tableSessionId: session.id,
        cashSessionId: activeCashSession.id,
        method: method === "mobile" ? "mobile_money" : "cash",
        provider,
        idempotencyKey: posCommandIdempotencyKey([
          "table-session-payment",
          restaurantId,
          session.id,
          method,
          provider,
        ]),
      })
      toast({ title: "Paiement valide" })
    } catch (error: any) {
      console.error(error)
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Validation impossible.",
      })
    } finally {
      finishOrderAction(session.id)
      setCollectingOrderId(null)
    }
  }

  const markOrderItemServed = async (order: any, orderItemId: string) => {
    if (!db || !restaurantId || !user || pendingOrderActionIdsRef.current.has(order.id)) return
    const selectedItem = (order.items ?? []).find(
      (item: any, index: number) =>
        String(item.id ?? item.orderItemId ?? `${item.productId ?? "item"}-${index}`) === orderItemId
    )
    if (!selectedItem || isServedOrderItem(selectedItem)) return
    if (posCanonicalMode === "canonical" && order.__legacyReadOnly) {
      toast({
        variant: "destructive",
        title: "Commande historique",
        description: "Cette commande reste consultable mais ne peut pas être modifiée depuis le parcours canonique.",
      })
      return
    }
    console.info("[DIRECT][SERVICE_ACTION]", {
      orderId: order.id,
      orderItemId,
      productId: selectedItem?.productId,
      preparationMode: selectedItem?.preparationMode,
      quantity: selectedItem?.quantity,
      currentServedQuantity: selectedItem?.servedQuantity ?? 0,
    })
    startOrderAction(order.id)
    try {
      if (posCanonicalMode === "canonical") {
        const activeQuantity =
          Number(selectedItem.quantity ?? 0) -
          Number(selectedItem.cancelledQuantity ?? 0)
        const quantityToServe =
          activeQuantity - Number(selectedItem.servedQuantity ?? 0)
        const result = await executePosCommand({
          user,
          restaurantId,
          orderId: order.id,
          command: "MARK_ORDER_ITEM_SERVED",
          payload: {
            orderItemId,
            expectedVersion: Number(selectedItem.version ?? 1),
            quantityToServe,
            idempotencyKey: posCommandIdempotencyKey([
              "pos-serve",
              order.id,
              orderItemId,
              selectedItem.version ?? 1,
              quantityToServe,
            ]),
          },
        })
        toast({
          title: "Produit marqué comme servi",
          ...(result.warning ? { description: result.warning } : {}),
        })
        return
      }
      console.info("[DIRECT][STOCK_CALL]", {
        restaurantId,
        orderId: order.id,
        orderItemId,
        requestedServedQuantity: selectedItem?.quantity,
      })
      const result = await markOrderItemAsServedAndDeductStock({
        db,
        restaurantId,
        orderId: order.id,
        orderItemId,
        actorId: user.uid,
        servedQuantity: Number(selectedItem.quantity ?? 0),
      })
      console.info("[DIRECT][STOCK_SUCCESS]", {
        operationId: result.operationId,
        previousQuantity: result.previousQuantity,
        deductedQuantity: result.deductedQuantity,
        newQuantity: result.newQuantity,
      })
      const nextItems = (order.items ?? []).map((item: any, index: number) => {
        const currentItemId = String(
          item.id ?? item.orderItemId ?? `${item.productId ?? "item"}-${index}`
        )
        return currentItemId === orderItemId
          ? {
              ...item,
              status: "served",
              servedQuantity: Number(item.quantity ?? 0),
            }
          : item
      })
      if (nextItems.length > 0 && nextItems.every(isServedOrderItem)) {
        await updateDoc(
          doc(
            db,
            COLLECTION_NAMES.RESTAURANTS,
            restaurantId,
            COLLECTION_NAMES.ORDERS,
            order.id
          ),
          {
            kitchenStatus: ORDER_OPERATION_STATUS.SERVED,
            orderStatus: ORDER_OPERATION_STATUS.SERVED,
            "timestamps.servedAt": serverTimestamp(),
            statusHistory: arrayUnion({
              status: ORDER_OPERATION_STATUS.SERVED,
              at: new Date(),
              source: "pos-direct-service",
            }),
            updatedAt: serverTimestamp(),
          }
        )
      }
      toast({
        title: "Produit marqué comme servi",
        ...(result.warning ? { description: result.warning } : {}),
      })
    } catch (error: any) {
      console.error("[DIRECT][STOCK_ERROR]", {
        code: error?.code,
        message: error?.message,
        path: error?.path,
        operation: error?.operation,
      })
      toast({
        variant: "destructive",
        title: "Service impossible",
        description: error?.message || "La ligne n’a pas pu être marquée comme servie.",
      })
    } finally {
      finishOrderAction(order.id)
    }
  }

  const handOffOrderItems = async (order: any) => {
    if (!restaurantId || !user || !activeCashSession?.id || pendingOrderActionIdsRef.current.has(order.id)) return
    const activeItems = (order.items ?? []).filter(
      (item: any) => !isServedOrderItem(item) && item.status !== "cancelled"
    )
    startOrderAction(order.id)
    try {
      await executePosCommand({
        user,
        restaurantId,
        orderId: order.id,
        command: "HAND_OFF_ORDER_ITEMS",
        payload: {
          expectedItems: activeItems.map((item: any, index: number) => ({
            orderItemId: String(
              item.id ?? item.orderItemId ?? `${item.productId ?? "item"}-${index}`
            ),
            expectedVersion: Number(item.version ?? 1),
          })),
          cashSessionId: activeCashSession.id,
          idempotencyKey: posCommandIdempotencyKey([
            "pos-hand-off",
            order.id,
            ...activeItems.flatMap((item: any) => [item.id ?? item.orderItemId, item.version ?? 1]),
          ]),
        },
      })
      toast({
        title: normalizeOrderType(order.orderType || order.serviceMode || order.type) === "delivery"
          ? "Commande remise au livreur"
          : "Commande remise au client",
      })
      setSelectedOrderDetailId((currentOrderId) =>
        currentOrderId === order.id ? null : currentOrderId
      )
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Remise impossible",
        description: error?.message || "La commande n’a pas pu être remise.",
      })
    } finally {
      finishOrderAction(order.id)
    }
  }

  const serveAllOrderItems = async (order: any) => {
    if (!restaurantId || !user || pendingOrderActionIdsRef.current.has(order.id)) return
    const activeItems = (order.items ?? []).filter(
      (item: any) => !isServedOrderItem(item) && item.status !== "cancelled"
    )
    startOrderAction(order.id)
    try {
      await executePosCommand({
        user,
        restaurantId,
        orderId: order.id,
        command: "SERVE_ORDER_ITEMS",
        payload: {
          expectedItems: activeItems.map((item: any, index: number) => ({
            orderItemId: String(item.id ?? item.orderItemId ?? `${item.productId ?? "item"}-${index}`),
            expectedVersion: Number(item.version ?? 1),
          })),
          idempotencyKey: posCommandIdempotencyKey([
            "pos-serve-all", order.id,
            ...activeItems.flatMap((item: any) => [item.id ?? item.orderItemId, item.version ?? 1]),
          ]),
        },
      })
      toast({ title: "Commande entièrement servie" })
      setSelectedOrderDetailId((currentOrderId) => currentOrderId === order.id ? null : currentOrderId)
    } catch (error: any) {
      toast({ variant: "destructive", title: "Service impossible", description: error?.message || "La commande n’a pas pu être servie." })
    } finally {
      finishOrderAction(order.id)
    }
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
    setMobileCartOpen(false)
    setPaymentDialogOpen(true)
  }

  const openOrderPaymentDialog = (order: any) => {
    if (processing || !order?.id) return
    setCollectingOrderId(order.id)
    setSelectedPaymentMode(null)
    setSelectedMobileMethodCode(null)
    setCashReceivedInput("")
    setPaymentFlowError(null)
    setPaymentDialogOpen(true)
  }

  const handleCartCheckout = async () => {
    if (hasUnavailableCartItems) {
      toast({
        variant: "destructive",
        title: "Ticket à corriger",
        description: `${unavailableCartItems[0].message} Retirez ce produit avant de confirmer.`,
      })
      return
    }
    if (orderType === "dine-in") {
      const succeeded = await handleCheckout()
      if (succeeded) setMobileCartOpen(false)
      return
    }
    openPaymentDialog()
  }

  const submitPayment = async () => {
    if (processing) return
    setPaymentFlowError(null)
    if (collectingOrder) {
      if (!selectedPaymentMode) {
        setPaymentFlowError("Sélectionnez Espèces ou Mobile Money.")
        return
      }
      const amountDue = getCanonicalPaymentAmount(collectingOrder)
      if (selectedPaymentMode === "cash" && cashReceivedAmount < amountDue) {
        setPaymentFlowError("Le montant reçu doit couvrir le total à payer.")
        return
      }
      if (selectedPaymentMode === "mobile" && !selectedMobileMethodCode) {
        setPaymentFlowError("Sélectionnez le moyen Mobile Money utilisé.")
        return
      }
      const succeeded = await handleCollectOrder(collectingOrder, selectedPaymentMode)
      if (succeeded) {
        setPaymentDialogOpen(false)
        setCollectingOrderId(null)
        setSelectedOrderDetailId((currentOrderId) =>
          currentOrderId === collectingOrder.id ? null : currentOrderId
        )
      } else {
        setPaymentFlowError("Impossible de confirmer cet encaissement.")
      }
      return
    }
    const succeeded = await handleCheckoutSelectedPayment()
    if (succeeded) {
      setPaymentDialogOpen(false)
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
    <PreparationIssuesAlert />
    <POSLayout
      restaurantName={restaurant?.name}
      restaurantLogoUrl={restaurant?.logoUrl}
      activeTab={activeTab}
      pendingOrderCount={pendingOrderCount}
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
            className="h-full rounded-none border-x-0 border-b-0 md:rounded-[var(--radius-dashboard-widget)] md:border lg:h-auto lg:self-start lg:overflow-visible"
            contentClassName="pb-24 md:pb-3 lg:h-auto lg:flex-none lg:overflow-y-visible lg:overscroll-auto lg:p-2.5"
            categories={<CategorySidebar categories={stationCategories} selectedCategoryId={selectedCategoryId} onSelectCategory={setSelectedCategoryId} />}
            footer={totalPages > 1 ? (
              <div className="flex items-center justify-center gap-2 bg-[var(--pos-catalog)] sm:gap-3">
                <Button variant="outline" size="sm" className="min-h-11 gap-1 rounded-full px-3 text-xs font-black" disabled={safeCurrentPage === 0} onClick={() => setCurrentPage((page) => page - 1)}>
                  <ChevronLeft className="h-4 w-4" />Préc.
                </Button>
                <span className="min-w-24 text-center text-xs font-black text-muted-foreground sm:min-w-32">Page {safeCurrentPage + 1} / {totalPages}<span className="block font-medium">{filteredProducts.length} produits accessibles</span></span>
                <Button variant="outline" size="sm" className="min-h-11 gap-1 rounded-full px-3 text-xs font-black" disabled={safeCurrentPage === totalPages - 1} onClick={() => setCurrentPage((page) => page + 1)}>
                  Suiv.<ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            ) : null}
          >

            <div className="min-h-0">
              <PosSearchField className="mb-2 md:hidden" label="Rechercher un produit" placeholder="Nom ou référence" value={productSearch} onChange={setProductSearch} onClear={() => setProductSearch("")} resultCount={filteredProducts.length} />
              <ProductGrid
                products={paginatedProducts}
                categories={stationCategories}
                loading={isLoadingVisible}
                formatPrice={formatDisplayPrice}
                onProductClick={openProductSelector}
                stockByProduct={stockByProduct}
              />
            </div>

            {configProduct ? (
              <ProductConfiguratorModal
                product={configProduct}
                catalogProducts={stationProducts}
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
            unavailableItems={unavailableCartItems}
            canCheckout={
              Boolean(activeCashSession) &&
              cart.length > 0 &&
              !hasUnavailableCartItems &&
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
            onCheckout={handleCartCheckout}
          /></div>
          <div aria-label="Résumé de session" className="grid shrink-0 grid-cols-3 gap-2">
            <POSFooterCard icon={<Clock3 />} label="Début" value={formatSessionDateTime(activeCashSession.openedAt)} />
            <POSFooterCard icon={<Percent />} label="Remise" value={discountRate > 0 ? `${Math.round(discountRate * 100)}%` : "0%"} />
            <POSFooterCard icon={<UserRound />} label="Poste" value={activeCashSession.posStationName || "Caisse principale"} />
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
                stations={allowedStations}
                selectedStationId={selectedPosStationId}
                onStationChange={setSelectedPosStationId}
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
            <div className="hidden h-full min-h-0 grid-cols-1 gap-5 overflow-y-auto p-4 xl:grid xl:grid-cols-5 xl:overflow-hidden">
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
                                disabled={pendingOrderActionIds.has(group.id) || !canVerifyPayment || !paymentSession}
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
                        const normalizedType = normalizeOrderType(order.orderType || order.type)
                        const currentOrderStatus = getPOSOperationStatus(order)
                        const isPosDineInOrder = order.source === "pos" && normalizedType === "dine_in"
                        const isPaymentStageAllowed =
                          !isPosDineInOrder || currentOrderStatus === ORDER_OPERATION_STATUS.SERVED
                        const isPaymentVisible =
                          isPaymentStageAllowed && (
                          (order.__canonicalPos && order.paymentStatus === "unpaid") ||
                          hasSessionPaymentRequest ||
                          order.paymentStatus === "pending_verification" ||
                          isPendingMobilePayment ||
                          order.paymentStatus === "pending_cash" ||
                          isPaid
                          )
                        const canVerifyPayment =
                          isPaymentStageAllowed &&
                          !mobilePaymentNeedsProof &&
                          (
                            (order.__canonicalPos && order.paymentStatus === "unpaid") ||
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
                        const tableLabel = formatTableDisplayName({
                          name: tables.find((table) => table.id === order.tableId)?.name || order.tableNumber || order.table,
                          id: order.tableId,
                        }, tableLabelPrefix)
                        const orderItems = Array.isArray(order.items) ? order.items : []
                        const previewItems = orderItems.slice(0, 3)
                        const hiddenItemsCount = Math.max(0, orderItems.length - previewItems.length)
                        const orderMetaLabel = getPOSOrderMetaLabel(normalizedType, tableLabel)
                        const orderDateLabel = formatPOSOrderDateTime(order.createdAt)

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

                            <div className="mt-3 space-y-1.5">
                              {previewItems.length > 0 ? previewItems.map((item: any, itemIndex: number) => {
                                const itemName = item.name || item.nameSnapshot || "Article"
                                return (
                                  <div key={item.id || item.orderItemId || `${item.productId}-${itemIndex}`} className="flex min-w-0 items-center gap-2">
                                    <div className="size-8 shrink-0 overflow-hidden rounded-md bg-muted">
                                      {item.imageUrl ? (
                                        <img
                                          src={getOptimizedImage(item.imageUrl, 64)}
                                          alt={itemName}
                                          loading="lazy"
                                          className="size-full object-cover"
                                        />
                                      ) : (
                                        <Utensils aria-hidden="true" className="m-2 size-4 text-muted-foreground" />
                                      )}
                                    </div>
                                    <p className={cn("min-w-0 flex-1 line-clamp-1 font-semibold", isCompletedColumn ? "text-xs text-foreground" : "text-[11px] text-muted-foreground")}>
                                      {Number(item.quantity ?? 1)}x {itemName}
                                    </p>
                                  </div>
                                )
                              }) : <p className="text-xs text-muted-foreground">Aucun produit</p>}
                            </div>
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
                                    disabled={pendingOrderActionIds.has(order.id) || !canVerifyPayment}
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      isPosDineInOrder
                                        ? openOrderPaymentDialog(order)
                                        : paymentSession
                                          ? validateTableSessionPayment(paymentSession)
                                          : markOrderPaid(order)
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
          className="h-[100dvh] max-h-[100dvh] w-full max-w-none rounded-none border-0 md:hidden"
          contentClassName="overflow-hidden p-0"
        >
          <CartPanel
            cart={cart}
            subtotal={subtotal}
            discountAmount={discountAmount}
            total={total}
            processing={processing}
            unavailableItems={unavailableCartItems}
            canCheckout={
              Boolean(activeCashSession) &&
              cart.length > 0 &&
              !hasUnavailableCartItems &&
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
            <POSFooterCard icon={<UserRound />} label="Poste" value={activeCashSession.posStationName || "Caisse principale"} />
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
            onCheckout={handleCartCheckout}
          />
        </PublicSheet>
      </>
    ) : null}

    <POSPaymentFlow
      open={paymentDialogOpen}
      onOpenChange={(open) => {
        setPaymentDialogOpen(open)
        if (!open) {
          setCollectingOrderId(null)
          setPaymentFlowError(null)
        }
      }}
      total={collectingOrder ? getCanonicalPaymentAmount(collectingOrder) : total}
      paymentMode={selectedPaymentMode}
      onPaymentModeChange={handlePaymentModeChange}
      mobilePaymentMethods={mobilePaymentMethods}
      selectedMobileMethodCode={selectedMobileMethodCode}
      onMobileMethodChange={setSelectedMobileMethodCode}
      cashReceivedInput={cashReceivedInput}
      cashReceivedAmount={cashReceivedAmount}
      onCashReceivedChange={setCashReceivedInput}
      processing={Boolean(
        processing ||
        (collectingOrder && pendingOrderActionIds.has(collectingOrder.id))
      )}
      error={paymentFlowError}
      canSubmit={
        Boolean(activeCashSession) &&
        Boolean(collectingOrder || cart.length > 0) &&
        Boolean(selectedPaymentMode) &&
        !(selectedPaymentMode === "cash" && cashReceivedInput.trim().length === 0) &&
        !(selectedPaymentMode === "cash" && cashReceivedAmount < (collectingOrder ? getCanonicalPaymentAmount(collectingOrder) : total)) &&
        !(selectedPaymentMode === "mobile" && !selectedMobileMethodCode) &&
        Boolean(collectingOrder || orderType !== "dine-in" || tableNumber)
      }
      onSubmit={submitPayment}
    />

    <CashierOrderDetailDialog
      order={selectedOrderDetail}
      paymentSession={selectedOrderPaymentSession}
      paymentMethods={mobilePaymentMethods}
      tables={tables}
      tableLabelPrefix={tableLabelPrefix}
      processing={Boolean(
        selectedOrderDetail && pendingOrderActionIds.has(selectedOrderDetail.id)
      )}
      onClose={() => setSelectedOrderDetailId(null)}
      onPrint={() => {
        if (selectedOrderDetail) queuePrint(selectedOrderDetail, "client")
      }}
      onValidatePayment={() => {
        if (!selectedOrderDetail) return
        const isPosDineInOrder =
          selectedOrderDetail.source === "pos" &&
          normalizeOrderType(selectedOrderDetail.orderType || selectedOrderDetail.type) === "dine_in"
        if (isPosDineInOrder) {
          openOrderPaymentDialog(selectedOrderDetail)
          return
        }
        selectedOrderPaymentSession
          ? validateTableSessionPayment(selectedOrderPaymentSession)
          : markOrderPaid(selectedOrderDetail)
      }}
      onServeItem={(orderItemId) => {
        if (selectedOrderDetail) markOrderItemServed(selectedOrderDetail, orderItemId)
      }}
      onServeAll={() => {
        if (selectedOrderDetail) serveAllOrderItems(selectedOrderDetail)
      }}
      onHandOff={() => {
        if (selectedOrderDetail) handOffOrderItems(selectedOrderDetail)
      }}
    />

    <PosSessionClosingDialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen} title="Clôture de caisse" description="Comptez uniquement les espèces physiques. Le Mobile Money est issu du registre des paiements." summary={<div className="space-y-3"><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><CloseAmount label="Fond initial" value={closeSessionDiff.openingBalance}/><CloseAmount label="Espèces attendues (fond inclus)" value={closeSessionDiff.systemCash}/><CloseAmount label="Mobile Money enregistré" value={closeSessionDiff.systemMobile}/><CloseAmount label="Total théorique" value={closeSessionDiff.systemTotal} strong/></div><PaymentBalanceSummary rows={closeSessionDiff.paymentBalanceRows}/></div>} expectedCash={<div><Label htmlFor="declared-cash">Espèces physiques comptées</Label><Input autoFocus id="declared-cash" inputMode="numeric" type="number" min={0} value={declaredCashInput} onChange={(event) => setDeclaredCashInput(event.target.value)} className="mt-1 min-h-12 text-right text-xl font-bold tabular-nums" aria-invalid={closeSessionDiff.cash !== 0}/></div>} declaredCash={<div><Label htmlFor="retained-float">Fond conservé en caisse</Label><Input id="retained-float" inputMode="numeric" type="number" min={0} value={retainedFloatInput} onChange={(event) => setRetainedFloatInput(event.target.value)} className="mt-1 min-h-12 text-right text-xl font-bold tabular-nums"/></div>} variance={<div className="grid grid-cols-1 gap-3 lg:grid-cols-2"><VarianceCard label="Écart espèces" expected={closeSessionDiff.systemCash} received={declaredCashAmount} variance={closeSessionDiff.cash}/><CloseAmount label="Versement attendu" value={closeSessionDiff.expectedHandover} strong/></div>} footer={<><Button variant="outline" className="min-h-12" disabled={processing} onClick={() => setCloseDialogOpen(false)}>Annuler</Button><Button className="min-h-12" disabled={processing || retainedFloatAmount > declaredCashAmount} onClick={closeMyCashSession}>{processing ? <Loader2 className="mr-2 size-4 animate-spin motion-reduce:animate-none"/> : null}Confirmer clôture</Button></>} />
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

const PAYMENT_BALANCE_LABELS: Record<string, string> = {
  orange_money: "Orange Money",
  wave: "Wave",
  moov_money: "Moov Money",
  mtn_money: "MTN Money",
  card: "Carte bancaire",
  bank_transfer: "Virement bancaire",
}

function buildPaymentBalanceRows(
  openingValue: unknown,
  totalsByProvider: unknown,
  configuredMethods: any[],
  ledgerPayments: any[] | null,
  ledgerSessionId?: string | null
) {
  const opening = resolvePaymentBalances(openingValue)
  const rawOpening = openingValue && typeof openingValue === "object" && !Array.isArray(openingValue)
    ? openingValue as Record<string, unknown>
    : {}
const changes = resolvePaymentBalanceChanges(
    totalsByProvider,
    configuredMethods,
    ledgerPayments,
    ledgerSessionId
  )
  const sessionBalanceKeyByMethod = resolveMethodSessionBalanceKeys(
    configuredMethods,
    ledgerPayments,
    ledgerSessionId
  )
  const paymentAccountNameByAccountId = resolvePaymentAccountNames(ledgerPayments, ledgerSessionId)

  // La liste des soldes reflète exclusivement les moyens de paiement réellement
  // configurés et actifs du restaurant (mobilePaymentMethods). Les clés legacy
  // ne sont plus rendues comme liste par défaut.
  return (Array.isArray(configuredMethods) ? configuredMethods : [])
    .filter((method: any) => {
      const code = method?.code || method?.methodCode
      if (!code) return false
      if (method.isActive === false) return false
      return true
})
    .map((method: any) => {
      const code = method?.code || method?.methodCode
      const resolvedBefore = Number((opening as Record<string, number>)[code])
      const rawBefore = Math.round(Number(rawOpening[code] || 0))
      const before = Number.isFinite(resolvedBefore)
        ? resolvedBefore
        : Number.isFinite(rawBefore) && rawBefore >= 0
          ? rawBefore
          : 0
// Le montant de session est résolu avec la même clé que celle utilisée
      // par le registre des paiements (paymentAccountId, puis provider réel,
      // puis method.code en dernier recours). Ceci garantit qu'un moyen
      // configuré avec un code différent de son provider (ex. Sarali /
      // orange_money) lit bien le bon total agrégé.
const sessionBalanceKey =
        sessionBalanceKeyByMethod.get(String(code)) ||
        String(method.paymentAccountId || "").trim() ||
        ""
      const normalizedCodeKey = normalizePaymentMethodToBalanceKey(code)
      const session = Number(
        (sessionBalanceKey && changes[sessionBalanceKey]) ??
        changes[code] ??
        (normalizedCodeKey ? changes[normalizedCodeKey] : undefined) ??
        0
      )
const methodName = typeof method.name === "string" ? String(method.name).trim() : ""
      const paymentAccountName = paymentAccountNameByAccountId.get(
        String(method.paymentAccountId || "")
      )
      const label = methodName || paymentAccountName || code
      const logoUrl =
        typeof method.logoUrl === "string" && method.logoUrl.trim() ? method.logoUrl : null
      return {
        key: code,
        code,
        label,
        logoUrl,
        before,
        session,
        after: Math.max(0, before + session),
      }
    })
}

// Retrouve le nom commercial du compte financier depuis le registre des
// paiements (safePayments) pour servir de libellé quand le nom du moyen
// configuré n'est pas disponible.
function resolvePaymentAccountNames(ledgerPayments: any[] | null, ledgerSessionId?: string | null) {
  const namesByAccountId = new Map<string, string>()
  if (!Array.isArray(ledgerPayments)) return namesByAccountId
  ledgerPayments.forEach((payment: any) => {
    if (ledgerSessionId && payment?.sessionId && payment.sessionId !== ledgerSessionId) return
    const accountId = String(payment?.paymentAccountId || "").trim()
    const accountName = String(payment?.paymentAccountName || "").trim()
    if (!accountId || !accountName) return
    if (!namesByAccountId.has(accountId)) namesByAccountId.set(accountId, accountName)
  })
  return namesByAccountId
}

// Pour chaque moyen configuré, retrouve la clé du décompte de session
// (changes) dans laquelle ses encaissements ont été agrégés. On privilégie
// l'attribution par paymentAccountId (le code du moyen configuré est alors la
// clé), puis on retombe sur le provider réel normalisé du paiement quand aucun
// compte configuré ne correspond.
function resolveMethodSessionBalanceKeys(
  configuredMethods: any[],
  ledgerPayments: any[] | null,
  ledgerSessionId?: string | null
) {
  const balanceKeyByMethodCode = new Map<string, string>()

  // Correspondance paymentAccountId -> code du moyen configuré, comme dans
  // resolvePaymentBalanceChanges.
  const methodsByAccountId = new Map<string, string>()
  ;(Array.isArray(configuredMethods) ? configuredMethods : []).forEach((method) => {
    const code = method?.code || method?.methodCode
    const accountId = String(method?.paymentAccountId || "").trim()
    if (code) balanceKeyByMethodCode.set(code, code)
    if (code && accountId) methodsByAccountId.set(accountId, code)
  })

  if (!Array.isArray(ledgerPayments)) return balanceKeyByMethodCode

  const seen = new Set<string>()
  ledgerPayments.forEach((payment: any) => {
    if (ledgerSessionId && payment?.sessionId && payment.sessionId !== ledgerSessionId) return
    const status = String(payment?.status || payment?.paymentStatus || "").toLowerCase()
    if (status && status !== "confirmed" && status !== "paid" && status !== "verified") return
    const methodValue = String(payment?.method || payment?.paymentMethod || "").toLowerCase()
    if (methodValue === "cash") return
    const amount = Math.round(Number(payment?.amount || payment?.totalAmount || 0))
    if (!Number.isFinite(amount) || amount <= 0) return
    const identity = String(payment?.idempotencyKey || payment?.id || "").trim()
    if (identity) {
      if (seen.has(identity)) return
      seen.add(identity)
    }

    const accountId = String(payment?.paymentAccountId || "").trim()
    if (accountId && methodsByAccountId.has(accountId)) {
      const methodCode = methodsByAccountId.get(accountId)!
      balanceKeyByMethodCode.set(methodCode, methodCode)
      return
    }

    // Repli : agrégation par provider réel quand aucun compte n'est rattaché.
    const provider = String(payment?.provider || payment?.paymentProvider || "").toLowerCase()
    const fallbackKey = normalizePaymentMethodToBalanceKey(provider || methodValue)
    if (fallbackKey && balanceKeyByMethodCode.has(fallbackKey)) {
      balanceKeyByMethodCode.set(fallbackKey, fallbackKey)
    }
  })

  return balanceKeyByMethodCode
}

function resolvePaymentBalanceChanges(
  value: unknown,
  configuredMethods: any[],
  ledgerPayments: any[] | null,
  ledgerSessionId?: string | null
) {
  const changes: Record<string, number> = {}
  const addChange = (key: string | null, amount: number) => {
    if (!key || !Number.isFinite(amount)) return
    changes[key] = (changes[key] || 0) + amount
  }

  // Correspondance paymentAccountId -> code du moyen configuré. C'est cette
  // règle qui permet de raisonner par moyen de paiement configuré (ex. Sarali)
  // plutôt que par fournisseur interne (orange_money, wave...).
  const methodsByAccountId = new Map<string, string>()
  ;(Array.isArray(configuredMethods) ? configuredMethods : []).forEach((method) => {
    const code = method?.code || method?.methodCode
    const accountId = String(method?.paymentAccountId || "").trim()
    if (code && accountId) methodsByAccountId.set(accountId, code)
  })

  // Source principale : le registre des paiements, agrégé par paymentAccountId
  // du moyen configuré. Pour chaque paiement confirmé mobile, on attribue le
  // montant au moyen configuré dont le paymentAccountId correspond.
  if (Array.isArray(ledgerPayments)) {
    const seen = new Set<string>()
    ledgerPayments.forEach((payment: any) => {
      if (ledgerSessionId && payment?.sessionId && payment.sessionId !== ledgerSessionId) return
      const status = String(payment?.status || payment?.paymentStatus || "").toLowerCase()
      if (status && status !== "confirmed" && status !== "paid" && status !== "verified") return
      const method = String(payment?.method || payment?.paymentMethod || "").toLowerCase()
      if (method === "cash") return
      const amount = Math.round(Number(payment?.amount || payment?.totalAmount || 0))
      if (!Number.isFinite(amount) || amount <= 0) return
      const identity = String(payment?.idempotencyKey || payment?.id || "").trim()
      if (identity) {
        if (seen.has(identity)) return
        seen.add(identity)
      }

// Résolution du moyen configuré par paymentAccountId d'abord.
      const accountId = String(payment?.paymentAccountId || "").trim()
      let key: string | null = null
      if (accountId && methodsByAccountId.has(accountId)) {
        key = methodsByAccountId.get(accountId)!
      } else {
        // Repli : agrégation par provider quand aucun compte n'est rattaché.
        const provider = String(payment?.provider || payment?.paymentProvider || "").toLowerCase()
        key = normalizePaymentMethodToBalanceKey(provider || method)
      }
addChange(key, amount)
    })
  }

  // Filet de sécurité : le décompte par fournisseur (serveur) n'est utilisé que
  // pour les moyens absents du registre par paymentAccountId, afin d'éviter tout
  // double comptage (on ne l'ajoute que si la clé n'est pas déjà renseignée).
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
  for (const [provider, amountValue] of Object.entries(source)) {
    const amount = Math.round(Number(amountValue || 0))
    const key = normalizePaymentProviderToBalanceKey(provider)
    if (key && changes[key] === undefined) addChange(key, amount)
  }

  return changes
}

const POS_STATION_PAYMENT_BALANCE_KEYS = [
  "orange_money",
  "wave",
  "moov_money",
  "mtn_money",
  "card",
  "bank_transfer",
]

function normalizePaymentProviderToBalanceKey(provider: string) {
  const key = normalizePaymentMethodToBalanceKey(provider)
  if (key) return key
  const value = String(provider || "").toLowerCase().replace(/[^a-z0-9]/g, "_")
  if (!value || value === "cash" || value === "mobile_money") return null
  return value
}

function normalizePaymentMethodToBalanceKey(method: string) {
  const value = String(method || "").toLowerCase().replace(/[^a-z0-9]/g, "_")
  if (!value || value === "cash" || value === "mobile_money") return null
  if (value === "orange" || value === "orange_money") return "orange_money"
  if (value === "wave") return "wave"
  if (value === "moov" || value === "moov_money") return "moov_money"
  if (value === "mtn" || value === "mtn_money" || value === "mtn_mobile_money") return "mtn_money"
  if (value === "card" || value === "visa" || value === "mastercard") return "card"
  if (value === "bank_transfer" || value === "vir" || value === "virement" || value === "bank") return "bank_transfer"
  return value
}

function PaymentBalanceSummary({ rows }: { rows: Array<{ key: string; code?: string; label: string; logoUrl?: string | null; before: number; session: number; after: number }> }) {
  if (!Array.isArray(rows) || rows.length === 0) return null
  return <div className="rounded-[var(--radius-dashboard-widget)] border border-[var(--pos-border)] bg-[var(--pos-muted)] p-3"><p className="text-[10px] font-black uppercase text-muted-foreground">Soldes moyens de paiement</p><div className="mt-2 grid gap-2">{rows.map((row) => <div key={row.key} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 text-xs"><span className="flex min-w-0 items-center gap-2"><span className="flex items-center">{row.logoUrl ? <img src={row.logoUrl} alt="" className="mr-1 size-4 object-contain" /> : null}<span className="min-w-0 truncate font-semibold">{row.label}</span></span><span className="shrink-0 text-[9px] font-bold uppercase text-muted-foreground">{row.code}</span></span><span className="tabular-nums text-muted-foreground">Avant {row.before.toLocaleString("fr-FR")}</span><span className="tabular-nums text-muted-foreground">Session {row.session.toLocaleString("fr-FR")}</span><span className="tabular-nums font-black">Après {row.after.toLocaleString("fr-FR")}</span></div>)}</div></div>
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
    <section aria-label="Commandes du point de vente" className="flex h-full min-h-0 flex-col xl:hidden">
      <div className="shrink-0 border-b border-[var(--pos-divider)] bg-[var(--pos-canvas)] px-3 pb-2 pt-1">
        <div role="tablist" aria-label="Statut des commandes" className="grid grid-cols-2 gap-2 md:grid-cols-4">
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
                  "dashboard-focus-visible flex min-h-11 min-w-0 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-xs font-semibold",
                  selected
                    ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-[var(--action-primary-fg)]"
                    : "border-[var(--pos-border)] bg-[var(--pos-panel)] text-[var(--dashboard-title)]"
                )}
              >
                <span className="whitespace-normal leading-tight">{label}</span>
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
  onServeItem,
  onServeAll,
  onHandOff,
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
  onServeItem: (orderItemId: string) => void
  onServeAll: () => void
  onHandOff: () => void
}) {
  if (!order) return null

  const items = Array.isArray(order.items) ? order.items : []
  const groupedItems = groupCashierOrderItems(items)
  const normalizedType = normalizeOrderType(order.orderType || order.type)
  const paymentRequestStatus = paymentSession?.paymentRequest?.status
  const isPaid = isOrderPaid(order) || paymentRequestStatus === "validated"
  const requiresGroupedHandOff = ["delivery", "takeaway", "pickup"].includes(normalizedType)
  const activeItems = items.filter((item: any) => !isServedOrderItem(item) && item.status !== "cancelled")
  const allPreparedItemsReady = activeItems.every((item: any) => {
    const mode = getEffectivePreparationMode(item)
    return mode === "direct" || item.status === "ready"
  })
  const canHandOff = requiresGroupedHandOff && isPaid && activeItems.length > 0 && allPreparedItemsReady
  const canServeAll = normalizedType === "dine_in" && activeItems.length > 0 && activeItems.every(canServePosOrderItem)
  const isMobilePayment = isMobileMoneyOrder(order) || paymentSession?.paymentRequest?.method === "mobile"
  const paymentProofSms = getPaymentProofSms(paymentSession, [order])
  const paymentProofSubmittedAt = getPaymentProofSubmittedAt(paymentSession, [order])
  const paymentMethodLabel = getConfiguredPaymentMethodLabel(order, paymentSession, paymentMethods)
  const mobilePaymentNeedsProof = isMobilePayment && !paymentProofSms
  const isPosDineInOrder = order.source === "pos" && normalizedType === "dine_in"
  const isPaymentStageAllowed =
    !isPosDineInOrder || getPOSOperationStatus(order) === ORDER_OPERATION_STATUS.SERVED
  const canValidatePayment =
    isPaymentStageAllowed &&
    !isPaid &&
    !mobilePaymentNeedsProof &&
    (
      paymentRequestStatus === "requested" ||
      paymentRequestStatus === "pending_confirmation" ||
      order.paymentStatus === "pending_verification" ||
      order.paymentStatus === "pending_mobile" ||
      order.paymentStatus === "pending_cash" ||
      order.paymentStatus === "pending" ||
      (order.__canonicalPos && order.paymentStatus === "unpaid")
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
      <DialogContent className="max-h-[82vh] max-w-2xl overflow-hidden p-0">
        <DialogHeader className="border-b px-4 py-3">
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

        <div className="max-h-[55vh] overflow-y-auto px-4 py-3">
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

          {order.notes || order.customerNote || order.customerNotes ? (
            <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
              <p className="font-black">Observation client</p>
              <p className="mt-1 whitespace-pre-wrap break-words font-semibold">
                {order.notes || order.customerNote || order.customerNotes}
              </p>
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

          <div className="mt-4 space-y-4">
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

                    const orderItemId = String(item.id ?? item.orderItemId ?? `${item.productId ?? "item"}-${items.indexOf(item)}`)
                    const served = isServedOrderItem(item)
                    return (
                      <div key={item.id || `${item.productId}-${index}`} className="rounded-lg border bg-card p-3">
                        <div className="grid grid-cols-[auto_auto_1fr_auto] gap-3">
                          <span className="flex h-8 min-w-8 items-center justify-center rounded-md bg-primary/10 px-2 text-sm font-black text-primary">
                            {quantity}x
                          </span>
                          <div className="size-10 overflow-hidden rounded-md bg-muted">
                            {item.imageUrl ? (
                              <img
                                src={getOptimizedImage(item.imageUrl, 80)}
                                alt={item.name || item.nameSnapshot || "Article"}
                                loading="lazy"
                                className="size-full object-cover"
                              />
                            ) : (
                              <Utensils aria-hidden="true" className="m-3 size-4 text-muted-foreground" />
                            )}
                          </div>
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
                            {item.instructions || item.note || item.notes ? (
                              <p className="mt-2 break-words rounded-md bg-amber-50 px-2 py-1.5 text-xs font-semibold text-amber-900">
                                <span className="font-black">Instruction : </span>
                                {item.instructions || item.note || item.notes}
                              </p>
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
                        {!requiresGroupedHandOff && (canServePosOrderItem(item) || served) ? (
                          <div className="mt-3 flex justify-end border-t pt-3">
                            <Button
                              type="button"
                              size="sm"
                              disabled={processing || served}
                              onClick={() => onServeItem(orderItemId)}
                            >
                              {served ? "Servi" : "Marquer comme servi"}
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
          {requiresGroupedHandOff ? (
            <div className="mt-5 rounded-lg border bg-muted/30 p-4">
              {!isPaid ? (
                <p className="text-sm font-black text-amber-700">
                  En attente de validation du paiement
                </p>
              ) : !allPreparedItemsReady ? (
                <p className="text-sm font-black text-amber-700">
                  En attente de la fin des préparations Cuisine et Bar
                </p>
              ) : (
                <Button
                  type="button"
                  className="w-full"
                  disabled={processing || !canHandOff}
                  onClick={onHandOff}
                >
                  {normalizedType === "delivery"
                    ? "Tout remettre au livreur"
                    : "Tout remettre au client"}
                </Button>
              )}
            </div>
          ) : null}
          {normalizedType === "dine_in" && activeItems.length > 0 ? (
            <div className="mt-4 rounded-lg border bg-muted/30 p-3">
              <Button type="button" className="w-full" disabled={processing || !canServeAll} onClick={onServeAll}>
                Tout marquer comme servi
              </Button>
              {!canServeAll ? <p className="mt-2 text-xs font-semibold text-muted-foreground">Toutes les préparations doivent être prêtes.</p> : null}
            </div>
          ) : null}
        </div>

        <DialogFooter className="border-t px-4 py-3">
          <Button variant="outline" onClick={onClose}>Fermer</Button>
          <Button variant="outline" onClick={onPrint}>Réimprimer ticket</Button>
          {!isPaid && isPaymentStageAllowed ? (
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
    { mode: "kitchen" as const, label: getPreparationModeLabel("kitchen"), items: [] as any[] },
    { mode: "direct" as const, label: getPreparationModeLabel("direct"), items: [] as any[] },
    { mode: "bar" as const, label: getPreparationModeLabel("bar"), items: [] as any[] },
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

function isServedOrderItem(item: any) {
  const quantity = Math.max(0, Number(item?.quantity ?? 0))
  const servedQuantity = Number(item?.servedQuantity)
  if (Number.isFinite(servedQuantity) && servedQuantity >= quantity && quantity > 0) return true
  return ["served", "picked_up", "completed", "delivered", "servie", "servies"].includes(
    String(item?.status ?? item?.itemStatus ?? "").toLowerCase()
  )
}

function canServePosOrderItem(item: any) {
  if (!item || isServedOrderItem(item)) return false
  const quantity = Number(item.quantity ?? 0)
  const cancelled = Number(item.cancelledQuantity ?? 0)
  const served = Number(item.servedQuantity ?? 0)
  if (quantity - cancelled - served <= 0) return false
  if (item.status === "ready") return true
  return item.preparationMode === "direct" && item.status === "pending"
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
  stations,
  selectedStationId,
  onStationChange,
}: {
  pending: boolean
  pendingValidation: boolean
  requesting: boolean
  approvalMode: "required" | "optional"
  onRequest: () => void
  stations: Array<{ id: string; name: string }>
  selectedStationId: string
  onStationChange: (stationId: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 p-2">
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
      {stations.length > 1 && !pending && !pendingValidation ? <label className="text-[10px] font-bold">Poste<select className="ml-2 min-h-8 rounded-md border bg-background px-2" value={selectedStationId} onChange={(event) => onStationChange(event.target.value)}>{stations.map((station) => <option key={station.id} value={station.id}>{station.name}</option>)}</select></label> : stations.length === 1 ? <span className="text-[10px] font-bold">{stations[0].name}</span> : null}
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

function getPosDeviceInstanceId() {
  if (typeof window === "undefined") return null
  const key = "oordera-pos-device-instance"
  const existing = window.localStorage.getItem(key)
  if (existing) return existing
  const created = window.crypto?.randomUUID?.() || `device-${Date.now()}-${Math.random().toString(36).slice(2)}`
  window.localStorage.setItem(key, created)
  return created
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
  const paymentMethod = String(order.paymentMethod || "").toLowerCase()
  const paymentType = String(order.paymentType || "").toLowerCase()
  const paymentMethodCode = String(order.paymentMethodCode || "").toLowerCase()
  const paymentProvider = String(order.paymentProvider || order.paymentRequest?.provider || "").toLowerCase()
  return (
    order.paymentRequest?.method === "mobile" ||
    paymentMethod === "mobile" ||
    paymentMethod === "mobile_money" ||
    paymentType === "mobile" ||
    paymentType === "mobile_money" ||
    Boolean(paymentMethodCode && paymentMethodCode !== "cash") ||
    Boolean(paymentProvider && paymentProvider !== "cash") ||
    order.paymentIntentStatus === "submitted" ||
    Boolean(paymentMethod && paymentMethod !== "cash")
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
      } else if (width >= 768) {
        setProductsPerPage(3 * POS_PRODUCT_ROWS_PER_PAGE)
      } else {
        setProductsPerPage(10)
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

export function getOrderComputedTotal(order: any) {
  if (Array.isArray(order.items) && order.items.length > 0) {
    return order.items.reduce((sum: number, item: any) => sum + (Number(item.priceSnapshot ?? item.price ?? item.unitPrice ?? 0) * Number(item.quantity ?? 1)), 0)
  }
  return order.totalAmount ?? order.total ?? 0
}
