/**
 * @fileOverview Service central des commandes.
 * Toute la logique Firebase passe ici. Rien ailleurs.
 */

import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  doc,
  query,
  arrayUnion,
  type QueryConstraint,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import type { Order, OrderStatus } from "@/types/index";
import { getOrderStatus, normalizeOperationStatus, toKitchenServedEventStatus } from "@/lib/order-lifecycle";

const ORDERS_SUBCOLLECTION = (restaurantId: string) =>
  collection(db, "restaurants", restaurantId, "orders");

/**
 * Crée une nouvelle commande dans la sous-collection de l'entreprise.
 */
export const createOrder = async (
  companyId: string,
  order: Omit<Order, "id" | "createdAt">
) => {
  const { status: _legacyStatus, kitchenStatus: _legacyKitchenStatus, ...safeOrder } = order as any;

  return await addDoc(ORDERS_SUBCOLLECTION(companyId), {
    ...safeOrder,
    orderStatus: normalizeOperationStatus(safeOrder.orderStatus),
    statusHistory: [
      {
        status: normalizeOperationStatus(safeOrder.orderStatus),
        at: new Date(),
        source: "order",
      },
    ],
    createdAt: Timestamp.now(),
  });
};

/**
 * Écoute les commandes d'une entreprise en temps réel.
 * Optionnellement filtré par statut(s).
 */
export const listenOrders = (
  restaurantId: string,
  callback: (orders: Order[]) => void,
  statuses?: OrderStatus[]
) => {
  const base = ORDERS_SUBCOLLECTION(restaurantId);
  const constraints: QueryConstraint[] = [];

  if (statuses && statuses.length > 0) {
    constraints.push(where("orderStatus", "in", statuses.map((status) => normalizeOperationStatus(status))));
  }

  constraints.push(orderBy("createdAt", "desc"));
  const q = query(base, ...constraints);

  return onSnapshot(q, (snap) => {
    const orders = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        status: getOrderStatus(data),
        createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
      } as unknown as Order;
    });
    callback(orders);
  });
};

/**
 * Met à jour le statut d'une commande.
 */
export const updateOrderStatus = async (
  restaurantId: string,
  id: string,
  status: OrderStatus
) => {
  const ref = doc(db, "restaurants", restaurantId, "orders", id);
  const normalizedStatus = normalizeOperationStatus(status);
  await updateDoc(ref, {
    orderStatus: normalizedStatus,
    statusHistory: arrayUnion({
      status: toKitchenServedEventStatus(normalizedStatus),
      at: new Date(),
      source: "service",
    }),
  });
};

