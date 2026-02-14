'use client';

import { 
  Firestore, 
  doc, 
  setDoc, 
  addDoc, 
  collection, 
  serverTimestamp, 
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs
} from 'firebase/firestore';
import { COLLECTION_NAMES, ORDER_STATUS, PAYMENT_STATUS } from '@/lib/constants';

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
  constructor(private db: Firestore) {}

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
      status: ORDER_STATUS.PENDING,
      paymentStatus: PAYMENT_STATUS.UNPAID,
      subtotal,
      deliveryFee: input.deliveryFee || 0,
      tipAmount: input.tipAmount || 0,
      totalAmount,
      deliveryAddress: input.deliveryAddress || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const orderRef = await addDoc(collection(this.db, COLLECTION_NAMES.ORDERS), orderData);

    // Add items as subcollection for data integrity and independent access
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

  async updateOrderStatus(orderId: string, status: string) {
    const orderRef = doc(this.db, COLLECTION_NAMES.ORDERS, orderId);
    await updateDoc(orderRef, {
      status,
      updatedAt: serverTimestamp(),
    });
  }

  async addItemsToOrder(orderId: string, items: OrderItemInput[]) {
    const orderRef = doc(this.db, COLLECTION_NAMES.ORDERS, orderId);
    
    for (const item of items) {
      const itemData = {
        ...item,
        orderId: orderId,
        subtotal: item.priceSnapshot * item.quantity,
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(this.db, COLLECTION_NAMES.ORDERS, orderId, COLLECTION_NAMES.ORDER_ITEMS), itemData);
    }

    // Recalculate total amount logic would ideally go here or in a Cloud Function
    // For MVP, we update the updatedAt to trigger listeners
    await updateDoc(orderRef, {
      updatedAt: serverTimestamp(),
    });
  }

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
