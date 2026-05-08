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
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import type { Order, OrderStatus } from "@/types/index";
import { normalizeOrderStatus } from "@/lib/order-status";

const ORDERS_SUBCOLLECTION = (companyId: string) =>
  collection(db, "companies", companyId, "commandes");

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
  companyId: string,
  callback: (orders: Order[]) => void,
  statuses?: OrderStatus[]
) => {
  const base = ORDERS_SUBCOLLECTION(companyId);
  const constraints = [];

  if (statuses && statuses.length > 0) {
    constraints.push(where("status", "in", statuses));
  }

  constraints.push(orderBy("createdAt", "desc"));

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
  companyId: string,
  id: string,
  status: OrderStatus
) => {
  const ref = doc(db, "companies", companyId, "commandes", id);
  await updateDoc(ref, { status: normalizeOrderStatus(status) });
};

