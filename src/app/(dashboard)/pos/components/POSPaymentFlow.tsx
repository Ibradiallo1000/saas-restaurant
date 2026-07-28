"use client"

import * as React from "react"
import { Banknote, Loader2, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CashQuickAmounts } from "@/components/pos/CashQuickAmounts"
import { NumericKeypad } from "@/components/pos/NumericKeypad"
import {
  appendCashKey,
  formatCashAmount,
  getCashQuickAmounts,
  removeLastCashDigit,
  sanitizeCashInput,
} from "@/components/pos/cash-payment-utils"
import { getOptimizedImage } from "@/lib/image"
import { PosMobileMoneyPayment, PosPaymentDialog, PosPaymentFailureState, PosPaymentMethodChoice, PosPaymentProcessingState, PosPaymentSuccessState } from "@/components/pos-ui"
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
  const cashInputRef = React.useRef<HTMLInputElement>(null)
  const difference = cashReceivedAmount - total
  const quickAmounts = React.useMemo(() => getCashQuickAmounts(total), [total])
  const providers = React.useMemo(() => mobilePaymentMethods.map((method: any) => ({ id: method.code, label: method.name || method.code, logo: method.logoUrl ? <img src={getOptimizedImage(method.logoUrl, 48)} alt="" className="size-7 rounded-full object-contain"/> : undefined })), [mobilePaymentMethods])

  React.useEffect(() => {
    if (open && paymentMode === "cash" && !processing) {
      requestAnimationFrame(() => cashInputRef.current?.focus())
    }
  }, [open, paymentMode, processing])

  React.useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter" && canSubmit && !processing && !success) {
        event.preventDefault()
        onSubmit()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [canSubmit, onSubmit, open, processing, success])

  return <PosPaymentDialog open={open} onOpenChange={(next) => { if (!processing) onOpenChange(next) }} initialFocusRef={paymentMode === "cash" ? cashInputRef : undefined} compact className="w-[calc(100%-1rem)] max-w-3xl gap-2 p-3 sm:p-4" title="Encaissement" description="Sélectionnez le moyen de paiement puis confirmez la transaction." total={formatMoney(total)} footer={success ? <Button type="button" className="min-h-12 w-full" onClick={() => onOpenChange(false)}>Fermer</Button> : <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" className="min-h-12" disabled={processing} onClick={() => onOpenChange(false)}>Annuler</Button><Button type="button" className="min-h-12" disabled={!canSubmit || processing} aria-busy={processing || undefined} onClick={onSubmit}>{processing ? <><Loader2 className="mr-2 size-4 animate-spin motion-reduce:animate-none" />Transaction en cours…</> : "Confirmer l'encaissement"}</Button></div>}>
    {success ? <PosPaymentSuccessState title="Vente validée" description="La commande et son paiement ont été enregistrés. L'impression a été déclenchée selon le flux existant." /> : <div className="space-y-3">
      <div role="radiogroup" aria-label="Moyen de paiement" className="grid gap-2 sm:grid-cols-2">
        <PosPaymentMethodChoice compact method="cash" label="Espèces" description="Saisir le montant reçu" selected={paymentMode === "cash"} disabled={processing} onSelect={() => onPaymentModeChange("cash")} icon={<Banknote/>}/>
        <PosPaymentMethodChoice compact method="mobileMoney" label="Mobile Money" description="Choisir un opérateur configuré" selected={paymentMode === "mobile"} disabled={processing} onSelect={() => onPaymentModeChange("mobile")} icon={<Smartphone/>}/>
      </div>
      {paymentMode === "cash" ? <div className="space-y-3">
        <div>
          <Label htmlFor="pos-cash-received">Montant reçu</Label>
          <div className="relative mt-1">
            <Input
              ref={cashInputRef}
              id="pos-cash-received"
              value={cashReceivedInput ? formatCashAmount(cashReceivedInput) : ""}
              onChange={(event) => onCashReceivedChange(sanitizeCashInput(event.target.value))}
              disabled={processing}
              inputMode="numeric"
              autoComplete="off"
              placeholder="0"
              className="min-h-12 pr-20 text-right text-xl font-bold tabular-nums sm:text-2xl"
              aria-describedby="pos-cash-feedback"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[var(--dashboard-muted)]">FCFA</span>
          </div>
        </div>
        <div className="grid gap-3 min-[680px]:grid-cols-[minmax(0,1.4fr)_minmax(220px,0.8fr)]">
          <NumericKeypad
            value={cashReceivedInput}
            disabled={processing}
            onChange={(key) => onCashReceivedChange(appendCashKey(cashReceivedInput, key))}
            onBackspace={() => onCashReceivedChange(removeLastCashDigit(cashReceivedInput))}
            onClear={() => onCashReceivedChange("")}
          />
          <CashQuickAmounts amounts={quickAmounts} selectedAmount={cashReceivedAmount} disabled={processing} onSelect={(amount) => onCashReceivedChange(String(amount))} />
        </div>
        <div
          id="pos-cash-feedback"
          aria-live="polite"
          className={`rounded-[var(--radius-dashboard-widget)] p-3 text-base font-bold tabular-nums ${cashReceivedInput && difference < 0 ? "bg-red-50 text-[var(--data-negative)]" : "bg-green-50 text-green-700"}`}
        >
          {cashReceivedInput && difference < 0
            ? `Montant insuffisant de ${formatMoney(Math.abs(difference))}`
            : `Monnaie à rendre : ${formatMoney(Math.max(0, difference))}`}
        </div>
      </div> : null}
      {paymentMode === "mobile" ? mobilePaymentMethods.length ? <PosMobileMoneyPayment providers={providers} selectedProvider={selectedMobileMethodCode} onProviderChange={onMobileMethodChange} disabled={processing} loading={processing} instructions="La sélection de l'opérateur ne constitue pas à elle seule une confirmation de paiement."/> : <PosPaymentFailureState title="Mobile Money indisponible" description="Aucun moyen Mobile Money n'est configuré pour ce restaurant."/> : null}
      {processing ? <PosPaymentProcessingState title="Transaction en cours" description="Création de la commande et enregistrement du paiement. Ne fermez pas cette fenêtre."/> : null}
      {error ? <PosPaymentFailureState title="Transaction non finalisée" description={`${error} Le panier et les choix sont conservés.`}/> : null}
    </div>}
  </PosPaymentDialog>
}
