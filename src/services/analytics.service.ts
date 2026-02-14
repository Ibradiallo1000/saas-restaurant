'use client';

import { 
  Firestore, 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  Timestamp,
  limit
} from 'firebase/firestore';
import { COLLECTION_NAMES, PAYMENT_STATUS, ORDER_STATUS } from '@/lib/constants';
import { startOfDay, endOfDay, startOfWeek, startOfMonth, subDays, format } from 'date-fns';

export interface DashboardStats {
  sales: {
    today: number;
    week: number;
    month: number;
    breakdown: {
      cash: number;
      mobileMoney: number;
    };
  };
  orders: {
    active: number;
    completedToday: number;
    avgPrepTime: number; // in minutes
  };
  performance: {
    topProducts: Array<{ name: string; quantity: number; total: number }>;
    salesByCashier: Record<string, number>;
  };
  alerts: {
    lowStockCount: number;
    unclosedSessions: number;
  };
}

export class AnalyticsService {
  constructor(private db: Firestore) {}

  async getDashboardOverview(restaurantId: string): Promise<DashboardStats> {
    const now = new Date();
    const todayStart = startOfDay(now);
    const weekStart = startOfWeek(now);
    const monthStart = startOfMonth(now);

    // 1. Fetch all paid orders for the current month (for deep analysis)
    const ordersRef = collection(this.db, COLLECTION_NAMES.ORDERS);
    const monthlyQuery = query(
      ordersRef,
      where('restaurantId', '==', restaurantId),
      where('paymentStatus', '==', PAYMENT_STATUS.PAID),
      where('createdAt', '>=', Timestamp.fromDate(monthStart)),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(monthlyQuery);
    
    let todaySales = 0;
    let weekSales = 0;
    let monthSales = 0;
    let cashSales = 0;
    let mmSales = 0;
    let completedToday = 0;
    let totalPrepTime = 0;
    let prepTimeCount = 0;
    
    const productMap: Record<string, { quantity: number; total: number }> = {};
    const cashierMap: Record<string, number> = {};

    snapshot.forEach(doc => {
      const data = doc.data();
      const amount = data.totalAmount || 0;
      const date = data.createdAt?.toDate();
      const method = data.paymentMethod;

      // Aggregations
      monthSales += amount;
      if (date >= weekStart) weekSales += amount;
      if (date >= todayStart) {
        todaySales += amount;
        completedToday++;
      }

      // Method breakdown
      if (method === 'cash') cashSales += amount;
      if (method === 'mobile_money') mmSales += amount;

      // Prep time calculation
      if (data.status === ORDER_STATUS.SERVED || data.status === ORDER_STATUS.DELIVERED) {
        const start = data.createdAt?.toDate();
        const updated = data.updatedAt?.toDate();
        if (start && updated) {
          const diff = (updated.getTime() - start.getTime()) / 60000;
          totalPrepTime += diff;
          prepTimeCount++;
        }
      }
    });

    // 2. Fetch Active Orders
    const activeQuery = query(
      ordersRef,
      where('restaurantId', '==', restaurantId),
      where('status', 'in', [ORDER_STATUS.PENDING, ORDER_STATUS.PREPARING, ORDER_STATUS.READY])
    );
    const activeSnapshot = await getDocs(activeQuery);

    // 3. Fetch Low Stock Alerts
    const inventoryRef = collection(this.db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.INVENTORY);
    const lowStockSnapshot = await getDocs(inventoryRef);
    const lowStockCount = lowStockSnapshot.docs.filter(d => d.data().quantity <= d.data().threshold).length;

    return {
      sales: {
        today: todaySales,
        week: weekSales,
        month: monthSales,
        breakdown: {
          cash: cashSales,
          mobileMoney: mmSales
        }
      },
      orders: {
        active: activeSnapshot.size,
        completedToday,
        avgPrepTime: prepTimeCount > 0 ? Math.round(totalPrepTime / prepTimeCount) : 0
      },
      performance: {
        topProducts: [], // Would require fetching orderItems subcollections (heavy for MVP overview)
        salesByCashier: cashierMap
      },
      alerts: {
        lowStockCount,
        unclosedSessions: 0 // Would query cashierSessions status == 'open'
      }
    };
  }

  async getSalesTrend(restaurantId: string, days: number = 7) {
    const startDate = subDays(new Date(), days);
    const ordersRef = collection(this.db, COLLECTION_NAMES.ORDERS);
    const q = query(
      ordersRef,
      where('restaurantId', '==', restaurantId),
      where('paymentStatus', '==', PAYMENT_STATUS.PAID),
      where('createdAt', '>=', Timestamp.fromDate(startDate)),
      orderBy('createdAt', 'asc')
    );

    const snapshot = await getDocs(q);
    const trendMap: Record<string, number> = {};

    snapshot.forEach(doc => {
      const date = format(doc.data().createdAt.toDate(), 'dd/MM');
      trendMap[date] = (trendMap[date] || 0) + (doc.data().totalAmount || 0);
    });

    return Object.entries(trendMap).map(([name, total]) => ({ name, total }));
  }
}
