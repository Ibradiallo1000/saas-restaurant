"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { addDoc, collection, doc, runTransaction, serverTimestamp } from "firebase/firestore"
import { AlertTriangle, Banknote, CheckCircle2, Clock, CreditCard, Plus, ReceiptText, Wallet } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AdminRouteSkeleton } from "@/components/performance/route-skeletons"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { useRestaurant } from "@/design-system/context/RestaurantContext"
import { useTenant } from "@/design-system/context/TenantProvider"
import { COLLECTION_NAMES } from "@/lib/constants"
import { getFinancialSummary } from "@/lib/finance/financial-summary"
import { isOrderPaid, isOrderServed } from "@/lib/order-lifecycle"
import { cn } from "@/lib/utils"
import { useRestaurantLiveData } from "@/modules/restaurant-live/RestaurantLiveDataProvider"
import {
  processOrderPaymentTransaction,
  releaseOrderTableIfNeeded,
  updateCashSessionTotals,
  validateMobilePaymentTransaction,
} from "@/services/pos-security.service"

export default function ManagerCaissePage() {
  const db = useFirestore()
  const searchParams = useSearchParams()
  const { restaurantId } = useRestaurant()
  const { user, role } = useTenant()
  const expenseFormRef = React.useRef<HTMLElement | null>(null)
  const validationRef = React.useRef<HTMLElement | null>(null)
  const paymentsRef = React.useRef<HTMLElement | null>(null)
  const { activeOrders, cashSessionRequests, cashSessions, payments, isLoadingOrders, isLoadingSessions } = useRestaurantLiveData()
  const [processingOrderId, setProcessingOrderId] = React.useState<string | null>(null)
  const [validatingSessionId, setValidatingSessionId] = React.useState<string | null>(null)
  const [activatingRequestId, setActivatingRequestId] = React.useState<string | null>(null)
  const [expenseAmount, setExpenseAmount] = React.useState("")
  const [expenseReason, setExpenseReason] = React.useState("")
  const [expenseCategory, setExpenseCategory] = React.useState("")
  const [creatingExpense, setCreatingExpense] = React.useState(false)
  const [discrepancyReasons, setDiscrepancyReasons] = React.useState<Record<string, string>>({})

  const canValidateCash = role === "manager" || role === "owner"
  const activeSession = cashSessions.find((session: any) => isOpenCashSessionStatus(session.status)) ?? null
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
    return collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.CASH_MOVEMENTS)
  }, [db, restaurantId])
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

  const servedOrders = React.useMemo(() => {
    return activeOrders.filter((order: any) => isOrderServed(order))
  }, [activeOrders])
  const unpaidOrders = React.useMemo(() => {
    return servedOrders.filter((order: any) => !isPaid(order))
  }, [servedOrders])
  const operationalPending = React.useMemo(() => getOperationalPendingSummary(unpaidOrders), [unpaidOrders])
  const globalCash = React.useMemo(
    () => getFinancialSummary({ movements: cashMovements || [], payments: payments || [] }),
    [cashMovements, payments]
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

  const collectOrder = async (order: any) => {
    if (!db || !restaurantId || !user || !isOrderServed(order)) return
    if (!activeSession?.id) return

    setProcessingOrderId(order.id)
    try {
      const amount = Number(order.total ?? order.totalAmount ?? 0)
      const staff = {
        userId: user.uid,
        staffId: user.uid,
        staffName: user.displayName || user.email?.split("@")[0] || "Manager",
      }
      const isMobilePayment = order.paymentType === "mobile" || (order.paymentMethod && order.paymentMethod !== "cash")

      const beforeOrder = isMobilePayment
        ? await validateMobilePaymentTransaction({
            db,
            restaurantId,
            orderId: order.id,
            cashSessionId: activeSession.id,
            amount,
            staff,
            printedClient: !order.printedClient,
          })
        : await processOrderPaymentTransaction({
            db,
            restaurantId,
            orderId: order.id,
            method: "cash",
            paymentMethod: "cash",
            cashSessionId: activeSession.id,
            amount,
            staff,
            printedClient: !order.printedClient,
          })

      if (activeSession?.id) {
        await updateCashSessionTotals(db, restaurantId, activeSession.id, isMobilePayment ? "mobile" : "cash", amount)
      }

      await releaseOrderTableIfNeeded(db, restaurantId, beforeOrder)
    } finally {
      setProcessingOrderId(null)
    }
  }

  const validateSession = async (session: SessionValidationRow, flag?: "discrepancy") => {
    if (!db || !restaurantId || !user || !canValidateCash) return

    setValidatingSessionId(session.id)
    try {
      const sessionRef = doc(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.CASH_SESSIONS, session.id)
      const movementRef = doc(
        db,
        COLLECTION_NAMES.RESTAURANTS,
        restaurantId,
        COLLECTION_NAMES.CASH_MOVEMENTS,
        `session-${session.id}`
      )

      await runTransaction(db, async (transaction) => {
        const sessionSnap = await transaction.get(sessionRef)
        const movementSnap = await transaction.get(movementRef)
        if (!sessionSnap.exists()) throw new Error("Session introuvable.")
        if (sessionSnap.data().validatedByManager || sessionSnap.data().status === "validated") return

        transaction.update(sessionRef, {
          status: "validated",
          validatedByManager: true,
          validatedBy: user.uid,
          validatedAt: serverTimestamp(),
          validationFlag: flag ?? null,
          discrepancyAmount: flag === "discrepancy" ? session.difference : 0,
          calculatedTotal: session.calculatedTotal,
          calculatedCash: session.calculatedCash,
          calculatedMobile: session.calculatedMobile,
          calculatedOrders: session.totalOrders,
          discrepancyStatus: flag === "discrepancy" ? "investigate" : "validated",
          discrepancyReason: discrepancyReasons[session.id]?.trim() || null,
          investigationRequired: flag === "discrepancy",
          depositCreated: true,
          updatedAt: serverTimestamp(),
        })

        if (movementSnap.exists()) {
          console.info("[finance] depot session deja existant", {
            sessionId: session.id,
            amount: session.calculatedTotal,
          })
          return
        }

        console.info("[finance] creation depot session", {
          sessionId: session.id,
          amount: session.calculatedTotal,
        })
        transaction.set(movementRef, {
          restaurantId,
          type: "deposit",
          amount: session.calculatedTotal,
          source: "session",
          sessionId: session.id,
          createdAt: serverTimestamp(),
          createdBy: user.uid,
          reason: "Validation manager de session caisse",
          category: "session",
          discrepancyReason: discrepancyReasons[session.id]?.trim() || null,
        })
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
            {activeSession ? "Session active" : "Aucune session active"}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Ouverture : {formatSessionTime(activeSession?.openedAt)}
          </span>
        </div>
      </section>

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

      <section
        ref={paymentsRef}
        className={cn(
          "space-y-3 rounded-2xl border border-transparent p-0 transition",
          isPaymentsFilter && "border-orange-300 bg-orange-50/50 p-3 dark:border-orange-900 dark:bg-orange-950/20"
        )}
      >
        <h2 className="text-lg font-black uppercase tracking-tight">À encaisser</h2>
        {unpaidOrders.length === 0 ? (
          <EmptyFinanceState label="Aucune commande servie en attente de paiement." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {unpaidOrders.map((order: any) => (
              <CashOrderCard
                key={order.id}
                order={order}
                actionLabel="Encaisser"
                processing={processingOrderId === order.id}
                onCollect={() => collectOrder(order)}
              />
            ))}
          </div>
        )}
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

function CashOrderCard({
  order,
  paid,
  processing,
  actionLabel,
  onCollect,
}: {
  order: any
  paid?: boolean
  processing?: boolean
  actionLabel?: string
  onCollect?: () => void
}) {
  return (
    <article className={cn("rounded-2xl border bg-card p-4 shadow-sm", !paid && "border-orange-300")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black">#{order.id.slice(-6).toUpperCase()}</h3>
          <p className="text-xs font-bold uppercase text-muted-foreground">{getOrderTypeLabel(order)}</p>
        </div>
        <p className="text-lg font-black text-primary">{getOrderAmount(order).toLocaleString()} FCFA</p>
      </div>

      <div className="mt-3 space-y-1 rounded-xl bg-muted px-3 py-2 text-sm">
        {(order.items || []).slice(0, 4).map((item: any) => (
          <p key={`${order.id}-${item.productId}-${item.nameSnapshot || item.name}`} className="truncate">
            {item.quantity}x {item.name || item.nameSnapshot}
          </p>
        ))}
        <p className="pt-1 text-xs font-black uppercase text-muted-foreground">
          Paiement : {formatPayment(order)}
        </p>
      </div>

      {!paid && onCollect ? (
        <Button className="mt-4 h-10 w-full font-black uppercase" disabled={processing} onClick={onCollect}>
          {processing ? "Encaissement..." : actionLabel || "Encaisser"}
        </Button>
      ) : (
        <div className="mt-4 rounded-xl bg-emerald-500/10 px-3 py-2 text-center text-xs font-black uppercase text-emerald-600">
          Payée
        </div>
      )}
    </article>
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

function getOperationalPendingSummary(unpaidOrders: any[]) {
  const pendingTotal = unpaidOrders.reduce((sum, order) => sum + getOrderAmount(order), 0)
  const cashPending = unpaidOrders
    .filter((order) => order.paymentStatus === "pending_cash" || (order.paymentType || order.paymentMethod || "cash") === "cash")
    .reduce((sum, order) => sum + getOrderAmount(order), 0)
  const mobilePending = unpaidOrders
    .filter((order) => order.paymentStatus === "pending_mobile" || order.paymentType === "mobile" || order.paymentType === "mobile_money" || (order.paymentMethod && order.paymentMethod !== "cash"))
    .reduce((sum, order) => sum + getOrderAmount(order), 0)

  return { pendingTotal, cashPending, mobilePending }
}

function isPaid(order: any) {
  return isOrderPaid(order)
}

function getOrderAmount(order: any) {
  return Number(order.total ?? order.totalAmount ?? 0)
}

function getOrderTypeLabel(order: any) {
  const type = order.orderType || (order.type === "table" ? "dine_in" : order.type)
  if (type === "dine_in") return "Sur place"
  if (type === "delivery") return "Livraison"
  return "À emporter"
}

function formatPayment(order: any) {
  if (order.paymentMethod === "cash" || order.paymentType === "cash") return "Cash"
  if (order.paymentType === "mobile" || order.paymentMethod) return order.paymentMethod || "Mobile money"
  return "Non défini"
}

function formatSessionTime(value: any) {
  const date = value?.toDate?.()
  if (!date) return "temps réel"
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
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
