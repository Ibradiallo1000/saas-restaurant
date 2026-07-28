"use client"

import * as React from "react"
import Link from "next/link"
import { collection, doc } from "firebase/firestore"

import {
  DashboardErrorState,
  DashboardLoadingState,
} from "@/components/dashboard-ui"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/design-system/components"
import { useRestaurant } from "@/design-system/context/RestaurantContext"
import {
  useCollection,
  useDoc,
  useFirestore,
  useMemoFirebase,
} from "@/firebase"
import { COLLECTION_NAMES } from "@/lib/constants"
import { useInventoryReferential } from "@/modules/stock/shared/use-inventory-referential"
import {
  ownerExpenseDate,
  ownerExpensePaymentStatusLabel,
  ownerExpenseTypeLabel,
  ownerExpenseUnitLabel,
  type OwnerCashMovement,
  type OwnerExpense,
} from "@/modules/owner-expenses/domain/owner-expense-read-model"

type StaffMember = {
  id: string
  displayName?: string
  staffName?: string
  name?: string
  email?: string
}

type ExpenseLog = {
  id: string
  expenseId?: string
  createdAt?: unknown
}

export default function OwnerExpenseDetailPage({
  params,
}: {
  params: Promise<{ expenseId: string }>
}) {
  const { expenseId } = React.use(params)
  const db = useFirestore()
  const { restaurantId, loading: restaurantLoading } = useRestaurant()
  const expenseRef = useMemoFirebase(() => {
    if (!db || !restaurantId || !expenseId) return null
    return doc(
      db,
      COLLECTION_NAMES.RESTAURANTS,
      restaurantId,
      COLLECTION_NAMES.EXPENSES,
      expenseId
    )
  }, [db, expenseId, restaurantId])
  const logRef = useMemoFirebase(() => {
    if (!db || !restaurantId || !expenseId) return null
    return doc(
      db,
      COLLECTION_NAMES.RESTAURANTS,
      restaurantId,
      COLLECTION_NAMES.EXPENSE_LOGS,
      expenseId
    )
  }, [db, expenseId, restaurantId])
  const staffQuery = useMemoFirebase(() => {
    if (!db || !restaurantId) return null
    return collection(
      db,
      COLLECTION_NAMES.RESTAURANTS,
      restaurantId,
      "staff"
    )
  }, [db, restaurantId])
  const expenseResult = useDoc<OwnerExpense>(expenseRef)
  const logResult = useDoc<ExpenseLog>(logRef)
  const staffResult = useCollection<StaffMember>(staffQuery)
  const {
    articles,
    operations,
    isLoading: stockLoading,
    error: stockError,
  } = useInventoryReferential(restaurantId, { includeOperations: true })
  const expense = expenseResult.data
  const cashMovementRef = useMemoFirebase(() => {
    if (!db || !restaurantId || !expense?.cashMovementId) return null
    return doc(
      db,
      COLLECTION_NAMES.RESTAURANTS,
      restaurantId,
      COLLECTION_NAMES.CASH_MOVEMENTS,
      expense.cashMovementId
    )
  }, [db, expense?.cashMovementId, restaurantId])
  const cashMovementResult = useDoc<OwnerCashMovement>(cashMovementRef)

  const isLoading =
    restaurantLoading ||
    expenseResult.isLoading ||
    logResult.isLoading ||
    staffResult.isLoading ||
    stockLoading
  if (isLoading) {
    return (
      <DashboardLoadingState
        className="min-h-[50vh]"
        label="Chargement de la dépense"
      />
    )
  }
  if (!expense || expenseResult.error) {
    return (
      <DashboardErrorState
        title="Dépense introuvable"
        description="Cette dépense n’existe pas ou n’est pas accessible."
      />
    )
  }

  const staff = (staffResult.data || []).find(
    (member) => member.id === expense.createdBy
  )
  const author =
    staff?.displayName ||
    staff?.staffName ||
    staff?.name ||
    staff?.email?.split("@")[0] ||
    "Utilisateur non résolu"
  const articleById = new Map(
    (articles || []).map((article) => [article.id, article])
  )
  const relatedOperations = (operations || []).filter(
    (operation) =>
      String((operation as { expenseId?: string }).expenseId || "") === expense.id
  )

  return (
    <main className="space-y-6 pb-24 md:pb-8">
      <PageHeader
        title={ownerExpenseTypeLabel(expense.type)}
        subtitle={`Dépense du ${ownerExpenseDate(expense.createdAt)} · consultation en lecture seule.`}
        eyebrow={
          <Link
            href="/owner/depenses"
            className="text-sm font-medium normal-case tracking-normal text-muted-foreground hover:text-foreground"
          >
            ← Retour aux dépenses
          </Link>
        }
      />

      {stockError || cashMovementResult.error ? (
        <DashboardErrorState
          title="Données liées partiellement indisponibles"
          description="La dépense reste consultable, mais certains mouvements liés n’ont pas pu être chargés."
        />
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DetailValue label="Montant total" value={`${formatMoney(expense.amount)} FCFA`} />
        <DetailValue label="Montant payé" value={`${formatMoney(expense.paidAmount)} FCFA`} />
        <DetailValue label="Dette restante" value={`${formatMoney(expense.debtAmount)} FCFA`} />
        <DetailValue
          label="Statut"
          value={ownerExpensePaymentStatusLabel(expense.paymentStatus)}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Informations</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Info label="Type" value={ownerExpenseTypeLabel(expense.type)} />
            <Info label="Date" value={ownerExpenseDate(expense.createdAt)} />
            <Info label="Auteur" value={author} />
            <Info
              label="Fournisseur"
              value={expense.supplierName || "Aucun fournisseur"}
            />
            <Info
              label="Source de paiement"
              value={accountName(expense.paymentAccountName, expense.paymentAccountId)}
            />
            <Info
              label="Catégorie"
              value={expense.category || "Non renseignée"}
            />
            <div className="sm:col-span-2">
              <Info label="Note" value={expense.note || "Aucune note"} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Traçabilité</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Info
              label="Mouvement de trésorerie"
              value={
                cashMovementResult.data
                  ? `${formatMoney(cashMovementResult.data.amount)} FCFA · sortie`
                  : expense.paidAmount > 0
                    ? "Mouvement lié indisponible"
                    : "Aucune sortie immédiate"
              }
            />
            <Info
              label="Mouvements de stock liés"
              value={`${relatedOperations.length} opération(s)`}
            />
            <Info
              label="Historique disponible"
              value={
                logResult.data
                  ? `Création tracée le ${ownerExpenseDate(logResult.data.createdAt)}`
                  : "Aucun journal complémentaire"
              }
            />
            <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
              Le champ technique de validation existe dans les documents
              historiques, mais aucun workflow d’approbation Owner n’est actif.
            </p>
          </CardContent>
        </Card>
      </section>

      {expense.type === "supply" ? (
        <Card>
          <CardHeader>
            <CardTitle>Articles approvisionnés</CardTitle>
          </CardHeader>
          <CardContent>
            {!expense.items?.length ? (
              <p className="text-sm text-muted-foreground">
                Aucune ligne d’approvisionnement disponible.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border">
                <table className="min-w-[700px] w-full text-sm">
                  <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-3">Article</th>
                      <th className="px-3 py-3">Quantité</th>
                      <th className="px-3 py-3">Coût unitaire</th>
                      <th className="px-3 py-3">Total</th>
                      <th className="px-3 py-3">Mouvement de stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {expense.items.map((item) => {
                      const article = articleById.get(item.articleId)
                      const operation = relatedOperations.find(
                        (candidate) =>
                          String(candidate.articleId) === item.articleId
                      )
                      return (
                        <tr key={item.articleId}>
                          <td className="px-3 py-3 font-semibold">
                            {item.articleName || article?.name || "Article"}
                          </td>
                          <td className="px-3 py-3">
                            {item.quantity}{" "}
                            {ownerExpenseUnitLabel(
                              article?.baseUnit || "",
                              item.quantity
                            )}
                          </td>
                          <td className="px-3 py-3">
                            {formatMoney(item.unitCost)} FCFA
                          </td>
                          <td className="px-3 py-3 font-semibold">
                            {formatMoney(
                              item.lineTotal ??
                                item.quantity * item.unitCost
                            )}{" "}
                            FCFA
                          </td>
                          <td className="px-3 py-3">
                            {operation ? (
                              <Badge variant="outline">
                                +{operation.variation || 0}{" "}
                                {ownerExpenseUnitLabel(
                                  operation.unit || "",
                                  operation.variation || 0
                                )}
                              </Badge>
                            ) : (
                              "Non retrouvé"
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <div>
        <Button asChild variant="outline">
          <Link href="/owner/depenses">Retour aux dépenses</Link>
        </Button>
      </div>
    </main>
  )
}

function DetailValue({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-black">{value}</p>
      </CardContent>
    </Card>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  )
}

function accountName(name?: string | null, id?: string | null) {
  if (id === "cash" || name === "Cash physique") return "Espèces"
  return name || (id === "mobile_money" ? "Mobile Money" : "Non renseignée")
}

function formatMoney(value: unknown) {
  const amount = Number(value || 0)
  return Number.isFinite(amount)
    ? Math.round(amount).toLocaleString("fr-FR")
    : "0"
}
