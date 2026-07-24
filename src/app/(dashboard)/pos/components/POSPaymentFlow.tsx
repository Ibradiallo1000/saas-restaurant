"use client"

import * as React from "react"
import { Banknote, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getOptimizedImage } from "@/lib/image"
import { PosCashPayment, PosMobileMoneyPayment, PosPaymentDialog, PosPaymentFailureState, PosPaymentMethodChoice, PosPaymentProcessingState, PosPaymentSuccessState } from "@/components/pos-ui"
import type { PosPaymentMode } from "./CartPanel"

type POSPaymentFlowProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  total: number
  paymentMode: PosPaymentMode | null
  onPaymentModeChange: (mode: PosPaymentMode) => void
  mobilePaymentMethods: any[]
  selectedMobileMethodCode: string | null
  onMobileMethodChange: (code: string) => void
  cashReceivedInput: string
  cashReceivedAmount: number
  onCashReceivedChange: (value: string) => void
  processing: boolean
  success: boolean
  error: string | null
  canSubmit: boolean
  onSubmit: () => void
}

export default function POSPaymentFlow({ open, onOpenChange, total, paymentMode, onPaymentModeChange, mobilePaymentMethods, selectedMobileMethodCode, onMobileMethodChange, cashReceivedInput, cashReceivedAmount, onCashReceivedChange, processing, success, error, canSubmit, onSubmit }: POSPaymentFlowProps) {
  const formatMoney = (value: number) => `${value.toLocaleString("fr-FR")} FCFA`
  const changeAmount = Math.max(0, cashReceivedAmount - total)
  const cashError = paymentMode === "cash" && cashReceivedInput.trim().length > 0 && cashReceivedAmount < total ? "Montant insuffisant pour encaisser cette vente." : null
  const providers = React.useMemo(() => mobilePaymentMethods.map((method: any) => ({ id: method.code, label: method.name || method.code, logo: method.logoUrl ? <img src={getOptimizedImage(method.logoUrl, 48)} alt="" className="size-7 rounded-full object-contain"/> : undefined })), [mobilePaymentMethods])

  return <PosPaymentDialog open={open} onOpenChange={(next) => { if (!processing) onOpenChange(next) }} title="Encaissement" description="Sélectionnez le moyen de paiement puis confirmez la transaction." total={formatMoney(total)} footer={success ? <Button type="button" className="min-h-12 w-full" onClick={() => onOpenChange(false)}>Fermer</Button> : <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" className="min-h-12" disabled={processing} onClick={() => onOpenChange(false)}>Annuler</Button><Button type="button" className="min-h-12" disabled={!canSubmit || processing} aria-busy={processing || undefined} onClick={onSubmit}>{processing ? "Transaction en cours…" : "Confirmer l'encaissement"}</Button></div>}>
    {success ? <PosPaymentSuccessState title="Vente validée" description="La commande et son paiement ont été enregistrés. L'impression a été déclenchée selon le flux existant." /> : <div className="space-y-4">
      <div role="radiogroup" aria-label="Moyen de paiement" className="grid gap-2 sm:grid-cols-2">
        <PosPaymentMethodChoice method="cash" label="Espèces" description="Saisir le montant reçu" selected={paymentMode === "cash"} disabled={processing} onSelect={() => onPaymentModeChange("cash")} icon={<Banknote/>}/>
        <PosPaymentMethodChoice method="mobileMoney" label="Mobile Money" description="Choisir un opérateur configuré" selected={paymentMode === "mobile"} disabled={processing} onSelect={() => onPaymentModeChange("mobile")} icon={<Smartphone/>}/>
      </div>
      {paymentMode === "cash" ? <PosCashPayment expectedAmount={formatMoney(total)} receivedValue={cashReceivedInput} onReceivedChange={(value) => onCashReceivedChange(value.replace(/\D/g, ""))} changeAmount={formatMoney(changeAmount)} error={cashError} disabled={processing} loading={processing}/> : null}
      {paymentMode === "mobile" ? mobilePaymentMethods.length ? <PosMobileMoneyPayment providers={providers} selectedProvider={selectedMobileMethodCode} onProviderChange={onMobileMethodChange} disabled={processing} loading={processing} instructions="La sélection de l'opérateur ne constitue pas à elle seule une confirmation de paiement."/> : <PosPaymentFailureState title="Mobile Money indisponible" description="Aucun moyen Mobile Money n'est configuré pour ce restaurant."/> : null}
      {processing ? <PosPaymentProcessingState title="Transaction en cours" description="Création de la commande et enregistrement du paiement. Ne fermez pas cette fenêtre."/> : null}
      {error ? <PosPaymentFailureState title="Transaction non finalisée" description={`${error} Le panier et les choix sont conservés.`}/> : null}
    </div>}
  </PosPaymentDialog>
}
