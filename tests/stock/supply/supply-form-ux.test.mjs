import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"

const root = process.cwd()
const expenses = fs.readFileSync(
  path.join(root, "src/app/(manager)/manager/expenses/page.tsx"),
  "utf8"
)
const inventoryCards = fs.readFileSync(
  path.join(root, "src/modules/stock/articles/ui/ArticleReferentialScreen.tsx"),
  "utf8"
)
const stockDetail = fs.readFileSync(
  path.join(root, "src/modules/stock/controlled-stock/ui/ControlledStockScreen.tsx"),
  "utf8"
)

test("l'approvisionnement utilise les libellés simplifiés", () => {
  assert.match(expenses, /<Label>Article<\/Label>/)
  assert.match(expenses, /<Label>Prix unitaire<\/Label>/)
  assert.match(expenses, /<Label>Mode de paiement<\/Label>/)
  assert.match(expenses, /Aucun fournisseur \(achat au marché\)/)
  assert.match(expenses, /return "Espèces"/)
  assert.doesNotMatch(expenses, /Fournisseur \{requiresSupplier/)
})

test("le paiement et sa source ne sont pas présélectionnés", () => {
  assert.match(
    expenses,
    /useState<ExpensePaymentStatus \| "">\(""\)/
  )
  assert.match(
    expenses,
    /const \[paymentAccountId, setPaymentAccountId\] = React\.useState\(""\)/
  )
  assert.match(expenses, /Boolean\(paymentStatus\)/)
  assert.match(expenses, /Boolean\(paymentAccountId\)/)
  assert.match(expenses, /setPaymentStatus\(""\)/)
  assert.match(expenses, /setPaymentAccountId\(""\)/)
})

test("la source est demandée uniquement pour un paiement payé ou partiel", () => {
  assert.match(
    expenses,
    /paymentStatus === "paid" \|\| paymentStatus === "partial"/
  )
  assert.match(expenses, /\{requiresPaymentSource && safeTreasuryAccounts\.length > 0 \? \(/)
  assert.match(expenses, /<RadioGroup[\s\S]*value=\{paymentAccountId\}/)
})

test("le récapitulatif conserve le calcul quantité multipliée par prix", () => {
  assert.match(
    expenses,
    /Number\(line\.quantity \|\| 0\) \*[\s\S]*Number\(line\.unitCost \|\| 0\)/
  )
  assert.match(expenses, /formatMoney\(effectiveAmount\)/)
  assert.match(expenses, /disabled=\{!canSubmit \|\| saving\}/)
})

test("Approvisionner ouvre le formulaire canonique avec l'article présélectionné", () => {
  assert.match(
    inventoryCards,
    /\/manager\/expenses\?type=supply&articleId=\$\{encodeURIComponent\(String\(article\.id\)\)\}/
  )
  assert.match(
    stockDetail,
    /\/manager\/expenses\?type=supply&articleId=\$\{encodeURIComponent\(id\)\}/
  )
  assert.match(expenses, /useSearchParams/)
  assert.match(expenses, /searchParams\?\.get\("type"\) === "supply"/)
  assert.match(
    expenses,
    /\{ articleId: requestedSupplyArticleId, quantity: "", unitCost: "" \}/
  )
})
