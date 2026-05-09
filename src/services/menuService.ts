/**
 * @fileOverview Service central du menu (produits & catégories).
 */

import { db } from "@/lib/firebase";
import {
  getDocs,
  limit,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import type { MenuItem, MenuCategory } from "@/types/index";
import { restaurantCategoriesRef, restaurantProductsRef } from "@/lib/restaurant-firestore-paths";

export const fetchMenuItems = async (restaurantId: string) => {
  if (!restaurantId) return [];

  const q = query(
    restaurantProductsRef(db, restaurantId),
    where("available", "!=", false),
    limit(50)
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MenuItem));
};

export const fetchCategories = async (restaurantId: string) => {
  if (!restaurantId) return [];

  const q = query(
    restaurantCategoriesRef(db, restaurantId),
    orderBy("order", "asc"),
    limit(50)
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MenuCategory));
};

