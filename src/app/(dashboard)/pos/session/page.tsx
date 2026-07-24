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
import { COLLECTION_NAMES, ROLES } from "@/lib/constants"
import { CashierService, type CashSession } from "@/services/cashier.service"
import { PosSessionReportsView } from "./PosSessionReportsView"
import { buildPosSessionReportsViewModel } from "./pos-session-reports-view-model"

export default function CashierSessionPage() {
  const db = useFirestore()
  const { restaurantId, role } = useRestaurant()
  const { user } = useTenant()
  const { toast } = useToast()
  const [session, setSession] = React.useState<CashSession | null>(null)
  const [openingBalance, setOpeningBalance] = React.useState("0")
  const [declaredCash, setDeclaredCash] = React.useState("0")
  const [declaredMobileMoney, setDeclaredMobileMoney] = React.useState("0")
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [openingDialogOpen, setOpeningDialogOpen] = React.useState(true)
  const [closingDialogOpen, setClosingDialogOpen] = React.useState(false)
  const sessionMutationLockRef = React.useRef(false)

  const cashierService = React.useMemo(() => (db ? new CashierService(db) : null), [db])
  const canValidate = role === ROLES.MANAGER || role === ROLES.OWNER

  const closedSessionsQuery = useMemoFirebase(() => {
    if (!db || !restaurantId || !canValidate) return null
    return query(
      collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.CASH_SESSIONS),
      where("status", "in", ["closed", "pending_validation"]),
      limit(50)
    )
  }, [canValidate, db, restaurantId])
  const { data: closedSessions, error: closedSessionsError, refetch: refetchClosedSessions } = useCollection<CashSession>(closedSessionsQuery)

  const historyQuery = useMemoFirebase(() => {
    if (!db || !restaurantId || !user?.uid) return null
    return query(
      collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.CASH_SESSIONS),
      where("cashierId", "==", user.uid),
      limit(50)
    )
  }, [db, restaurantId, user?.uid])
  const { data: historySessions, error: historyError } = useCollection<CashSession>(historyQuery)

  const sortedHistory = React.useMemo(() => {
    return [...(historySessions || [])].sort((a, b) => getTime(b.openedAt) - getTime(a.openedAt))
  }, [historySessions])

  const latestClosedSession = React.useMemo(() => {
    return sortedHistory.find((cashSession) => {
      return cashSession.status !== "open" && !cashSession.validatedByManager
    }) ?? null
  }, [sortedHistory])

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
      await cashierService.openShift(restaurantId, user.uid, Number(openingBalance || 0))
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
    if (!cashierService || !restaurantId || !session || !user || sessionMutationLockRef.current) return
    sessionMutationLockRef.current = true
    setSaving(true)
    try {
      await cashierService.closeShift(restaurantId, session.id, {
        closingBalance: Number(declaredCash || 0) + Number(declaredMobileMoney || 0),
        declaredCash: Number(declaredCash || 0),
        declaredMobileMoney: Number(declaredMobileMoney || 0),
        closedBy: user.uid,
      })
      toast({ title: "Session clôturée", description: "En attente de validation manager." })
      await loadSession()
      refetchClosedSessions()
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: error.message })
    } finally {
      sessionMutationLockRef.current = false
      setSaving(false)
    }
  }

  const handleValidate = async (cashSession: CashSession) => {
    if (!cashierService || !restaurantId || !user || sessionMutationLockRef.current) return
    sessionMutationLockRef.current = true
    setSaving(true)
    try {
      await cashierService.validateShift(restaurantId, cashSession.id, user.uid)
      toast({ title: "Caisse validée" })
      refetchClosedSessions()
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
  const reportsModel = buildPosSessionReportsViewModel({
    report: reportSession ? {
      reference: `#${reportSession.id.slice(-6).toUpperCase()}`, employee: reportSession.cashierId,
      schedule: `${formatSessionDate(reportSession.openedAt)} → ${formatSessionDate(reportSession.closedAt)}`,
      status: formatSessionStatus(reportSession), orders: `${reportSession.totalOrders || 0} commandes`, payments: `${getSystemTotal(reportSession).toLocaleString()} FCFA`,
      cash: `${Number(reportSession.totalCash || 0).toLocaleString()} FCFA`, mobileMoney: `${Number(reportSession.totalMobile || 0).toLocaleString()} FCFA`,
      openedAt: formatSessionDate(reportSession.openedAt), closedAt: formatSessionDate(reportSession.closedAt), variance: `${Number(reportSession.discrepancyAmount ?? 0).toLocaleString()} FCFA`,
      duration: formatSessionDuration(reportSession.openedAt, reportSession.closedAt), quality: "complete" as const,
    } : null,
    history: sortedHistory.map((cashSession) => ({ id: cashSession.id, reference: `#${cashSession.id.slice(-6).toUpperCase()}`, schedule: `${formatSessionDate(cashSession.openedAt)} → ${formatSessionDate(cashSession.closedAt)}`, ordersAndVariance: `${cashSession.totalOrders || 0} commandes · Écart ${Number(cashSession.discrepancyAmount ?? 0).toLocaleString()} FCFA`, total: `${getSystemTotal(cashSession).toLocaleString()} FCFA`, status: formatSessionStatus(cashSession) })),
    validations: (closedSessions || []).map((cashSession) => { const systemTotal = getSystemTotal(cashSession); const realTotal = Number(cashSession.declaredTotal ?? cashSession.closingBalance ?? 0); return { id: cashSession.id, reference: `#${cashSession.id.slice(-6).toUpperCase()}`, orders: String(cashSession.totalOrders || 0), system: `${systemTotal.toLocaleString()} FCFA`, real: `${realTotal.toLocaleString()} FCFA`, variance: `${Number(cashSession.discrepancyAmount ?? realTotal - systemTotal).toLocaleString()} FCFA`, validated: Boolean(cashSession.validatedByManager) } }),
    historyQuality: "partial" as const,
  })

  const sessionControl = !session ? (
          <DashboardWidget>
            <DashboardWidgetHeader title={latestClosedSession ? "Session clôturée" : "Caisse fermée"} description={latestClosedSession ? "En attente de validation manager. La session reste visible dans l'historique." : "Une session ouverte est obligatoire pour vendre depuis le POS."} />
            <div className="p-4">
              {latestClosedSession ? <PosSessionStatus status="pendingValidation" label="Validation manager requise" description={`Session #${latestClosedSession.id.slice(-6).toUpperCase()}`} /> : <PosSessionRequiredState title="Aucune session ouverte" description="Ouvrez votre caisse pour commencer les ventes." action={<Button className="min-h-12" onClick={() => setOpeningDialogOpen(true)}>Ouvrir ma caisse</Button>} />}
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
  const dialogs = <>{!session && !latestClosedSession ? <PosSessionOpeningDialog open={openingDialogOpen} onOpenChange={setOpeningDialogOpen} title="Ouvrir ma caisse" description="Saisissez le montant initial avant de commencer les ventes." user={user?.email || user?.uid} openingAmount={`${Number(openingBalance || 0).toLocaleString()} FCFA`} date={new Date().toLocaleDateString("fr-FR")} footer={<><Button variant="outline" className="min-h-12" disabled={saving} onClick={() => setOpeningDialogOpen(false)}>Annuler</Button><Button className="min-h-12" disabled={saving} onClick={handleOpenShift}>{saving ? <Loader2 className="mr-2 size-4 animate-spin motion-reduce:animate-none"/> : null}Ouvrir ma caisse</Button></>}><div><Label htmlFor="opening-balance">Montant initial</Label><Input autoFocus id="opening-balance" type="number" inputMode="numeric" min="0" value={openingBalance} onChange={(event) => setOpeningBalance(event.target.value)} className="mt-1 min-h-14 text-right text-2xl font-bold tabular-nums" /></div></PosSessionOpeningDialog> : null}{session ? <PosSessionClosingDialog open={closingDialogOpen} onOpenChange={setClosingDialogOpen} title="Clôturer la caisse" description="Saisissez les montants comptés puis confirmez la clôture." summary={<div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><MetricCard icon={Receipt} label="Espèces attendues" value={session.totalCash}/><MetricCard icon={Receipt} label="Mobile Money" value={session.totalMobile}/><MetricCard icon={Wallet} label="Total session" value={Number(session.totalCash || 0) + Number(session.totalMobile || 0)}/></div>} expectedCash={<AmountField id="session-declared-cash" label="Espèces comptées" value={declaredCash} onChange={setDeclaredCash}/>} declaredCash={<AmountField id="session-declared-mobile" label="Mobile Money compté" value={declaredMobileMoney} onChange={setDeclaredMobileMoney}/>} variance={<SessionDiff declaredCash={Number(declaredCash || 0)} declaredMobile={Number(declaredMobileMoney || 0)} systemCash={Number(session.totalCash || 0)} systemMobile={Number(session.totalMobile || 0)} />} footer={<><Button variant="outline" className="min-h-12" disabled={saving} onClick={() => setClosingDialogOpen(false)}>Annuler</Button><Button variant="destructive" className="min-h-12" disabled={saving} onClick={handleCloseShift}>{saving ? <Loader2 className="mr-2 size-4 animate-spin motion-reduce:animate-none"/> : null}Confirmer la clôture</Button></>} /> : null}</>
  return <PosSessionReportsView model={reportsModel} errors={[historyError && "historique personnel", closedSessionsError && "sessions à valider"].filter(Boolean) as string[]} sessionControl={sessionControl} dialogs={dialogs} canValidate={canValidate} saving={saving} onValidate={(id) => { const target = (closedSessions || []).find((cashSession) => cashSession.id === id); if (target) void handleValidate(target) }} />
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
  declaredCash,
  declaredMobile,
  systemCash,
  systemMobile,
}: {
  declaredCash: number
  declaredMobile: number
  systemCash: number
  systemMobile: number
}) {
  const declaredTotal = declaredCash + declaredMobile
  const systemTotal = systemCash + systemMobile
  const diff = declaredTotal - systemTotal

  const state = diff === 0 ? "balanced" : diff > 0 ? "positive" : "negative"
  const label = diff === 0 ? "Correct" : diff > 0 ? "Excédent" : "Manque"
  return <PosVarianceDisplay expected={`${systemTotal.toLocaleString()} FCFA`} received={`${declaredTotal.toLocaleString()} FCFA`} variance={`${diff.toLocaleString()} FCFA`} state={state} label={label} />
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
