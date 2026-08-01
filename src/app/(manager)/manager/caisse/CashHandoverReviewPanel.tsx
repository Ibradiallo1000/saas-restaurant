"use client"

import * as React from "react"
import { collection, limit, query } from "firebase/firestore"
import type { User } from "firebase/auth"

import { DashboardWidget, DashboardWidgetHeader } from "@/components/dashboard-ui"
import { ReportsEmptyState } from "@/components/reports-ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { useToast } from "@/hooks/use-toast"
import { COLLECTION_NAMES } from "@/lib/constants"
import {
  ensureCashHandoverForReview,
  reviewCashHandover,
} from "@/modules/pos/canonical/cash-handover-command-client"

export function CashHandoverReviewPanel({
  restaurantId,
  user,
  cashSessions,
  audience = "manager",
}: {
  restaurantId: string
  user: User
  cashSessions: any[]
  audience?: "manager" | "owner"
}) {
  const db = useFirestore()
  const { toast } = useToast()
  const [received, setReceived] = React.useState<Record<string, string>>({})
  const [notes, setNotes] = React.useState<Record<string, string>>({})
  const [savingId, setSavingId] = React.useState<string | null>(null)
  const handoversQuery = useMemoFirebase(
    () => db ? query(collection(db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.CASH_HANDOVERS), limit(100)) : null,
    [db, restaurantId]
  )
  const { data: handovers, error: handoversError, isLoading } = useCollection<any>(handoversQuery)
  const pending = (handovers || []).filter((item: any) =>
    ["submitted", "under_review"].includes(String(item.status))
  )
  const sessionsById = new Map(cashSessions.map((session: any) => [session.id, session]))
  const handoverSessionIds = new Set((handovers || []).map((item: any) => item.sessionId))
  const awaitingSubmission = cashSessions.filter((session: any) =>
    (session.status === "closed" || session.status === "pending_validation") &&
    !session.validatedByManager &&
    !handoverSessionIds.has(session.id)
  )

  const decide = async (
    handover: any,
    decision: "under_review" | "validated" | "correction_required" | "rejected"
  ) => {
    if (savingId) return
    const session = sessionsById.get(handover.sessionId) as any
    const expectedAmount = Number(handover.expectedAmount ?? session?.expectedHandover ?? 0)
    const receivedAmount = Number(received[handover.id] ?? handover.declaredAmount ?? 0)
    const difference = receivedAmount - expectedAmount
    if (
      !window.confirm(
        decision === "validated"
          ? [
              "Valider cette remise de caisse ?",
              `Caisse : session #${String(handover.sessionId).slice(-6).toUpperCase()}`,
              `Utilisateur : ${session?.staffName || session?.cashierName || session?.userName || session?.cashierId || session?.userId || "Caissier"}`,
              `Montant attendu : ${expectedAmount.toLocaleString("fr-FR")} FCFA`,
              `Montant reçu : ${receivedAmount.toLocaleString("fr-FR")} FCFA`,
              `Écart : ${difference.toLocaleString("fr-FR")} FCFA`,
              "La trésorerie sera mise à jour avec le montant reçu.",
            ].join("\n")
          : decision === "rejected"
            ? "Rejeter cette remise ? Une nouvelle intervention sera nécessaire."
            : "Enregistrer cette décision sur la remise ?"
      )
    ) return
    setSavingId(handover.id)
    try {
      await reviewCashHandover({
        restaurantId,
        handoverId: handover.id,
        user,
        decision,
        receivedAmount: decision === "validated"
          ? Number(received[handover.id] ?? handover.declaredAmount ?? 0)
          : undefined,
        note: notes[handover.id] || "",
      })
      toast({
        title: decision === "validated" ? "Remise validée" : "Décision enregistrée",
      })
    } catch (error: any) {
      console.error("CASH_HANDOVER_REVIEW_FAILED", error)
      toast({ variant: "destructive", title: "Validation impossible", description: audience === "owner" ? "La remise n’a pas été modifiée. Réessayez." : error.message })
    } finally {
      setSavingId(null)
    }
  }

  const recoverAndValidate = async (session: any) => {
    const handoverId = `session-${session.id}`
    const expectedAmount = Number(session.expectedHandover || 0)
    const receivedAmount = Number(received[handoverId] ?? expectedAmount)
    if (savingId) return
    if (!window.confirm([
      "Valider cette session clôturée et sa remise ?",
      `Caisse : session #${String(session.id).slice(-6).toUpperCase()}`,
      `Utilisateur : ${session.staffName || session.cashierName || session.userName || session.cashierId || session.userId || "Caissier"}`,
      `Montant attendu : ${expectedAmount.toLocaleString("fr-FR")} FCFA`,
      `Montant reçu : ${receivedAmount.toLocaleString("fr-FR")} FCFA`,
      `Écart : ${(receivedAmount - expectedAmount).toLocaleString("fr-FR")} FCFA`,
    ].join("\n"))) return
    setSavingId(handoverId)
    try {
      const ensured = await ensureCashHandoverForReview({ restaurantId, sessionId: session.id, user })
      if (ensured.status !== "validated") {
        if (ensured.status === "submitted") {
          await reviewCashHandover({
            restaurantId,
            handoverId,
            user,
            decision: "under_review",
            note: notes[handoverId] || "Régularisation manager d'une session clôturée.",
          })
        }
        await reviewCashHandover({
          restaurantId,
          handoverId,
          user,
          decision: "validated",
          receivedAmount,
          note: notes[handoverId] || "Réception validée par le manager.",
        })
      }
      toast({ title: expectedAmount > 0 ? "Réception validée" : "Session Mobile Money validée" })
    } catch (error: any) {
      console.error("CASH_HANDOVER_RECOVERY_FAILED", error)
      toast({ variant: "destructive", title: "Validation impossible", description: audience === "owner" ? "La session n’a pas été modifiée. Réessayez." : error.message })
    } finally {
      setSavingId(null)
    }
  }

  return (
    <DashboardWidget>
      <DashboardWidgetHeader
        title="Réception physique des remises"
        description="La trésorerie est créditée uniquement après validation du montant réellement reçu."
      />
      <div className="grid gap-4 p-4 lg:grid-cols-2">
        {handoversError ? (
          <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive lg:col-span-2">
            <p className="font-bold">Impossible de charger les remises</p>
            <p>{audience === "owner" ? "Les clôtures et remises en attente ne sont pas disponibles actuellement." : "Les règles Firestore refusent actuellement la lecture de cashHandovers. Aucune conclusion ne peut être tirée sur les remises en attente."}</p>
          </div>
        ) : null}
        {awaitingSubmission.map((session: any) => (
          <article key={`awaiting-${session.id}`} className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
            <p className="font-bold">Session #{String(session.id).slice(-6).toUpperCase()}</p>
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
              Session clôturée — remise à soumettre par le caissier.
            </p>
            <p className="text-sm text-muted-foreground">
              Versement attendu {Number(session.expectedHandover || 0).toLocaleString()} FCFA
            </p>
            {Number(session.expectedHandover || 0) > 0 ? (
              <div>
                <Label htmlFor={`recovery-received-${session.id}`}>Montant réellement reçu</Label>
                <Input
                  id={`recovery-received-${session.id}`}
                  type="number"
                  min={0}
                  value={received[`session-${session.id}`] ?? String(session.expectedHandover || 0)}
                  onChange={(event) => setReceived((current) => ({ ...current, [`session-${session.id}`]: event.target.value }))}
                />
              </div>
            ) : null}
            <Button
              className="min-h-11"
              disabled={savingId === `session-${session.id}`}
              onClick={() => recoverAndValidate(session)}
            >
              {Number(session.expectedHandover || 0) > 0 ? "Valider la réception" : "Valider la session Mobile Money"}
            </Button>
          </article>
        ))}
        {!isLoading && !handoversError && !pending.length && !awaitingSubmission.length ? (
          <ReportsEmptyState title={audience === "owner" ? "Aucune clôture n’attend votre validation." : "Aucune remise en attente"} />
        ) : pending.map((handover: any) => {
          const session = sessionsById.get(handover.sessionId) as any
          const physicalHandover = Number(handover.expectedAmount || 0)
          const isCashless = handover.physicalHandoverRequired === false || physicalHandover === 0
          return (
          <article key={handover.id} className="space-y-3 rounded-xl border p-4">
            <div>
              <p className="font-bold">Session #{String(handover.sessionId).slice(-6).toUpperCase()}</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                <p>Ventes espèces <strong className="block text-foreground">{Number(session?.totalCash || 0).toLocaleString()} FCFA</strong></p>
                <p>Mobile Money <strong className="block text-foreground">{Number(session?.expectedMobileMoney ?? session?.totalMobileMoney ?? session?.totalMobile ?? 0).toLocaleString()} FCFA</strong></p>
                <p>Fond conservé <strong className="block text-foreground">{Number(session?.retainedFloat || 0).toLocaleString()} FCFA</strong></p>
                <p>Remise physique <strong className="block text-foreground">{physicalHandover.toLocaleString()} FCFA</strong></p>
              </div>
              {isCashless ? (
                <p className="mt-3 rounded-lg bg-muted p-3 text-sm font-medium">Session uniquement Mobile Money — aucune remise physique.</p>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">Montant déclaré remis : {Number(handover.declaredAmount || 0).toLocaleString()} FCFA</p>
              )}
            </div>
            {!isCashless ? <div>
              <Label htmlFor={`received-${handover.id}`}>Montant réellement reçu</Label>
              <Input
                id={`received-${handover.id}`}
                type="number"
                min={0}
                value={received[handover.id] ?? String(handover.declaredAmount || 0)}
                onChange={(event) => setReceived((current) => ({ ...current, [handover.id]: event.target.value }))}
              />
            </div> : null}
            <div>
              <Label htmlFor={`note-${handover.id}`}>{audience === "owner" ? "Note de contrôle" : "Note manager"}</Label>
              <Input
                id={`note-${handover.id}`}
                maxLength={500}
                value={notes[handover.id] || ""}
                onChange={(event) => setNotes((current) => ({ ...current, [handover.id]: event.target.value }))}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {handover.status === "submitted" ? <Button className="min-h-11" variant="secondary" disabled={savingId === handover.id} onClick={() => decide(handover, "under_review")}>Commencer la revue</Button> : null}
              <Button className="min-h-11" disabled={savingId === handover.id} onClick={() => decide(handover, "validated")}>
                {isCashless ? "Valider la session Mobile Money" : "Valider la réception"}
              </Button>
              <Button className="min-h-11" variant="outline" disabled={savingId === handover.id || !notes[handover.id]?.trim()} onClick={() => decide(handover, "correction_required")}>Demander correction</Button>
              <Button className="min-h-11" variant="destructive" disabled={savingId === handover.id || !notes[handover.id]?.trim()} onClick={() => decide(handover, "rejected")}>Rejeter</Button>
            </div>
          </article>
          )
        })}
      </div>
    </DashboardWidget>
  )
}
