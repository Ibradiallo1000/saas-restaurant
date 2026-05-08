/**
 * @fileOverview Hook temps réel pour les commandes.
 */

import { useEffect, useState } from "react";
import { listenOrders } from "@/services/orderService";
import type { Order, OrderStatus } from "@/types/index";

export const useOrders = (companyId?: string, statuses?: OrderStatus[]) => {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (!companyId) {
      setOrders([]);
      return;
    }

    const unsub = listenOrders(companyId, setOrders, statuses);
    return () => unsub();
  }, [companyId, statuses?.join("|")]);

  return orders;
};

