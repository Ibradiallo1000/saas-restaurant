"use client"

import * as React from "react"
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore"
import { CreditCard, Loader2, Plus, Trash2 } from "lucide-react"

import { useCollectionOnce, useFirestore, useMemoFirebase } from "@/firebase"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { COLLECTION_NAMES } from "@/lib/constants"
import { generatePaymentLinkOrUSSD } from "@/lib/payment-generation"
import { useRestaurant } from "@/design-system/context/RestaurantContext"

type PaymentMethod = {
  name: string
  code: string
  logoUrl?: string
  isActive: boolean
}

type PaymentVariant = {
  methodCode: string
  countryCode: string
  type: "ussd" | "link"
  ussdTemplate: string
  requiresMerchant: boolean
  requiresPhone: boolean
  isActive: boolean
}

type RestaurantPaymentConfig = {
  restaurantId: string
  methodCode: string
  merchantNumber: string
  isActive: boolean
}

export default function RestaurantPaymentsSettingsPage() {
  const db = useFirestore()
  const { restaurantId, restaurant } = useRestaurant()
  const { toast } = useToast()
  const [methodCode, setMethodCode] = React.useState("")
  const [merchantNumber, setMerchantNumber] = React.useState("")
  const [isSaving, setIsSaving] = React.useState(false)
  const [pendingId, setPendingId] = React.useState<string | null>(null)
  const [preview, setPreview] = React.useState("")
  const countryCode = React.useMemo(() => {
    const value = restaurant?.countryCode || restaurant?.country || restaurant?.countryIso
    return typeof value === "string" ? value.toUpperCase() : ""
  }, [restaurant])

  const variantsQuery = useMemoFirebase(() => {
    if (!db || !countryCode) return null
    return query(
      collection(db, COLLECTION_NAMES.PLATFORM_PAYMENT_VARIANTS),
      where("countryCode", "==", countryCode),
      where("isActive", "==", true),
      limit(50)
    )
  }, [db, countryCode])
  const { data: variants, isLoading: isLoadingVariants } = useCollectionOnce<PaymentVariant>(variantsQuery)

  const methodsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(
      collection(db, COLLECTION_NAMES.PLATFORM_PAYMENT_METHODS),
      where("isActive", "==", true),
      limit(50)
    )
  }, [db])
  const { data: methods } = useCollectionOnce<PaymentMethod>(methodsQuery)

  const configsQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return query(
      collection(db, COLLECTION_NAMES.RESTAURANT_PAYMENT_CONFIGS),
      where("restaurantId", "==", restaurantId),
      limit(50)
    )
  }, [db, restaurantId])
  const { data: configs, isLoading: isLoadingConfigs, refetch: refetchConfigs } =
    useCollectionOnce<RestaurantPaymentConfig>(configsQuery)

  const compatibleMethods = React.useMemo(() => {
    const compatibleCodes = new Set((variants ?? []).map((variant) => variant.methodCode))
    return (methods ?? []).filter((method) => compatibleCodes.has(method.code))
  }, [methods, variants])

  const selectedVariant = React.useMemo(() => {
    return variants?.find((variant) => variant.methodCode === methodCode) ?? null
  }, [methodCode, variants])

  React.useEffect(() => {
    if (!methodCode && compatibleMethods[0]) {
      setMethodCode(compatibleMethods[0].code)
    }
  }, [compatibleMethods, methodCode])

  React.useEffect(() => {
    let cancelled = false

    async function loadPreview() {
      if (!db || !countryCode || !methodCode || !merchantNumber.trim()) {
        setPreview("")
        return
      }

      try {
        const result = await generatePaymentLinkOrUSSD({
          db,
          methodCode,
          countryCode,
          merchant: merchantNumber.trim(),
          amount: 5000,
        })

        if (!cancelled) setPreview(result)
      } catch {
        if (!cancelled) setPreview("")
      }
    }

    loadPreview()

    return () => {
      cancelled = true
    }
  }, [countryCode, db, merchantNumber, methodCode])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!db || !restaurantId || !methodCode || !merchantNumber.trim()) return

    setIsSaving(true)

    try {
      await addDoc(collection(db, COLLECTION_NAMES.RESTAURANT_PAYMENT_CONFIGS), {
        restaurantId: restaurantId,
        methodCode,
        merchantNumber: merchantNumber.trim(),
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      setMerchantNumber("")
      refetchConfigs()
      toast({ title: "Paiement ajouté", description: "Le numéro marchand a été enregistré." })
    } catch (error) {
      console.error(error)
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible d'enregistrer ce moyen de paiement.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const toggleConfig = async (configId: string, nextValue: boolean) => {
    if (!db) return

    setPendingId(configId)

    try {
      await updateDoc(doc(db, COLLECTION_NAMES.RESTAURANT_PAYMENT_CONFIGS, configId), {
        isActive: nextValue,
        updatedAt: serverTimestamp(),
      })
      refetchConfigs()
    } catch (error) {
      console.error(error)
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de modifier le statut.",
      })
    } finally {
      setPendingId(null)
    }
  }

  const deleteConfig = async (configId: string) => {
    if (!db) return

    setPendingId(configId)

    try {
      await deleteDoc(doc(db, COLLECTION_NAMES.RESTAURANT_PAYMENT_CONFIGS, configId))
      refetchConfigs()
      toast({ title: "Configuration supprimée" })
    } catch (error) {
      console.error(error)
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de supprimer cette configuration.",
      })
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary p-3 text-primary-foreground shadow-lg">
          <CreditCard className="h-8 w-8" />
        </div>
        <div>
          <h1 className="text-4xl font-black italic uppercase tracking-tighter text-primary">
            Paiements
          </h1>
          <p className="font-medium text-muted-foreground">
            Renseignez uniquement les informations marchand de l'établissement.
          </p>
        </div>
      </div>

      <Card className="overflow-hidden rounded-2xl border-none shadow-xl">
        <CardHeader className="border-b border-primary/10 bg-primary/5 p-8">
          <CardTitle className="text-2xl font-black italic uppercase">
            Nouveau moyen de paiement
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          {!countryCode ? (
            <p className="rounded-xl bg-secondary/30 p-4 text-sm font-medium text-muted-foreground">
              Aucun pays n'est défini sur ce restaurant. Configurez d'abord le pays de l'établissement.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Méthode compatible</Label>
                <select
                  value={methodCode}
                  onChange={(event) => setMethodCode(event.target.value)}
                  className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm"
                  disabled={!compatibleMethods.length}
                >
                  {!compatibleMethods.length && <option value="">Aucune méthode compatible</option>}
                  {compatibleMethods.map((method) => (
                    <option key={method.id} value={method.code}>
                      {method.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Numéro marchand</Label>
                <Input
                  value={merchantNumber}
                  onChange={(event) => setMerchantNumber(event.target.value)}
                  placeholder="12345"
                  className="h-12 rounded-xl"
                />
              </div>

              <div className="rounded-xl bg-secondary/30 p-4 md:col-span-2">
                <p className="text-xs font-bold uppercase text-muted-foreground">
                  Aperçu avec montant 5000
                </p>
                <p className="mt-2 break-all font-mono text-lg font-black text-primary">
                  {preview || selectedVariant?.ussdTemplate || "Aucun aperçu disponible"}
                </p>
              </div>

              <Button
                type="submit"
                disabled={!methodCode || !merchantNumber.trim() || isSaving}
                className="h-12 rounded-xl font-black uppercase md:col-span-2"
              >
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Ajouter
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(isLoadingVariants || isLoadingConfigs) && (
          <Card className="border-none shadow-xl md:col-span-2 xl:col-span-3">
            <CardContent className="flex justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </CardContent>
          </Card>
        )}

        {!isLoadingConfigs &&
          configs?.map((config) => {
            const method = methods?.find((item) => item.code === config.methodCode)

            return (
              <Card key={config.id} className="border-none shadow-xl">
                <CardContent className="space-y-5 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-black text-primary">
                        {method?.name ?? config.methodCode}
                      </p>
                      <p className="text-sm font-medium text-muted-foreground">
                        Marchand: {config.merchantNumber}
                      </p>
                    </div>
                    <Badge variant={config.isActive ? "default" : "secondary"}>
                      {config.isActive ? "Actif" : "Inactif"}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">
                        Actif
                      </Label>
                      <Switch
                        checked={config.isActive}
                        disabled={pendingId === config.id}
                        onCheckedChange={(checked) => toggleConfig(config.id, checked)}
                      />
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={pendingId === config.id}
                      onClick={() => deleteConfig(config.id)}
                      aria-label="Supprimer la configuration"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}

        {!isLoadingConfigs && !configs?.length && (
          <Card className="border-none shadow-xl md:col-span-2 xl:col-span-3">
            <CardContent className="p-12 text-center text-muted-foreground">
              Aucun moyen de paiement configuré pour ce restaurant.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
