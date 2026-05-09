/**
 * @fileOverview Hook temps réel pour les commandes.
 */

import { useEffect, useState } from "react";
import { listenOrders } from "@/services/orderService";
import type { Order, OrderStatus } from "@/types/index";

export const useOrders = (restaurantId?: string, statuses?: OrderStatus[]) => {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (!restaurantId) {
      setOrders([]);
      return;
    }

    const unsub = listenOrders(restaurantId, setOrders, statuses);
    return () => unsub();
  }, [restaurantId, statuses?.join("|")]);

  return orders;
};

