"use client"

import * as React from "react"
import { collection, limit, query, where } from "firebase/firestore"
import { Loader2, Receipt, Wallet } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DashboardWidget, DashboardWidgetHeader } from "@/components/dashboard-ui"
import { ReportsLoadingState } from "@/components/reports-ui"
import { PosSessionClosingDialog, PosSessionOpeningDialog, PosSessionRequiredState, PosSessionStatus, PosVarianceDisplay } from "@/components/pos-ui"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { useToast } from "@/hooks/use-toast"
import { useRestaurant } from "@/design-system/context/RestaurantContext"
import { useTenant } from "@/design-system/context/TenantProvider"
import { COLLECTION_NAMES } from "@/lib/constants"
import { closeCashSessionV2, openCashSession } from "@/modules/pos/canonical/cash-session-command-client"
import { submitCashHandover } from "@/modules/pos/canonical/cash-handover-command-client"
import { CashierService, type CashSession } from "@/services/cashier.service"
import { PosSessionReportsView } from "../session/PosSessionReportsView"
import { buildPosSessionReportsViewModel } from "../session/pos-session-reports-view-model"
import { POS_STATION_PAYMENT_BALANCE_KEYS, normalizePaymentProviderToBalanceKey, resolvePaymentBalances } from "@/lib/pos-stations"

