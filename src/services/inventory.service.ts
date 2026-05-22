'use client';

/**
 * Minimal restaurant-scoped inventory service.
 *
 * Inventory runs after payment success and must never block payment.
 */

import {
  Firestore,
  collection,
  doc,
  getDoc,
  increment,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

import { COLLECTION_NAMES } from '@/lib/constants';
import { computeConsumption } from '@/lib/product-components';

export type InventoryUnit = 'pièce' | 'kg' | 'litre';

export type InventoryItemInput = {
  name: string;
  unit: InventoryUnit;
  stockEstimated: number;
  costPerUnit?: number;
  minThreshold?: number;
  lossRate?: number;
};

type OrderLike = {
  id?: string | null;
  restaurantId?: string | null;
  paymentId?: string | null;
  items?: Array<{
    productId?: string | null;
    name?: string | null;
    productName?: string | null;
    price?: number | null;
    priceSnapshot?: number | null;
    quantity?: number | null;
    selectedOptions?: unknown[] | null;
    variant?: unknown | null;
    addons?: unknown[] | null;
    product?: unknown | null;
  }>;
  total?: number | null;
  totalAmount?: number | null;
};

type RecipeLine = {
  inventoryItemId?: string | null;
  itemId?: string | null;
  ingredientId?: string | null;
  quantity?: number | null;
  qty?: number | null;
  lossRate?: number | null;
};

type InventoryUpdate = {
  itemId: string;
  quantity: number;
};

type OrderCostLine = {
  productId: string;
  productName: string;
  quantity: number;
  sales: number;
  cost: number;
  margin: number;
  missingCost: boolean;
};

type OrderCostDetails = {
  totalCost: number;
  totalSales: number;
  margin: number;
  itemMargins: OrderCostLine[];
};

export class InventoryService {
  constructor(private db: Firestore) {}

  async createInventoryItem(restaurantId: string, input: InventoryItemInput) {
    const itemRef = doc(collection(this.db, COLLECTION_NAMES.RESTAURANTS, restaurantId, 'inventoryItems'));
    await setDoc(itemRef, {
      name: input.name.trim(),
      unit: input.unit,
      stockEstimated: normalizeStockValue(input.stockEstimated),
      lastCountedStock: normalizeStockValue(input.stockEstimated),
      avgDailyConsumption: 0,
      costPerUnit: normalizePositiveNumber(input.costPerUnit),
      minThreshold: normalizePositiveNumber(input.minThreshold),
      lossRate: normalizeLossRate(input.lossRate),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastCountedAt: serverTimestamp(),
    });
    await this.evaluateInventoryItemAlerts(restaurantId, itemRef.id);
    return itemRef.id;
  }

  async addInventoryStock(restaurantId: string, itemId: string, quantity: number) {
    const amount = normalizePositiveQuantity(quantity);
    const itemRef = doc(this.db, COLLECTION_NAMES.RESTAURANTS, restaurantId, 'inventoryItems', itemId);
    await updateDoc(itemRef, {
      stockEstimated: increment(amount),
      updatedAt: serverTimestamp(),
    });
    await this.evaluateInventoryItemAlerts(restaurantId, itemId);
  }

  async adjustInventoryStock(restaurantId: string, itemId: string, newValue: number) {
    const itemRef = doc(this.db, COLLECTION_NAMES.RESTAURANTS, restaurantId, 'inventoryItems', itemId);
    await updateDoc(itemRef, {
      stockEstimated: normalizeStockValue(newValue),
      updatedAt: serverTimestamp(),
    });
    await this.evaluateInventoryItemAlerts(restaurantId, itemId);
  }

  async updateInventoryCost(restaurantId: string, itemId: string, costPerUnit: number) {
    const itemRef = doc(this.db, COLLECTION_NAMES.RESTAURANTS, restaurantId, 'inventoryItems', itemId);
    await updateDoc(itemRef, {
      costPerUnit: normalizePositiveNumber(costPerUnit),
      updatedAt: serverTimestamp(),
    });
    await this.evaluateInventoryItemAlerts(restaurantId, itemId);
  }

  async updateInventoryMinThreshold(restaurantId: string, itemId: string, minThreshold: number) {
    const itemRef = doc(this.db, COLLECTION_NAMES.RESTAURANTS, restaurantId, 'inventoryItems', itemId);
    await updateDoc(itemRef, {
      minThreshold: normalizePositiveNumber(minThreshold),
      updatedAt: serverTimestamp(),
    });
    await this.evaluateInventoryItemAlerts(restaurantId, itemId);
  }

  async reconcileStock(restaurantId: string, itemId: string, realValue: number) {
    const stock = normalizeStockValue(realValue);
    const itemRef = doc(this.db, COLLECTION_NAMES.RESTAURANTS, restaurantId, 'inventoryItems', itemId);
    await updateDoc(itemRef, {
      stockEstimated: stock,
      lastCountedStock: stock,
      lastCountedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await this.evaluateInventoryItemAlerts(restaurantId, itemId);
  }

  async updateConsumptionStats(restaurantId: string, itemId: string, quantityUsed: number) {
    const used = normalizePositiveNumber(quantityUsed);
    if (used <= 0) return;

    const itemRef = doc(this.db, COLLECTION_NAMES.RESTAURANTS, restaurantId, 'inventoryItems', itemId);
    const todayKey = getDateKey(new Date());

    await runTransaction(this.db, async (transaction) => {
      const itemSnap = await transaction.get(itemRef);
      if (!itemSnap.exists()) return;

      const item = itemSnap.data();
      const previousDateKey = typeof item.dailyConsumptionDate === 'string' ? item.dailyConsumptionDate : null;
      const sameDay = previousDateKey === todayKey;
      const totalUsed = normalizePositiveNumber(item.consumptionTotal) + used;
      const dayCount = sameDay
        ? Math.max(1, Math.round(normalizePositiveNumber(item.consumptionDays)))
        : Math.max(1, Math.round(normalizePositiveNumber(item.consumptionDays)) + 1);
      const dailyUsed = sameDay
        ? normalizePositiveNumber(item.dailyConsumptionUsed) + used
        : used;

      transaction.update(itemRef, {
        avgDailyConsumption: totalUsed / dayCount,
        consumptionTotal: totalUsed,
        consumptionDays: dayCount,
        dailyConsumptionDate: todayKey,
        dailyConsumptionUsed: dailyUsed,
        updatedAt: serverTimestamp(),
      });
    });
    await this.evaluateInventoryItemAlerts(restaurantId, itemId);
  }

  async seedInventoryItems(restaurantId: string) {
    const seeds: InventoryItemInput[] = [
      { name: 'Poulet', unit: 'pièce', stockEstimated: 0, costPerUnit: 0, minThreshold: 5, lossRate: 0 },
      { name: 'Huile', unit: 'litre', stockEstimated: 0, costPerUnit: 0, minThreshold: 5, lossRate: 0 },
      { name: 'Pain', unit: 'pièce', stockEstimated: 0, costPerUnit: 0, minThreshold: 5, lossRate: 0 },
    ];

    await Promise.all(seeds.map((item) => this.createInventoryItem(restaurantId, item)));
  }

  async calculateOrderCost(order: OrderLike) {
    const restaurantId = order.restaurantId;
    const items = Array.isArray(order.items) ? order.items : [];
    if (!restaurantId || items.length === 0) return 0;

    const details = await this.calculateOrderCostDetails(restaurantId, order);
    return details.totalCost;
  }

  async handleOrderPaid(order: OrderLike) {
    try {
      const restaurantId = order.restaurantId;
      const paymentId = order.paymentId || order.id;
      const items = Array.isArray(order.items) ? order.items : [];

      if (!restaurantId || !paymentId || items.length === 0) return;

      const updates = await this.buildInventoryUpdates(restaurantId, items);
      const costDetails = await this.calculateOrderCostDetails(restaurantId, order);
      const logRef = doc(this.db, COLLECTION_NAMES.RESTAURANTS, restaurantId, 'inventoryLogs', paymentId);
      const snapshotRef = order.id
        ? doc(
            this.db,
            COLLECTION_NAMES.RESTAURANTS,
            restaurantId,
            COLLECTION_NAMES.ORDERS,
            order.id,
            'costSnapshot',
            paymentId
          )
        : null;
      const createdDate = getDateKey(new Date());

      const processed = await runTransaction(this.db, async (transaction) => {
        const logSnap = await transaction.get(logRef);
        if (logSnap.exists()) return false;

        const inventoryUpdates = await Promise.all(
          updates.map(async (update) => {
            const inventoryRef = doc(
              this.db,
              COLLECTION_NAMES.RESTAURANTS,
              restaurantId,
              'inventoryItems',
              update.itemId
            );
            const inventorySnap = await transaction.get(inventoryRef);
            return { update, inventoryRef, inventorySnap };
          })
        );

        for (const { update, inventoryRef, inventorySnap } of inventoryUpdates) {
          const currentStock = Number(inventorySnap.data()?.stockEstimated || 0);
          const nextStock = currentStock - update.quantity;
          if (Number.isFinite(currentStock) && nextStock < -10) {
            console.warn('Stock incohérent critique', {
              restaurantId,
              inventoryItemId: update.itemId,
              currentStock,
              nextStock,
              quantity: update.quantity,
              orderId: order.id ?? null,
              paymentId,
            });
          } else if (Number.isFinite(currentStock) && nextStock < -5) {
            console.warn('Stock incohérent', {
              restaurantId,
              inventoryItemId: update.itemId,
              currentStock,
              nextStock,
              quantity: update.quantity,
              orderId: order.id ?? null,
              paymentId,
            });
          }

          transaction.update(inventoryRef, {
            stockEstimated: increment(-update.quantity),
            updatedAt: serverTimestamp(),
          });
          const movementRef = doc(collection(
            this.db,
            COLLECTION_NAMES.RESTAURANTS,
            restaurantId,
            COLLECTION_NAMES.INVENTORY_MOVEMENTS
          ));
          transaction.set(movementRef, {
            restaurantId,
            inventoryItemId: update.itemId,
            type: 'sale',
            quantity: -update.quantity,
            source: 'system',
            referenceId: order.id ?? null,
            paymentId,
            createdAt: serverTimestamp(),
          });
        }

        transaction.set(logRef, {
          paymentId,
          orderId: order.id ?? null,
          decrementCount: updates.length,
          totalCost: costDetails.totalCost,
          totalSales: costDetails.totalSales,
          margin: costDetails.margin,
          itemMargins: costDetails.itemMargins,
          createdDate,
          createdAt: serverTimestamp(),
        });

        if (snapshotRef) {
          transaction.set(snapshotRef, {
            paymentId,
            totalCost: costDetails.totalCost,
            totalSales: costDetails.totalSales,
            margin: costDetails.margin,
            itemMargins: costDetails.itemMargins,
            createdDate,
            createdAt: serverTimestamp(),
          });
        }

        return true;
      });

      if (processed) {
        await Promise.all(
          updates.map((update) =>
            this.updateConsumptionStats(restaurantId, update.itemId, update.quantity)
          )
        );
      }
    } catch (error) {
      console.error('[inventory] handleOrderPaid failed', error);
    }
  }

  private async buildInventoryUpdates(
    restaurantId: string,
    orderItems: NonNullable<OrderLike['items']>
  ): Promise<InventoryUpdate[]> {
    const updates = new Map<string, number>();

    for (const orderItem of orderItems) {
      const productId = orderItem.productId;
      const orderQuantity = normalizePositiveNumber(orderItem.quantity ?? 0);
      if (!productId || orderQuantity <= 0) continue;

      const productSnap = await getDoc(
        doc(this.db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.PRODUCTS, productId)
      );
      if (!productSnap.exists()) continue;

      const product = { id: productSnap.id, ...productSnap.data() };
      const consumption = computeConsumption(orderItem, product);

      for (const line of consumption) {
        const decrement = line.quantity * orderQuantity;
        updates.set(line.inventoryItemId, (updates.get(line.inventoryItemId) || 0) + decrement);
      }
    }

    return Array.from(updates.entries()).map(([itemId, quantity]) => ({ itemId, quantity }));
  }

  private async calculateOrderCostDetails(
    restaurantId: string,
    order: OrderLike
  ): Promise<OrderCostDetails> {
    const itemMargins: OrderCostLine[] = [];
    const items = Array.isArray(order.items) ? order.items : [];
    let totalCost = 0;

    for (const orderItem of items) {
      const productId = orderItem.productId;
      const orderQuantity = normalizePositiveNumber(orderItem.quantity ?? 0);
      if (!productId || orderQuantity <= 0) continue;

      const productSnap = await getDoc(
        doc(this.db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.PRODUCTS, productId)
      );
      const product: any = productSnap.exists() ? { id: productSnap.id, ...productSnap.data() } : null;
      const consumption = computeConsumption(orderItem, product);
      const unitPrice = normalizePositiveNumber(
        orderItem.priceSnapshot ?? orderItem.price ?? product?.price ?? product?.basePrice ?? 0
      );
      const sales = unitPrice * orderQuantity;
      let productCost = 0;
      let missingCost = consumption.length === 0;

      if (consumption.length > 0) {
        for (const line of consumption) {
          const inventorySnap = await getDoc(
            doc(this.db, COLLECTION_NAMES.RESTAURANTS, restaurantId, 'inventoryItems', line.inventoryItemId)
          );
          const costPerUnit = inventorySnap.exists()
            ? normalizePositiveNumber(inventorySnap.data().costPerUnit)
            : 0;
          if (costPerUnit <= 0) {
            missingCost = true;
          }
          productCost += line.quantity * orderQuantity * costPerUnit;
        }
      }

      if (!missingCost) {
        totalCost += productCost;
      }
      itemMargins.push({
        productId,
        productName: getOrderItemName(orderItem, product),
        quantity: orderQuantity,
        sales,
        cost: productCost,
        margin: missingCost ? 0 : sales - productCost,
        missingCost,
      });
    }

    const completeSales = itemMargins
      .filter((item) => !item.missingCost)
      .reduce((sum, item) => sum + item.sales, 0);
    const totalSales = completeSales;
    return {
      totalCost,
      totalSales,
      margin: totalSales - totalCost,
      itemMargins,
    };
  }

  private async evaluateInventoryItemAlerts(restaurantId: string, itemId: string) {
    const itemRef = doc(this.db, COLLECTION_NAMES.RESTAURANTS, restaurantId, 'inventoryItems', itemId);
    const itemSnap = await getDoc(itemRef);
    if (!itemSnap.exists()) return;

    const item = itemSnap.data();
    const itemName = typeof item.name === 'string' && item.name.trim() ? item.name.trim() : 'Ingredient';
    const stockEstimated = Number(item.stockEstimated || 0);
    const avgDailyConsumption = Number(item.avgDailyConsumption || 0);
    const costPerUnit = Number(item.costPerUnit || 0);
    const minThreshold = Number(item.minThreshold || 0);
    const daysLeft = avgDailyConsumption > 0 ? stockEstimated / avgDailyConsumption : null;

    if (Number.isFinite(stockEstimated) && stockEstimated < 0) {
      await this.setInventoryAlertState(
        restaurantId,
        'incoherent_stock',
        itemId,
        `${itemName}: stock estimé négatif, correction nécessaire.`,
        'high'
      );
      return;
    }

    if (daysLeft !== null && daysLeft < 2) {
      await this.setInventoryAlertState(
        restaurantId,
        'low_stock',
        itemId,
        `${itemName}: stock critique, moins de 2 jours restants.`,
        'high'
      );
      return;
    }

    if (minThreshold > 0 && stockEstimated <= minThreshold) {
      await this.setInventoryAlertState(
        restaurantId,
        'low_stock',
        itemId,
        `${itemName}: stock sous le seuil minimum.`,
        'high'
      );
      return;
    }

    if (costPerUnit <= 0) {
      await this.setInventoryAlertState(
        restaurantId,
        'missing_cost',
        itemId,
        `${itemName}: coût unitaire non défini.`,
        'medium'
      );
      return;
    }

    await this.resolveInventoryAlert(restaurantId, itemId);
  }

  private async setInventoryAlertState(
    restaurantId: string,
    type: 'low_stock' | 'incoherent_stock' | 'missing_cost',
    itemId: string,
    message: string,
    severity: 'low' | 'medium' | 'high'
  ) {
    const alertRef = doc(
      this.db,
      COLLECTION_NAMES.RESTAURANTS,
      restaurantId,
      'inventoryAlerts',
      itemId
    );

    await setDoc(
      alertRef,
      {
        type,
        itemId,
        message,
        severity,
        resolved: false,
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  private async resolveInventoryAlert(restaurantId: string, itemId: string) {
    const alertRef = doc(
      this.db,
      COLLECTION_NAMES.RESTAURANTS,
      restaurantId,
      'inventoryAlerts',
      itemId
    );
    const alertSnap = await getDoc(alertRef);
    if (!alertSnap.exists()) return;

    await setDoc(alertRef, { resolved: true, resolvedAt: serverTimestamp() }, { merge: true });
  }
}

function normalizeRecipe(value: unknown): RecipeLine[] | null {
  return Array.isArray(value) ? (value as RecipeLine[]) : null;
}

function normalizePositiveQuantity(value: number) {
  const amount = normalizePositiveNumber(value);
  if (amount <= 0) throw new Error('Quantite invalide.');
  return amount;
}

function normalizeStockValue(value: number) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return amount;
}

function normalizePositiveNumber(value: unknown) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function normalizeLossRate(value: unknown) {
  const rate = Number(value || 0);
  if (!Number.isFinite(rate) || rate < 0) return 0;
  return Math.min(rate, 1);
}

function getDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getOrderItemName(orderItem: NonNullable<OrderLike['items']>[number], product: any) {
  const name = orderItem.productName || orderItem.name || product?.name || product?.title;
  return typeof name === 'string' && name.trim() ? name.trim() : 'Plat sans nom';
}
