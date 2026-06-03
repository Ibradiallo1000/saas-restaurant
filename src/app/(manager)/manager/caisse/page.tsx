"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { addDoc, collection, doc, getDocs, query, runTransaction, serverTimestamp, updateDoc, where, writeBatch } from "firebase/firestore"
import { AlertTriangle, Banknote, CheckCircle2, Clock, CreditCard, Plus, ReceiptText, Wallet } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AdminRouteSkeleton } from "@/components/performance/route-skeletons"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { useRestaurant } from "@/design-system/context/RestaurantContext"
import { useTenant } from "@/design-system/context/TenantProvider"
import { useToast } from "@/hooks/use-toast"
import { COLLECTION_NAMES } from "@/lib/constants"
import { getDateRange, useTimeFilter } from "@/contexts/time-filter-context"
import { getFinancialSummary } from "@/lib/finance/financial-summary"
import { cn } from "@/lib/utils"
import { useRestaurantLiveData } from "@/modules/restaurant-live/RestaurantLiveDataProvider"
import { TreasuryService } from "@/services/treasury.service"
import {
  buildPaymentIdempotencyKey,
  normalizePaymentProvider,
  PaymentLedgerService,
} from "@/services/payment-ledger.service"

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

  const pendingPaymentSessions = React.useMemo(() => {
    const sessions = tableSessions || []
    const requests = sessions.filter((session: any) => {
      return session.paymentRequest?.status === "requested" || session.paymentRequest?.status === "pending_confirmation"
    })
    console.log("CAISSE READ:", requests)
    return requests
  }, [tableSessions])

  

  const validateTableSessionPayment = async (session: any) => {
    if (!db || !restaurantId || !user) return
    if (!currentUserCashSession?.id) {
      toast({
        title: "Caisse fermée",
        description: "Ouvre une session caisse avant de valider un paiement.",
        variant: "destructive",
      })
      return
    }

    setProcessingOrderId(session.id)
    try {
      const sessionRef = doc(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, "tableSessions", session.id)
      const ordersRef = collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.ORDERS)
      const [tableSessionOrdersSnap, legacySessionOrdersSnap] = await Promise.all([
        getDocs(query(ordersRef, where("tableSessionId", "==", session.id))),
        getDocs(query(ordersRef, where("sessionId", "==", session.id))),
      ])
      const orderDocs = new Map<string, (typeof tableSessionOrdersSnap.docs)[number]>()

      tableSessionOrdersSnap.docs.forEach((orderDoc) => orderDocs.set(orderDoc.id, orderDoc))
      legacySessionOrdersSnap.docs.forEach((orderDoc) => orderDocs.set(orderDoc.id, orderDoc))

      const method = session.paymentRequest?.method === "mobile" ? "mobile" : "cash"
      const paymentType = method === "mobile" ? "mobile_money" : "cash"
      const paymentProvider = method === "mobile" ? normalizePaymentProvider(session.paymentRequest?.provider || "mobile_money") : null
      const ledger = new PaymentLedgerService(db)

      for (const orderDoc of Array.from(orderDocs.values())) {
        const currentOrder = { id: orderDoc.id, ...orderDoc.data() } as any
        const amount = getOrderComputedTotal(currentOrder)

        await ledger.createPayment({
          restaurantId,
          orderId: orderDoc.id,
          sessionId: currentUserCashSession.id,
          cashierId: user.uid,
          source: "qr_table",
          type: paymentType,
          provider: paymentProvider,
          amount,
          status: "confirmed",
          idempotencyKey: buildPaymentIdempotencyKey([
            "table-session-payment",
            restaurantId,
            session.id,
            orderDoc.id,
            paymentType,
            paymentProvider,
          ]),
          orderUpdate: {
            paymentStatus: "paid",
            paymentMethod: paymentType,
            paymentType,
            paymentProvider,
            cashSessionId: currentUserCashSession.id,
            paidAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
        })
      }

      const batch = writeBatch(db)
      batch.update(sessionRef, {
        "paymentRequest.status": "validated",
        "paymentRequest.handledAt": serverTimestamp(),
        "paymentRequest.handledBy": user.uid,
        status: "closed",
        closedAt: serverTimestamp(),
      })

      await batch.commit()
      toast({ title: "Paiement validé" })
    } catch (e) {
      console.error(e)
      toast({ title: "Erreur", description: "Impossible de valider", variant: "destructive" })
    } finally {
      setProcessingOrderId(null)
    }
  }

  const rejectTableSessionPayment = async (session: any) => {
    if (!db || !restaurantId || !user) return
    setProcessingOrderId(session.id)
    try {
      const sessionRef = doc(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, "tableSessions", session.id)
      await updateDoc(sessionRef, {
        "paymentRequest.status": "rejected",
        "paymentRequest.handledAt": serverTimestamp(),
        "paymentRequest.handledBy": user.uid,
      })
      toast({ title: "Paiement refusé" })
    } catch (e) {
      console.error(e)
    } finally {
      setProcessingOrderId(null)
    }
  }
  const { cashSessionRequests, cashSessions, payments, isLoadingOrders, isLoadingSessions } = useRestaurantLiveData()
  const treasuryService = React.useMemo(() => (db ? new TreasuryService(db) : null), [db])
  const [processingOrderId, setProcessingOrderId] = React.useState<string | null>(null)
  const [validatingSessionId, setValidatingSessionId] = React.useState<string | null>(null)
  const [activatingRequestId, setActivatingRequestId] = React.useState<string | null>(null)
  const [expenseAmount, setExpenseAmount] = React.useState("")
  const [expenseReason, setExpenseReason] = React.useState("")
  const [expenseCategory, setExpenseCategory] = React.useState("")
  const [creatingExpense, setCreatingExpense] = React.useState(false)
  const [discrepancyReasons, setDiscrepancyReasons] = React.useState<Record<string, string>>({})

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
  const periodPayments = React.useMemo(
    () => (payments || []).filter((payment: any) => isValueInDateRange(payment.createdAt, range.startDate, range.endDate)),
    [payments, range.endDate, range.startDate]
  )
  const globalCash = React.useMemo(
    () => getFinancialSummary({ movements: cashMovements || [], payments: periodPayments }),
    [cashMovements, periodPayments]
  )
  const isPaymentsFilter = searchParams?.get("filter") === "payments"

  React.useEffect(() => {
    if (isPaymentsFilter && paymentsRef.current) {
      paymentsRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [isPaymentsFilter])

  const scrollToExpenseForm = React.useCallback(() => {
    expenseFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  const scrollToCashValidation = React.useCallback(() => {
    validationRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  const activateOpeningRequest = async (request: any) => {
    if (!db || !restaurantId || !user || !canValidateCash || activatingRequestId) return

    setActivatingRequestId(request.id)
    try {
      const cashierId = request.cashierId || request.userId || request.staffId
      if (!cashierId) return

      const staffId = request.staffId || cashierId
      const sessionId = request.sessionId || request.id
      const sessionPayload = {
        restaurantId,
        cashierId,
        userId: cashierId,
        staffId,
        staffName: request.staffName || request.cashierName || "Caissier",
        cashierName: request.cashierName || request.staffName || "Caissier",
        staffPhone: request.staffPhone || null,
        status: "open",
        openedAt: serverTimestamp(),
        closedAt: null,
        openingBalance: Number(request.openingBalance || 0),
        closingBalance: null,
        totalCash: 0,
        totalMobile: 0,
        totalOrders: 0,
        validatedByManager: false,
        approvedBy: user.uid,
        approvedRole: role || "manager",
        approvedAt: serverTimestamp(),
        createdAt: request.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      }

      await runTransaction(db, async (transaction) => {
        if (request.source === "session") {
          const sessionRef = doc(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.CASH_SESSIONS, request.id)
          transaction.update(sessionRef, {
            ...sessionPayload,
            activatedFrom: "cashSession",
          })
          return
        }

        const requestRef = doc(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, "cashSessionRequests", request.id)
        const sessionRef = doc(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.CASH_SESSIONS, sessionId)
        transaction.set(sessionRef, {
          ...sessionPayload,
          requestId: request.id,
          activatedFrom: "cashSessionRequest",
        })
        transaction.update(requestRef, {
          status: "approved",
          sessionId,
          approvedBy: user.uid,
          approvedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      })
    } finally {
      setActivatingRequestId(null)
    }
  }

  const validateSession = async (session: SessionValidationRow, flag?: "discrepancy") => {
    if (!treasuryService || !restaurantId || !user || !canValidateCash) return

    setValidatingSessionId(session.id)
    try {
      await treasuryService.postCashSessionMovementToTreasury({
        restaurantId,
        sessionId: session.id,
        managerId: user.uid,
        managerRole: role || "manager",
        calculatedTotal: session.calculatedTotal,
        calculatedCash: session.calculatedCash,
        calculatedMobile: session.calculatedMobile,
        totalOrders: session.totalOrders,
        difference: session.difference,
        validationFlag: flag ?? null,
        discrepancyReason: discrepancyReasons[session.id]?.trim() || null,
      })
    } finally {
      setValidatingSessionId(null)
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
    <main className="space-y-6 pb-20">
      <section className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-primary">Caisse</h1>
            <p className="text-sm text-muted-foreground">
              Argent vendu, déclaré, vérifié puis validé.
            </p>
          </div>
          <div className="rounded-full border bg-background px-3 py-1 text-xs font-black uppercase text-emerald-600">
            {activeCashSession ? "Session active" : "Aucune session active"}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Ouverture : {formatSessionTime(activeCashSession?.openedAt)}
          </span>
          {activeCashSession ? (
            <span className="inline-flex items-center gap-1">
              <Wallet className="h-3 w-3" />
              Montant session : {activeCashSessionAmount.toLocaleString()} FCFA
            </span>
          ) : null}
          {activeCashSession ? (
            <span className="inline-flex items-center gap-1">
              <strong>Caissier :</strong> {activeCashSession.staffName || activeCashSession.cashierName || activeCashSession.userName || activeCashSession.cashierId || activeCashSession.userId || "Caissier"}
            </span>
          ) : null}
        </div>
      </section>

      {pendingSessions.length > 0 ? (
        <section className="rounded-2xl border-2 border-orange-300 bg-orange-50 p-4 shadow-sm dark:border-orange-900 dark:bg-orange-950/30">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-600 text-white">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-black uppercase text-orange-700 dark:text-orange-200">
                  Caisse POS à valider
                </h2>
                <p className="text-sm font-semibold text-orange-900/80 dark:text-orange-100/80">
                  {pendingSessions.length} session{pendingSessions.length > 1 ? "s" : ""} clôturée{pendingSessions.length > 1 ? "s" : ""} attend{pendingSessions.length > 1 ? "ent" : ""} une validation manager.
                </p>
              </div>
            </div>
            <Button onClick={scrollToCashValidation} className="min-h-11 font-black">
              Vérifier maintenant
            </Button>
          </div>
        </section>
      ) : null}


      {pendingPaymentSessions.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-black uppercase tracking-tight text-orange-600 animate-pulse">
              DEMANDES DE PAIEMENT TABLE
            </h2>
            <span className="rounded-full bg-orange-600 text-white px-3 py-1 text-xs font-black">
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
                onReject={() => rejectTableSessionPayment(session)}
              />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-black uppercase tracking-tight">Demandes d'ouverture</h2>
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-black text-muted-foreground">
            {openingRequests.length}
          </span>
        </div>

        {openingRequests.length === 0 ? (
          <EmptyFinanceState label="Aucune demande d'ouverture de caisse." />
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
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
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <KpiCard icon={Wallet} label="Total caisse actuelle" value={globalCash.balance} />
        <KpiCard icon={ReceiptText} label="Total entrées" value={globalCash.deposits} />
        <KpiCard icon={Banknote} label="Total dépenses" value={globalCash.expenses} danger={globalCash.expenses > 0} />
        <KpiCard icon={Wallet} label="Solde réel" value={globalCash.balance} />
      </section>

      <section ref={expenseFormRef} className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black uppercase tracking-tight">Ajouter une dépense</h2>
            <p className="text-sm text-muted-foreground">Toute sortie d'argent passe par un mouvement de caisse.</p>
          </div>
          <Plus className="h-5 w-5 text-primary" />
        </div>
        <div className="grid gap-3 md:grid-cols-[160px_1fr_180px_auto] md:items-end">
          <div className="space-y-2">
            <Label>Montant</Label>
            <Input type="number" min="0" value={expenseAmount} onChange={(event) => setExpenseAmount(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Motif</Label>
            <Input value={expenseReason} onChange={(event) => setExpenseReason(event.target.value)} placeholder="Achat, transport, maintenance..." />
          </div>
          <div className="space-y-2">
            <Label>Catégorie</Label>
            <Input value={expenseCategory} onChange={(event) => setExpenseCategory(event.target.value)} placeholder="Optionnel" />
          </div>
          <Button disabled={!canValidateCash || creatingExpense || Number(expenseAmount || 0) <= 0} onClick={createExpense}>
            {creatingExpense ? "Ajout..." : "Ajouter"}
          </Button>
        </div>
      </section>

      <section ref={validationRef} className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-black uppercase tracking-tight">VALIDATION DES CAISSES</h2>
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-black text-muted-foreground">
            {pendingSessions.length} en attente
          </span>
        </div>

        {pendingSessions.length === 0 ? (
          <EmptyFinanceState label="Aucune caisse en attente de validation." />
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {pendingSessions.map((session) => (
              <SessionValidationCard
                key={session.id}
                session={session}
                canValidate={canValidateCash}
                processing={validatingSessionId === session.id}
                discrepancyReason={discrepancyReasons[session.id] || ""}
                onDiscrepancyReasonChange={(value) => {
                  setDiscrepancyReasons((current) => ({ ...current, [session.id]: value }))
                }}
                onValidate={() => validateSession(session)}
                onDiscrepancy={() => validateSession(session, "discrepancy")}
              />
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <KpiCard icon={Wallet} label="À encaisser" value={operationalPending.pendingTotal} danger={operationalPending.pendingTotal > 0} />
        <KpiCard icon={CreditCard} label="Mobile en attente" value={operationalPending.mobilePending} />
        <KpiCard icon={Banknote} label="Cash en attente" value={operationalPending.cashPending} />
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
  onReject,
}: {
  session: any
  processing: boolean
  onValidate: () => void
  onReject: () => void
}) {
  const requestStatus = session.paymentRequest?.status
  const requestLabel =
    requestStatus === "pending_confirmation"
      ? "Client dit avoir payé"
      : "Client a choisi paiement"

  return (
    <article className="rounded-2xl border-2 border-orange-300 bg-orange-50 p-4 shadow-sm relative overflow-hidden dark:bg-orange-950/20">
      <div className="absolute top-0 left-0 w-1.5 h-full bg-orange-500 animate-pulse" />
      <div className="flex items-start justify-between gap-3 pl-2">
        <div>
          <h3 className="text-xl font-black uppercase text-orange-600">{session.tableName || session.tableId}</h3>
          <p className="text-sm font-bold text-orange-800/80 dark:text-orange-200/80 mt-1">
            {requestStatus === "pending_confirmation" && (
              <span className="bg-red-500 text-white px-2 py-0.5 rounded-full text-[10px] mr-2 uppercase animate-pulse">À vérifier</span>
            )}
            {requestLabel} : <span className="uppercase text-orange-900 font-black dark:text-orange-100">{session.paymentRequest?.method === "cash" ? "Espèces" : session.paymentRequest?.provider || "Mobile Money"}</span>
          </p>
        </div>
        <p className="text-2xl font-black text-orange-600">{Number(session.totalAmount || 0).toLocaleString()} FCFA</p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 pl-2">
        <Button disabled={processing} onClick={onValidate} className="font-black h-12 bg-emerald-600 hover:bg-emerald-700 text-white w-full">
          <CheckCircle2 className="mr-2 h-5 w-5" />
          Valider le paiement
        </Button>
        <Button disabled={processing} onClick={onReject} variant="outline" className="font-black h-12 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 w-full bg-white dark:bg-transparent">
          <AlertTriangle className="mr-2 h-5 w-5" />
          Refuser
        </Button>
      </div>
    </article>
  )
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
    <article className="rounded-2xl border border-orange-300 bg-orange-50/60 p-4 shadow-sm dark:border-orange-900 dark:bg-orange-950/20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black">{request.staffName || request.cashierName || "Caissier"}</h3>
          <p className="text-xs font-bold uppercase text-muted-foreground">
            Demande #{request.id.slice(-6).toUpperCase()} · {formatSessionStatus(request.status)}
          </p>
          {request.staffPhone ? (
            <p className="text-xs font-semibold text-muted-foreground">{request.staffPhone}</p>
          ) : null}
        </div>
        <div className="rounded-full bg-orange-500/10 px-3 py-1 text-xs font-black text-orange-700 dark:text-orange-300">
          En attente
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs font-bold text-muted-foreground">
          Créée : {formatSessionTime(request.createdAt || request.requestedAt)}
        </div>
        <Button disabled={!canActivate || processing} onClick={onActivate} className="min-h-11 font-black">
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
    <article className={cn("rounded-2xl border bg-card p-4 shadow-sm", hasDifference && "border-orange-300")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black">{session.cashierLabel}</h3>
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

      <div className="mt-4 grid gap-2 text-sm md:grid-cols-3">
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

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        <Button disabled={!canValidate || processing} onClick={onValidate} className="font-black">
          <CheckCircle2 className="mr-2 h-4 w-4" />
          {processing ? "Validation..." : "Valider conforme"}
        </Button>
        <Button disabled={!canValidate || processing} onClick={onDiscrepancy} variant="outline" className="font-black">
          <AlertTriangle className="mr-2 h-4 w-4" />
          À investiguer
        </Button>
      </div>
    </article>
  )
}

function AmountBlock({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="rounded-xl bg-muted p-3">
      <p className="text-[10px] font-black uppercase text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-lg font-black", danger ? "text-orange-600" : "text-foreground")}>
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
  return (
    <Card>
      <CardContent className="p-4">
        <Icon className={cn("mb-3 h-5 w-5", danger ? "text-orange-600" : "text-primary")} />
        <p className="text-xs font-black uppercase text-muted-foreground">{label}</p>
        <p className={cn("mt-1 text-2xl font-black", danger ? "text-orange-600" : "text-foreground")}>
          {value.toLocaleString()} FCFA
        </p>
      </CardContent>
    </Card>
  )
}

function EmptyFinanceState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
      {label}
    </div>
  )
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
  return Number(session.totalAmount ?? session.total ?? 0)
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
    Number(session?.totalCash ?? 0) +
    Number(session?.totalMobile ?? 0)
  )
}

function getSessionOpenedAtMs(session: any) {
  const date = session?.openedAt?.toDate?.() ?? (session?.openedAt instanceof Date ? session.openedAt : null)
  return date?.getTime?.() ?? 0
}

function isValueInDateRange(value: any, startDate: Date, endDate: Date) {
  const date = value?.toDate?.() ?? (value instanceof Date ? value : null)
  if (!date) return false
  return date >= startDate && date <= endDate
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
