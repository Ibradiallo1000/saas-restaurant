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
  runTransaction
} from 'firebase/firestore';
import { COLLECTION_NAMES, ORDER_STATUS, PAYMENT_STATUS } from '@/lib/constants';
import { normalizePaymentMethod, paymentStatusForMethod, type PaymentMethod } from '@/lib/order-payment';
import { InventoryService } from './inventory.service';
import { LoyaltyService } from './loyalty.service';

export interface OrderItemInput {
  productId: string;
  nameSnapshot: string;
  priceSnapshot: number;
  quantity: number;
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
  private inventoryService: InventoryService;
  private loyaltyService: LoyaltyService;

  constructor(private db: Firestore) {
    this.inventoryService = new InventoryService(db);
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
      type: input.type,
      tableId: input.tableId || null,
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
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const orderRef = await addDoc(collection(this.db, COLLECTION_NAMES.ORDERS), orderData);

    // Enregistrement des articles de la commande (Snapshot des prix pour l'historique)
    for (const item of input.items) {
      const itemData = {
        ...item,
        orderId: orderRef.id,
        subtotal: item.priceSnapshot * item.quantity,
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(this.db, COLLECTION_NAMES.ORDERS, orderRef.id, COLLECTION_NAMES.ORDER_ITEMS), itemData);
    }

    return orderRef.id;
  }

  /**
   * Met à jour le statut opérationnel de la commande.
   */
  async updateOrderStatus(orderId: string, status: string) {
    const orderRef = doc(this.db, COLLECTION_NAMES.ORDERS, orderId);
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
    const orderRef = doc(this.db, COLLECTION_NAMES.ORDERS, orderId);
    
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
    const itemsSnapshot = await getDocs(collection(this.db, COLLECTION_NAMES.ORDERS, orderId, COLLECTION_NAMES.ORDER_ITEMS));
    const orderSnap = await getDoc(doc(this.db, COLLECTION_NAMES.ORDERS, orderId));
    const orderData = orderSnap.data();

    if (!orderData) return;

    // Mise à jour automatique de l'inventaire
    for (const itemDoc of itemsSnapshot.docs) {
      const item = itemDoc.data();
      await this.inventoryService.decrementStockForProduct(restaurantId, item.productId, item.quantity);
    }

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
