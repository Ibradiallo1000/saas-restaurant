'use client';

/**
 * @fileOverview Interface Caisse (Cashier) - Monitoring temps réel et clôture des commandes.
 */

import * as React from 'react';
import { useFirestore } from '@/firebase';
import {
  doc,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { COLLECTION_NAMES, ORDER_STATUS } from '@/lib/constants';
import { ClipboardList, BellRing, Clock, CheckCircle2, Eye, Printer, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { printOrder } from '@/lib/order-printing';
import { normalizePaymentMethod, normalizePaymentStatus } from '@/lib/order-payment';
import { normalizeOrderStatus, orderStatusLabel } from '@/lib/order-status';
import { useRestaurant } from '@/design-system/context/RestaurantContext';
import { OrdersProvider, useOrders } from '@/modules/orders/OrdersProvider';
import type { RestaurantOrder } from '@/modules/restaurant/types';
import { AdminRouteSkeleton } from '@/components/performance/route-skeletons';
import { EmptyState, ErrorState } from '@/components/layout/app-states';
import { useRestaurantPage } from '@/hooks/use-restaurant-page';

type OrdersTab = "active" | "payments" | "history";

const ORDER_TABS: Array<{ id: OrdersTab; label: string }> = [
  { id: "active", label: "Actives" },
  { id: "payments", label: "Paiements" },
  { id: "history", label: "Historique" },
];

const ORDER_STATUS_BY_TAB: Record<Exclude<OrdersTab, "active">, string> = {
  payments: ORDER_STATUS.SERVIE,
  history: ORDER_STATUS.PAYEE,
};

export default function OrdersPage() {
  const { restaurantId } = useRestaurant();

  return (
    <OrdersProvider restaurantId={restaurantId ?? undefined}>
      <OrdersPageContent />
    </OrdersProvider>
  );
}

function OrdersPageContent() {
  const db = useFirestore();
  const { restaurantId, restaurant } = useRestaurant();
  const { orders: activeOrders, isLoading } = useOrders();
  const [expandedOrderId, setExpandedOrderId] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<OrdersTab>("active");
  const archiveStatus = activeTab === "active" ? null : ORDER_STATUS_BY_TAB[activeTab];
  const archiveConstraints = React.useMemo(
    () => (archiveStatus ? [where("status", "==", archiveStatus)] : []),
    [archiveStatus]
  );
  const {
    error: archiveError,
    hasMore: hasMoreArchive,
    isLoading: archiveLoading,
    items: archiveOrders,
    loadMore: loadMoreArchive,
    refetch: refetchArchive,
  } = useRestaurantPage<RestaurantOrder>({
    collectionName: COLLECTION_NAMES.ORDERS,
    constraints: archiveConstraints,
    enabled: Boolean(archiveStatus),
    orderByField: "createdAt",
    pageSize: 20,
  });
  const activeOrderList = (activeOrders || []) as RestaurantOrder[];
  const allOrders = activeTab === "active" ? activeOrderList : archiveOrders;
  const filteredOrders = React.useMemo(() => {
    return allOrders.filter((order) => isOrderInTab(order, activeTab));
  }, [activeTab, allOrders]);

  // 🔥 UPDATE CORRIGÉ
  const completeOrder = async (orderId: string) => {
    if (!db || !restaurantId) return;

    const orderRef = doc(
      db,
      "restaurants",
      restaurantId,
      COLLECTION_NAMES.ORDERS,
      orderId
    );

    await updateDoc(orderRef, {
      status: ORDER_STATUS.PAYEE,
      paymentMethod: "cash",
      paymentStatus: "validated",
      paidAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  const validateMobilePayment = async (orderId: string) => {
    if (!db || !restaurantId) return;

    const orderRef = doc(
      db,
      "restaurants",
      restaurantId,
      COLLECTION_NAMES.ORDERS,
      orderId
    );

    await updateDoc(orderRef, {
      paymentStatus: "validated",
      status: ORDER_STATUS.PAYEE,
      paidAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  if (isLoading) {
    return <AdminRouteSkeleton />;
  }

  if (archiveError) {
    return (
      <ErrorState
        title="Commandes indisponibles"
        description="Impossible de charger les commandes archivees pour le moment."
        actionLabel="Reessayer"
        onAction={() => void refetchArchive()}
      />
    );
  }

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">

      {/* HEADER */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-4xl font-black italic text-primary uppercase tracking-tighter flex items-center gap-3">
            <ClipboardList className="h-10 w-10" />
            Gestion Commandes
          </h1>
          <p className="text-muted-foreground font-medium">
            Suivi caisse et service en temps reel.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="py-2 px-4 bg-primary/5 font-black uppercase">
            <CheckCircle2 className="mr-2 h-4 w-4 text-primary" />
            {activeOrderList.filter(o => isReadyOrder(o.status)).length || 0} PRETES
          </Badge>
          <Badge variant="outline" className="py-2 px-4 bg-red-500/10 font-black uppercase text-red-600">
            <BellRing className="mr-2 h-4 w-4 animate-pulse" />
            {activeOrderList.filter(o => isActiveOrder(o.status)).length || 0} actives
          </Badge>
        </div>
      </div>

      <div className="flex rounded-2xl border bg-card p-1 shadow-sm">
        {ORDER_TABS.map((tab) => {
          const active = activeTab === tab.id;
          const count = (tab.id === "active" ? activeOrderList : archiveOrders).filter((order) => isOrderInTab(order, tab.id)).length;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-xs font-black uppercase transition",
                active
                  ? "bg-[var(--color-primary)] text-white shadow-sm"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px]",
                  active ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">

        {filteredOrders.map((order) => {
          const isExpanded = expandedOrderId === order.id;
          const visibleItems = isExpanded ? order.items : order.items.slice(0, 3);
          const mobilePaymentPending = hasPendingMobilePayment(order as RestaurantOrder);

          return (
          <Card
            key={order.id}
            className={cn(
              "overflow-hidden rounded-2xl border bg-card shadow-sm transition-all",
              isReadyOrder(order.status)
                ? "ring-2 ring-blue-500"
                : "border-border"
            )}
          >
            <CardHeader className="p-4 pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="truncate text-lg font-black tracking-tight">
                    {getOrderTableLabel(order)}
                  </CardTitle>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    #{order.id.slice(-6)}
                  </span>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Badge className={cn("text-[10px] font-black", statusBadgeClass(order.status))}>
                    {statusLabel(order.status)}
                  </Badge>
                  <span className="flex items-center gap-1 text-xs font-bold text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {elapsedSince(order.createdAt)}
                  </span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 p-4 pt-0">
              <div className="space-y-2">
                {visibleItems.map((item: RestaurantOrder["items"][number]) => (
                  <div key={`${order.id}-${item.productId}-${item.name}`} className="flex justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate font-semibold">
                      {item.quantity}x {item.name}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {item.total.toLocaleString()} FCFA
                    </span>
                  </div>
                ))}
                {!isExpanded && order.items.length > 3 && (
                  <button
                    type="button"
                    className="text-xs font-bold text-[var(--color-primary)]"
                    onClick={() => setExpandedOrderId(order.id)}
                  >
                    +{order.items.length - 3} plat(s)
                  </button>
                )}
                {isExpanded && order.items.length > 3 && (
                  <button
                    type="button"
                    className="text-xs font-bold text-muted-foreground"
                    onClick={() => setExpandedOrderId(null)}
                  >
                    Réduire
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between rounded-xl bg-muted px-3 py-2">
                <span className="text-xs font-bold uppercase text-muted-foreground">Total</span>
                <span className="text-lg font-black text-[var(--color-primary)]">
                  {order.total.toLocaleString()} FCFA
                </span>
              </div>

              {mobilePaymentPending && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black uppercase text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                  Paiement à vérifier
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  {ORDER_PROGRESS.map((status) => {
                    const active = progressIndex(order.status) >= progressIndex(status);

                    return (
                      <span
                        key={status}
                        className={cn(
                          "h-2.5 flex-1 rounded-full",
                          active ? statusDotClass(status) : "bg-muted"
                        )}
                      />
                    );
                  })}
                </div>
                <div className="grid grid-cols-5 text-center text-[9px] font-bold uppercase text-muted-foreground">
                  <span>Attente</span>
                  <span>Prépa</span>
                  <span>Prêt</span>
                  <span>Servi</span>
                  <span>Payé</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  className="h-10 rounded-xl text-xs font-black"
                  onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                >
                  <Eye className="mr-1 h-4 w-4" />
                  Voir
                </Button>
                {canPrint(order as RestaurantOrder) ? (
                  <Button
                    variant="outline"
                    className="h-10 rounded-xl text-xs font-black border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-300 dark:hover:bg-blue-950/40"
                    onClick={() => printOrder(order as RestaurantOrder, restaurant)}
                  >
                    <Printer className="mr-1 h-4 w-4" />
                    Imprimer
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="h-10 rounded-xl text-xs font-black"
                    disabled
                  >
                    <Printer className="mr-1 h-4 w-4" />
                    Imprimer
                  </Button>
                )}
                {mobilePaymentPending ? (
                  <Button
                    className="h-10 rounded-xl bg-green-600 text-xs font-black hover:bg-green-700"
                    onClick={() => validateMobilePayment(order.id)}
                  >
                    Valider paiement
                  </Button>
                ) : isPaidOrder(order.status) ? (
                  <Button
                    variant="outline"
                    className="h-10 rounded-xl border-emerald-200 text-xs font-black text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                    onClick={() => setExpandedOrderId(null)}
                  >
                    Archiver
                  </Button>
                ) : (
                  <Button
                    className="h-10 rounded-xl bg-green-600 text-xs font-black hover:bg-green-700 disabled:bg-muted disabled:text-muted-foreground disabled:hover:bg-muted"
                    onClick={() => completeOrder(order.id)}
                    disabled={!canCash(order as RestaurantOrder)}
                  >
                    <Wallet className="mr-1 h-4 w-4" />
                    Encaisser
                  </Button>
                )}
              </div>

            </CardContent>
          </Card>
          );
        })}

        {/* EMPTY */}
        {filteredOrders.length === 0 && (
          <div className="col-span-full">
            {archiveLoading ? (
              <AdminRouteSkeleton />
            ) : (
              <EmptyState
                title="Aucune commande"
                description={getEmptyTabDescription(activeTab)}
              />
            )}
          </div>
        )}

      </div>
      {(activeTab === "payments" || activeTab === "history") && hasMoreArchive && filteredOrders.length > 0 && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            className="rounded-xl font-black"
            disabled={archiveLoading}
            onClick={() => loadMoreArchive()}
          >
            {archiveLoading ? "Chargement..." : "Charger plus"}
          </Button>
        </div>
      )}
    </div>
  );
}

function isOrderInTab(order: RestaurantOrder, tab: OrdersTab) {
  const status = normalizeOrderStatus(order.status);

  if (tab === "active") {
    return (
      status === ORDER_STATUS.NOUVELLE ||
      status === ORDER_STATUS.PREPARATION ||
      status === ORDER_STATUS.PRETE ||
      status === ORDER_STATUS.SERVIE
    );
  }

  if (tab === "payments") {
    return status === ORDER_STATUS.SERVIE;
  }

  return status === ORDER_STATUS.PAYEE;
}

function getEmptyTabDescription(tab: OrdersTab) {
  if (tab === "active") return "Aucune commande active pour le moment."
  if (tab === "payments") return "Aucune commande servie en attente d'encaissement."
  return "Aucune commande payee dans l'historique charge."
}

function isReadyOrder(status: string) {
  return normalizeOrderStatus(status) === ORDER_STATUS.PRETE
}

function isActiveOrder(status: string) {
  return normalizeOrderStatus(status) !== ORDER_STATUS.PAYEE
}

function isPaidOrder(status: string) {
  return normalizeOrderStatus(status) === ORDER_STATUS.PAYEE
}

function canCash(order: RestaurantOrder) {
  return normalizeOrderStatus(order.status) === ORDER_STATUS.SERVIE
}

function canPrint(order: RestaurantOrder) {
  const status = normalizeOrderStatus(order.status)
  return status === ORDER_STATUS.SERVIE || status === ORDER_STATUS.PAYEE
}

function hasPendingMobilePayment(order: RestaurantOrder) {
  return (
    normalizePaymentMethod(order.paymentMethod) === "mobile" &&
    normalizePaymentStatus(order.paymentStatus) === "pending"
  )
}

const ORDER_PROGRESS = [
  ORDER_STATUS.NOUVELLE,
  ORDER_STATUS.PREPARATION,
  ORDER_STATUS.PRETE,
  ORDER_STATUS.SERVIE,
  ORDER_STATUS.PAYEE,
] as const;

function progressIndex(status: string) {
  return ORDER_PROGRESS.indexOf(normalizeOrderStatus(status) as typeof ORDER_PROGRESS[number]);
}

function getOrderTableLabel(order: RestaurantOrder) {
  return order.table ? `Table ${order.table}` : "A emporter";
}

function statusLabel(status: string) {
  return orderStatusLabel(status);
}

function statusBadgeClass(status: string) {
  const normalized = normalizeOrderStatus(status);
  if (normalized === ORDER_STATUS.NOUVELLE) return "bg-secondary text-white";
  if (normalized === ORDER_STATUS.PREPARATION) return "bg-orange-500 text-white";
  if (normalized === ORDER_STATUS.PRETE) return "bg-blue-600 text-white";
  if (normalized === ORDER_STATUS.SERVIE) return "bg-green-600 text-white";
  if (normalized === ORDER_STATUS.PAYEE) return "bg-emerald-600 text-white";
  return "bg-muted text-muted-foreground";
}

function statusDotClass(status: string) {
  if (status === ORDER_STATUS.NOUVELLE) return "bg-secondary";
  if (status === ORDER_STATUS.PREPARATION) return "bg-orange-500";
  if (status === ORDER_STATUS.PRETE) return "bg-blue-600";
  if (status === ORDER_STATUS.SERVIE) return "bg-green-600";
  if (status === ORDER_STATUS.PAYEE) return "bg-emerald-600";
  return "bg-muted";
}

function elapsedSince(createdAt: RestaurantOrder["createdAt"]) {
  const createdAtMs = createdAt?.toDate?.().getTime?.() ?? Date.now();
  const minutes = Math.max(0, Math.floor((Date.now() - createdAtMs) / 60000));

  if (minutes < 1) return "maintenant";
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}
