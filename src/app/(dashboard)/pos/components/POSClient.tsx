"use client"

import * as React from "react"
import { addDoc, collection, doc, getDocs, limit, query, serverTimestamp, updateDoc, where, writeBatch } from "firebase/firestore"
import { signOut } from "firebase/auth"
import { useSearchParams, useRouter } from "next/navigation"
import { useCollection, useFirestore, useMemoFirebase, useAuth } from "@/firebase"
import { 
  Banknote, 
  ShoppingCart, 
  Zap, 
  Loader2,
  X
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
import { useToast } from "@/hooks/use-toast"
import { OrderService } from "@/services/order.service"
import {
  closeActiveTableSession,
  getOrCreateActiveTableSession,
  type RestaurantTableRecord,
} from "@/services/table-session.service"
import { cn } from "@/lib/utils"
import { getOptimizedImage } from "@/lib/image"
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
  getKitchenOrderItems,
  orderHasKitchenItems,
  resolveProductPreparationMode,
} from "@/utils/preparation-logic"
import POSLayout from "./POSLayout"
import type { POSTab } from "./POSHeader"
import CategorySidebar from "./CategorySidebar"
import ProductGrid from "./ProductGrid"
import CartPanel, { type PosPaymentMode } from "./CartPanel"

const STATUS_LABELS = {
  pending: "En attente",
  preparing: "En pr\u00e9paration",
  ready: "Pr\u00eates",
  served: "Servies",
  completed: "Termin\u00e9es",
} as const

