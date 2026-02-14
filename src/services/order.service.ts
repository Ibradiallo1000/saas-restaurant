'use client';

import { 
  Firestore, 
  doc, 
  addDoc, 
  collection, 
  serverTimestamp, 
  updateDoc,
  getDocs
} from 'firebase/firestore';
import { COLLECTION_NAMES, ORDER_STATUS, PAYMENT_STATUS } from '@/lib/constants';
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

  async processPayment(orderId: string, restaurantId: string, method: string) {
    const orderRef = doc(this.db, COLLECTION_NAMES.ORDERS, orderId);
    
    // 1. Mark as Paid
    await updateDoc(orderRef, {
      paymentStatus: PAYMENT_STATUS.PAID,
      paymentMethod: method,
      updatedAt: serverTimestamp(),
    });

    // 2. Fetch items to process inventory and loyalty
    const itemsSnapshot = await getDocs(collection(this.db, COLLECTION_NAMES.ORDERS, orderId, COLLECTION_NAMES.ORDER_ITEMS));
    const orderSnap = await (await doc(this.db, COLLECTION_NAMES.ORDERS, orderId)).get(); // Minimal read for total/phone
    const orderData = orderSnap.data();

    if (!orderData) return;

    // 3. Automated Inventory Decrement
    for (const itemDoc of itemsSnapshot.docs) {
      const item = itemDoc.data();
      await this.inventoryService.decrementStockForProduct(restaurantId, item.productId, item.quantity);
    }

    // 4. Loyalty Update
    if (orderData.customerPhone) {
      await this.loyaltyService.recordVisit(
        restaurantId, 
        orderData.customerPhone, 
        orderData.customerName, 
        orderData.totalAmount
      );
    }
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
