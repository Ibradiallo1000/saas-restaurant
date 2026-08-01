"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { CashHandoverReviewPanel } from "./CashHandoverReviewPanel"
import { addDoc, collection, doc, getDocs, query, serverTimestamp, where, writeBatch } from "firebase/firestore"
import { AlertTriangle, Banknote, CheckCircle2, Clock, CreditCard, Plus, ReceiptText, Wallet } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AdminRouteSkeleton } from "@/components/performance/route-skeletons"
import { DashboardEmptyState, DashboardHeader, MetricCard } from "@/components/dashboard-ui"
import { ManagerPeriodFilter } from "@/components/layout/manager-period-filter"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { useRestaurant } from "@/design-system/context/RestaurantContext"
import { useTenant } from "@/design-system/context/TenantProvider"
import { useToast } from "@/hooks/use-toast"
import { COLLECTION_NAMES } from "@/lib/constants"
import { getDateRange, useTimeFilter } from "@/contexts/time-filter-context"
import { isConfirmedFinancePayment } from "@/lib/finance/financial-summary"
import { isOrderPaid, isOrderServed } from "@/lib/order-lifecycle"
import { cn } from "@/lib/utils"
import { useRestaurantLiveData } from "@/modules/restaurant-live/RestaurantLiveDataProvider"
import {
  confirmTableSessionPayment,
  posCommandIdempotencyKey,
} from "@/modules/pos/canonical"
import { approveCashOpeningRequest } from "@/modules/cash/approve-cash-opening-request"

