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
import { Loader2, Plus, Smartphone, Trash2 } from "lucide-react"

import { useCollectionOnce, useFirestore, useMemoFirebase } from "@/firebase"
import { Button } from "@/components/ui/button"
import { SettingsConfirmationDialog, SettingsEmptyState, SettingsErrorState, SettingsFieldGroup, SettingsForm, SettingsLoadingState, SettingsNumberField, SettingsPaymentMethods, SettingsSelect, SettingsTextField } from "@/components/settings-ui"
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
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null)
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
  const { data: variants, isLoading: isLoadingVariants, error: variantsError } = useCollectionOnce<PaymentVariant>(variantsQuery)

  const methodsQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(
      collection(db, COLLECTION_NAMES.PLATFORM_PAYMENT_METHODS),
      where("isActive", "==", true),
      limit(50)
    )
  }, [db])
  const { data: methods, isLoading: isLoadingMethods, error: methodsError } = useCollectionOnce<PaymentMethod>(methodsQuery)

  const configsQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return query(
      collection(db, COLLECTION_NAMES.RESTAURANT_PAYMENT_CONFIGS),
      where("restaurantId", "==", restaurantId),
      limit(50)
    )
  }, [db, restaurantId])
  const { data: configs, isLoading: isLoadingConfigs, error: configsError, refetch: refetchConfigs } =
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

  const paymentMethods = (configs ?? []).map((config) => {
    const variant = variants?.find((item) => item.id === config.variantId)
    const method = methods?.find((item) => item.code === (variant?.methodCode || config.methodCode))
    return {
      id: config.id,
      name: method?.name ?? config.methodCode,
      provider: variant?.type === "ussd" ? "USSD" : variant?.type === "link" ? "Lien" : undefined,
      logo: method?.logoUrl ? <img src={method.logoUrl} alt="" className="size-8 object-contain"/> : undefined,
      status: <span className="text-xs font-semibold">{config.isActive ? "Actif" : "Inactif"}</span>,
      maskedIdentifier: <>Marchand : {config.merchantNumber}</>,
      enabled: config.isActive,
      onEnabledChange: (checked: boolean) => toggleConfig(config.id, checked),
      disabled: pendingId === config.id,
      loading: pendingId === config.id,
      actions: <Button type="button" variant="ghost" disabled={pendingId === config.id} onClick={() => setPendingDeleteId(config.id)} className="min-h-11 text-destructive"><Trash2 aria-hidden="true" className="mr-2 size-4"/>Supprimer</Button>,
    }
  })

  return <div className="space-y-6">
    {!countryCode ? <div role="alert" className="rounded-[var(--radius-dashboard-widget)] bg-[var(--settings-state-dirty-bg)] p-4 text-sm font-medium text-[var(--settings-state-dirty-fg)]">Aucun pays n'est défini sur ce restaurant. Configurez d'abord le pays de l'établissement.</div> : <SettingsForm onSubmit={handleSubmit} saving={isSaving}>
      <SettingsFieldGroup title="Configurer un moyen de paiement" columns="one">
        {(isLoadingVariants || isLoadingMethods) ? (
          <SettingsLoadingState label="Chargement des moyens de paiement"/>
        ) : (variantsError || methodsError) ? (
          <SettingsErrorState title="Catalogue de paiement indisponible" description="Impossible de charger les moyens de paiement disponibles."/>
        ) : compatibleMethods.length ? (
          <SettingsSelect label="Moyen de paiement" value={methodCode} onChange={(event) => setMethodCode(event.target.value)} options={compatibleMethods.map((method) => { const alreadyConfigured = configs?.some((config) => variants?.find((variant) => variant.id === config.variantId)?.methodCode === method.code); return { value: method.code, label: `${method.name} (${method.code})${alreadyConfigured ? " - configuré" : ""}`, disabled: alreadyConfigured } })}/>
        ) : (
          <SettingsEmptyState title={`Aucun moyen de paiement disponible pour ${countryCode}`}/>
        )}
        {selectedVariant && !isAlreadyConfigured ? <SettingsTextField label="Numéro marchand" description="Le numéro fourni par votre opérateur de paiement mobile" value={merchantNumber} onChange={(event) => setMerchantNumber(event.target.value)} placeholder="Ex: 123456789" className="font-mono"/> : null}
        {selectedVariant && merchantNumber.trim() && !isAlreadyConfigured ? <div className="rounded-[var(--radius-dashboard-widget)] border border-[var(--settings-border)] bg-[var(--settings-section)] p-4"><p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Smartphone aria-hidden="true" className="size-4"/>Test de paiement</p><SettingsNumberField label="Montant (FCFA)" value={testAmount} onChange={(event) => setTestAmount(Number(event.target.value))} min={100} step={100}/><div className="mt-3 rounded-[var(--radius-dashboard-input)] bg-[var(--settings-panel)] p-3"><p className="text-xs text-[var(--settings-muted)]">Code à générer :</p><p className="break-all font-mono text-sm font-semibold">{preview || selectedVariant.ussdTemplate || "En attente..."}</p></div></div> : null}
      </SettingsFieldGroup>
      {selectedVariant && !isAlreadyConfigured ? <Button type="submit" disabled={!merchantNumber.trim() || isSaving} className="min-h-11 w-full sm:w-auto">{isSaving ? <Loader2 aria-hidden="true" className="mr-2 size-4 animate-spin motion-reduce:animate-none"/> : <Plus aria-hidden="true" className="mr-2 size-4"/>}{isSaving ? "Configuration..." : "Ajouter"}</Button> : null}
    </SettingsForm>}
    {(isLoadingVariants || isLoadingMethods || isLoadingConfigs) ? (
      <SettingsLoadingState label="Chargement des configurations de paiement"/>
    ) : configsError ? (
      <SettingsErrorState title="Configurations indisponibles" description="Impossible de charger les configurations de paiement du restaurant."/>
    ) : (
      <SettingsPaymentMethods methods={paymentMethods} emptyState={<SettingsEmptyState title="Aucune configuration"/>}/>
    )}
    <SettingsConfirmationDialog open={pendingDeleteId !== null} onOpenChange={(open) => { if (!open && !pendingId) setPendingDeleteId(null) }} title="Supprimer cette configuration de paiement ?" description="Cette action retire la configuration sélectionnée du restaurant." consequence="Le moyen de paiement ne sera plus disponible via cette configuration." confirmLabel="Supprimer" loading={Boolean(pendingDeleteId && pendingId === pendingDeleteId)} onConfirm={() => { if (!pendingDeleteId) return; void deleteConfig(pendingDeleteId).then(() => setPendingDeleteId(null)) }}/>
  </div>
}
