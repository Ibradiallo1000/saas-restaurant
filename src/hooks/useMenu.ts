/**
 * @fileOverview Hook de lecture ponctuelle pour le menu.
 */

import { useEffect, useState } from "react";
import { fetchCategories, fetchMenuItems } from "@/services/menuService";
import type { MenuCategory, MenuItem } from "@/types/index";

export const useMenu = (restaurantId?: string) => {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);

  useEffect(() => {
    let cancelled = false;

    if (!restaurantId) {
      setItems([]);
      setCategories([]);
      return;
    }

    Promise.all([
      fetchMenuItems(restaurantId),
      fetchCategories(restaurantId),
    ]).then(([nextItems, nextCategories]) => {
      if (cancelled) return;
      setItems(nextItems);
      setCategories(nextCategories);
    });

    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  return { items, categories };
};