export default function ManagerCaissePage() {
  const db = useFirestore()
  const searchParams = useSearchParams()
  const { restaurantId } = useRestaurant()
  const { user, role } = useTenant()
  const { filter } = useTimeFilter()
  const range = React.useMemo(() => getDateRange(filter), [filter])
  const expenseFormRef = React.useRef<HTMLElement | null>(null)
  const validationRef = React.useRef<HTMLElement | null>(null)
  const paymentsRef = React.useRef<HTMLElement | null>(null)
  const { toast } = useToast()
  
  
  const tableSessionsQuery = useMemoFirebase(
    () => {
      if (!db || !restaurantId) return null
      return query(
        collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, "tableSessions"),
        where("status", "==", "active")
      )
    },
    [db, restaurantId]
  )
  const { data: tableSessions } = useCollection<any>(tableSessionsQuery)

  const { activeOrders, cashSessionRequests, cashSessions, payments, isLoadingOrders, isLoadingSessions } = useRestaurantLiveData()

  const pendingPaymentSessions = React.useMemo(() => {
    const sessions = tableSessions || []
    const sessionsById = new Map(sessions.map((session: any) => [session.id, session]))
    const groups = new Map<string, any>()

    const ensureGroup = (sessionId: string, seed?: any) => {
      const session = seed || sessionsById.get(sessionId) || {}
      const existing = groups.get(sessionId)
      if (existing) return existing

      const group = {
        ...session,
        id: sessionId,
        tableId: session.tableId || null,
        zoneId: session.zoneId || "main",
        paymentRequest: session.paymentRequest || { status: "none" },
        orders: [] as any[],
      }
      groups.set(sessionId, group)
      return group
    }

    ;(activeOrders || []).forEach((order: any) => {
      const sessionId = order.tableSessionId || order.sessionId
      if (!sessionId || !isOrderServed(order) || isOrderPaid(order)) return

      const group = ensureGroup(sessionId)
      group.tableId = group.tableId || order.tableId || null
      group.tableName = group.tableName || order.table || order.tableName || order.tableId || null
      group.orders.push(order)
    })

    sessions
      .filter((session: any) => {
        return session.paymentRequest?.status === "requested" || session.paymentRequest?.status === "pending_confirmation"
      })
      .forEach((session: any) => {
        const group = ensureGroup(session.id, session)
        const sessionOrders = (activeOrders || []).filter((order: any) => {
          return (order.tableSessionId === session.id || order.sessionId === session.id) && !isOrderPaid(order)
        })
        sessionOrders.forEach((order: any) => {
          if (!group.orders.some((currentOrder: any) => currentOrder.id === order.id)) {
            group.orders.push(order)
          }
        })
      })

    return Array.from(groups.values()).map((session: any) => {
      const ordersTotalAmount = session.orders.reduce((sum: number, order: any) => sum + getOrderComputedTotal(order), 0)
      const itemCount = session.orders.reduce((sum: number, order: any) => {
        return sum + (order.items || []).reduce((itemSum: number, item: any) => itemSum + Number(item.quantity || 0), 0)
      }, 0)
      return {
        ...session,
        ordersTotalAmount,
        orderCount: session.orders.length,
        itemCount,
        payableAmount: ordersTotalAmount > 0 ? ordersTotalAmount : Number(session.totalAmount ?? session.total ?? 0),
      }
    }).filter((session: any) => session.orderCount > 0 || session.paymentRequest?.status === "requested" || session.paymentRequest?.status === "pending_confirmation")
  }, [activeOrders, tableSessions])

  

  const validateTableSessionPayment = async (session: any) => {
    if (!db || !restaurantId || !user || processingOrderId) return
    if (!currentUserCashSession?.id) {
      toast({
        title: "Caisse fermée",
        description: "Ouvre une session caisse avant de valider un paiement.",
        variant: "destructive",
      })
      return
    }

    const methodLabel = session.paymentRequest?.method === "mobile"
      ? String(session.paymentRequest?.provider || "Mobile Money")
      : "Espèces"
    const tableLabel = session.tableName || session.tableNumber || session.tableId || session.id
    const customerLabel = session.customerName || session.createdByName || "Client de la table"
    if (!window.confirm([
      "Confirmer le paiement de cette table ?",
      `Table : ${tableLabel}`,
      `Utilisateur : ${customerLabel}`,
      `Montant : ${Number(session.payableAmount || 0).toLocaleString("fr-FR")} FCFA`,
      `Moyen de paiement : ${methodLabel}`,
    ].join("\n"))) return

    setProcessingOrderId(session.id)
    try {
      const method = session.paymentRequest?.method === "mobile" ? "mobile" : "cash"
      const paymentType = method === "mobile" ? "mobile_money" : "cash"
      const paymentProvider =
        method === "mobile"
          ? String(session.paymentRequest?.provider || "mobile_money")
          : null
      await confirmTableSessionPayment({
        user,
        restaurantId,
        tableSessionId: session.id,
        cashSessionId: currentUserCashSession.id,
        method: paymentType,
        provider: paymentProvider,
        idempotencyKey: posCommandIdempotencyKey([
          "table-session-payment",
          restaurantId,
          session.id,
          paymentType,
          paymentProvider,
        ]),
      })
      toast({ title: "Paiement validé" })
    } catch (e) {
      console.error(e)
      toast({ title: "Erreur", description: "Impossible de valider", variant: "destructive" })
    } finally {
      setProcessingOrderId(null)
    }
  }

  const [processingOrderId, setProcessingOrderId] = React.useState<string | null>(null)
  const [activatingRequestId, setActivatingRequestId] = React.useState<string | null>(null)
  const [expenseAmount, setExpenseAmount] = React.useState("")
  const [expenseReason, setExpenseReason] = React.useState("")
  const [expenseCategory, setExpenseCategory] = React.useState("")
  const [creatingExpense, setCreatingExpense] = React.useState(false)

  const canValidateCash = role === "manager" || role === "owner"
  const currentUserCashSession = cashSessions.find((session: any) => {
    return (
      isOpenCashSessionStatus(session.status) &&
      (session.cashierId === user?.uid || session.userId === user?.uid)
    )
  }) ?? null
  const activeCashSession = React.useMemo(() => {
    const openSessions = (cashSessions || []).filter((session: any) => isOpenCashSessionStatus(session.status))
    if (!openSessions.length) return null
    return openSessions.sort((a: any, b: any) => getSessionOpenedAtMs(b) - getSessionOpenedAtMs(a))[0]
  }, [cashSessions])
  const activeCashSessionAmount = React.useMemo(() => {
    if (!activeCashSession) return 0
    return getCashSessionAmount(activeCashSession)
  }, [activeCashSession])

  const openingRequests = React.useMemo(() => {
    const requestRows = cashSessionRequests.map((request: any) => ({
      ...request,
      source: "request" as const,
    }))

    const sessionRows = cashSessions
      .filter((session: any) => isPendingCashSessionOpeningStatus(session.status))
      .map((session: any) => ({
        ...session,
        source: "session" as const,
      }))

    return [...requestRows, ...sessionRows]
  }, [cashSessionRequests, cashSessions])

  const cashMovementsQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return query(
      collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.CASH_MOVEMENTS),
      where("createdAt", ">=", range.startDate),
      where("createdAt", "<=", range.endDate)
    )
  }, [db, restaurantId, range.endDate, range.startDate])
  const { data: cashMovements } = useCollection<any>(cashMovementsQuery)

  const pendingSessions = React.useMemo(() => {
    const depositSessionIds = new Set(
      (cashMovements || [])
        .filter((movement: any) => movement.type === "deposit" && movement.sessionId)
        .map((movement: any) => movement.sessionId)
    )

    return cashSessions
      .filter((session: any) => {
        return (
          (session.status === "closed" || session.status === "pending_validation") &&
          !session.validatedByManager
        )
      })
      .map((session: any) => buildSessionValidationRow(session, depositSessionIds.has(session.id)))
  }, [cashMovements, cashSessions])

  const operationalPending = React.useMemo(
    () => getTableSessionPaymentSummary(pendingPaymentSessions),
    [pendingPaymentSessions]
  )
  const activeCashSummary = React.useMemo(
    () => buildActiveCashSummary(activeCashSession, payments || [], cashMovements || []),
    [activeCashSession, cashMovements, payments]
  )
  const isPaymentsFilter = searchParams?.get("filter") === "payments"

  React.useEffect(() => {
    if (isPaymentsFilter && paymentsRef.current) {
      paymentsRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [isPaymentsFilter, pendingPaymentSessions.length])

  const scrollToExpenseForm = React.useCallback(() => {
    expenseFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  const scrollToCashValidation = React.useCallback(() => {
    validationRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  const activateOpeningRequest = async (request: any) => {
    if (!db || !restaurantId || !user || !canValidateCash || activatingRequestId) return

    const cashierLabel = request.staffName || request.cashierName || request.userName || request.userEmail || request.userId || "Caissier"
    if (!window.confirm([
      "Approuver cette ouverture de caisse ?",
      `Caisse : ${request.cashRegisterName || request.cashRegisterId || "Caisse principale"}`,
      `Utilisateur : ${cashierLabel}`,
      `Fond initial : ${Number(request.openingBalance || request.initialAmount || 0).toLocaleString("fr-FR")} FCFA`,
    ].join("\n"))) return

    setActivatingRequestId(request.id)
    try {
      await approveCashOpeningRequest({
        db,
        restaurantId,
        request,
        approverId: user.uid,
        approverRole: role || "manager",
      })
    } finally {
      setActivatingRequestId(null)
    }
  }

  const createExpense = async () => {
    if (!db || !restaurantId || !user || !canValidateCash || creatingExpense) return

    const amount = Math.round(Number(expenseAmount || 0))
    if (!Number.isFinite(amount) || amount <= 0) return

    setCreatingExpense(true)
    try {
      await addDoc(collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.CASH_MOVEMENTS), {
        restaurantId,
        type: "expense",
        amount,
        source: "manual",
        sessionId: null,
        reason: expenseReason.trim() || "Dépense",
        category: expenseCategory.trim() || null,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
      })
      setExpenseAmount("")
      setExpenseReason("")
      setExpenseCategory("")
    } finally {
      setCreatingExpense(false)
    }
  }

  if (!restaurantId || isLoadingOrders || isLoadingSessions) {
    return <AdminRouteSkeleton />
  }

  return (
    <main className="space-y-4 pb-20 lg:pb-6">
      <DashboardHeader
        title="Caisse"
        subtitle="Suivez les encaissements, les sessions et les validations sur la période sélectionnée."
        actions={<ManagerPeriodFilter />}
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={Wallet} label="Total caisse actuelle" value={activeCashSummary.balance} />
        <KpiCard icon={ReceiptText} label="Total entrées" value={activeCashSummary.entries} />
        <KpiCard icon={Banknote} label="Total dépenses" value={activeCashSummary.expenses} danger={activeCashSummary.expenses > 0} />
        <KpiCard icon={Wallet} label="Solde réel" value={activeCashSummary.balance} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-xl border bg-card p-3 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-black uppercase tracking-tight">État de la caisse</h2>
                <span className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-black uppercase",
                  activeCashSession ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200" : "bg-muted text-muted-foreground"
                )}>
                  {activeCashSession ? "Ouverte" : "Fermée"}
                </span>
              </div>
              <div className="mt-2 grid gap-2 text-xs font-bold text-muted-foreground sm:grid-cols-3">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  Ouverture : {formatSessionTime(activeCashSession?.openedAt)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Wallet className="h-3.5 w-3.5" />
                  {activeCashSessionAmount.toLocaleString()} FCFA
                </span>
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Temps réel · {activeCashSession ? "Statut actif" : "Inactif"}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2 sm:min-w-64">
              <div className="min-w-0 text-xs">
                <p className="truncate font-black text-foreground">
                  {activeCashSession?.staffName || activeCashSession?.cashierName || activeCashSession?.userName || activeCashSession?.cashierId || activeCashSession?.userId || "Aucun caissier"}
                </p>
                <p className="mt-0.5 font-bold uppercase text-muted-foreground">
                  Session {activeCashSession?.id ? `#${activeCashSession.id.slice(-6).toUpperCase()}` : "—"}
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" className="h-8 rounded-md px-3 text-xs font-black" onClick={scrollToCashValidation}>
                Détails
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-sm font-black uppercase tracking-tight">Demandes d'ouverture</h2>
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-black text-muted-foreground">
              {openingRequests.length}
            </span>
          </div>

          {openingRequests.length === 0 ? (
            <EmptyFinanceState label="Aucune demande d'ouverture" compact />
          ) : (
            <div className="grid gap-2">
              {openingRequests.map((request: any) => (
                <CashOpeningRequestCard
                  key={`${request.source}-${request.id}`}
                  request={request}
                  canActivate={canValidateCash}
                  processing={activatingRequestId === request.id}
                  onActivate={() => activateOpeningRequest(request)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {pendingSessions.length > 0 ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-3 shadow-sm dark:border-amber-900 dark:bg-amber-950/30">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-600 text-white">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-black uppercase text-amber-700 dark:text-amber-200">
                  Sessions clôturées à régulariser
                </h2>
                <p className="text-xs font-semibold text-amber-900/80 dark:text-amber-100/80">
                  {pendingSessions.length} session{pendingSessions.length > 1 ? "s" : ""} clôturée{pendingSessions.length > 1 ? "s" : ""} attend{pendingSessions.length > 1 ? "ent" : ""} une remise ou une validation manager.
                </p>
              </div>
            </div>
            <Button onClick={scrollToCashValidation} size="sm" className="h-9 font-black">
              Vérifier
            </Button>
          </div>
        </section>
      ) : null}

      {pendingPaymentSessions.length > 0 && (
        <section ref={paymentsRef} className="scroll-mt-24 space-y-2" tabIndex={-1} aria-labelledby="pending-table-payments-title">
          <div className="flex items-center justify-between gap-3">
            <h2 id="pending-table-payments-title" className="text-sm font-black uppercase tracking-tight text-amber-600">
              Demandes de paiement table
            </h2>
            <span className="rounded-full bg-amber-600 px-2.5 py-0.5 text-[10px] font-black text-white">
              {pendingPaymentSessions.length}
            </span>
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            {pendingPaymentSessions.map((session: any) => (
              <TableSessionPaymentRequestCard
                key={session.id}
                session={session}
                processing={processingOrderId === session.id}
                onValidate={() => validateTableSessionPayment(session)}
              />
            ))}
          </div>
        </section>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <KpiCard icon={Wallet} label="À encaisser" value={operationalPending.pendingTotal} danger={operationalPending.pendingTotal > 0} />
        <KpiCard icon={CreditCard} label="Mobile en attente" value={operationalPending.mobilePending} />
        <KpiCard icon={Banknote} label="Cash en attente" value={operationalPending.cashPending} />
      </section>

      <section ref={expenseFormRef} className="rounded-xl border bg-card p-3 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-black uppercase tracking-tight">Ajouter une dépense</h2>
            <p className="text-xs text-muted-foreground">Toute sortie d'argent passe par un mouvement de caisse.</p>
          </div>
          <Plus className="h-4 w-4 text-primary" />
        </div>
        <div className="grid gap-3 md:grid-cols-[140px_1fr_160px_auto] md:items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">Montant</Label>
            <Input className="h-9" type="number" min="0" value={expenseAmount} onChange={(event) => setExpenseAmount(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Motif</Label>
            <Input className="h-9" value={expenseReason} onChange={(event) => setExpenseReason(event.target.value)} placeholder="Achat, transport, maintenance..." />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Catégorie</Label>
            <Input className="h-9" value={expenseCategory} onChange={(event) => setExpenseCategory(event.target.value)} placeholder="Optionnel" />
          </div>
          <Button className="h-9" disabled={!canValidateCash || creatingExpense || Number(expenseAmount || 0) <= 0} onClick={createExpense}>
            {creatingExpense ? "Ajout..." : "Ajouter"}
          </Button>
        </div>
      </section>

      <section ref={validationRef}>
        {restaurantId && user ? (
          <CashHandoverReviewPanel restaurantId={restaurantId} user={user} cashSessions={cashSessions} />
        ) : null}
      </section>

      <div className="fixed bottom-20 right-4 z-40 flex flex-col gap-3 md:hidden">
        <Button
          type="button"
          className="h-14 w-14 rounded-full p-0 shadow-lg"
          onClick={scrollToExpenseForm}
          aria-label="Ajouter depense"
        >
          <Plus className="h-6 w-6" />
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="h-14 w-14 rounded-full border p-0 shadow-lg"
          onClick={scrollToCashValidation}
          aria-label="Ouvrir ou cloturer caisse"
        >
          <Wallet className="h-6 w-6" />
        </Button>
      </div>

    </main>
  )
}

type SessionValidationRow = {
  id: string
  cashierLabel: string
  staffPhone?: string | null
  declaredTotal: number
  calculatedTotal: number
  declaredCash: number
  declaredMobile: number
  calculatedCash: number
  calculatedMobile: number
  difference: number
  cashDifference: number
  mobileDifference: number
  discrepancyStatus?: string
  totalOrders: number
  status: string
  openedAt: any
  closedAt: any
  depositCreated: boolean
}

function TableSessionPaymentRequestCard({
  session,
  processing,
  onValidate,
}: {
  session: any
  processing: boolean
  onValidate: () => void
}) {
  const requestStatus = session.paymentRequest?.status
  const paymentProofSms = session.paymentRequest?.paymentProofSms
  const isMobilePayment = session.paymentRequest?.method === "mobile"
  const mobilePaymentNeedsProof = isMobilePayment && !paymentProofSms
  const orders = session.orders || []
  const orderPreview = orders.slice(0, 3)

  return (
    <article className="relative overflow-hidden rounded-xl border border-amber-300 bg-amber-50 p-3 shadow-sm dark:border-amber-900 dark:bg-amber-950/20">
      <div className="absolute left-0 top-0 h-full w-1 bg-amber-500" />
      <div className="flex items-start justify-between gap-3 pl-2">
        <div>
          <h3 className="text-base font-black uppercase text-amber-600">{session.tableName || session.tableId || "Table"}</h3>
          <p className="mt-1 text-xs font-bold text-amber-800/80 dark:text-amber-200/80">
            {requestStatus === "pending_confirmation" && (
              <span className="bg-red-500 text-white px-2 py-0.5 rounded-full text-[10px] mr-2 uppercase animate-pulse">À vérifier</span>
            )}
            {isMobilePayment ? (
              <span className={`px-2 py-0.5 rounded-full text-[10px] mr-2 uppercase ${paymentProofSms ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}>
                {paymentProofSms ? "Preuve reçue" : "Preuve manquante"}
              </span>
            ) : null}
            {getTableSessionPaymentStatusLabel(session)}
          </p>
          <p className="mt-1 text-xs font-bold text-amber-900/70 dark:text-amber-100/70">
            {session.orderCount || 0} commande{session.orderCount > 1 ? "s" : ""} · {session.itemCount || 0} article{session.itemCount > 1 ? "s" : ""}
          </p>
        </div>
        <p className="whitespace-nowrap text-xl font-black text-amber-600">{Number(session.payableAmount || 0).toLocaleString()} FCFA</p>
      </div>

      <div className="mt-3 space-y-2 pl-2">
        {orderPreview.map((order: any) => (
          <div key={order.id} className="rounded-xl border border-amber-200 bg-white/70 px-3 py-2 text-xs font-semibold text-amber-950 dark:border-amber-900 dark:bg-background/40 dark:text-amber-100">
            <div className="flex items-center justify-between gap-3">
              <span className="font-black">{getShortOrderLabel(order)}</span>
              <span>{getOrderComputedTotal(order).toLocaleString()} FCFA</span>
            </div>
            <p className="mt-1 line-clamp-2 text-amber-900/75 dark:text-amber-100/75">
              {summarizeOrderItems(order)}
            </p>
          </div>
        ))}
        {orders.length > orderPreview.length ? (
          <p className="text-xs font-bold text-amber-900/70 dark:text-amber-100/70">
            +{orders.length - orderPreview.length} commande{orders.length - orderPreview.length > 1 ? "s" : ""} dans cette session
          </p>
        ) : null}
      </div>

      {paymentProofSms ? (
        <div className="mt-4 rounded-xl border border-amber-300 bg-white/80 p-3 text-xs text-amber-950 dark:border-amber-900 dark:bg-background/50 dark:text-amber-100">
          <p className="font-black uppercase">SMS de confirmation client</p>
          <p className="mt-2 whitespace-pre-wrap break-words font-semibold">{paymentProofSms}</p>
        </div>
      ) : null}

      <div className="mt-3 pl-2">
        <Button disabled={processing || Number(session.payableAmount || 0) <= 0 || mobilePaymentNeedsProof} onClick={onValidate} className="h-10 w-full bg-emerald-600 font-black text-white hover:bg-emerald-700">
          <CheckCircle2 className="mr-2 h-4 w-4" />
          {processing ? "Validation..." : "Encaisser et cloturer la table"}
        </Button>
      </div>
    </article>
  )
}

function getTableSessionPaymentStatusLabel(session: any) {
  const status = session.paymentRequest?.status
  if (status === "pending_confirmation") return "Paiement declare par le client - verification caisse"
  if (status === "requested") {
    const method = session.paymentRequest?.method === "cash" ? "Especes" : session.paymentRequest?.provider || "Mobile Money"
    return `Paiement demande - ${method}`
  }
  return "Commandes servies non payees"
}

function getShortOrderLabel(order: any) {
  const id = String(order?.orderNumber || order?.displayId || order?.id || "").slice(-6).toUpperCase()
  return id ? `Commande #${id}` : "Commande"
}

function summarizeOrderItems(order: any) {
  const items = Array.isArray(order?.items) ? order.items : []
  if (items.length === 0) return "Aucun detail article"

  return items
    .slice(0, 4)
    .map((item: any) => `${Number(item.quantity || 1)}x ${item.name || item.nameSnapshot || "Article"}`)
    .join(", ")
}

function CashOpeningRequestCard({
  request,
  canActivate,
  processing,
  onActivate,
}: {
  request: any
  canActivate: boolean
  processing: boolean
  onActivate: () => void
}) {
  return (
    <article className="rounded-xl border border-amber-300 bg-amber-50/60 p-3 shadow-sm dark:border-amber-900 dark:bg-amber-950/20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-black">{request.staffName || request.cashierName || "Caissier"}</h3>
          <p className="text-xs font-bold uppercase text-muted-foreground">
            Demande #{request.id.slice(-6).toUpperCase()} · {formatSessionStatus(request.status)}
          </p>
          {request.staffPhone ? (
            <p className="text-xs font-semibold text-muted-foreground">{request.staffPhone}</p>
          ) : null}
        </div>
        <div className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-black text-amber-700 dark:text-amber-300">
          En attente
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs font-bold text-muted-foreground">
          Créée : {formatSessionTime(request.createdAt || request.requestedAt)}
        </div>
        <Button disabled={!canActivate || processing} onClick={onActivate} size="sm" className="h-9 font-black">
          {processing ? "Activation..." : "Activer session"}
        </Button>
      </div>
    </article>
  )
}

function SessionValidationCard({
  session,
  canValidate,
  processing,
  discrepancyReason,
  onDiscrepancyReasonChange,
  onValidate,
  onDiscrepancy,
}: {
  session: SessionValidationRow
  canValidate: boolean
  processing: boolean
  discrepancyReason: string
  onDiscrepancyReasonChange: (value: string) => void
  onValidate: () => void
  onDiscrepancy: () => void
}) {
  const hasDifference = session.difference !== 0
  const isAlreadyCounted = session.depositCreated

  return (
    <article className={cn("rounded-xl border bg-card p-3 shadow-sm", hasDifference && "border-amber-300")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-black">{session.cashierLabel}</h3>
          <p className="text-xs font-bold uppercase text-muted-foreground">
            Session #{session.id.slice(-6).toUpperCase()} · {formatSessionStatus(session.status)} · {session.totalOrders} commandes
          </p>
          {session.staffPhone ? (
            <p className="text-xs font-semibold text-muted-foreground">{session.staffPhone}</p>
          ) : null}
        </div>
        <div className={cn("rounded-full px-3 py-1 text-xs font-black", hasDifference ? "bg-red-500/10 text-red-600" : "bg-emerald-500/10 text-emerald-600")}>
          {isAlreadyCounted ? "Comptabilisée" : hasDifference ? "Écart" : "Conforme"}
        </div>
      </div>

      {isAlreadyCounted ? (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          Session déjà comptabilisée
        </div>
      ) : null}

      <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
        <AmountBlock label="Montant déclaré" value={session.declaredTotal} />
        <AmountBlock label="Montant calculé" value={session.calculatedTotal} />
        <AmountBlock label="Écart" value={session.difference} danger={hasDifference} />
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold text-muted-foreground">
        <span>Cash déclaré: {session.declaredCash.toLocaleString()} FCFA</span>
        <span>Mobile déclaré: {session.declaredMobile.toLocaleString()} FCFA</span>
        <span>Cash: {session.calculatedCash.toLocaleString()} FCFA</span>
        <span>Mobile: {session.calculatedMobile.toLocaleString()} FCFA</span>
        <span>Écart cash: {session.cashDifference.toLocaleString()} FCFA</span>
        <span>Écart mobile: {session.mobileDifference.toLocaleString()} FCFA</span>
        <span>Ouverture: {formatSessionTime(session.openedAt)}</span>
        <span>Fermeture: {formatSessionTime(session.closedAt)}</span>
      </div>

      {hasDifference ? (
        <div className="mt-4 space-y-2">
          <Label>Motif écart</Label>
          <Input
            value={discrepancyReason}
            onChange={(event) => onDiscrepancyReasonChange(event.target.value)}
            placeholder="Ex: rendu monnaie, erreur déclaration, contrôle à faire..."
          />
        </div>
      ) : null}

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <Button disabled={!canValidate || processing} onClick={onValidate} size="sm" className="h-9 font-black">
          <CheckCircle2 className="mr-2 h-4 w-4" />
          {processing ? "Validation..." : "Valider conforme"}
        </Button>
        <Button disabled={!canValidate || processing} onClick={onDiscrepancy} variant="outline" size="sm" className="h-9 font-black">
          <AlertTriangle className="mr-2 h-4 w-4" />
          À investiguer
        </Button>
      </div>
    </article>
  )
}

function AmountBlock({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="rounded-lg bg-muted p-2.5">
      <p className="text-[10px] font-black uppercase text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-base font-black", danger ? "text-amber-600" : "text-foreground")}>
        {value.toLocaleString()} FCFA
      </p>
    </div>
  )
}

function KpiCard({
  icon: Icon,
  label,
  value,
  danger,
}: {
  icon: React.ElementType
  label: string
  value: number
  danger?: boolean
}) {
  const variant = danger ? "danger" : label.includes("encaisser") || label.includes("Caisse") ? "finance" : "neutral"
  return <MetricCard variant={variant} label={label} value={value.toLocaleString("fr-FR")} unit="FCFA" icon={<Icon />} emphasis={danger ? "strong" : "default"} />
}

function EmptyFinanceState({ label, compact = false }: { label: string; compact?: boolean }) {
  return <DashboardEmptyState className={compact ? "min-h-16 p-3" : undefined} title={label} icon={<CheckCircle2 />} />
}

function buildSessionValidationRow(session: any, depositAlreadyExists = false): SessionValidationRow {
  const snapshot = session.closeSnapshot || {}
  const calculatedCash = Number(snapshot.systemCash ?? snapshot.systemTotals?.cash ?? session.totalCash ?? 0)
  const calculatedMobile = Number(snapshot.systemMobileMoney ?? snapshot.systemTotals?.mobileMoney ?? session.totalMobileMoney ?? session.totalMobile ?? 0)
  const calculatedTotal = Number(snapshot.totalCalculated ?? snapshot.systemTotal ?? snapshot.systemTotals?.total ?? session.totalCalculated ?? session.totalConfirmed ?? calculatedCash + calculatedMobile)
  const declaredCash = Number(snapshot.declaredCash ?? snapshot.declaredTotals?.cash ?? session.declaredCash ?? calculatedCash)
  const declaredMobile = Number(snapshot.declaredMobileMoney ?? snapshot.declaredTotals?.mobileMoney ?? session.declaredMobileMoney ?? calculatedMobile)
  const declaredTotal = Number(snapshot.declaredTotal ?? snapshot.declaredTotals?.total ?? session.declaredTotal ?? declaredCash + declaredMobile)

  return {
    id: session.id,
    cashierLabel: session.staffName || session.cashierName || session.userName || session.cashierEmail || session.cashierId || session.userId || "Caissier",
    staffPhone: session.staffPhone || session.telephone || null,
    declaredTotal,
    calculatedTotal,
    declaredCash,
    declaredMobile,
    calculatedCash,
    calculatedMobile,
    difference: Number(snapshot.totalDifference ?? snapshot.diff?.total ?? session.discrepancyAmount ?? declaredTotal - calculatedTotal),
    cashDifference: Number(snapshot.cashDifference ?? snapshot.diff?.cash ?? declaredCash - calculatedCash),
    mobileDifference: Number(snapshot.mobileMoneyDifference ?? snapshot.diff?.mobileMoney ?? declaredMobile - calculatedMobile),
    discrepancyStatus: snapshot.discrepancyStatus || session.discrepancyStatus,
    totalOrders: Number(snapshot.totalOrders ?? session.totalOrders ?? 0),
    status: session.status,
    openedAt: session.openedAt,
    closedAt: session.closedAt,
    depositCreated: session.depositCreated === true || depositAlreadyExists,
  }
}

function getTableSessionPaymentSummary(sessions: any[]) {
  const pendingTotal = sessions.reduce((sum, session) => sum + getSessionAmount(session), 0)
  const cashPending = sessions
    .filter((session) => session.paymentRequest?.method === "cash")
    .reduce((sum, session) => sum + getSessionAmount(session), 0)
  const mobilePending = sessions
    .filter((session) => session.paymentRequest?.method === "mobile")
    .reduce((sum, session) => sum + getSessionAmount(session), 0)

  return { pendingTotal, cashPending, mobilePending }
}

function getSessionAmount(session: any) {
  return Number(session.payableAmount ?? session.ordersTotalAmount ?? session.totalAmount ?? session.total ?? 0)
}

function getOrderComputedTotal(order: any) {
  if (Array.isArray(order.items) && order.items.length > 0) {
    return order.items.reduce((sum: number, item: any) => {
      const unitPrice = Number(item.priceSnapshot ?? item.price ?? item.unitPrice ?? 0)
      const quantity = Number(item.quantity ?? 1)
      return sum + unitPrice * quantity
    }, 0)
  }

  return Number(order.totalAmount ?? order.total ?? 0)
}

function formatSessionTime(value: any) {
  const date = value?.toDate?.()
  if (!date) return "temps réel"
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
}

function getCashSessionAmount(session: any) {
  return (
    Number(session?.openingBalance ?? 0) +
    getCashSessionSalesAmount(session)
  )
}

function buildActiveCashSummary(activeCashSession: any, payments: any[], cashMovements: any[]) {
  if (!activeCashSession?.id) {
    return { entries: 0, expenses: 0, balance: 0 }
  }

  const sessionId = String(activeCashSession.id)
  const sessionPaymentsTotal = payments
    .filter((payment: any) => isConfirmedFinancePayment(payment) && String(payment.sessionId || "") === sessionId)
    .reduce((sum: number, payment: any) => sum + getPositiveAmount(payment.amount), 0)
  const sessionAggregateTotal = getCashSessionSalesAmount(activeCashSession)
  const entries = sessionPaymentsTotal > 0 ? sessionPaymentsTotal : sessionAggregateTotal
  const expenses = cashMovements
    .filter((movement: any) => String(movement.sessionId || movement.sourceSessionId || "") === sessionId)
    .filter((movement: any) => movement.type === "expense" || movement.type === "withdrawal" || movement.direction === "out")
    .reduce((sum: number, movement: any) => sum + getPositiveAmount(movement.amount), 0)
  const openingBalance = getPositiveAmount(activeCashSession.openingBalance)

  return {
    entries,
    expenses,
    balance: openingBalance + entries - expenses,
  }
}

function getCashSessionSalesAmount(session: any) {
  return (
    getPositiveAmount(session?.totalCash) +
    getPositiveAmount(session?.totalMobileMoney ?? session?.totalMobile)
  )
}

function getPositiveAmount(value: unknown) {
  const amount = Number(value || 0)
  return Number.isFinite(amount) && amount > 0 ? amount : 0
}

function getSessionOpenedAtMs(session: any) {
  const date = session?.openedAt?.toDate?.() ?? (session?.openedAt instanceof Date ? session.openedAt : null)
  return date?.getTime?.() ?? 0
}

function formatSessionStatus(status: string) {
  if (isPendingCashSessionOpeningStatus(status)) return "Demande ouverture"
  if (status === "closed" || status === "pending_validation") return "En attente"
  if (status === "validated") return "Validée"
  if (status === "rejected") return "Refusée"
  if (isOpenCashSessionStatus(status)) return "Ouverte"
  return status
}

function isOpenCashSessionStatus(status: unknown) {
  return status === "open" || status === "opened" || status === "active"
}

function isPendingCashSessionOpeningStatus(status: unknown) {
  return status === "pending" || status === "requested" || status === "request"
}
