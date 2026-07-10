"use client"

import * as React from "react"
import { doc, updateDoc, serverTimestamp, getDoc } from "firebase/firestore"
import { useRouter } from "next/navigation"
import {
  Smartphone,
  Banknote,
  ArrowRight,
  ChevronLeft,
  X
} from "lucide-react"

import { useFirestore } from "@/firebase"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ORDER_PAYMENT_STATUS } from "@/lib/order-lifecycle"
import { generatePaymentLinkOrUSSD } from "@/lib/payment-generation"

// Only define the known types for UI meta mapping. Other dynamic codes will just use a default mobile icon.
type PaymentMethod = "cash" | "orange_money" | "mtn_money" | "wave" | string
type PaymentStep = "method_group" | "mobile_methods" | "phone_input" | "success"

export interface PaymentModalProps {
  open: boolean
  onClose: () => void
  restaurantId: string
  orderId: string
  orderDetails?: {
    total: number
    orderType: "dine_in" | "takeaway" | "delivery"
    customerPhone?: string | null
    tableName?: string | null
    deliveryAddress?: {
      street: string
      zone?: string
    } | null
  }
}

export default function PaymentModal({
  open,
  onClose,
  restaurantId,
  orderId,
  orderDetails,
}: PaymentModalProps) {
  const db = useFirestore()
  const router = useRouter()
  const { toast } = useToast()

  const [step, setStep] = React.useState<PaymentStep>("method_group")
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod | null>(null)

  // Stores { code: "orange_money", name: "Orange Money" } etc.
  const [availableMethods, setAvailableMethods] = React.useState<Array<{ code: string, name: string }>>([])

  const [phone, setPhone] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState("")
  const [paymentCode, setPaymentCode] = React.useState("")
  const [orderTotal, setOrderTotal] = React.useState(orderDetails?.total || 0)

  // ❌ BLOQUER complètement pour SUR PLACE (Le paiement se fait via la page order normalement après que le status soit "servie", 
  // mais la consigne dit "Laisser : paymentStatus = pending, La caisse valide plus tard" -> Actually in page.tsx we show "Payer en espèces" or "Payer avec Mobile Money" even for dine_in if it's served.
  // Wait, the prompt said: "1. ❌ jamais afficher dine_in sans QR". But for the payment modal itself, is it blocked for dine_in? 
  // The existing PaymentModal had: `if (orderType === "dine_in") return null`. Let's remove this block because the page.tsx expects it to be openable for Mobile Money after service.
  // Wait, the user's prompt says "Payment flow dynamique". Let's just make it work for whatever `orderType` is passed.

  // 🔥 META UI
  const getPaymentMeta = (code: string) => {
    switch (code) {
      case "cash": return { name: "Espèces", icon: Banknote, color: "bg-emerald-500" }
      case "orange_money": return { name: "Orange Money", icon: Smartphone, color: "bg-amber-500" }
      case "mtn_money": return { name: "MTN Money", icon: Smartphone, color: "bg-yellow-500" }
      case "wave": return { name: "Wave", icon: Smartphone, color: "bg-blue-500" }
      default: return { name: "Mobile Money", icon: Smartphone, color: "bg-blue-600" }
    }
  }

  React.useEffect(() => {
    if (open) {
      setStep("method_group")
      setError("")
      setPaymentMethod(null)
      setPhone(orderDetails?.customerPhone || "")
    }
  }, [open, orderDetails])

  // 🔥 LOAD CONFIG
  React.useEffect(() => {
    async function loadConfig() {
      if (!db || !restaurantId) return

      const snap = await getDoc(doc(db, "restaurants", restaurantId))
      if (!snap.exists()) return

      const data = snap.data()

      const methods = (data?.settings?.paymentMethods || [])
        .filter((m: any) => m?.isActive)
        .map((m: any) => ({ code: m.code, name: m.name || getPaymentMeta(m.code).name }))

      setAvailableMethods(methods)
    }

    if (open) {
      loadConfig()
    }
  }, [db, restaurantId, open])

  // 🔥 LOAD ORDER
  React.useEffect(() => {
    async function loadOrder() {
      if (!db || !restaurantId || !orderId) return
      if (orderDetails) {
        setOrderTotal(orderDetails.total)
        return
      }

      const snap = await getDoc(doc(db, "restaurants", restaurantId, "orders", orderId))
      if (!snap.exists()) return

      const data = snap.data()
      setOrderTotal(data.total || 0)
    }

    if (open) {
      loadOrder()
    }
  }, [db, restaurantId, orderId, orderDetails, open])

  const hasCash = availableMethods.some(m => m.code === "cash")
  const mobileMethods = availableMethods.filter(m => m.code !== "cash")
  const hasMobile = mobileMethods.length > 0

  // ✅ ESPÈCES
  const handleCash = async () => {
    setLoading(true)

    try {
      await updateDoc(doc(db, "restaurants", restaurantId, "orders", orderId), {
        paymentMethod: "cash",
        paymentType: "offline",
        paymentStatus: ORDER_PAYMENT_STATUS.VERIFIED,
        paidAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      toast({ title: "Paiement enregistré" })
      onClose()
      router.refresh()
    } catch {
      setError("Erreur paiement espèces")
    } finally {
      setLoading(false)
    }
  }

  // ✅ MOBILE MONEY
  const handleMobile = async () => {
    if (!phone.trim() || !paymentMethod) {
      setError("Numéro requis")
      return
    }

    setLoading(true)

    try {
      const result = await generatePaymentLinkOrUSSD({
        methodCode: paymentMethod,
        countryCode: "CM",
        merchant: "RESTAURANT", // Should ideally be dynamic but following prompt
        amount: orderTotal,
        phone: phone.trim(),
        db
      })

      if (result.type === "ussd") {
        setPaymentCode(result.value)
      } else {
        window.location.href = result.value
        return
      }

      await updateDoc(doc(db, "restaurants", restaurantId, "orders", orderId), {
        paymentMethod,
        paymentType: "mobile",
        paymentStatus: ORDER_PAYMENT_STATUS.PENDING_MOBILE,
        customerPhone: phone,
        paymentCode: result.value,
        updatedAt: serverTimestamp(),
      })

      setStep("success")
    } catch (err: any) {
      setError(err.message || "Erreur paiement mobile")
    } finally {
      setLoading(false)
    }
  }

  const renderMethodGroup = () => (
    <div className="space-y-3">
      {hasCash && (
        <button
          onClick={() => handleCash()}
          className="w-full flex items-center gap-4 p-4 rounded-xl border hover:border-[var(--color-primary)] transition-colors bg-emerald-50 hover:bg-emerald-100/50"
        >
          <div className="h-12 w-12 bg-emerald-500 rounded-full flex items-center justify-center text-white">
            <Banknote />
          </div>
          <div className="flex-1 text-left">
            <p className="font-black text-emerald-900">Payer en espèces</p>
          </div>
          <ArrowRight className="text-emerald-500" />
        </button>
      )}

      {hasMobile && (
        <button
          onClick={() => {
            setError("")
            setStep("mobile_methods")
          }}
          className="w-full flex items-center gap-4 p-4 rounded-xl border hover:border-[var(--color-primary)] transition-colors"
        >
          <div className="h-12 w-12 bg-blue-600 rounded-full flex items-center justify-center text-white">
            <Smartphone />
          </div>
          <div className="flex-1 text-left">
            <p className="font-black">Mobile Money</p>
          </div>
          <ArrowRight />
        </button>
      )}

      {!hasCash && !hasMobile && (
        <p className="text-center text-muted-foreground py-4">Aucune méthode de paiement disponible.</p>
      )}
    </div>
  )

  const renderMobileMethods = () => (
    <div className="space-y-3">
      <div className="flex items-center mb-4">
        <button onClick={() => setStep("method_group")} className="mr-2 p-1 bg-muted rounded-full">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="font-bold">Choisissez votre opérateur</p>
      </div>

      {mobileMethods.map((method) => {
        const meta = getPaymentMeta(method.code)
        const Icon = meta.icon

        return (
          <button
            key={method.code}
            onClick={() => {
              setPaymentMethod(method.code)
              setError("")
              setStep("phone_input")
            }}
            className="w-full flex items-center gap-4 p-4 rounded-xl border hover:border-[var(--color-primary)]"
          >
            <div className={`h-12 w-12 ${meta.color} rounded-full flex items-center justify-center text-white`}>
              <Icon />
            </div>
            <div className="flex-1 text-left">
              <p className="font-black">{method.name || meta.name}</p>
            </div>
            <ArrowRight />
          </button>
        )
      })}
    </div>
  )

  const renderPhoneInput = () => (
    <div className="space-y-4">
      <div className="flex items-center mb-4">
        <button onClick={() => setStep("mobile_methods")} className="mr-2 p-1 bg-muted rounded-full">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="font-bold">Numéro Mobile Money</p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Numéro de téléphone</label>
        <Input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Ex: 6XXXXXXXX"
          className="h-12"
        />
      </div>

      <Button onClick={handleMobile} disabled={loading} className="w-full h-12 text-lg font-bold">
        {loading ? "Génération en cours..." : "Payer"}
      </Button>
    </div>
  )

  const renderSuccess = () => (
    <div className="text-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
      <div className="mx-auto w-20 h-20 bg-blue-500/10 rounded-[2rem] flex items-center justify-center mb-4 relative shadow-[0_0_40px_rgba(59,130,246,0.3)] ring-1 ring-blue-500/20">
        <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full pointer-events-none" />
        <Smartphone className="h-10 w-10 text-blue-500 relative z-10" />
      </div>

      <div>
        <p className="text-sm font-bold text-muted-foreground mb-2">Composez ce code pour payer</p>
        <div className="bg-muted/50 p-5 rounded-2xl border-2 border-dashed border-[var(--color-primary)]/50 shadow-inner">
          <p className="text-3xl font-black tracking-widest text-center text-foreground">{paymentCode}</p>
        </div>
      </div>

      <div className="bg-amber-50 text-amber-700 p-4 rounded-2xl text-sm font-medium border border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900">
        ⚠️ La validation de votre paiement sera effectuée par la caisse une fois le code composé.
      </div>

      <Button onClick={onClose} className="w-full h-14 text-base font-black uppercase tracking-wide bg-[var(--color-primary)] rounded-2xl shadow-[0_8px_24px_var(--color-primary)]/30 transition-all duration-300 active:scale-[0.98] hover:shadow-[0_12px_32px_var(--color-primary)]/40 hover:brightness-110">
        J'ai payé
      </Button>
    </div>
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-4 sm:p-6 transition-all duration-300">
      <div className="bg-background rounded-t-[2rem] sm:rounded-[2rem] p-6 w-full max-w-md shadow-[0_20px_60px_rgba(0,0,0,0.5)] ring-1 ring-white/10 flex flex-col max-h-[92vh] animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 ease-out">

        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-black">Paiement</h2>
            <p className="text-sm font-medium text-muted-foreground mt-0.5">
              Total à régler : <span className="font-black text-[var(--color-primary)]">{orderTotal.toLocaleString()} FCFA</span>
            </p>
          </div>
          <button onClick={onClose} className="flex h-10 w-10 items-center justify-center bg-muted/50 rounded-full hover:bg-muted active:scale-95 transition-all duration-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-1">
          {step === "method_group" && renderMethodGroup()}
          {step === "mobile_methods" && renderMobileMethods()}
          {step === "phone_input" && renderPhoneInput()}
          {step === "success" && renderSuccess()}
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

      </div>
    </div>
  )
}
