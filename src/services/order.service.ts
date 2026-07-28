'use client';

/**
 * @fileOverview Service gérant le cycle de vie complet des commandes.
 * Centralise la création, les mises à jour de statut et le traitement des paiements.
 */

import { 
  Firestore, 
  doc, 
  addDoc, 
  collection, 
  arrayUnion,
  serverTimestamp, 
  setDoc,
  updateDoc,
  getDoc,
  runTransaction,
} from 'firebase/firestore';
import { COLLECTION_NAMES, PAYMENT_STATUS } from '@/lib/constants';
import {
  ORDER_OPERATION_STATUS,
  ORDER_PAYMENT_STATUS,
  normalizeOperationStatus,
  toKitchenServedEventStatus,
} from '@/lib/order-lifecycle';
import { normalizePaymentMethod, paymentStatusForMethod, type PaymentMethod } from '@/lib/order-payment';
import type { SelectedCartOption } from '@/modules/restaurant/types';
import type { PreparationMode } from '@/utils/preparation-logic';
import { orderHasKitchenItems } from '@/utils/preparation-logic';
import { LoyaltyService } from './loyalty.service';

export interface OrderItemInput {
  id?: string;
  productId: string;
  nameSnapshot: string;
  priceSnapshot: number;
  quantity: number;
  status?: string;
  createdAt?: Date;
  selectedOptions?: SelectedCartOption[];
  instructions?: string;
  preparationMode?: PreparationMode;
}

export interface OrderInput {
  restaurantId: string;
  type: 'table' | 'room' | 'takeaway' | 'delivery';
  orderType?: 'dine_in' | 'takeaway' | 'pickup' | 'delivery';
  tableId?: string;
  zoneId?: string;
  sessionId?: string;
  tableSessionId?: string;
  cashierId?: string;
  cashSessionId?: string;
  source?: 'qr' | 'pos';
  roomId?: string;
  customerName?: string;
  customerPhone?: string;
  items: OrderItemInput[];
  deliveryAddress?: string;
  deliveryFee?: number;
  tipAmount?: number;
  discountAmount?: number;
}

export class OrderService {
  private loyaltyService: LoyaltyService;

  constructor(private db: Firestore) {
    this.loyaltyService = new LoyaltyService(db);
  }

