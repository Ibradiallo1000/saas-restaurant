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
  serverTimestamp, 
  updateDoc,
  getDocs,
  getDoc,
  runTransaction,
  writeBatch,
  query,
  where,
  limit
} from 'firebase/firestore';
import { COLLECTION_NAMES, ORDER_STATUS, PAYMENT_STATUS } from '@/lib/constants';
import { normalizePaymentMethod, paymentStatusForMethod, type PaymentMethod } from '@/lib/order-payment';
import type { SelectedCartOption } from '@/modules/restaurant/types';
import { LoyaltyService } from './loyalty.service';

export interface OrderItemInput {
  productId: string;
  nameSnapshot: string;
  priceSnapshot: number;
  quantity: number;
  selectedOptions?: SelectedCartOption[];
  instructions?: string;
}

export interface OrderInput {
  restaurantId: string;
  type: 'table' | 'room' | 'takeaway' | 'delivery';
  tableId?: string;
  roomId?: string;
  customerName?: string;
  customerPhone?: string;
  items: OrderItemInput[];
  deliveryAddress?: string;
  deliveryFee?: number;
  tipAmount?: number;
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
    const totalAmount = subtotal + (input.deliveryFee || 0) + (input.tipAmount || 0);

    const orderData = {
      restaurantId: input.restaurantId,
      source: 'pos',
      type: input.type,
      tableId: input.tableId || null,
      table: input.tableId || null,
      roomId: input.roomId || null,
      customerName: input.customerName || 'Client Anonyme',
      customerPhone: input.customerPhone || null,
      status: ORDER_STATUS.NOUVELLE,
      paymentMethod: null,
      paymentStatus: null,
      paidAt: null,
      subtotal,
      deliveryFee: input.deliveryFee || 0,
      tipAmount: input.tipAmount || 0,
      totalAmount,
      deliveryAddress: input.deliveryAddress || null,
      total: totalAmount,
      items: input.items.map((item) => ({
        productId: item.productId,
        name: item.nameSnapshot,
        unitPrice: item.priceSnapshot,
        quantity: item.quantity,
        total: item.priceSnapshot * item.quantity,
        selectedOptions: item.selectedOptions || [],
      })),
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
    for (const item of input.items) {
      const itemData = {
        ...item,
        orderId: orderRef.id,
        subtotal: item.priceSnapshot * item.quantity,
        createdAt: serverTimestamp(),
      };
      await addDoc(
        collection(
          this.db,
          COLLECTION_NAMES.RESTAURANTS,
          input.restaurantId,
          COLLECTION_NAMES.ORDERS,
          orderRef.id,
          COLLECTION_NAMES.ORDER_ITEMS
        ),
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
    await updateDoc(orderRef, {
      status,
      updatedAt: serverTimestamp(),
    });
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
      if (orderData.paymentStatus === PAYMENT_STATUS.VALIDATED) {
        throw new Error("Cette commande a déjà été payée");
      }
      const paymentMethod = normalizePaymentMethod(method);
      if (!paymentMethod) throw new Error("Mode de paiement invalide");

      const paymentStatus = paymentStatusForMethod(paymentMethod);

      transaction.update(orderRef, {
        paymentMethod,
        paymentStatus,
        status: paymentStatus === PAYMENT_STATUS.VALIDATED ? ORDER_STATUS.PAYEE : orderData.status,
        paidAt: paymentStatus === PAYMENT_STATUS.VALIDATED ? serverTimestamp() : null,
        updatedAt: serverTimestamp(),
      });
    });

    // Effets secondaires après transaction réussie
    const itemsSnapshot = await getDocs(
      collection(
        this.db,
        COLLECTION_NAMES.RESTAURANTS,
        restaurantId,
        COLLECTION_NAMES.ORDERS,
        orderId,
        COLLECTION_NAMES.ORDER_ITEMS
      )
    );
    const orderSnap = await getDoc(orderRef);
    const orderData = orderSnap.data();

    if (!orderData) return;

    // Mise à jour automatique de l'inventaire
    await this.decrementStockForOrderItems(
      restaurantId,
      itemsSnapshot.docs.map((itemDoc) => {
        const item = itemDoc.data();
        return {
          productId: item.productId as string,
          quantity: Number(item.quantity || 0),
        };
      })
    );

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

  private async decrementStockForOrderItems(
    restaurantId: string,
    items: Array<{ productId: string; quantity: number }>
  ) {
    const quantityByProductId = items.reduce((acc, item) => {
      if (!item.productId || item.quantity <= 0) return acc;
      acc.set(item.productId, (acc.get(item.productId) || 0) + item.quantity);
      return acc;
    }, new Map<string, number>());

    if (quantityByProductId.size === 0) return;

    const inventoryRef = collection(
      this.db,
      COLLECTION_NAMES.RESTAURANTS,
      restaurantId,
      COLLECTION_NAMES.INVENTORY
    );

    const inventorySnapshots = await Promise.all(
      Array.from(quantityByProductId.keys()).map(async (productId) => ({
        productId,
        snapshot: await getDocs(
          query(
            inventoryRef,
            where('linkedProductIds', 'array-contains', productId),
            limit(20)
          )
        ),
      }))
    );

    const batch = writeBatch(this.db);
    let writes = 0;

    for (const { productId, snapshot } of inventorySnapshots) {
      const soldQuantity = quantityByProductId.get(productId) || 0;

      for (const inventoryDoc of snapshot.docs) {
        const currentData = inventoryDoc.data();
        const currentQuantity = Number(currentData.quantity || 0);

        batch.update(inventoryDoc.ref, {
          quantity: Math.max(0, currentQuantity - soldQuantity),
          updatedAt: serverTimestamp(),
        });
        writes += 1;
      }
    }

    if (writes > 0) {
      await batch.commit();
    }
  }
}
