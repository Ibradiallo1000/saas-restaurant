"use client"

import * as React from "react"
import { collection, limit, query, where } from "firebase/firestore"
import { History, Loader2, Power, Receipt, ShieldCheck, Wallet } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { useToast } from "@/hooks/use-toast"
import { useRestaurant } from "@/design-system/context/RestaurantContext"
import { useTenant } from "@/design-system/context/TenantProvider"
import { COLLECTION_NAMES, ROLES } from "@/lib/constants"
import { CashierService, type CashSession } from "@/services/cashier.service"

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
  const { data: closedSessions, refetch: refetchClosedSessions } = useCollection<CashSession>(closedSessionsQuery)

  const historyQuery = useMemoFirebase(() => {
    if (!db || !restaurantId || !user?.uid) return null
    return query(
      collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.CASH_SESSIONS),
      where("cashierId", "==", user.uid),
      limit(50)
    )
  }, [db, restaurantId, user?.uid])
  const { data: historySessions } = useCollection<CashSession>(historyQuery)

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
    if (!cashierService || !restaurantId || !user) return
    setSaving(true)
    try {
      await cashierService.openShift(restaurantId, user.uid, Number(openingBalance || 0))
      toast({ title: "Session ouverte" })
      await loadSession()
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: error.message })
    } finally {
      setSaving(false)
    }
  }

  const handleCloseShift = async () => {
    if (!cashierService || !restaurantId || !session || !user) return
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
      setSaving(false)
    }
  }

  const handleValidate = async (cashSession: CashSession) => {
    if (!cashierService || !restaurantId || !user) return
    setSaving(true)
    try {
      await cashierService.validateShift(restaurantId, cashSession.id, user.uid)
      toast({ title: "Caisse validée" })
      refetchClosedSessions()
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: error.message })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 py-8">
      <section className="grid gap-6 lg:grid-cols-2">
        {!session ? (
          <Card className="border-none shadow-xl">
            <CardHeader>
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <Power className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl font-black uppercase">
                {latestClosedSession ? "Session clôturée" : "Ouvrir ma caisse"}
              </CardTitle>
              <CardDescription>
                {latestClosedSession
                  ? "En attente de validation manager. La session reste visible dans l'historique."
                  : "Une session ouverte est obligatoire pour vendre depuis le POS."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {latestClosedSession ? (
                <div className="rounded-xl border border-[var(--brand-primary)]/30 bg-[var(--brand-primary-soft)] p-3 text-sm font-bold text-[var(--brand-primary)]">
                  <p>Statut : en attente de validation manager</p>
                  <p className="mt-1 text-xs">Session #{latestClosedSession.id.slice(-6).toUpperCase()}</p>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label>Montant initial</Label>
                <Input type="number" min="0" value={openingBalance} onChange={(event) => setOpeningBalance(event.target.value)} />
              </div>
              <Button className="h-12 w-full font-black uppercase" disabled={saving || Boolean(latestClosedSession)} onClick={handleOpenShift}>
                {saving ? <Loader2 className="animate-spin" /> : "Ouvrir ma caisse"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden border-none shadow-xl">
            <CardHeader className="bg-primary text-primary-foreground">
              <CardTitle className="text-2xl font-black uppercase">Session caisse ouverte</CardTitle>
              <CardDescription className="text-primary-foreground/80">ID session: {session.id}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 p-6">
              <div className="grid grid-cols-3 gap-3">
                <MetricCard icon={Wallet} label="Fond initial" value={session.openingBalance} />
                <MetricCard icon={Receipt} label="Espèces" value={session.totalCash} />
                <MetricCard icon={Receipt} label="Mobile" value={session.totalMobile} />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Espèces réelles</Label>
                  <Input type="number" min="0" value={declaredCash} onChange={(event) => setDeclaredCash(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Mobile Money réel</Label>
                  <Input type="number" min="0" value={declaredMobileMoney} onChange={(event) => setDeclaredMobileMoney(event.target.value)} />
                </div>
              </div>
              <SessionDiff
                declaredCash={Number(declaredCash || 0)}
                declaredMobile={Number(declaredMobileMoney || 0)}
                systemCash={Number(session.totalCash || 0)}
                systemMobile={Number(session.totalMobile || 0)}
              />
              <Button variant="destructive" className="h-12 w-full font-black uppercase" disabled={saving} onClick={handleCloseShift}>
                {saving ? <Loader2 className="animate-spin" /> : "Clôturer la caisse"}
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="border-none shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-black uppercase">
              <History className="h-5 w-5 text-primary" /> Historique des sessions
            </CardTitle>
            <CardDescription>Une session clôturée ne disparaît jamais.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {sortedHistory.map((cashSession) => (
              <SessionRow key={cashSession.id} session={cashSession} />
            ))}
            {!sortedHistory.length ? <p className="text-sm text-muted-foreground">Aucune session.</p> : null}
          </CardContent>
        </Card>
      </section>

      {canValidate ? (
        <Card className="border-none shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-black uppercase">
              <ShieldCheck className="h-5 w-5 text-primary" /> Validation des caisses
            </CardTitle>
            <CardDescription>Comparer le réel et le système avant validation manager.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(closedSessions || []).map((cashSession) => {
              const systemTotal = getSystemTotal(cashSession)
              const realTotal = Number(cashSession.declaredTotal ?? cashSession.closingBalance ?? 0)
              return (
                <div key={cashSession.id} className="grid gap-3 rounded-xl border p-4 md:grid-cols-[1fr_auto] md:items-center">
                  <div className="grid gap-2 text-sm md:grid-cols-5">
                    <span className="font-bold">#{cashSession.id.slice(-6).toUpperCase()}</span>
                    <span>Commandes: {cashSession.totalOrders || 0}</span>
                    <span>Système: {systemTotal.toLocaleString()} FCFA</span>
                    <span>Réel: {realTotal.toLocaleString()} FCFA</span>
                    <span>Écart: {Number(cashSession.discrepancyAmount ?? realTotal - systemTotal).toLocaleString()} FCFA</span>
                  </div>
                  <Button disabled={saving || cashSession.validatedByManager} onClick={() => handleValidate(cashSession)}>
                    {cashSession.validatedByManager ? "Validée" : "Valider"}
                  </Button>
                </div>
              )
            })}
            {!closedSessions?.length ? <p className="text-sm text-muted-foreground">Aucune caisse à valider.</p> : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
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

  return (
    <div className="rounded-xl bg-muted p-3 text-sm font-bold">
      <div className="flex justify-between">
        <span>Total déclaré</span>
        <span>{declaredTotal.toLocaleString()} FCFA</span>
      </div>
      <div className="mt-1 flex justify-between text-muted-foreground">
        <span>Total système</span>
        <span>{systemTotal.toLocaleString()} FCFA</span>
      </div>
      <div className="mt-1 flex justify-between text-primary">
        <span>Écart</span>
        <span>{diff.toLocaleString()} FCFA</span>
      </div>
    </div>
  )
}

function SessionRow({ session }: { session: CashSession }) {
  const systemTotal = getSystemTotal(session)
  const diff = Number(session.discrepancyAmount ?? 0)

  return (
    <div className="grid gap-3 rounded-xl border px-3 py-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center">
      <div>
        <p className="font-bold">#{session.id.slice(-6).toUpperCase()}</p>
        <p className="text-xs text-muted-foreground">
          Ouverture: {formatSessionDate(session.openedAt)} · Fermeture: {formatSessionDate(session.closedAt)}
        </p>
        <p className="text-xs text-muted-foreground">{session.totalOrders || 0} commandes · Écart {diff.toLocaleString()} FCFA</p>
      </div>
      <div className="text-left sm:text-right">
        <p className="font-black">{systemTotal.toLocaleString()} FCFA</p>
        <p className="text-xs text-muted-foreground">{formatSessionStatus(session)}</p>
      </div>
    </div>
  )
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
