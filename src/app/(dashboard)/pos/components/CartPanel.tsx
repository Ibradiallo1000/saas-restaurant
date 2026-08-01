"use client"

import * as React from "react"
import { Check, ImageIcon, PauseCircle, Percent, Search, Trash2, Utensils, ShoppingBag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PosCart, PosCartLine, PosCheckoutAction, PosEmptyState, PosTotals } from "@/components/pos-ui"
import { groupCartLinesByBundle } from "@/lib/linked-option-groups"
import { cn } from "@/lib/utils"
import { formatTableDisplayName } from "@/lib/table-display"
import { getOptimizedImage } from "@/lib/image"
import { getPreparationModeLabel } from "@/utils/preparation-logic"

export type PosPaymentMode = "cash" | "mobile"
type CartPanelProps = { cart: any[]; subtotal: number; discountAmount: number; total: number; processing: boolean; canCheckout: boolean; unavailableItems?: Array<{ id: string; message: string }>; orderType: "dine-in" | "takeaway"; tableNumber: string | null; tableLabelPrefix?: string; tables: any[]; mobileSheet?: boolean; sessionInfo?: React.ReactNode; onOrderTypeChange: (type: "dine-in" | "takeaway") => void; onTableSelect: (tableId: string) => void; onIncrease: (item: any) => void; onDecrease: (itemId: string) => void; onRemove: (itemId: string) => void; onClear: () => void; onHold: () => void; onDiscount: () => void; onCheckout: () => void }

