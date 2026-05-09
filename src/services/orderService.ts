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
  limit,
  query,
  type QueryConstraint,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import type { Order, OrderStatus } from "@/types/index";
import { normalizeOrderStatus } from "@/lib/order-status";

const ORDERS_SUBCOLLECTION = (restaurantId: string) =>
  collection(db, "restaurants", restaurantId, "orders");

/**
 * Crée une nouvelle commande dans la sous-collection de l'entreprise.
 */
export const createOrder = async (
  companyId: string,
  order: Omit<Order, "id" | "createdAt">
) => {
  return await addDoc(ORDERS_SUBCOLLECTION(companyId), {
    ...order,
    status: normalizeOrderStatus(order.status),
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
    constraints.push(where("status", "in", statuses));
  }

  constraints.push(orderBy("createdAt", "desc"));
  constraints.push(limit(20));

  const q = query(base, ...constraints);

  return onSnapshot(q, (snap) => {
    const orders = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        status: normalizeOrderStatus(data.status),
        createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
      } as Order;
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
  await updateDoc(ref, { status: normalizeOrderStatus(status) });
};

