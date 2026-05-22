"use client"

import * as React from "react"
import {
  Banknote,
  LockKeyhole,
  Loader2,
  Minus,
  PauseCircle,
  Percent,
  Plus,
  Smartphone,
  Trash2,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { getOptimizedImage } from "@/lib/image"
import { cn } from "@/lib/utils"

export type PosPaymentMode = "cash" | "mobile"

type CartPanelProps = {
  cart: any[]
  subtotal: number
  discountAmount: number
  total: number
  processing: boolean
  canCheckout: boolean
  orderType: "dine-in" | "takeaway"
  tableNumber: string | null
  tables: any[]
  paymentMode: PosPaymentMode | null
  mobilePaymentMethods: any[]
  selectedMobileMethodCode: string | null
  onPaymentModeChange: (mode: PosPaymentMode) => void
  onMobileMethodChange: (code: string) => void
  onOrderTypeChange: (type: "dine-in" | "takeaway") => void
  onTableSelect: (tableId: string) => void
  onIncrease: (item: any) => void
  onDecrease: (itemId: string) => void
  onRemove: (itemId: string) => void
  onClear: () => void
  onHold: () => void
  onDiscount: () => void
  onCheckout: () => void
  canCloseSession: boolean
  onCloseSession: () => void
}

export default function CartPanel({
  cart,
  subtotal,
  discountAmount,
  total,
  processing,
  canCheckout,
  orderType,
  tableNumber,
  tables,
  paymentMode,
  mobilePaymentMethods,
  selectedMobileMethodCode,
  onPaymentModeChange,
  onMobileMethodChange,
  onOrderTypeChange,
  onTableSelect,
  onIncrease,
  onDecrease,
  onRemove,
  onClear,
  onHold,
  onDiscount,
  onCheckout,
  canCloseSession,
  onCloseSession,
}: CartPanelProps) {
  return (
    <aside className="flex h-full flex-col overflow-hidden rounded-lg border bg-card shadow-sm">
      <div className="shrink-0 border-b bg-primary px-4 py-3 text-primary-foreground">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase opacity-80">Panier</p>
            <p className="text-lg font-black">{cart.length} ligne{cart.length > 1 ? "s" : ""}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold opacity-80">Total</p>
            <p className="text-2xl font-black">{total.toLocaleString("fr-FR")}</p>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-b p-3">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onOrderTypeChange("takeaway")}
            className={cn(
              "h-10 rounded-md text-sm font-black transition-colors",
              orderType === "takeaway" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
            )}
          >
            A emporter
          </button>
          <button
            type="button"
            onClick={() => onOrderTypeChange("dine-in")}
            className={cn(
              "h-10 rounded-md text-sm font-black transition-colors",
              orderType === "dine-in" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
            )}
          >
            Sur place
          </button>
        </div>

        {orderType === "dine-in" ? (
          <div className="mt-3 grid grid-cols-4 gap-2">
            {tables.slice(0, 12).map((table: any) => (
              <button
                key={table.id}
                type="button"
                onClick={() => onTableSelect(table.id)}
                className={cn(
                  "h-9 rounded-md text-xs font-black transition-colors",
                  tableNumber === table.id
                    ? "bg-primary text-primary-foreground"
                    : table.status === "occupied"
                      ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-200"
                      : "bg-muted text-foreground"
                )}
              >
                {table.name || table.id.slice(-2)}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {cart.length === 0 ? (
          <div className="flex h-full min-h-[260px] items-center justify-center rounded-lg border border-dashed text-sm font-bold text-muted-foreground">
            Panier vide
          </div>
        ) : (
          <div className="space-y-2">
            {cart.map((item) => (
              <CartLine
                key={item.id}
                item={item}
                onIncrease={() => onIncrease(item)}
                onDecrease={() => onDecrease(item.id)}
                onRemove={() => onRemove(item.id)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t bg-background p-3 pb-4">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Sous-total</span>
            <span className="font-bold">{subtotal.toLocaleString("fr-FR")} FCFA</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Remise</span>
            <span className="font-bold">-{discountAmount.toLocaleString("fr-FR")} FCFA</span>
          </div>
          <div className="mt-2 flex items-end justify-between border-t pt-2">
            <span className="text-sm font-black uppercase">Total</span>
            <span className="text-3xl font-black text-primary">{total.toLocaleString("fr-FR")} FCFA</span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <ActionButton icon={<PauseCircle />} label="En attente" onClick={onHold} disabled={cart.length === 0 || processing} />
          <ActionButton icon={<Percent />} label="Remise" onClick={onDiscount} disabled={cart.length === 0 || processing} />
          <ActionButton icon={<Trash2 />} label="Vider" onClick={onClear} disabled={cart.length === 0 || processing} />
          <ActionButton icon={<X />} label="Supprimer" onClick={onClear} disabled={cart.length === 0 || processing} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <PaymentButton active={paymentMode === "cash"} icon={<Banknote />} label="Especes" onClick={() => onPaymentModeChange("cash")} />
          <PaymentButton active={paymentMode === "mobile"} icon={<Smartphone />} label="Mobile Money" onClick={() => onPaymentModeChange("mobile")} />
        </div>

        {paymentMode === "mobile" && mobilePaymentMethods.length > 0 ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            {mobilePaymentMethods.slice(0, 4).map((method: any) => (
              <button
                key={method.id || method.code}
                type="button"
                onClick={() => onMobileMethodChange(method.code)}
                className={cn(
                  "h-9 rounded-md border bg-white text-xs font-black text-zinc-950 transition-colors hover:bg-zinc-50 dark:bg-background dark:text-foreground dark:hover:bg-muted",
                  selectedMobileMethodCode === method.code
                    ? "border-zinc-900 bg-zinc-50 shadow-sm dark:border-zinc-100 dark:bg-muted"
                    : "border-zinc-200 dark:border-border"
                )}
              >
                {method.name}
              </button>
            ))}
          </div>
        ) : null}

        <Button
          type="button"
          className="mt-3 h-14 w-full rounded-lg bg-primary text-lg font-black text-primary-foreground hover:bg-primary/90"
          disabled={!canCheckout || processing}
          onClick={onCheckout}
        >
          {processing ? <Loader2 className="h-5 w-5 animate-spin" /> : "Encaisser"}
        </Button>

        <Button
          type="button"
          variant="outline"
          className="mt-2 h-14 w-full rounded-lg border-2 text-base font-black"
          disabled={!canCloseSession || processing}
          onClick={onCloseSession}
        >
          <LockKeyhole className="mr-2 h-5 w-5" />
          Cloturer la caisse
        </Button>
      </div>
    </aside>
  )
}

function CartLine({
  item,
  onIncrease,
  onDecrease,
  onRemove,
}: {
  item: any
  onIncrease: () => void
  onDecrease: () => void
  onRemove: () => void
}) {
  const unitPrice = Number(item.unitPrice ?? item.basePrice ?? item.price ?? 0)
  const lineTotal = Math.round(unitPrice) * Number(item.quantity ?? 1)

  return (
    <div className="grid grid-cols-[48px_minmax(0,1fr)_112px] gap-2 rounded-lg border bg-background p-2">
      {item.imageUrl ? (
        <img
          src={getOptimizedImage(item.imageUrl, 80)}
          className="h-12 w-12 rounded-md object-cover"
          alt={item.name}
          loading="lazy"
        />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted">
          <Banknote className="h-5 w-5 text-muted-foreground" />
        </div>
      )}

      <div className="min-w-0">
        <p className="truncate text-sm font-black">{item.name}</p>
        <p className="text-xs font-bold text-muted-foreground">{lineTotal.toLocaleString("fr-FR")} FCFA</p>
      </div>

      <div className="flex items-center justify-end gap-1">
        <button type="button" onClick={onDecrease} className="flex h-9 w-9 items-center justify-center rounded-md bg-muted hover:bg-orange-100">
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-7 text-center text-base font-black">{item.quantity}</span>
        <button type="button" onClick={onIncrease} className="flex h-9 w-9 items-center justify-center rounded-md bg-muted hover:bg-orange-100">
          <Plus className="h-4 w-4" />
        </button>
        <button type="button" onClick={onRemove} className="flex h-9 w-9 items-center justify-center rounded-md text-red-600 hover:bg-red-50">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function ActionButton({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: React.ReactElement<{ className?: string }>
  label: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex h-10 items-center justify-center gap-2 rounded-md border bg-card text-xs font-black transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
    >
      {React.cloneElement(icon, { className: "h-4 w-4" })}
      {label}
    </button>
  )
}

function PaymentButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean
  icon: React.ReactElement<{ className?: string }>
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-12 items-center justify-center gap-2 rounded-md border text-sm font-black transition-colors active:scale-[0.99]",
        active ? "border-zinc-900 bg-zinc-100 text-zinc-950 dark:border-zinc-100 dark:bg-muted dark:text-foreground" : "bg-card hover:bg-muted"
      )}
    >
      {React.cloneElement(icon, { className: "h-4 w-4" })}
      {label}
    </button>
  )
}
