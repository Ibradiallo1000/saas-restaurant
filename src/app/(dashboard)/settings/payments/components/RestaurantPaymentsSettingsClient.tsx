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
import { CreditCard, Loader2, Plus, Smartphone, Trash2 } from "lucide-react"

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
  id: string
  name: string
  code: string
  logoUrl?: string
  isActive: boolean
}

type PaymentVariant = {
  id: string
  methodCode: string
  countryCode: string
  type: "ussd" | "link"
  ussdTemplate: string
  requiresMerchant: boolean
  requiresPhone: boolean
  isActive: boolean
}

type RestaurantPaymentConfig = {
  id: string
  restaurantId: string
  methodCode: string
  variantId: string
  merchantNumber: string
  isActive: boolean
}

export default function RestaurantPaymentsSettingsClient() {
  const db = useFirestore()
  const { restaurantId, restaurant } = useRestaurant()
  const { toast } = useToast()
  const [methodCode, setMethodCode] = React.useState("")
  const [merchantNumber, setMerchantNumber] = React.useState("")
  const [isSaving, setIsSaving] = React.useState(false)
  const [pendingId, setPendingId] = React.useState<string | null>(null)
  const [preview, setPreview] = React.useState("")
  const [testAmount, setTestAmount] = React.useState(5000)
  
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
    const availableVariants = variants ?? []
    const availableMethodCodes = new Set(availableVariants.map(v => v.methodCode))
    return (methods ?? []).filter(method => availableMethodCodes.has(method.code))
  }, [methods, variants])

  const selectedVariant = React.useMemo(() => {
    return variants?.find((variant) => variant.methodCode === methodCode) ?? null
  }, [methodCode, variants])

  const isAlreadyConfigured = React.useMemo(() => {
    if (!configs || !selectedVariant) return false
    return configs.some(c => c.variantId === selectedVariant.id)
  }, [configs, selectedVariant])

  React.useEffect(() => {
    if (!methodCode && compatibleMethods[0]) {
      setMethodCode(compatibleMethods[0].code)
    }
  }, [compatibleMethods, methodCode])

  React.useEffect(() => {
    let cancelled = false

    async function loadPreview() {
      if (!db || !countryCode || !methodCode || !selectedVariant || !merchantNumber.trim()) {
        setPreview("")
        return
      }

      try {
        // ✅ Version sans variantId pour éviter l'erreur TypeScript
        const result = await generatePaymentLinkOrUSSD({
          methodCode,
          countryCode,
          merchant: merchantNumber.trim(),
          amount: testAmount,
        })

        if (!cancelled) setPreview(result.value)
      } catch {
        if (!cancelled) setPreview("")
      }
    }

    loadPreview()

    return () => {
      cancelled = true
    }
  }, [countryCode, db, merchantNumber, methodCode, selectedVariant, testAmount])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!db || !restaurantId || !methodCode || !selectedVariant) {
      toast({
        variant: "destructive",
        title: "Information manquante",
        description: "Veuillez sélectionner un moyen de paiement.",
      })
      return
    }

    if (!merchantNumber.trim()) {
      toast({
        variant: "destructive",
        title: "Champ requis",
        description: "Veuillez entrer un numéro marchand.",
      })
      return
    }

    if (isAlreadyConfigured) {
      toast({
        variant: "destructive",
        title: "Configuration déjà existante",
        description: "Ce moyen de paiement est déjà configuré pour ce restaurant.",
      })
      return
    }

    setIsSaving(true)

    try {
      await addDoc(collection(db, COLLECTION_NAMES.RESTAURANT_PAYMENT_CONFIGS), {
        restaurantId: restaurantId,
        methodCode,
        variantId: selectedVariant.id,
        merchantNumber: merchantNumber.trim(),
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      setMerchantNumber("")
      refetchConfigs()
      toast({ 
        title: "✅ Paiement configuré", 
        description: "Le moyen de paiement a été enregistré avec succès." 
      })
    } catch (error) {
      console.error(error)
      toast({
        variant: "destructive",
        title: "❌ Erreur",
        description: "Impossible d'enregistrer ce moyen de paiement. Veuillez réessayer.",
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
      toast({ 
        title: nextValue ? "✅ Moyen de paiement activé" : "⏸️ Moyen de paiement désactivé",
      })
    } catch (error) {
      console.error(error)
      toast({
        variant: "destructive",
        title: "❌ Erreur",
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
      toast({ 
        title: "🗑️ Configuration supprimée",
      })
    } catch (error) {
      console.error(error)
      toast({
        variant: "destructive",
        title: "❌ Erreur",
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
            Configurez les moyens de paiement acceptés dans votre établissement
          </p>
        </div>
      </div>

      <Card className="overflow-hidden rounded-2xl border-none shadow-xl">
        <CardHeader className="border-b border-primary/10 bg-primary/5 p-6">
          <CardTitle className="text-xl font-black italic uppercase">
            Configurer un moyen de paiement
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {!countryCode ? (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
              <p className="text-sm font-medium text-amber-800">
                ⚠️ Aucun pays n'est défini sur ce restaurant. 
                Configurez d'abord le pays de l'établissement.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-3">
                <Label className="text-sm font-bold">Moyen de paiement</Label>
                {!compatibleMethods.length ? (
                  <div className="rounded-xl bg-secondary/30 p-4 text-center text-sm text-muted-foreground">
                    Aucun moyen de paiement disponible pour {countryCode}
                  </div>
                ) : (
                  <select
                    value={methodCode}
                    onChange={(event) => setMethodCode(event.target.value)}
                    className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm font-medium text-foreground"
                  >
                      {compatibleMethods.map((method) => {
                        const alreadyConfigured = configs?.some(c => {
                          const variant = variants?.find(v => v.id === c.variantId)
                          return variant?.methodCode === method.code
                        })
                        
                        return (
                          <option
                            key={method.id}
                            value={method.code}
                            disabled={alreadyConfigured}
                          >
                            {method.name} ({method.code}){alreadyConfigured ? " - configuré" : ""}
                            {/*
                              <Badge variant="secondary" className="text-[10px] px-1">
                                Configuré
                              </Badge>
                            */}
                          </option>
                        )
                      })}
                  </select>
                )}
              </div>

              {selectedVariant && !isAlreadyConfigured && (
                <div className="space-y-3">
                  <Label className="text-sm font-bold">Numéro marchand</Label>
                  <Input
                    value={merchantNumber}
                    onChange={(event) => setMerchantNumber(event.target.value)}
                    placeholder="Ex: 123456789"
                    className="h-11 rounded-lg font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Le numéro fourni par votre opérateur de paiement mobile
                  </p>
                </div>
              )}

              {selectedVariant && merchantNumber.trim() && !isAlreadyConfigured && (
                <div className="rounded-xl bg-gradient-to-r from-primary/5 to-secondary/5 p-4 border border-primary/10">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4 text-primary" />
                      <p className="text-xs font-bold uppercase text-primary">Test de paiement</p>
                    </div>
                  </div>
                  
                  <div className="mb-3">
                    <Label className="text-xs font-bold mb-1 block">Montant (FCFA)</Label>
                    <Input
                      type="number"
                      value={testAmount}
                      onChange={(e) => setTestAmount(Number(e.target.value))}
                      className="h-9 rounded-lg text-sm"
                      min="100"
                      step="100"
                    />
                  </div>
                  
                  <div className="rounded-lg bg-background p-3">
                    <p className="text-[10px] text-muted-foreground mb-1">Code à générer :</p>
                    <p className="break-all font-mono text-sm font-bold text-primary">
                      {preview || selectedVariant.ussdTemplate || "En attente..."}
                    </p>
                  </div>
                </div>
              )}

              {selectedVariant && !isAlreadyConfigured && (
                <Button
                  type="submit"
                  disabled={!merchantNumber.trim() || isSaving}
                  className="h-11 rounded-lg font-bold uppercase w-full"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Configuration...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Ajouter
                    </>
                  )}
                </Button>
              )}
            </form>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black italic uppercase">
            Configurations actives
          </h2>
          <Badge variant="outline" className="text-xs">
            {configs?.length || 0}
          </Badge>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {(isLoadingVariants || isLoadingConfigs) && (
            <Card className="border-none shadow-md col-span-full">
              <CardContent className="flex justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </CardContent>
            </Card>
          )}

          {!isLoadingConfigs &&
            configs?.map((config) => {
              const variant = variants?.find(v => v.id === config.variantId)
              const method = methods?.find(m => m.code === (variant?.methodCode || config.methodCode))

              return (
                <Card key={config.id} className="border-none shadow-md">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {method?.logoUrl && (
                          <img
                            src={method.logoUrl}
                            alt={method?.name}
                            className="h-8 w-8 object-contain rounded bg-secondary/30 p-1"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-primary truncate">
                            {method?.name ?? config.methodCode}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Marchand: {config.merchantNumber}
                          </p>
                          {variant?.type && (
                            <p className="text-[10px] text-muted-foreground capitalize mt-0.5">
                              {variant.type === "ussd" ? "USSD" : "Lien"}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge className={`text-[10px] px-2 py-0 ${config.isActive ? "bg-green-500" : "bg-gray-400"}`}>
                        {config.isActive ? "Actif" : "Inactif"}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={config.isActive}
                          disabled={pendingId === config.id}
                          onCheckedChange={(checked) => toggleConfig(config.id, checked)}
                          className="scale-75"
                        />
                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                          Actif
                        </Label>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={pendingId === config.id}
                        onClick={() => deleteConfig(config.id)}
                        className="h-7 px-2"
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}

          {!isLoadingConfigs && !configs?.length && (
            <Card className="border-none shadow-md col-span-full">
              <CardContent className="p-8 text-center">
                <CreditCard className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Aucune configuration
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
