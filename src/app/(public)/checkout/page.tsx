"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  Loader2,
  Send,
  ShoppingBag,
  Store,
  User,
  Phone
} from "lucide-react"

import { CartProvider, useCart } from "@/components/public/cart-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { useDoc, useFirestore, useMemoFirebase } from "@/firebase"
import { useToast } from "@/hooks/use-toast"
import { COLLECTION_NAMES } from "@/lib/constants"
import { doc } from "firebase/firestore"

import { createOrder } from "@/services/orderService"
import type { Order } from "@/types/index"

export default function CheckoutPageWrapper() {
  return (
    <CartProvider>
      <CheckoutPage />
    </CartProvider>
  )
}

function CheckoutPage() {
  const params = useParams()
  const slug = params.slug as string

  const db = useFirestore()
  const router = useRouter()
  const { toast } = useToast()

  const { items, totalPrice, clearCart } = useCart()

  const [loading, setLoading] = React.useState(false)
  const [createdOrderId, setCreatedOrderId] = React.useState<string | null>(null)

  const [formData, setFormData] = React.useState({
    name: "",
    phone: "",
    table: "",
  })

  // 🔥 REDIRECTION TRACKING (IMPORTANT)
  React.useEffect(() => {
    if (createdOrderId) {
      router.replace(`/order/${createdOrderId}`)
    }
  }, [createdOrderId, router])

  // 🔥 FETCH RESTAURANT
  const restaurantRef = useMemoFirebase(() => {
    if (!db || !slug) return null
    return doc(db, COLLECTION_NAMES.RESTAURANTS, slug)
  }, [db, slug])

  const { data: restaurant } = useDoc(restaurantRef)

  // 🔥 SUBMIT ORDER
  const handleOrder = async (event: React.FormEvent) => {
  event.preventDefault()

  if (!restaurant || items.length === 0) return

  if (!restaurant.companyId) {
    toast({
      variant: "destructive",
      title: "Erreur",
      description: "Restaurant non configuré pour les commandes.",
    })
    return
  }

  setLoading(true)

  try {
    const orderData: Omit<Order, "id" | "createdAt"> = {
      restaurantId: restaurant.id,
      companyId: restaurant.companyId,

      mode: formData.table ? "sur_place" : "a_emporter",
      table: formData.table || undefined,

      // ✅ ALIGNÉ AVEC TON TYPE
      status: "nouvelle",

      customer: {
        name: formData.name,
        phone: formData.phone,
      },

      // ✅ ALIGNÉ AVEC OrderItem
      items: items.map((item) => {
        const total = item.price * item.quantity

        return {
          productId: item.productId,
          name: item.name,
          price: item.price, // 🔥 plus de unitPrice
          quantity: item.quantity,
          selections: item.selections || {},
          total, // 🔥 obligatoire dans ton type
        }
      }),

      total: totalPrice,
    }

    const orderRef = await createOrder(restaurant.companyId, orderData)

    setCreatedOrderId(orderRef.id)

    clearCart()

    toast({
      title: "Commande envoyée",
      description: "Suivi en temps réel activé.",
    })

  } catch (error) {
    toast({
      variant: "destructive",
      title: "Erreur",
      description: "Impossible de valider la commande.",
    })
  } finally {
    setLoading(false)
  }
}
  return (
    <div className="min-h-screen space-y-6 bg-background p-4 md:p-8">

      {/* HEADER */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="rounded-xl bg-secondary/50"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <div>
          <h1 className="text-2xl font-black uppercase tracking-tighter">
            Finaliser commande
          </h1>
          <p className="text-sm text-muted-foreground">
            Vérifiez votre panier puis confirmez.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">

        {/* PANIER */}
        <div className="space-y-6">
          <Card className="overflow-hidden rounded-2xl border-none shadow-xl">
            <CardHeader className="bg-primary p-5 text-white">
              <CardTitle className="flex items-center gap-2 uppercase">
                <ShoppingBag className="h-5 w-5" /> Récapitulatif
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4 p-5">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between border-b py-2 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-primary/10 text-xs font-black text-primary">
                      {item.quantity}x
                    </span>
                    <span className="text-sm font-bold">{item.name}</span>
                  </div>

                  <span className="text-sm font-black">
                    {(item.price * item.quantity).toLocaleString()}
                    {restaurant?.currency || "XOF"}
                  </span>
                </div>
              ))}

              <div className="flex items-center justify-between pt-4 text-xl font-black text-primary">
                <span>Total</span>
                <span>
                  {totalPrice.toLocaleString()}
                  {restaurant?.currency || "XOF"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* FORM */}
        <form onSubmit={handleOrder} className="space-y-6">

          <Card className="rounded-2xl border-none shadow-xl">
            <CardHeader className="p-5">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-xl font-black uppercase">
                  Informations
                </CardTitle>
                <Badge>
                  {formData.table ? "Sur place" : "À emporter"}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 p-5 pt-0">

              <Field
                icon={User}
                label="Nom complet"
                required
                value={formData.name}
                placeholder="Ex: Ibrahim Diallo"
                onChange={(value) =>
                  setFormData((c) => ({ ...c, name: value }))
                }
              />

              <Field
                icon={Phone}
                label="Numéro WhatsApp"
                required
                type="tel"
                value={formData.phone}
                placeholder="+223..."
                onChange={(value) =>
                  setFormData((c) => ({ ...c, phone: value }))
                }
              />

              <Field
                icon={Store}
                label="Numéro de table (optionnel)"
                value={formData.table}
                placeholder="Ex: 4"
                onChange={(value) =>
                  setFormData((c) => ({ ...c, table: value }))
                }
              />

            </CardContent>
          </Card>

          <Button
            type="submit"
            className="h-16 w-full rounded-2xl text-lg font-black uppercase shadow-[0_20px_50px_rgba(249,115,22,0.3)]"
            disabled={loading || items.length === 0}
          >
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                Envoyer la commande
                <Send className="ml-2 h-5 w-5" />
              </>
            )}
          </Button>

        </form>

      </div>
    </div>
  )
}

// 🔥 INPUT FIELD
function Field({
  icon: Icon,
  label,
  value,
  onChange,
  placeholder,
  required,
  type = "text",
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  required?: boolean
  type?: string
}) {
  return (
    <div className="space-y-2">
      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        {label}
      </Label>

      <div className="relative">
        <Icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />

        <Input
          required={required}
          type={type}
          placeholder={placeholder}
          className="h-12 rounded-xl border-none bg-secondary/30 pl-10"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </div>
  )
}
