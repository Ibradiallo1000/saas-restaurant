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
import { startOfDay, endOfDay, startOfWeek, startOfMonth, subDays, format, subWeeks, subMonths } from 'date-fns';

export interface ComparisonMetric {
  current: number;
  previous: number;
  percentageChange: number;
}

export interface DashboardStats {
  sales: {
    today: ComparisonMetric;
    week: ComparisonMetric;
    month: ComparisonMetric;
    breakdown: {
      cash: number;
      mobileMoney: number;
    };
  };
  orders: {
    active: number;
    completedToday: number;
    avgPrepTime: number; 
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
    
    // Current periods
    const todayStart = startOfDay(now);
    const weekStart = startOfWeek(now);
    const monthStart = startOfMonth(now);

    // Previous periods for comparison
    const yesterdayStart = startOfDay(subDays(now, 1));
    const yesterdayEnd = endOfDay(subDays(now, 1));
    const lastWeekStart = startOfWeek(subWeeks(now, 1));
    const lastMonthStart = startOfMonth(subMonths(now, 1));

    const ordersRef = collection(this.db, COLLECTION_NAMES.ORDERS);
    
    // Fetch all orders from start of last month to now for full metrics
    const mainQuery = query(
      ordersRef,
      where('restaurantId', '==', restaurantId),
      where('paymentStatus', '==', PAYMENT_STATUS.PAID),
      where('createdAt', '>=', Timestamp.fromDate(lastMonthStart)),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(mainQuery);
    
    let stats = {
      today: 0, yesterday: 0,
      thisWeek: 0, lastWeek: 0,
      thisMonth: 0, lastMonth: 0,
      cash: 0, mm: 0,
      prepTime: 0, prepCount: 0,
      completedToday: 0
    };

    snapshot.forEach(doc => {
      const data = doc.data();
      const amount = data.totalAmount || 0;
      const date = data.createdAt?.toDate();
      const method = data.paymentMethod;

      // Sales aggregations
      if (date >= todayStart) {
        stats.today += amount;
        stats.completedToday++;
      } else if (date >= yesterdayStart && date <= yesterdayEnd) {
        stats.yesterday += amount;
      }

      if (date >= weekStart) {
        stats.thisWeek += amount;
      } else if (date >= lastWeekStart && date < weekStart) {
        stats.lastWeek += amount;
      }

      if (date >= monthStart) {
        stats.thisMonth += amount;
        if (method === 'cash') stats.cash += amount;
        if (method === 'mobile_money') stats.mm += amount;
      } else if (date >= lastMonthStart && date < monthStart) {
        stats.lastMonth += amount;
      }

      // Prep time
      if (data.status === ORDER_STATUS.SERVED || data.status === ORDER_STATUS.DELIVERED) {
        const start = data.createdAt?.toDate();
        const updated = data.updatedAt?.toDate();
        if (start && updated) {
          stats.prepTime += (updated.getTime() - start.getTime()) / 60000;
          stats.prepCount++;
        }
      }
    });

    const calcChange = (cur: number, prev: number) => {
      if (prev === 0) return cur > 0 ? 100 : 0;
      return Math.round(((cur - prev) / prev) * 100);
    };

    // Active Orders
    const activeQuery = query(
      ordersRef,
      where('restaurantId', '==', restaurantId),
      where('status', 'in', [ORDER_STATUS.PENDING, ORDER_STATUS.PREPARING, ORDER_STATUS.READY])
    );
    const activeSnapshot = await getDocs(activeQuery);

    // Stock
    const inventoryRef = collection(this.db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.INVENTORY);
    const lowStockSnapshot = await getDocs(inventoryRef);
    const lowStockCount = lowStockSnapshot.docs.filter(d => d.data().quantity <= d.data().threshold).length;

    return {
      sales: {
        today: { current: stats.today, previous: stats.yesterday, percentageChange: calcChange(stats.today, stats.yesterday) },
        week: { current: stats.thisWeek, previous: stats.lastWeek, percentageChange: calcChange(stats.thisWeek, stats.lastWeek) },
        month: { current: stats.thisMonth, previous: stats.lastMonth, percentageChange: calcChange(stats.thisMonth, stats.lastMonth) },
        breakdown: { cash: stats.cash, mobileMoney: stats.mm }
      },
      orders: {
        active: activeSnapshot.size,
        completedToday: stats.completedToday,
        avgPrepTime: stats.prepCount > 0 ? Math.round(stats.prepTime / stats.prepCount) : 0
      },
      alerts: {
        lowStockCount,
        unclosedSessions: 0
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