export default function CashierSessionPage() {
  const db = useFirestore()
  const { restaurantId } = useRestaurant()
  const { user } = useTenant()
  const { toast } = useToast()
  const [session, setSession] = React.useState<CashSession | null>(null)
  const [countedPhysicalCash, setCountedPhysicalCash] = React.useState("0")
  const [retainedFloat, setRetainedFloat] = React.useState("0")
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [openingDialogOpen, setOpeningDialogOpen] = React.useState(true)
  const [closingDialogOpen, setClosingDialogOpen] = React.useState(false)
  const [period, setPeriod] = React.useState<"day" | "week" | "month">("month")
  const [handoverAmount, setHandoverAmount] = React.useState("")
  const [handoverNote, setHandoverNote] = React.useState("")
  const sessionMutationLockRef = React.useRef(false)

  const cashierService = React.useMemo(() => (db ? new CashierService(db) : null), [db])
  const historyQuery = useMemoFirebase(() => {
    if (!db || !restaurantId || !user?.uid) return null
    return query(
      collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.CASH_SESSIONS),
      where("cashierId", "==", user.uid),
      limit(50)
    )
  }, [db, restaurantId, user?.uid])
  const { data: historySessions, error: historyError } = useCollection<CashSession>(historyQuery)
  const handoversQuery = useMemoFirebase(() => {
    if (!db || !restaurantId || !user?.uid) return null
    return query(
      collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.CASH_HANDOVERS),
      where("cashierId", "==", user.uid),
      limit(50)
    )
  }, [db, restaurantId, user?.uid])
  const { data: handovers, error: handoversError } = useCollection<any>(handoversQuery)
  const handoverBySession = React.useMemo(
    () => new Map((handovers || []).map((handover: any) => [handover.sessionId, handover])),
    [handovers]
  )

  const sortedHistory = React.useMemo(() => {
    const cutoff = new Date()
    cutoff.setHours(0, 0, 0, 0)
    if (period === "week") cutoff.setDate(cutoff.getDate() - 6)
    if (period === "month") cutoff.setDate(cutoff.getDate() - 29)
    return [...(historySessions || [])]
      .filter((item) => getTime(item.openedAt) >= cutoff.getTime())
      .sort((a, b) => getTime(b.openedAt) - getTime(a.openedAt))
  }, [historySessions, period])

  const latestClosedSession = React.useMemo(() => {
    return [...(historySessions || [])].sort((a, b) => getTime(b.openedAt) - getTime(a.openedAt)).find((cashSession) => {
      return cashSession.status !== "open" && !cashSession.validatedByManager
    }) ?? null
  }, [historySessions])

  const loadSession = React.useCallback(async () => {
    if (!cashierService || !restaurantId || !user) return
    setLoading(true)
    const current = await cashierService.getCurrentSession(restaurantId, user.uid)
    setSession(current)
    setLoading(false)
  }, [cashierService, restaurantId, user])

  React.useEffect(() => {
    void loadSession()
  }, [loadSession])

  const handleOpenShift = async () => {
    if (!cashierService || !restaurantId || !user || sessionMutationLockRef.current) return
    sessionMutationLockRef.current = true
    setSaving(true)
    try {
      await openCashSession({ restaurantId, user })
      toast({ title: "Session ouverte" })
      await loadSession()
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: error.message })
    } finally {
      sessionMutationLockRef.current = false
      setSaving(false)
    }
  }

  const handleCloseShift = async () => {
    if (!restaurantId || !session || !user || sessionMutationLockRef.current) return
    sessionMutationLockRef.current = true
    setSaving(true)
    try {
      await closeCashSessionV2({
        restaurantId,
        sessionId: session.id,
        user,
        countedPhysicalCash: Number(countedPhysicalCash || 0),
        retainedFloat: Number(retainedFloat || 0),
      })
      toast({ title: "Session clôturée", description: "En attente de validation manager." })
      await loadSession()
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: error.message })
    } finally {
      sessionMutationLockRef.current = false
      setSaving(false)
    }
  }

  const handleSubmitHandover = async () => {
    if (!restaurantId || !user || !latestClosedSession || sessionMutationLockRef.current) return
    sessionMutationLockRef.current = true
    setSaving(true)
    try {
      await submitCashHandover({
        restaurantId,
        sessionId: latestClosedSession.id,
        user,
        declaredAmount: Number(handoverAmount || 0),
        note: handoverNote,
      })
      toast({ title: "Remise transmise", description: "Le manager doit confirmer la réception physique." })
      setHandoverNote("")
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: error.message })
    } finally {
      sessionMutationLockRef.current = false
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-6xl py-8"><ReportsLoadingState label="Chargement des rapports de sessions" /></div>
  }

  const reportSession = session ?? sortedHistory[0] ?? null
  const reportHandover = reportSession ? handoverBySession.get(reportSession.id) as any : null
  const reportsModel = buildPosSessionReportsViewModel({
    report: reportSession ? {
      reference: `#${reportSession.id.slice(-6).toUpperCase()}`, employee: reportSession.cashierId,
      schedule: `${formatSessionDate(reportSession.openedAt)} → ${formatSessionDate(reportSession.closedAt)}`,
      status: formatSessionStatus(reportSession), orders: `${reportSession.totalOrders || 0} commandes`, payments: `${getSystemTotal(reportSession).toLocaleString()} FCFA`,
      cash: `${Number(reportSession.totalCash || 0).toLocaleString()} FCFA`, mobileMoney: `${Number(reportSession.totalMobile || 0).toLocaleString()} FCFA`,
      openedAt: formatSessionDate(reportSession.openedAt), closedAt: formatSessionDate(reportSession.closedAt), variance: `${Number(reportSession.discrepancyAmount ?? 0).toLocaleString()} FCFA`,
      duration: formatSessionDuration(reportSession.openedAt, reportSession.closedAt), handover: reportHandover ? formatHandoverDetails(reportHandover) : undefined, quality: "complete" as const,
    } : null,
    history: sortedHistory.map((cashSession) => { const handover = handoverBySession.get(cashSession.id) as any; return { id: cashSession.id, reference: `#${cashSession.id.slice(-6).toUpperCase()}`, schedule: `${formatSessionDate(cashSession.openedAt)} → ${formatSessionDate(cashSession.closedAt)}`, ordersAndVariance: `${cashSession.totalOrders || 0} commandes · Écart ${Number(cashSession.cashCountDifference ?? cashSession.discrepancyAmount ?? 0).toLocaleString()} FCFA`, financialDetails: `Ouverture ${Number(cashSession.openingBalance || 0).toLocaleString()} · Cash ${Number(cashSession.totalCash || 0).toLocaleString()} · Mobile ${Number(cashSession.totalMobile || 0).toLocaleString()} · Compté ${Number(cashSession.countedPhysicalCash || 0).toLocaleString()} · Fond ${Number(cashSession.retainedFloat || 0).toLocaleString()}${handover ? ` · ${formatHandoverDetails(handover)}` : ""}`, total: `${getSystemTotal(cashSession).toLocaleString()} FCFA`, status: formatSessionStatus(cashSession) } }),
    validations: [],
    historyQuality: "partial" as const,
  })

  const pendingHandover = latestClosedSession ? handoverBySession.get(latestClosedSession.id) as any : null
  const sessionControl = !session ? (
          <DashboardWidget>
            <DashboardWidgetHeader title={latestClosedSession ? "Session clôturée" : "Caisse fermée"} description={latestClosedSession ? "En attente de validation manager. La session reste visible dans l'historique." : "Une session ouverte est obligatoire pour vendre depuis le POS."} />
            <div className="space-y-4 p-4">
              {latestClosedSession ? <PosSessionStatus status="pendingValidation" label="Validation manager requise" description={`Session #${latestClosedSession.id.slice(-6).toUpperCase()}`} /> : <PosSessionRequiredState title="Aucune session ouverte" description="Ouvrez votre caisse pour commencer les ventes." action={<Button className="min-h-12" onClick={() => setOpeningDialogOpen(true)}>Ouvrir ma caisse</Button>} />}
              {latestClosedSession && Number(latestClosedSession.closeVersion) === 2 ? Number(latestClosedSession.expectedHandover || 0) === 0 ? <p className="rounded-lg bg-muted p-3 text-sm">Aucune remise physique · Mobile Money {Number(latestClosedSession.expectedMobileMoney || 0).toLocaleString()} FCFA en attente de validation manager.</p> : pendingHandover && pendingHandover.status !== "correction_required" ? <p className="rounded-lg bg-muted p-3 text-sm">Remise : {formatHandoverStatus(pendingHandover.status)} · {Number(pendingHandover.declaredAmount || 0).toLocaleString()} FCFA</p> : <div className="grid gap-3"><AmountField id="handover-amount" label="Montant remis" value={handoverAmount || String(latestClosedSession.expectedHandover || 0)} onChange={setHandoverAmount}/><div><Label htmlFor="handover-note">Note de remise</Label><Input id="handover-note" value={handoverNote} maxLength={500} onChange={(event) => setHandoverNote(event.target.value)} /></div><Button disabled={saving} onClick={handleSubmitHandover}>{pendingHandover ? "Renvoyer la correction" : "Déclarer la remise"}</Button></div> : null}
            </div>
          </DashboardWidget>
        ) : (
          <DashboardWidget>
            <DashboardWidgetHeader title="Session caisse ouverte" description={`ID session : ${session.id}`} />
            <div className="space-y-5 p-4">
              <PosSessionStatus status="active" label="Session active" openedAt={formatSessionDate(session.openedAt)} openingAmount={`${Number(session.openingBalance || 0).toLocaleString()} FCFA`} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <MetricCard icon={Wallet} label="Fond initial" value={session.openingBalance} />
                <MetricCard icon={Receipt} label="Espèces" value={session.totalCash} />
                <MetricCard icon={Receipt} label="Mobile" value={session.totalMobile} />
              </div>
              <Button variant="destructive" className="min-h-12 w-full" disabled={saving} onClick={() => setClosingDialogOpen(true)}>Clôturer la caisse</Button>
            </div>
          </DashboardWidget>
        )
  const expectedPhysicalCash = Number(session?.openingBalance || 0) + Number(session?.totalCash || 0)
  const paymentBalanceRows = buildPaymentBalanceRows(session?.openingPaymentBalances, session?.totalsByProvider)
  const dialogs = <>{!session && !latestClosedSession ? <PosSessionOpeningDialog open={openingDialogOpen} onOpenChange={setOpeningDialogOpen} title="Ouvrir ma caisse" description="Le fond initial est repris automatiquement depuis le poste de caisse." user={user?.email || user?.uid} openingAmount="Fond du poste" date={new Date().toLocaleDateString("fr-FR")} footer={<><Button variant="outline" className="min-h-12" disabled={saving} onClick={() => setOpeningDialogOpen(false)}>Annuler</Button><Button className="min-h-12" disabled={saving} onClick={handleOpenShift}>{saving ? <Loader2 className="mr-2 size-4 animate-spin motion-reduce:animate-none"/> : null}Ouvrir ma caisse</Button></>}><p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">Le montant exact sera affiché après l’ouverture, à partir du fond conservé sur le poste.</p></PosSessionOpeningDialog> : null}{session ? <PosSessionClosingDialog open={closingDialogOpen} onOpenChange={setClosingDialogOpen} title="Clôturer la caisse" description="Comptez uniquement les espèces physiques. Le Mobile Money provient du registre des paiements." summary={<div className="space-y-3"><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><MetricCard icon={Receipt} label="Espèces attendues (fond inclus)" value={expectedPhysicalCash}/><MetricCard icon={Receipt} label="Mobile Money enregistré" value={session.totalMobile}/><MetricCard icon={Wallet} label="Fond initial" value={session.openingBalance}/></div><PaymentBalanceSummary rows={paymentBalanceRows}/></div>} expectedCash={<AmountField id="session-counted-cash" label="Espèces physiques comptées" value={countedPhysicalCash} onChange={setCountedPhysicalCash}/>} declaredCash={<AmountField id="session-retained-float" label="Fond conservé en caisse" value={retainedFloat} onChange={setRetainedFloat}/>} variance={<SessionDiff countedPhysicalCash={Number(countedPhysicalCash || 0)} retainedFloat={Number(retainedFloat || 0)} expectedPhysicalCash={expectedPhysicalCash} />} footer={<><Button variant="outline" className="min-h-12" disabled={saving} onClick={() => setClosingDialogOpen(false)}>Annuler</Button><Button variant="destructive" className="min-h-12" disabled={saving} onClick={handleCloseShift}>{saving ? <Loader2 className="mr-2 size-4 animate-spin motion-reduce:animate-none"/> : null}Confirmer la clôture</Button></>} /> : null}</>
  return <><div className="mx-auto flex max-w-3xl gap-2 px-4 pt-4" aria-label="Période du rapport">{(["day", "week", "month"] as const).map((value) => <Button key={value} size="sm" variant={period === value ? "default" : "outline"} onClick={() => setPeriod(value)}>{value === "day" ? "Jour" : value === "week" ? "Semaine" : "Mois"}</Button>)}</div><PosSessionReportsView model={reportsModel} errors={[historyError && "historique personnel", handoversError && "remises"].filter(Boolean) as string[]} sessionControl={sessionControl} dialogs={dialogs} canValidate={false} saving={saving} onValidate={() => undefined} /></>
}

function MetricCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="rounded-xl bg-secondary/30 p-4">
      <Icon className="mb-2 h-5 w-5 text-primary" />
      <p className="text-[10px] font-black uppercase text-muted-foreground">{label}</p>
      <p className="text-lg font-black">{Number(value || 0).toLocaleString()} FCFA</p>
    </div>
  )
}

function AmountField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return <div><Label htmlFor={id}>{label}</Label><Input id={id} type="number" inputMode="numeric" min="0" value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 min-h-12 text-right text-xl font-bold tabular-nums" /></div>
}

function SessionDiff({
  countedPhysicalCash,
  retainedFloat,
  expectedPhysicalCash,
}: {
  countedPhysicalCash: number
  retainedFloat: number
  expectedPhysicalCash: number
}) {
  const diff = countedPhysicalCash - expectedPhysicalCash
  const expectedHandover = Math.max(0, countedPhysicalCash - retainedFloat)

  const state = diff === 0 ? "balanced" : diff > 0 ? "positive" : "negative"
  const label = diff === 0 ? "Correct" : diff > 0 ? "Excédent" : "Manque"
  return <PosVarianceDisplay expected={`${expectedPhysicalCash.toLocaleString()} FCFA`} received={`${countedPhysicalCash.toLocaleString()} FCFA`} variance={`${diff.toLocaleString()} FCFA · Versement attendu ${expectedHandover.toLocaleString()} FCFA`} state={state} label={label} />
}

