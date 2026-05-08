/**
 * @fileOverview Service central du menu (produits & catégories).
 */

import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import type { MenuItem, MenuCategory } from "@/types/index";

export const listenMenuItems = (
  restaurantId: string,
  callback: (items: MenuItem[]) => void
) => {
  const q = query(
    collection(db, "products"),
    where("restaurantId", "==", restaurantId),
    where("available", "!=", false)
  );

  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as MenuItem));
    callback(items);
  });
};

export const listenCategories = (
  restaurantId: string,
  callback: (cats: MenuCategory[]) => void
) => {
  const q = query(
    collection(db, "categories"),
    where("restaurantId", "==", restaurantId),
    orderBy("order", "asc")
  );

  return onSnapshot(q, (snap) => {
    const cats = snap.docs.map((d) => ({ id: d.id, ...d.data() } as MenuCategory));
    callback(cats);
  });
};

