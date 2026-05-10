"use client"

import * as React from "react"
import { collection, orderBy, query } from "firebase/firestore"
import { useSearchParams } from "next/navigation"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { 
  Search, 
  CreditCard, 
  Banknote, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  Zap, 
  Table as TableIcon, 
  Loader2,
  ArrowLeft,
  Store,
  GripVertical,
  TrendingUp
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { OrderService } from "@/services/order.service"
import {
  getOrCreateActiveTableSession,
  type RestaurantTableRecord,
} from "@/services/table-session.service"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { getOptimizedImage } from "@/lib/image"
import {
  getConfiguredCartItemId,
  recalculateConfiguredUnitPrice,
} from "@/lib/order-pricing"
import { useRestaurant } from "@/design-system/context/RestaurantContext"
import { CatalogProvider, useCatalog } from "@/modules/catalog/CatalogProvider"
import ProductSelectorModal, {
  type ProductSelectorCartItem,
} from "@/modules/products/components/ProductSelectorModal"

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
  const searchParams = useSearchParams()
  const { restaurantId } = useRestaurant()
  const { products, categories, isLoadingVisible } = useCatalog()
  const { toast } = useToast()
  
  const [searchTerm, setSearchTerm] = React.useState("")
  const [cart, setCart] = React.useState<any[]>([])
  
  // ✅ GESTION DES TABLES
  const [orderType, setOrderType] = React.useState<"dine-in" | "takeaway">("takeaway")
  const [tableNumber, setTableNumber] = React.useState<string | null>(null)
  
  const [processing, setProcessing] = React.useState(false)
  const [viewMode, setViewMode] = React.useState<"categories" | "products">("categories")
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null)
  const [turboMode, setTurboMode] = React.useState(false)
  const [selectorCategory, setSelectorCategory] = React.useState<any | null>(null)
  const [selectorProducts, setSelectorProducts] = React.useState<any[]>([])
  const [selectorInitialProduct, setSelectorInitialProduct] = React.useState<any | null>(null)
  
  // ✅ DOUBLE TAP: ref et feedback visuel
  const lastTapRef = React.useRef<number>(0)
  const [lastTappedProductId, setLastTappedProductId] = React.useState<string | null>(null)
  
  // ✅ CATEGORY USAGE: tracker l'utilisation des catégories
  const [categoryUsage, setCategoryUsage] = React.useState<Record<string, number>>({})

  const tablesQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return query(
      collection(db, "restaurants", restaurantId, "tables"),
      orderBy("createdAt", "asc")
    )
  }, [db, restaurantId])
  const { data: tablesData } = useCollection<RestaurantTableRecord>(tablesQuery)
  const tables = tablesData || []
  const initialTableId = searchParams?.get("tableId")

  // ✅ BONUS: sauvegarder categoryUsage dans localStorage
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("categoryUsage")
      if (saved) {
        setCategoryUsage(JSON.parse(saved))
      }
    } catch (e) {
      console.error("Erreur chargement categoryUsage", e)
    }
  }, [])
  
  React.useEffect(() => {
    try {
      localStorage.setItem("categoryUsage", JSON.stringify(categoryUsage))
    } catch (e) {
      console.error("Erreur sauvegarde categoryUsage", e)
    }
  }, [categoryUsage])
  
  // ✅ BONUS: mémoriser la dernière table utilisée
  React.useEffect(() => {
    try {
      const savedTable = localStorage.getItem("lastTableNumber")
      if (savedTable) {
        setTableNumber(savedTable)
      }
    } catch (e) {
      console.error("Erreur chargement dernière table", e)
    }
  }, [])

  React.useEffect(() => {
    if (!initialTableId || tables.length === 0) return
    if (!tables.some((table) => table.id === initialTableId)) return

    setOrderType("dine-in")
    setTableNumber(initialTableId)
  }, [initialTableId, tables])

  // OPTIMISATION PRO : produits par catégorie pré-indexés
  const productsByCategory = React.useMemo(() => {
    if (!products) return {}
    return products.reduce((acc: Record<string, any[]>, p: any) => {
      if (p.isActive === false) return acc
      const catId = p.categoryId || "uncategorized"
      if (!acc[catId]) acc[catId] = []
      acc[catId].push(p)
      return acc
    }, {})
  }, [products])

  // Fallback image produit (catégorie si produit sans image)
  const getProductImage = (product: any) => {
    if (product.imageUrl) return product.imageUrl
    const category = categories?.find((c: any) => c.id === product.categoryId)
    if (category?.imageUrl) return category.imageUrl
    return null
  }

  // Produits filtrés (optimisé)
  const filteredProducts = React.useMemo(() => {
    if (!selectedCategory) return []
    const catProducts = productsByCategory[selectedCategory] || []
    if (!searchTerm) return catProducts
    return catProducts.filter((p: any) => 
      p.name?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [productsByCategory, selectedCategory, searchTerm])

  // ✅ CATEGORIES TRIÉES PAR UTILISATION (plus utilisées en premier)
  const sortedCategories = React.useMemo(() => {
    if (!categories) return []
    
    return [...categories]
      .filter((cat: any) => 
        cat.name?.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a: any, b: any) => {
        const usageA = categoryUsage[a.id] || 0
        const usageB = categoryUsage[b.id] || 0
        
        // Priorité à l'utilisation, puis alphabétique
        if (usageA !== usageB) return usageB - usageA
        return a.name.localeCompare(b.name, "fr", { sensitivity: "base" })
      })
  }, [categories, categoryUsage, searchTerm])
  
  // ✅ Top 5 catégories les plus utilisées
  const topCategories = React.useMemo(() => {
    return sortedCategories.slice(0, 5)
  }, [sortedCategories])
  
  // ✅ Reste des catégories (après le top 5)
  const remainingCategories = React.useMemo(() => {
    return sortedCategories.slice(5)
  }, [sortedCategories])

  const visibleCategories = sortedCategories

  // Long press timer pour ajout rapide x2
  let pressTimer: NodeJS.Timeout
  const handleLongPressStart = (product: any) => {
    pressTimer = setTimeout(() => {
      addToCart(product)
      addToCart(product)
      if (!turboMode) {
        toast({ title: "Ajout x2", description: product.name, duration: 500 })
      }
    }, 500)
  }
  const handleLongPressEnd = () => {
    clearTimeout(pressTimer)
  }

  const closeProductSelector = () => {
    setSelectorCategory(null)
    setSelectorProducts([])
    setSelectorInitialProduct(null)
  }

  const openProductSelector = (
    category: any,
    categoryProducts: any[],
    initialProduct?: any
  ) => {
    if (categoryProducts.length === 0) return

    setSelectorCategory(category)
    setSelectorProducts(categoryProducts)
    setSelectorInitialProduct(initialProduct ?? categoryProducts[0])
  }

  const handleCategorySelect = (category: any) => {
    const categoryProducts = productsByCategory[category.id] || []
    
    // ✅ INCRÉMENTER L'UTILISATION DE LA CATÉGORIE
    setCategoryUsage(prev => ({
      ...prev,
      [category.id]: (prev[category.id] || 0) + 1
    }))

    setSelectedCategory(category.id)
    setSearchTerm("")
    openProductSelector(category, categoryProducts, categoryProducts[0])
  }

  const handleProductSelect = (product: any) => {
    const hasOptions = Array.isArray(product.options) && product.options.length > 0

    if (!hasOptions) {
      addToCart(product)
      return
    }

    const category = categories?.find((cat: any) => cat.id === product.categoryId)
    const categoryProducts = productsByCategory[product.categoryId] || [product]
    openProductSelector(category, categoryProducts, product)
  }

  const addToCart = (product: any) => {
    const existing = cart.find(item => item.id === product.id)
    if (existing) {
      setCart(cart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item))
    } else {
      setCart([...cart, { ...product, quantity: 1 }])
    }
    
    if (!turboMode) {
      toast({ title: "Ajouté", description: product.name, duration: 800 })
    }
  }

  // ✅ DOUBLE TAP: ajout direct avec dernier choix + feedback visuel
  const addToCartWithLastSelection = (product: any) => {
    try {
      const saved = localStorage.getItem("lastProductSelection")
      if (!saved) {
        addToCart(product)
        return
      }

      const parsed = JSON.parse(saved)

      if (parsed.productId === product.id) {
        setCart((prev) => {
          const existing = prev.find((item) => item.id === product.id)

          if (existing) {
            return prev.map((item) =>
              item.id === product.id
                ? { ...item, quantity: item.quantity + (parsed.quantity || 1) }
                : item
            )
          }

          return [
            ...prev,
            {
              ...product,
              quantity: parsed.quantity || 1,
            },
          ]
        })
        
        if (!turboMode) {
          toast({ title: "Ajouté (× rapide)", description: product.name, duration: 800 })
        }
      } else {
        addToCart(product)
      }
    } catch (e) {
      console.error("double tap error", e)
      addToCart(product)
    }
  }

  const addConfiguredToCart = (item: ProductSelectorCartItem) => {
    const cartItemId = getConfiguredCartItemId(item.productId, item.selectedOptions)

    setCart((current) => {
      const existing = current.find((cartItem) => cartItem.id === cartItemId)

      if (existing) {
        return current.map((cartItem) =>
          cartItem.id === cartItemId
            ? { ...cartItem, quantity: cartItem.quantity + item.quantity }
            : cartItem
        )
      }

      return [
        ...current,
        {
          ...item.product,
          id: cartItemId,
          productId: item.productId,
          name: item.name,
          imageUrl: item.imageUrl,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          selectedOptions: item.selectedOptions,
        },
      ]
    })

    closeProductSelector()

    if (!turboMode) {
      toast({ title: "Ajouté", description: item.name, duration: 800 })
    }
  }

  const removeFromCart = (productId: string) => {
    const existing = cart.find(item => item.id === productId)
    if (existing?.quantity === 1) {
      setCart(cart.filter(item => item.id !== productId))
    } else {
      setCart(cart.map(item => item.id === productId ? { ...item, quantity: item.quantity - 1 } : item))
    }
  }

  const total = cart.reduce((acc, item) => acc + (getProductPrice(item) * item.quantity), 0)

  // ✅ CHECKOUT MODIFIÉ: validation + TypeScript fix
  const handleCheckout = async (method: string) => {
    if (!db || !restaurantId || cart.length === 0) return
    
    // ✅ VALIDATION: si sur place mais pas de table sélectionnée
    if (orderType === "dine-in" && !tableNumber) {
      toast({
        title: "Table requise",
        description: "Veuillez sélectionner une table pour une commande sur place.",
        variant: "destructive",
      })
      return
    }
    
    setProcessing(true)
    
    const orderService = new OrderService(db)
    try {
      const recalculatedItems = cart.map((item) => {
        const productId = item.productId ?? item.id
        const product = products.find((currentProduct: any) => currentProduct.id === productId)

        if (!product) {
          throw new Error(`Produit introuvable: ${productId}`)
        }

        return {
          productId,
          nameSnapshot: item.name,
          priceSnapshot: recalculateConfiguredUnitPrice(
            product,
            item.selectedOptions ?? []
          ),
          quantity: item.quantity,
          selectedOptions: item.selectedOptions ?? [],
        }
      })

      // ✅ TYPE SCRIPT FIX: mapping correct des types
      const orderData: any = {
        restaurantId: restaurantId,
        type: orderType === "dine-in" ? "table" : "takeaway",
        items: recalculatedItems
      }

      if (orderType === "dine-in" && tableNumber) {
        const tableSession = await getOrCreateActiveTableSession(db, restaurantId, tableNumber)
        orderData.tableId = tableSession.tableId
        orderData.zoneId = tableSession.zoneId
        orderData.sessionId = tableSession.sessionId
        orderData.source = "pos"
      }

      const orderId = await orderService.createOrder(orderData)

      if (method === 'cash' || method === 'mobile') {
        await orderService.processPayment(orderId, restaurantId, method)
      }

      setCart([])
      setTableNumber(null)
      setOrderType("takeaway")
      toast({ title: "Vente validée", description: `Encaissement ${method.toUpperCase()} terminé.` })
      
      // Vibration si supporté (optionnel)
      if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(200)
      }
    } catch (error) {
      console.error("POS checkout error:", error)
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de finaliser la vente." })
    } finally {
      setProcessing(false)
    }
  }

  // ✅ BONUS: sauvegarder la dernière table utilisée
  const handleTableSelect = (tableId: string) => {
    setTableNumber(tableId)
    try {
      localStorage.setItem("lastTableNumber", tableId)
    } catch (e) {
      console.error("Erreur sauvegarde table", e)
    }
  }

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-black italic text-primary uppercase tracking-tighter flex items-center gap-3">
            <ShoppingCart className="h-8 w-8 md:h-10 md:w-10" />
            {viewMode === "categories" ? "Point de Vente" : categories?.find((c: any) => c.id === selectedCategory)?.name || "Produits"}
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground font-medium">
            {viewMode === "categories" 
              ? "Sélectionnez une catégorie pour commencer" 
              : "Ajoutez des produits au panier"
            }
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Turbo Toggle */}
          <Button
            variant={turboMode ? "default" : "outline"}
            size="sm"
            onClick={() => setTurboMode(!turboMode)}
            className="rounded-full text-xs font-black h-8 gap-1"
          >
            <Zap className="h-3 w-3" />
            {turboMode ? "Turbo ON" : "Mode normal"}
          </Button>
          
          <Badge variant="outline" className="py-2 px-4 bg-primary/5 font-black uppercase">
            <Zap className="mr-2 h-4 w-4 text-primary" />
            Caisse active
          </Badge>
        </div>
      </div>

      {/* MAIN GRID */}
      <div className="grid lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
      
      {/* Product Selection */}
      <div className="lg:col-span-2 flex flex-col gap-4">
        
        {/* Header avec retour et recherche */}
        <div className="flex items-center gap-3">
          {viewMode === "products" && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                setViewMode("categories")
                setSelectedCategory(null)
                setSearchTerm("")
              }}
              className="h-11 w-11 rounded-xl shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder={viewMode === "products" ? "Rechercher un produit..." : "Rechercher une catégorie..."} 
              className="pl-10 h-11 bg-card/50 border-none shadow-sm rounded-xl text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* TABS CATÉGORIES RAPIDES (MODE PRODUITS) */}
        {viewMode === "products" && categories && categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
            {categories.map((cat: any) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={cn(
                  "px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 touch-manipulation",
                  selectedCategory === cat.id
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {/* GRID PRODUITS / CATÉGORIES */}
        <ScrollArea className="flex-1">
          <div className="space-y-6">
            
            {/* ✅ TOP 5 CATÉGORIES - BARRE STICKY ULTRA RAPIDE */}
            {viewMode === "categories" && topCategories.length > 0 && (
              <div className="sticky top-0 z-20 bg-background pb-3 border-b border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-3 w-3 text-primary" />
                  <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                    Accès rapide
                  </p>
                </div>
                <div className="flex gap-2 overflow-x-auto px-1">
                  {topCategories.map((cat: any) => (
                    <button
                      key={cat.id}
                      onClick={() => handleCategorySelect(cat)}
                      className="shrink-0 px-4 py-2 rounded-full bg-primary text-white text-xs font-black shadow-md active:scale-95 transition-all"
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ✅ TOUTES LES CATÉGORIES */}
            {viewMode === "categories" && (
              <div className="space-y-3">
                {isLoadingVisible ? (
                  <CatalogGridSkeleton />
                ) : topCategories.length > 0 && (
                  <div className="flex items-center gap-2 pt-2">
                    <div className="h-px flex-1 bg-border" />
                    <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                      Toutes les catégories
                    </p>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                )}
                
                {!isLoadingVisible && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 items-start gap-4">
                  {remainingCategories.map((cat: any) => (
                    <button
                      key={cat.id}
                      onClick={() => handleCategorySelect(cat)}
                      className="group flex w-full flex-col rounded-2xl bg-card text-center shadow-md transition-all duration-200 hover:shadow-xl md:hover:scale-[1.02] active:scale-95 cursor-pointer touch-manipulation"
                    >
                      <div className="aspect-square w-full overflow-hidden rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200">
                        {cat.imageUrl ? (
                          <img
                            src={getOptimizedImage(cat.imageUrl, 300)}
                            className="h-full w-full rounded-2xl object-cover"
                            alt={cat.name}
                            loading="lazy"
                            width={300}
                            height={300}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center rounded-2xl">
                            <Store className="h-8 w-8 sm:h-10 sm:w-10 text-gray-400" />
                          </div>
                        )}
                      </div>

                      <p className="mt-2 w-full truncate px-1 text-center text-sm font-semibold sm:text-base">
                        {cat.name}
                      </p>
                    </button>
                  ))}
                </div>
                )}
              </div>
            )}

            {/* MODE PRODUITS */}
            {viewMode === "products" && (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 items-start gap-4">
                {filteredProducts.map((product: any) => {
                  const displayImage = getProductImage(product)
                  const hasOptions = Array.isArray(product.options) && product.options.length > 0
                  
                  return (
                    <button
                      key={product.id}
                      onClick={() => {
                        // ✅ DOUBLE TAP: détection de double clic rapide + feedback
                        const now = Date.now()
                        if (now - lastTapRef.current < 300) {
                          setLastTappedProductId(product.id)
                          addToCartWithLastSelection(product)
                          setTimeout(() => setLastTappedProductId(null), 300)
                        } else {
                          handleProductSelect(product)
                        }
                        lastTapRef.current = now
                      }}
                      onTouchStart={() => {
                        if (!hasOptions) handleLongPressStart(product)
                      }}
                      onTouchEnd={handleLongPressEnd}
                      onMouseDown={() => {
                        if (!hasOptions) handleLongPressStart(product)
                      }}
                      onMouseUp={handleLongPressEnd}
                      onMouseLeave={handleLongPressEnd}
                      className="group relative flex flex-col text-left bg-card hover:ring-2 ring-primary/50 transition-all duration-200 rounded-xl md:rounded-2xl shadow-lg overflow-hidden active:scale-95 cursor-pointer touch-manipulation"
                    >
                      <div className="aspect-[4/3] min-h-[80px] sm:min-h-[100px] relative bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
                        {displayImage ? (
                          <img 
                            src={getOptimizedImage(displayImage, 300)} 
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
                            alt={product.name}
                            loading="lazy"
                            width={300}
                            height={225}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ShoppingCart className="h-8 w-8 sm:h-10 sm:w-10 text-gray-400" />
                          </div>
                        )}
                        <div className="absolute bottom-2 right-2 h-7 w-7 sm:h-8 sm:w-8 bg-primary rounded-full flex items-center justify-center text-white shadow-lg scale-0 group-hover:scale-100 transition-transform">
                          <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                        </div>
                        
                        {/* ✅ FEEDBACK VISUEL DOUBLE TAP */}
                        {lastTappedProductId === product.id && (
                          <div className="absolute inset-0 bg-primary/90 flex items-center justify-center text-white text-xs font-black animate-in fade-in duration-150">
                            + ajouté
                          </div>
                        )}
                      </div>
                      
                      <div className="p-2 sm:p-3 space-y-0.5">
                        <p className="text-[11px] sm:text-xs font-bold truncate">{product.name}</p>
                        <p className="text-xs sm:text-sm font-black italic text-primary">{getProductPrice(product)} FCFA</p>
                        {!turboMode && <ProductOptionsPreview product={product} />}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {/* MESSAGES VIDES */}
            {viewMode === "categories" && !isLoadingVisible && categories?.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                Aucune catégorie trouvée
              </div>
            )}
            
            {viewMode === "products" && !isLoadingVisible && filteredProducts.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                Aucun produit trouvé
              </div>
            )}

          </div>
        </ScrollArea>
      </div>

      {/* CART & CHECKOUT */}
      <Card className="flex flex-col border-none shadow-2xl rounded-2xl md:rounded-3xl overflow-hidden bg-card/80 backdrop-blur-md h-full">
        <CardHeader className="bg-primary text-primary-foreground p-4 md:p-6">
          <CardTitle className="flex items-center justify-between gap-2 italic uppercase text-sm md:text-base">
            <span className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 md:h-5 md:w-5" /> Panier
            </span>
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
              {cart.length}
            </span>
          </CardTitle>
          <CardDescription className="text-white/80 text-xs">
            {cart.length} article{cart.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="flex-1 p-0 overflow-hidden flex flex-col">
          {/* ✅ SWITCH MODE SUR PLACE / À EMPORTER */}
          <div className="p-3 md:p-4 border-b border-primary/5">
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => {
                  setOrderType("takeaway")
                  setTableNumber(null)
                }}
                className={cn(
                  "flex-1 px-3 py-2 rounded-xl text-xs font-bold transition-all",
                  orderType === "takeaway"
                    ? "bg-primary text-white shadow-md"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                🍔 À emporter
              </button>

              <button
                onClick={() => setOrderType("dine-in")}
                className={cn(
                  "flex-1 px-3 py-2 rounded-xl text-xs font-bold transition-all",
                  orderType === "dine-in"
                    ? "bg-primary text-white shadow-md"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                🍽️ Sur place
              </button>
            </div>

            {/* ✅ SÉLECTION TABLE AVEC PRÉPARATION FIRESTORE */}
            {orderType === "dine-in" && (
              <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                <p className="text-[10px] font-black uppercase text-muted-foreground">
                  Choisir une table
                </p>

                <div className="grid grid-cols-5 gap-2">
                  {tables.map((table) => {
                    const active = tableNumber === table.id
                    const occupied = table.status === "occupied"
                    
                    return (
                      <button
                        key={table.id}
                        onClick={() => handleTableSelect(table.id)}
                        className={cn(
                          "h-10 rounded-xl text-sm font-black transition-all active:scale-95",
                          active
                            ? "bg-primary text-white shadow-md"
                            : occupied
                              ? "bg-red-50 text-red-700 ring-1 ring-red-200 hover:bg-red-100"
                              : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100"
                        )}
                      >
                        {table.name || table.id}
                      </button>
                    )
                  })}
                  {tables.length === 0 && (
                    <p className="col-span-5 rounded-xl bg-muted px-3 py-4 text-center text-xs font-bold text-muted-foreground">
                      Aucune table configuree
                    </p>
                  )}
                </div>

                {!tableNumber && (
                  <p className="text-[9px] font-bold text-amber-600 text-center">
                    ⚠️ Sélectionnez une table
                  </p>
                )}
              </div>
            )}
          </div>

          <ScrollArea className="flex-1 px-3 md:px-4">
            <div className="space-y-3 md:space-y-4 py-3 md:py-4">
              {cart.map((item) => (
                <div key={item.id} className="flex items-center justify-between group animate-in slide-in-from-right-2 gap-2">
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <p className="text-xs md:text-sm font-bold truncate">{item.name}</p>
                    {Array.isArray(item.selectedOptions) && item.selectedOptions.length > 0 ? (
                      <p className="truncate text-[9px] font-bold text-primary">
                        {item.selectedOptions.map((option: any) => option.choiceName).join(", ")}
                      </p>
                    ) : null}
                    <p className="text-[9px] md:text-[10px] text-muted-foreground font-black italic">
                      {getProductPrice(item)} FCFA × {item.quantity}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 md:gap-2">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 md:h-7 md:w-7 rounded-full bg-secondary/50 hover:bg-destructive/20" 
                      onClick={() => removeFromCart(item.id)}
                    >
                      <Minus className="h-2.5 w-2.5 md:h-3 md:w-3" />
                    </Button>
                    <span className="text-xs md:text-sm font-black w-5 text-center">{item.quantity}</span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 md:h-7 md:w-7 rounded-full bg-primary/10 text-primary" 
                      onClick={() => addToCart(item)}
                    >
                      <Plus className="h-2.5 w-2.5 md:h-3 md:w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 md:h-7 md:w-7 rounded-full text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setCart(cart.filter(i => i.id !== item.id))}
                    >
                      <Trash2 className="h-2.5 w-2.5 md:h-3 md:w-3" />
                    </Button>
                  </div>
                </div>
              ))}
              {cart.length === 0 && (
                <div className="py-12 md:py-20 text-center space-y-2 opacity-30">
                  <Zap className="h-8 w-8 md:h-10 md:w-10 mx-auto" />
                  <p className="text-[10px] md:text-xs font-bold uppercase tracking-tighter italic">Panier vide</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>

        <CardFooter className="p-4 md:p-6 bg-secondary/30 flex flex-col gap-3 md:gap-4">
          <div className="flex justify-between items-center w-full">
            <span className="text-[10px] md:text-xs font-black uppercase text-muted-foreground italic">Total TTC</span>
            <span className="text-xl md:text-3xl font-black italic text-primary tracking-tighter">
              {total.toLocaleString()} FCFA
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-2 md:gap-3 w-full">
            <Button 
              className="h-11 md:h-14 rounded-xl font-black uppercase italic bg-primary hover:bg-primary/90 shadow-lg text-xs md:text-sm"
              disabled={cart.length === 0 || processing || (orderType === "dine-in" && !tableNumber)}
              onClick={() => handleCheckout('cash')}
            >
              {processing ? <Loader2 className="animate-spin h-4 w-4 md:h-5 md:w-5" /> : <><Banknote className="mr-1 md:mr-2 h-4 w-4 md:h-5 md:w-5" /> Espèces</>}
            </Button>
            <Button 
              variant="outline" 
              className="h-11 md:h-14 rounded-xl font-black uppercase italic border-2 border-primary/20 text-primary hover:bg-primary/5 text-xs md:text-sm"
              disabled={cart.length === 0 || processing || (orderType === "dine-in" && !tableNumber)}
              onClick={() => handleCheckout('mobile')}
            >
              {processing ? <Loader2 className="animate-spin h-4 w-4 md:h-5 md:w-5" /> : <><CreditCard className="mr-1 md:mr-2 h-4 w-4 md:h-5 md:w-5" /> Mobile</>}
            </Button>
          </div>
          
          <Button 
            variant="ghost" 
            className="w-full text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-destructive"
            onClick={() => {
              if (cart.length > 0) {
                setCart([])
                toast({ title: "Panier vidé" })
              }
            }}
            disabled={cart.length === 0}
          >
            <Trash2 className="mr-1 md:mr-2 h-2.5 w-2.5 md:h-3 md:w-3" /> Vider le panier
          </Button>
        </CardFooter>
      </Card>
      </div>

      {selectorCategory ? (
        <ProductSelectorModal
          mode="pos"
          category={selectorCategory}
          products={selectorProducts}
          initialProduct={selectorInitialProduct}
          onClose={closeProductSelector}
          onAddToCart={addConfiguredToCart}
        />
      ) : null}
    </div>
  )
}

function getProductPrice(product: any) {
  const basePrice = Number(product.unitPrice ?? product.basePrice ?? product.price ?? 0)
  return Math.round(basePrice)
}

function CatalogGridSkeleton() {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 items-start gap-4">
      {Array.from({ length: 12 }).map((_, index) => (
        <div key={index} className="space-y-2">
          <div className="aspect-square animate-pulse rounded-2xl bg-secondary/40" />
          <div className="mx-auto h-3 w-2/3 animate-pulse rounded-full bg-secondary/50" />
        </div>
      ))}
    </div>
  )
}

function ProductOptionsPreview({ product }: { product: any }) {
  const options = Array.isArray(product.options) ? product.options : []
  const visibleOptions = options.slice(0, 2)
  const remainingOptions = Math.max(0, options.length - visibleOptions.length)

  if (options.length === 0) {
    return (
      <p className="text-[9px] font-bold uppercase text-muted-foreground/60">
        Sans option
      </p>
    )
  }

  return (
    <div className="mt-1 space-y-0.5 border-t border-border/60 pt-1">
      {visibleOptions.map((option: any, index: number) => {
        const choices = Array.isArray(option.choices) ? option.choices : []
        const choiceNames = choices
          .slice(0, 2)
          .map((choice: any) => choice.name)
          .filter(Boolean)
          .join(", ")

        return (
          <div key={`${product.id}-option-${index}`} className="min-w-0">
            <p className="truncate text-[8px] md:text-[9px] font-black uppercase text-foreground">
              {option.name}
              {option.required && <span className="text-red-500 ml-0.5">*</span>}
            </p>
            {choiceNames ? (
              <p className="truncate text-[7px] md:text-[8px] font-medium text-muted-foreground">
                {choiceNames}
                {choices.length > 2 ? ` +${choices.length - 2}` : ""}
              </p>
            ) : null}
          </div>
        )
      })}

      {remainingOptions > 0 && (
        <p className="text-[8px] md:text-[9px] font-black text-primary">
          +{remainingOptions}
        </p>
      )}
    </div>
  )
}