  /**
   * Crée une nouvelle commande et enregistre ses articles dans une sous-collection.
   * Calcule automatiquement les totaux et initialise le statut.
   */
  async createOrder(input: OrderInput) {
    const subtotal = input.items.reduce((acc, item) => acc + (item.priceSnapshot * item.quantity), 0);
    const discountAmount = Math.max(0, Number(input.discountAmount || 0));
    const totalAmount = Math.max(0, subtotal - discountAmount + (input.deliveryFee || 0) + (input.tipAmount || 0));

    const normalizedOrderType =
      input.orderType === 'takeaway' ? 'pickup' : input.orderType || (input.type === 'table' ? 'dine_in' : input.type);

    const mappedItems = input.items.map((item, index) => {
      const orderItemId =
        item.id ||
        `${item.productId}-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`;
      return {
        id: orderItemId,
        orderItemId,
        productId: item.productId,
        name: item.nameSnapshot,
        status: item.status || "pending",
        createdAt: item.createdAt || new Date(),
        unitPrice: item.priceSnapshot,
        quantity: item.quantity,
        total: item.priceSnapshot * item.quantity,
        selectedOptions: item.selectedOptions || [],
        variant: (item as any).variant || null,
        addons: (item as any).addons || [],
        preparationMode: item.preparationMode || null,
      };
    });

    const requiresKitchen = orderHasKitchenItems(
      mappedItems.map((item) => ({ preparationMode: item.preparationMode ?? undefined }))
    );

    if (process.env.NODE_ENV !== "production") {
      console.info("[preparationMode][order_service]", {
        restaurantId: input.restaurantId,
        source: input.source || "pos",
        items: mappedItems.map((item) => ({
          productId: item.productId,
          name: item.name,
          preparationMode: item.preparationMode,
          sentToKitchen: item.preparationMode === "kitchen",
        })),
        kitchenItems: mappedItems
          .filter((item) => item.preparationMode === "kitchen")
          .map((item) => item.productId),
        requiresKitchen,
      });
    }

    const orderData = {
      restaurantId: input.restaurantId,
      source: input.source || 'pos',
      type: input.type,
      orderType: normalizedOrderType,
      tableId: input.tableId || null,
      table: input.tableId || null,
      zoneId: input.zoneId || null,
      sessionId: input.sessionId || null,
      tableSessionId:
        normalizedOrderType === "dine_in"
          ? input.tableSessionId || input.sessionId || null
          : null,
      cashierId: input.cashierId || null,
      cashSessionId: input.cashSessionId || null,
      roomId: input.roomId || null,
      customerName: input.customerName || 'Client Anonyme',
      customerPhone: input.customerPhone || null,
      kitchenStatus: requiresKitchen ? ORDER_OPERATION_STATUS.PENDING : ORDER_OPERATION_STATUS.READY,
      orderStatus: requiresKitchen ? ORDER_OPERATION_STATUS.PENDING : ORDER_OPERATION_STATUS.READY,
      statusHistory: [
        {
          status: requiresKitchen ? ORDER_OPERATION_STATUS.PENDING : ORDER_OPERATION_STATUS.READY,
          at: new Date(),
          source: "order",
        },
      ],
      sessionActive: normalizedOrderType === 'dine_in',
      paymentMethod: null,
      paymentType: null,
      paymentIntentStatus: "none",
      paymentStatus: ORDER_PAYMENT_STATUS.UNPAID,
      paymentCode: null,
      paidAt: null,
      subtotal,
      discountAmount,
      deliveryFee: input.deliveryFee || 0,
      tipAmount: input.tipAmount || 0,
      totalAmount,
      deliveryAddress: input.deliveryAddress || null,
      total: totalAmount,
      items: mappedItems,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const orderRef = await addDoc(
      collection(
        this.db,
        COLLECTION_NAMES.RESTAURANTS,
        input.restaurantId,
        COLLECTION_NAMES.ORDERS
      ),
      orderData
    );

    // Enregistrement des articles de la commande (Snapshot des prix pour l'historique)
    for (const item of mappedItems) {
      const orderItemId = item.orderItemId;
      const itemData = {
        ...item,
        id: orderItemId,
        orderItemId,
        restaurantId: input.restaurantId,
        nameSnapshot: item.name,
        priceSnapshot: item.unitPrice,
        status: item.status || "pending",
        servedQuantity: 0,
        createdAt: item.createdAt || serverTimestamp(),
        orderId: orderRef.id,
        subtotal: item.unitPrice * item.quantity,
      };
      await setDoc(
        doc(orderRef, COLLECTION_NAMES.ORDER_ITEMS, orderItemId),
        itemData
      );
    }

    return orderRef.id;
  }

  /**
   * Met à jour le statut opérationnel de la commande.
   */
  async updateOrderStatus(restaurantId: string, orderId: string, status: string) {
    if (!restaurantId || !orderId) return;

    const orderRef = doc(
      this.db,
      COLLECTION_NAMES.RESTAURANTS,
      restaurantId,
      COLLECTION_NAMES.ORDERS,
      orderId
    );
    const orderSnap = await getDoc(orderRef);
    const orderData = orderSnap.data();

    if (orderData?.sessionActive === false) {
      throw new Error("Session terminee - action impossible");
    }

    const normalizedStatus = normalizeOperationStatus(status);

    await updateDoc(orderRef, {
      kitchenStatus: normalizedStatus,
      statusHistory: arrayUnion({
        status: toKitchenServedEventStatus(normalizedStatus),
        at: new Date(),
        source: "service",
      }),
      updatedAt: serverTimestamp(),
    });

    // Stock V2 ne consomme jamais une recette au passage en préparation.
    // Les articles contrôlés sont comptés physiquement et les articles
    // automatiques sont traités une seule fois après confirmation du paiement.
  }

  /**
   * Gère le processus de paiement de manière atomique via une transaction Firestore.
   * Assure la cohérence entre le statut de paiement, les stocks et la fidélité.
   */
  async processPayment(orderId: string, restaurantId: string, method: PaymentMethod) {
    const orderRef = doc(
      this.db,
      COLLECTION_NAMES.RESTAURANTS,
      restaurantId,
      COLLECTION_NAMES.ORDERS,
      orderId
    );
    
    // TRANSACTION ATOMIQUE : Garantit qu'un paiement n'est traité qu'une seule fois
    // et que les données restent cohérentes même en cas de concurrence.
    await runTransaction(this.db, async (transaction) => {
      const orderDoc = await transaction.get(orderRef);
      if (!orderDoc.exists()) throw new Error("Commande introuvable");
      
      const orderData = orderDoc.data();
      if (orderData.sessionActive === false) {
        throw new Error("Session terminee - action impossible");
      }

      if (
        orderData.paymentStatus === "paid" ||
        orderData.paymentStatus === "paye" ||
        orderData.paymentStatus === "verified" ||
        orderData.paymentStatus === PAYMENT_STATUS.VALIDATED
      ) {
        throw new Error("Cette commande a déjà été payée");
      }
      const paymentMethod = normalizePaymentMethod(method);
      if (!paymentMethod) throw new Error("Mode de paiement invalide");

      const paymentStatus = paymentStatusForMethod(paymentMethod);

      transaction.update(orderRef, {
        paymentMethod,
        paymentStatus,
        paymentType: paymentMethod === "cash" ? "cash" : "mobile",
        paidAt: paymentStatus === "paid" ? serverTimestamp() : null,
        updatedAt: serverTimestamp(),
      });
    });

    // Effets secondaires après transaction réussie
    const orderSnap = await getDoc(orderRef);
    const orderData = orderSnap.data();

    if (!orderData) return;

    // La déduction physique est désormais portée exclusivement par Stock V2,
    // via le déclencheur serveur de paiement confirmé. Cette méthode ne met
    // plus à jour l’ancienne autorité `inventory.quantity`.

    // Enregistrement de la visite pour le programme de fidélité
    if (orderData.customerPhone) {
      await this.loyaltyService.recordVisit(
        restaurantId, 
        orderData.customerPhone, 
        orderData.customerName, 
        orderData.totalAmount
      );
    }
  }

  /**
   * Enregistre un avis client associé à une commande.
   */
  async submitReview(restaurantId: string, orderId: string, rating: number, comment: string) {
    const reviewData = {
      restaurantId,
      orderId,
      rating,
      comment,
      createdAt: serverTimestamp(),
    };
    await addDoc(collection(this.db, COLLECTION_NAMES.REVIEWS), reviewData);
  }

}
