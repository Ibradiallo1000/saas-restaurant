/**
 * @fileOverview Hook temps réel pour le menu (produits & catégories).
 */

import { useEffect, useState } from "react";
import { listenMenuItems, listenCategories } from "@/services/menuService";
import type { MenuItem, MenuCategory } from "@/types/index";

export const useMenu = (restaurantId?: string) => {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);

  useEffect(() => {
    if (!restaurantId) {
      setItems([]);
      setCategories([]);
      return;
    }

    const unsubItems = listenMenuItems(restaurantId, setItems);
    const unsubCats = listenCategories(restaurantId, setCategories);

    return () => {
      unsubItems();
      unsubCats();
    };
  }, [restaurantId]);

  return { items, categories };
};