const PAYMENT_BALANCE_LABELS: Record<string, string> = {
  orange_money: "Orange Money",
  wave: "Wave",
  moov_money: "Moov Money",
  card: "Carte bancaire",
  bank_transfer: "Virement bancaire",
}

function buildPaymentBalanceRows(openingValue: unknown, totalsByProvider: unknown) {
  const opening = resolvePaymentBalances(openingValue)
  const changes = resolvePaymentBalanceChanges(totalsByProvider)
  return POS_STATION_PAYMENT_BALANCE_KEYS.map((key) => {
    const before = Number(opening[key] || 0)
    const session = Number(changes[key] || 0)
    return { key, label: PAYMENT_BALANCE_LABELS[key], before, session, after: Math.max(0, before + session) }
  })
}

function resolvePaymentBalanceChanges(value: unknown) {
  const changes = resolvePaymentBalances(null)
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
  for (const [provider, amountValue] of Object.entries(source)) {
    const key = normalizePaymentProviderToBalanceKey(provider)
    const amount = Math.round(Number(amountValue || 0))
    if (key && Number.isFinite(amount)) changes[key] += amount
  }
  return changes
}

function PaymentBalanceSummary({ rows }: { rows: Array<{ key: string; label: string; before: number; session: number; after: number }> }) {
  return <div className="rounded-xl bg-secondary/30 p-4"><p className="text-[10px] font-black uppercase text-muted-foreground">Soldes moyens de paiement</p><div className="mt-2 grid gap-2">{rows.map((row) => <div key={row.key} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 text-xs"><span className="min-w-0 truncate font-semibold">{row.label}</span><span className="tabular-nums text-muted-foreground">Avant {row.before.toLocaleString("fr-FR")}</span><span className="tabular-nums text-muted-foreground">Session {row.session.toLocaleString("fr-FR")}</span><span className="tabular-nums font-black">Après {row.after.toLocaleString("fr-FR")}</span></div>)}</div></div>
}

function getSystemTotal(session: CashSession) {
  return Number(
    session.closeSnapshot?.systemTotal ??
      session.closeSnapshot?.systemTotals?.total ??
      Number(session.totalCash || 0) + Number(session.totalMobile || 0)
  )
}

function formatSessionStatus(session: CashSession) {
  if (session.validatedByManager || session.status === "validated") return "Validée"
  if (session.status === "rejected") return "Refusée"
  if (session.status === "closed" || session.status === "pending_validation") return "En attente"
  if (session.status === "open") return "Ouverte"
  return session.status
}

function formatHandoverStatus(status: string) {
  return ({
    submitted: "Transmise",
    under_review: "En revue",
    validated: "Validée",
    correction_required: "Correction demandée",
    rejected: "Rejetée",
  } as Record<string, string>)[status] || status
}

function formatHandoverDetails(handover: any) {
  return `Remis ${Number(handover.declaredAmount || 0).toLocaleString()} · Reçu ${Number(handover.receivedAmount || 0).toLocaleString()} · Écart ${Number(handover.receiptDifference ?? handover.declarationDifference ?? 0).toLocaleString()} · ${formatHandoverStatus(String(handover.status))}${handover.managerId ? ` · Manager ${handover.managerId}` : ""}`
}

function formatSessionDate(value: any) {
  const date = value?.toDate?.() ?? (value ? new Date(value) : null)
  if (!date) return "-"
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getTime(value: any) {
  const date = value?.toDate?.() ?? (value ? new Date(value) : null)
  return date ? date.getTime() : 0
}

function formatSessionDuration(openedAt: any, closedAt: any) {
  const start = getTime(openedAt)
  const end = getTime(closedAt)
  if (!start || !end || end < start) return "-"
  const minutes = Math.floor((end - start) / 60_000)
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return hours > 0 ? `${hours} h ${remainingMinutes} min` : `${remainingMinutes} min`
}