const warnedMissingKitchenStatusOrders = new Set<string>()

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
  const [turboMode, setTurboMode] = React.useState(false)
  const [discountRate, setDiscountRate] = React.useState(0)
  const [selectedPaymentMode, setSelectedPaymentMode] = React.useState<PosPaymentMode | null>(null)
  const [closeDialogOpen, setCloseDialogOpen] = React.useState(false)
  const [declaredCashInput, setDeclaredCashInput] = React.useState("")
  const [declaredMobileInput, setDeclaredMobileInput] = React.useState("")
  const [configProduct, setConfigProduct] = React.useState<any | null>(null)
  const [configSelections, setConfigSelections] = React.useState<Record<string, SelectedCartOption>>({})
  const [configLinkedSelections, setConfigLinkedSelections] = React.useState<LinkedOptionSelection[]>([])
  const [configValidationError, setConfigValidationError] = React.useState<string | null>(null)
  const previousOrderIdsRef = React.useRef<Set<string>>(new Set())
  const previousOrderStatusRef = React.useRef<Map<string, string>>(new Map())
  const hasInitializedOrderSoundRef = React.useRef(false)
  
  // Pagination
  const [currentPage, setCurrentPage] = React.useState(0)
  const ITEMS_PER_PAGE = 48

  const tables = safeTables as RestaurantTableRecord[]
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
    { id: ORDER_OPERATION_STATUS.PENDING, color: "border-orange-500" },
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

  const unpaidServedCount = React.useMemo(() => {
    return posVisibleOrders.filter((order: any) => {
      const orderStatus = getPOSOperationStatus(order)
      return (
        orderStatus === ORDER_OPERATION_STATUS.SERVED ||
        orderStatus === ORDER_OPERATION_STATUS.PICKED_UP
      ) && !isOrderPaid(order)
    }).length
  }, [posVisibleOrders])

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
          name: method?.name ?? config.methodCode,
          logoUrl: method?.logoUrl,
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
    return filtered
  }, [safeProducts, selectedCategoryId])

  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE)
  const paginatedProducts = filteredProducts.slice(
    currentPage * ITEMS_PER_PAGE,
    (currentPage + 1) * ITEMS_PER_PAGE
  )

  // Reset page when category changes
  React.useEffect(() => {
    setCurrentPage(0)
  }, [selectedCategoryId])

  React.useEffect(() => {
    if (!initialTableId || tables.length === 0) return
    if (!tables.some((table) => table.id === initialTableId)) return

    setOrderType("dine-in")
    setTableNumber(initialTableId)
  }, [initialTableId, tables])

  function getDisplayPrice(product: any) {
    if (product.basePrice) return product.basePrice
    if (product.price) return product.price

    if (product.sizes?.length) {
      return Math.min(...product.sizes.map((s: any) => s.price || Infinity))
    }

    if (product.variants?.length) {
      return Math.min(...product.variants.map((v: any) => v.price || Infinity))
    }

    return null
  }

  const formatDisplayPrice = (product: any) => {
    const price = getDisplayPrice(product)
    return Number.isFinite(price) ? `${Math.round(Number(price)).toLocaleString()} FCFA` : "-"
  }

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

  const addToCart = (product: any) => {
    if (!product?.id) return

    setCart((current) => {
      const existing = current.find(item => item.id === product.id)
      if (existing) {
        return current.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
      }

      return [...current, { ...product, quantity: 1 }]
    })
    
    if (!turboMode) {
      toast({ title: "Ajouté", description: product.name, duration: 500 })
    }
  }

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
        if (printed) toast({ title: "Ticket imprimé" })
      })
  }, [restaurant, toast])

  const openProductSelector = (product: any) => {
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
  }

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
        },
      ]
    })

    closeProductSelector()
    if (!turboMode) {
      toast({ title: "Ajouté", description: configProduct.name, duration: 500 })
    }
  }

  const handleCheckout = async (method: "cash" | "mobile") => {
    if (!db || !restaurantId || !user || cart.length === 0) return

    if (!activeCashSession) {
      toast({
        title: "Caisse fermee",
        description: "Ouvrez une session de caisse avant de vendre.",
        variant: "destructive",
      })
      return
    }
    
    if (orderType === "dine-in" && !tableNumber) {
      toast({
        title: "Table requise",
        description: "Veuillez sélectionner une table.",
        variant: "destructive",
      })
      return
    }
    
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
        }
      })

      const selectedMobileConfig = mobilePaymentMethods.find((paymentMethod: any) => paymentMethod.code === selectedMobileMethodCode)
      let mobilePaymentCode: string | null = null

      if (method === "mobile") {
        if (!selectedMobileConfig || !countryCode) {
          throw new Error("Methode mobile money non configuree")
        }

        const paymentResult = await generatePaymentLinkOrUSSD({
          methodCode: selectedMobileConfig.code,
          countryCode,
          merchant: selectedMobileConfig.merchantNumber,
          amount: total,
          db,
        })
        mobilePaymentCode = paymentResult.value
      }

      const requiresKitchen = orderHasKitchenItems(recalculatedItems)

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
        paymentStatus: method === "mobile" ? ORDER_PAYMENT_STATUS.PENDING_MOBILE : ORDER_PAYMENT_STATUS.PAID,
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
        paymentCode: mobilePaymentCode,
        cashSessionId: activeCashSession.id,
        amount: total,
        staff: {
          userId: user.uid,
          staffId: staffSnapshot.staffId,
          staffName: staffSnapshot.staffName,
        },
        printedClient: method === "cash",
      })

      if (method === "cash") {
        await updateActiveCashSessionTotals("cash", total)
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
      if (method === "cash") {
        queuePrint(printableOrder, "client", { automatic: true })
      }

      setCart([])
      setTableNumber(null)
      setOrderType("takeaway")
      toast({ title: "Vente validée", description: `Encaissement ${method.toUpperCase()} terminé.` })
      
      if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(100)
      }
    } catch (error) {
      console.error("POS checkout error:", error)
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de finaliser la vente." })
    } finally {
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
    if (!db || !restaurantId || !activeCashSession?.id || processing) return

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

      if (method === "mobile") {
        const selectedMobileConfig = mobilePaymentMethods.find((item: any) => item.code === selectedMobileMethodCode)
        if (!selectedMobileConfig || !countryCode) {
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
        paymentMethod = selectedMobileConfig.code
      }

      const beforeOrder = await processOrderPaymentTransaction({
        db,
        restaurantId,
        orderId: order.id,
        method,
        paymentMethod,
        paymentCode,
        cashSessionId: activeCashSession.id,
        amount: getOrderComputedTotal(order),
        staff: {
          userId: user.uid,
          staffId: staffSnapshot.staffId,
          staffName: staffSnapshot.staffName,
        },
        printedClient: method === "cash" && !order.printedClient,
      })

      if (method === "cash") {
        await updateActiveCashSessionTotals("cash", getOrderComputedTotal(order))
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
        title: method === "cash" ? "Commande encaissee" : "Paiement mobile genere",
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
    toast({ title: "Panier mis en attente", description: "La vente courante a ete retiree de l'ecran caisse." })
  }

  const handleCheckoutSelectedPayment = () => {
    if (!selectedPaymentMode) {
      toast({
        title: "Mode de paiement requis",
        description: "Sélectionnez Espèces ou Mobile Money avant d'encaisser.",
        variant: "destructive",
      })
      return
    }

    if (selectedPaymentMode === "cash") {
      void handleCheckout("cash")
      return
    }

    if (selectedPaymentMode === "mobile") {
      if (!selectedMobileMethodCode) {
        toast({
          title: "Canal Mobile Money requis",
          description: "Selectionnez le moyen Mobile Money utilise.",
          variant: "destructive",
        })
        return
      }
      void handleCheckout("mobile")
      return
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
      sidebar={
        activeTab === "cashier" && activeCashSession ? (
          <CategorySidebar
            categories={safeCategories}
            selectedCategoryId={selectedCategoryId}
            onSelectCategory={setSelectedCategoryId}
          />
        ) : undefined
      }
      center={
        activeTab === "cashier" && activeCashSession ? (
          <div className="flex h-full min-h-0 flex-col">
            <div className="mb-3 flex shrink-0 items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-black uppercase text-primary">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    Session ouverte
                  </span>
                   <span>Début : {formatSessionDateTime(activeCashSession.openedAt)}</span>
                </div>
                <div className="mt-1 text-xs font-bold text-muted-foreground">
                  <span>Caissier : {activeCashSession.staffName || staffSnapshot.staffName}</span>
                {discountRate > 0 ? (
                  <>
                    <span className="mx-2">/</span>
                    <span className="text-primary">Remise {Math.round(discountRate * 100)}%</span>
                  </>
                ) : null}
                </div>
              </div>
              <Button
                variant={turboMode ? "default" : "outline"}
                size="sm"
                onClick={() => setTurboMode(!turboMode)}
                className="h-9 shrink-0 rounded-md px-3 text-xs font-black"
              >
                <Zap className="h-4 w-4" />
                {turboMode ? "Turbo" : "Normal"}
              </Button>
            </div>

            <ProductGrid
              products={paginatedProducts}
              categories={safeCategories}
              loading={isLoadingVisible}
              formatPrice={formatDisplayPrice}
              onProductClick={openProductSelector}
            />

            {totalPages > 1 ? (
              <div className="mt-3 flex shrink-0 items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-3 text-xs font-black"
                  disabled={currentPage === 0}
                  onClick={() => setCurrentPage((page) => page - 1)}
                >
                  Préc.
                </Button>
                <span className="text-xs font-black text-muted-foreground">
                  {currentPage + 1} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-3 text-xs font-black"
                  disabled={currentPage === totalPages - 1}
                  onClick={() => setCurrentPage((page) => page + 1)}
                >
                  Suiv.
                </Button>
              </div>
            ) : null}

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
          </div>
        ) : undefined
      }
      right={
        activeTab === "cashier" && activeCashSession ? (
          <CartPanel
            cart={cart}
            subtotal={subtotal}
            discountAmount={discountAmount}
            total={total}
            processing={processing}
            canCheckout={
              Boolean(activeCashSession) &&
              cart.length > 0 &&
              Boolean(selectedPaymentMode) &&
              !(selectedPaymentMode === "mobile" && !selectedMobileMethodCode) &&
              !(orderType === "dine-in" && !tableNumber)
            }
            orderType={orderType}
            tableNumber={tableNumber}
            tables={tables}
            paymentMode={selectedPaymentMode}
            mobilePaymentMethods={mobilePaymentMethods}
            selectedMobileMethodCode={selectedMobileMethodCode}
            onPaymentModeChange={handlePaymentModeChange}
            onMobileMethodChange={setSelectedMobileMethodCode}
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
            }}
            onHold={handleHoldCart}
            onDiscount={handleApplyDiscount}
            onCheckout={handleCheckoutSelectedPayment}
          />
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
            <div className="grid grid-cols-5 gap-4 h-full p-4">
              {posColumns.map((column) => {
                const columnOrders = posOrders[column.id] ?? []

                return (
                  <div key={column.id} className="bg-card rounded-xl p-3 flex flex-col h-full min-h-0 border">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-semibold text-xs uppercase">{STATUS_LABELS[column.id as keyof typeof STATUS_LABELS]}</h3>
                      <span className="text-xs">{columnOrders.length}</span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2">
                      {columnOrders.map((order: any) => {
                        const paymentSession = getPaymentSessionForOrder(order, safeTableSessions)
                        const paymentRequestStatus = paymentSession?.paymentRequest?.status
                        const hasSessionPaymentRequest =
                          paymentRequestStatus === "requested" ||
                          paymentRequestStatus === "pending_confirmation"
                        const isPaid = isOrderPaid(order) || paymentRequestStatus === "validated"
                        const isMobilePayment = isMobileMoneyOrder(order) || paymentSession?.paymentRequest?.method === "mobile"
                        const isPendingMobilePayment = (order.paymentStatus === "pending_mobile" || order.paymentStatus === "pending") && isMobilePayment
                        const isPaymentVisible =
                          hasSessionPaymentRequest ||
                          order.paymentStatus === "pending_verification" ||
                          isPendingMobilePayment ||
                          order.paymentStatus === "pending_cash" ||
                          isPaid
                        const canVerifyPayment =
                          hasSessionPaymentRequest ||
                          order.paymentStatus === "pending_verification" ||
                          isPendingMobilePayment ||
                          order.paymentStatus === "pending_cash"
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
                        const tableLabel =
                          tables.find((table) => table.id === order.tableId)?.name ||
                          order.tableNumber ||
                          order.table ||
                          (order.tableId ? order.tableId.slice(-2).toUpperCase() : "")
                        const oneLineProducts = (Array.isArray(order.items) ? order.items : [])
                          .map((item: any) => `${item.quantity}x ${item.name || item.nameSnapshot}`)
                          .join(" · ")

                        return (
                          <div key={order.id} className="rounded-lg border bg-background p-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-xs font-black">{getOrderDisplayId(order)}</p>
                                <p className="text-[9px] font-bold uppercase text-muted-foreground">
                                  {normalizedType === "dine_in"
                                    ? `SUR PLACE${tableLabel ? ` · TABLE ${tableLabel}` : ""}`
                                    : normalizedType === "delivery"
                                      ? "LIVRAISON"
                                      : "A EMPORTER"}
                                </p>
                              </div>
                              <p className="shrink-0 text-xs font-black text-primary">
                                {getOrderComputedTotal(order).toLocaleString()} FCFA
                              </p>
                            </div>

                            <p className="mt-2 line-clamp-1 text-[10px] font-semibold text-muted-foreground">
                              {oneLineProducts || "Aucun produit"}
                            </p>

                            <Button
                              variant="outline"
                              className="mt-2 h-7 w-full text-[9px] font-black"
                              onClick={() => queuePrint(order, "client")}
                            >
                              Réimprimer
                            </Button>

                            {!isPaid ? (
                              <div className="mt-3 space-y-2 rounded-md bg-muted/50 p-2">
                                {isPaymentVisible ? (
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-semibold text-muted-foreground">Mode:</span>
                                    <span className="text-[10px] font-black">
                                      {paymentSession?.paymentRequest?.method === "cash"
                                        ? "Espèces"
                                        : isMobilePayment
                                          ? paymentSession?.paymentRequest?.provider || "Mobile Money"
                                          : "Cash"}
                                    </span>
                                  </div>
                                ) : null}
                                <p className={cn("text-right text-[10px] font-black", canVerifyPayment ? "text-amber-600" : "text-muted-foreground")}>
                                  {paymentLabel}
                                </p>

                                {isPaymentVisible ? (
                                  <Button
                                    className="mt-2 h-7 w-full bg-primary text-[9px] font-black hover:bg-primary/90"
                                    disabled={processing || !canVerifyPayment}
                                    onClick={() => paymentSession ? validateTableSessionPayment(paymentSession) : markOrderPaid(order)}
                                  >
                                    {isMobilePayment ? "Valider paiement" : "Encaisser (cash)"}
                                  </Button>
                                ) : null}
                              </div>
                            ) : isPaid && normalizedType !== "dine_in" && currentOrderStatus === ORDER_OPERATION_STATUS.PENDING ? (
                              <div className="mt-2 rounded-md bg-muted px-2 py-1 text-center text-[9px] font-black uppercase text-foreground">
                                Payée - en attente de préparation
                              </div>
                            ) : isPaid ? (
                              <div className="mt-2 rounded-md bg-muted px-2 py-1 text-center text-[9px] font-black uppercase text-foreground">
                                Paiement confirmé
                              </div>
                            ) : null}

                            {canComplete ? (
                              <Button
                                className="mt-2 h-7 w-full text-[9px] font-black"
                                disabled={processing}
                                onClick={() => markOrderCompleted(order)}
                              >
                                Terminer
                              </Button>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      }
    />

    <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Clôture de caisse</DialogTitle>
          <DialogDescription>
            Vérifiez le résumé système, saisissez les montants réels, puis confirmez la fermeture.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-3">
            <p className="mb-2 text-[10px] font-black uppercase text-muted-foreground">Résumé avant validation</p>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <CloseAmount label="Espèces" value={closeSessionDiff.systemCash} />
              <CloseAmount label="Mobile money" value={closeSessionDiff.systemMobile} />
              <CloseAmount label="Total global" value={closeSessionDiff.systemTotal} strong />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="declared-cash">Montant réel cash</Label>
              <Input
                id="declared-cash"
                inputMode="numeric"
                type="number"
                min={0}
                value={declaredCashInput}
                onChange={(event) => setDeclaredCashInput(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="declared-mobile">Montant réel mobile money</Label>
              <Input
                id="declared-mobile"
                inputMode="numeric"
                type="number"
                min={0}
                value={declaredMobileInput}
                onChange={(event) => setDeclaredMobileInput(event.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-sm">
            <DiffAmount label="Écart cash" value={closeSessionDiff.cash} />
            <DiffAmount label="Écart mobile" value={closeSessionDiff.mobile} />
            <DiffAmount label="Écart total" value={closeSessionDiff.total} strong />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={processing} onClick={() => setCloseDialogOpen(false)}>
            Annuler
          </Button>
          <Button disabled={processing} onClick={closeMyCashSession}>
            {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Confirmer clôture
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}

function CloseAmount({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-black", strong ? "text-base text-primary" : "text-sm")}>
        {value.toLocaleString("fr-FR")} FCFA
      </p>
    </div>
  )
}

function DiffAmount({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  const hasDiff = value !== 0

  return (
    <div className={cn("rounded-lg border p-2", hasDiff ? "border-orange-300 bg-orange-500/10" : "bg-muted/40")}>
      <p className="text-[10px] font-black uppercase text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-black", strong ? "text-base" : "text-sm", hasDiff ? "text-orange-600" : "text-foreground")}>
        {value.toLocaleString("fr-FR")} FCFA
      </p>
    </div>
  )
}

function normalizeMoneyInput(value: string) {
  const amount = Math.round(Number(value || 0))
  return Number.isFinite(amount) && amount > 0 ? amount : 0
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