export default function CartPanel(props: CartPanelProps) {
  const { cart, subtotal, discountAmount, total, processing, canCheckout, unavailableItems = [], orderType, tableNumber, tables, mobileSheet = false, sessionInfo, onOrderTypeChange, onTableSelect, onIncrease, onDecrease, onRemove, onClear, onHold, onDiscount, onCheckout } = props
  const formatMoney = (value: number) => `${value.toLocaleString("fr-FR")} FCFA`

  const controls = <div className="space-y-3">
    <div className="grid grid-cols-2 gap-2">
      <ModeButton active={orderType === "takeaway"} icon={<ShoppingBag/>} label="À emporter" onClick={() => onOrderTypeChange("takeaway")}/>
      <ModeButton active={orderType === "dine-in"} icon={<Utensils/>} label="Sur place" onClick={() => onOrderTypeChange("dine-in")}/>
    </div>
    {orderType === "dine-in" ? <TableSelector tables={tables} selectedTableId={tableNumber} onSelect={onTableSelect} /> : null}
  </div>

  const totals = <PosTotals subtotal={formatMoney(subtotal)} discount={`-${formatMoney(discountAmount)}`} total={total.toLocaleString("fr-FR")} currency="FCFA" />
  const actions = <div className="space-y-3">
    {unavailableItems.length ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs font-semibold text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{unavailableItems.map((item) => <p key={item.id}>{item.message} Retirez-le du ticket.</p>)}</div> : null}
    <div className="grid grid-cols-3 gap-2">
      <ActionButton icon={<PauseCircle/>} label="En attente" onClick={onHold} disabled={!cart.length || processing}/>
      <ActionButton icon={<Percent/>} label="Remise" onClick={onDiscount} disabled={!cart.length || processing}/>
      <ActionButton icon={<Trash2/>} label="Vider" onClick={onClear} disabled={!cart.length || processing}/>
    </div>
    <PosCheckoutAction
      label={orderType === "dine-in" ? "Envoyer la commande" : "Choisir le paiement"}
      amount={formatMoney(total)}
      disabled={!canCheckout}
      loading={processing}
      onSelect={onCheckout}
    />
  </div>

  return <PosCart title="Ticket en cours" itemCount={`${cart.length} article${cart.length > 1 ? "s" : ""}`} hideHeader={mobileSheet} className={mobileSheet ? "rounded-none border-0 shadow-none" : undefined} totals={totals} actions={actions} emptyState={<PosEmptyState title="Votre ticket est vide" description="Sélectionnez des produits pour commencer la commande." />} loading={processing}>
    <div className="mb-3">{controls}</div>
    {cart.length ? <div className="space-y-2">{groupCartLinesByBundle(cart).map((group) => <div key={group.bundleId || group.lines[0]?.id} className="space-y-2">{group.lines.map((item, index) => {
      const unitPrice = Number(item.unitPrice ?? item.basePrice ?? item.price ?? 0)
      const lineTotal = Math.round(unitPrice) * Number(item.quantity ?? 1)
      const nested = Boolean(group.bundleId && !item.isBundleMain)
      const options = !nested && item.selectedOptions?.length ? item.selectedOptions.map((option: any) => `${option.optionName}: ${option.choiceName}`).join(" · ") : nested ? item.linkedGroupTitle : undefined
      const controlsEnabled = index === 0 || !group.bundleId
      return <PosCartLine key={item.id} className={nested ? "ml-3 border-dashed" : undefined} image={item.imageUrl ? <img src={getOptimizedImage(item.imageUrl, 112)} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-muted-foreground"><ImageIcon className="size-5" aria-hidden="true" /></span>} name={nested ? `+ ${item.name}` : item.name} description={getPreparationModeLabel(getCartPreparationMode(item))} options={options} quantity={item.quantity} unitPrice={formatMoney(unitPrice)} lineTotal={formatMoney(lineTotal)} onIncrease={controlsEnabled ? () => onIncrease(item) : undefined} onDecrease={controlsEnabled ? () => onDecrease(item.id) : undefined} onRemove={controlsEnabled ? () => onRemove(item.id) : undefined}/>
    })}</div>)}</div> : <PosEmptyState title="Votre ticket est vide" description="Sélectionnez des produits pour commencer la commande." />}
    {sessionInfo ? <details className="mt-3 rounded-[var(--radius-dashboard-button)] border border-[var(--pos-border)] bg-[var(--pos-panel)] p-3"><summary className="dashboard-focus-visible cursor-pointer text-sm font-semibold">Informations de session</summary><div className="mt-3">{sessionInfo}</div></details> : null}
  </PosCart>
}

function ModeButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactElement<{ className?: string }>; label: string; onClick: () => void }) { return <button type="button" onClick={onClick} aria-pressed={active} className={cn("dashboard-focus-visible flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-dashboard-button)] border text-sm font-semibold", active ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-[var(--action-primary-fg)]" : "border-[var(--pos-border)] bg-[var(--pos-panel)]")}>{React.cloneElement(icon, { className: "size-4" })}{label}</button> }

function TableSelector({ tables, selectedTableId, onSelect }: { tables: any[]; selectedTableId: string | null; onSelect: (tableId: string) => void }) {
  const [selectedZone, setSelectedZone] = React.useState("")
  const [query, setQuery] = React.useState("")
  const [visibleCount, setVisibleCount] = React.useState(12)
  const zones = React.useMemo(() => Array.from(new Set(tables.map((table) => getTableZoneKey(table)))), [tables])
  const activeZone = zones.includes(selectedZone) ? selectedZone : zones[0] ?? ""
  const normalizedQuery = query.trim().toLocaleLowerCase("fr-FR")
  const matchingTables = React.useMemo(() => {
    if (!normalizedQuery) return tables.filter((table) => getTableZoneKey(table) === activeZone)
    return tables.filter((table) => getTableSearchText(table).includes(normalizedQuery))
  }, [activeZone, normalizedQuery, tables])
  const visibleTables = matchingTables.slice(0, visibleCount)

  React.useEffect(() => {
    setVisibleCount(12)
  }, [activeZone, normalizedQuery])

  return <div className="space-y-3">
    {zones.length ? <div role="tablist" aria-label="Zones de tables" className="flex gap-2 overflow-x-auto pb-1">
      {zones.map((zone) => <button key={zone} type="button" role="tab" aria-selected={activeZone === zone} onClick={() => setSelectedZone(zone)} className={cn("dashboard-focus-visible min-h-11 shrink-0 rounded-full border px-3 text-xs font-semibold", activeZone === zone ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-[var(--action-primary-fg)]" : "border-[var(--pos-border)] bg-[var(--pos-panel)]")}>{getTableZoneLabel(zone)}</button>)}
    </div> : null}

    <div className="relative">
      <label htmlFor="pos-table-search" className="sr-only">Rechercher une table ou une zone</label>
      <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--dashboard-muted)]" />
      <Input id="pos-table-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une table ou une zone" className="min-h-11 pl-9" />
    </div>

    {activeZone && !normalizedQuery ? <p className="text-xs font-semibold text-[var(--dashboard-muted)]">Zone : {getTableZoneLabel(activeZone)}</p> : null}

    {visibleTables.length ? <div className="grid grid-cols-2 gap-2 min-[390px]:grid-cols-3 md:grid-cols-4">
      {visibleTables.map((table: any) => {
        const selected = selectedTableId === table.id
        const name = formatTableDisplayName(table) || "Table sans nom"
        return <button key={table.id} type="button" onClick={() => onSelect(table.id)} aria-pressed={selected} className={cn("dashboard-focus-visible flex min-h-12 min-w-0 flex-col items-center justify-center rounded-[var(--radius-dashboard-button)] border px-2 py-1.5 text-center text-xs font-semibold", selected ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-[var(--action-primary-fg)]" : table.status === "occupied" ? "border-red-200 bg-red-100 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200" : "border-[var(--pos-border)] bg-[var(--pos-muted)]")}>
          <span className="flex min-w-0 items-center gap-1"><span className="break-words">{name}</span>{selected ? <Check aria-hidden="true" className="size-3.5 shrink-0" /> : null}</span>
          {normalizedQuery ? <span className="mt-0.5 break-words text-[10px] opacity-75">{getTableZoneLabel(getTableZoneKey(table))}</span> : null}
        </button>
      })}
    </div> : <p className="rounded-[var(--radius-dashboard-button)] border border-dashed border-[var(--pos-border)] p-3 text-center text-sm text-[var(--dashboard-muted)]">Aucune table trouvée.</p>}

    {visibleCount < matchingTables.length ? <Button type="button" variant="outline" className="min-h-11 w-full" onClick={() => setVisibleCount((count) => count + 12)}>Afficher plus</Button> : null}
  </div>
}

function getTableZoneKey(table: any) { return typeof table?.zoneId === "string" && table.zoneId.trim() ? table.zoneId.trim() : "__unassigned" }
function getTableZoneLabel(zone: string) { return zone === "__unassigned" ? "Sans zone" : zone }
function getTableSearchText(table: any) { return [table?.name, table?.label, table?.code, table?.number, getTableZoneLabel(getTableZoneKey(table))].filter((value) => value !== null && value !== undefined).join(" ").toLocaleLowerCase("fr-FR") }

function ActionButton({ icon, label, disabled, onClick }: { icon: React.ReactElement<{ className?: string }>; label: string; disabled: boolean; onClick: () => void }) { return <Button type="button" variant="outline" disabled={disabled} onClick={onClick} className="min-h-11 min-w-0 px-2 text-xs"><span aria-hidden="true">{React.cloneElement(icon, { className: "size-4" })}</span><span className="truncate">{label}</span></Button> }
type CartPreparationMode = "kitchen" | "direct" | "bar"
function getCartPreparationMode(item: any): CartPreparationMode { if (item?.preparationMode === "direct" || item?.preparationMode === "service_direct") return "direct"; if (item?.preparationMode === "bar" || item?.preparationMode === "counter") return "bar"; return "kitchen" }
