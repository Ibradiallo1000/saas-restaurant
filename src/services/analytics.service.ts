'use client';

/**
 * @fileOverview Service d'analyse et de calcul des KPI financiers.
 * Fournit les données agrégées pour le tableau de bord propriétaire.
 */

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
import { normalizePaymentMethod } from '@/lib/order-payment';
import { normalizeOrderStatus } from '@/lib/order-status';
import { startOfDay, endOfDay, startOfWeek, startOfMonth, subDays, format, subWeeks, subMonths } from 'date-fns';

const DASHBOARD_QUERY_LIMIT = 40;
const ANALYTICS_CACHE_TTL_MS = 30_000;
const analyticsCache = new Map<string, { data: unknown; timestamp: number }>();

async function cachedQuery<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const cached = analyticsCache.get(key);
  if (cached && Date.now() - cached.timestamp < ANALYTICS_CACHE_TTL_MS) {
    return cached.data as T;
  }

  const data = await fn();
  analyticsCache.set(key, { data, timestamp: Date.now() });
  return data;
}

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

  /**
   * Calcule les statistiques globales de l'établissement.
   * Compare les périodes actuelles avec les périodes précédentes (J-1, Semaine-1).
   */
  async getDashboardOverview(restaurantId: string): Promise<DashboardStats> {
    return cachedQuery(`dashboard-overview:${restaurantId}`, async () => {
    const now = new Date();
    
    // Définition des périodes temporelles
    const todayStart = startOfDay(now);
    const weekStart = startOfWeek(now);
    const monthStart = startOfMonth(now);

    const yesterdayStart = startOfDay(subDays(now, 1));
    const yesterdayEnd = endOfDay(subDays(now, 1));
    const lastWeekStart = startOfWeek(subWeeks(now, 1));
    const lastMonthStart = startOfMonth(subMonths(now, 1));

    const ordersRef = collection(
      this.db,
      COLLECTION_NAMES.RESTAURANTS,
      restaurantId,
      COLLECTION_NAMES.ORDERS
    );
    
    // Requête principale filtrée par restaurant et statut payé
    const mainQuery = query(
      ordersRef,
      where('paymentStatus', '==', PAYMENT_STATUS.VALIDATED),
      where('createdAt', '>=', Timestamp.fromDate(lastMonthStart)),
      orderBy('createdAt', 'desc'),
      limit(DASHBOARD_QUERY_LIMIT)
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

    // Agrégation manuelle des données pour optimiser les lectures Firestore
    snapshot.forEach(doc => {
      const data = doc.data();
      const amount = data.totalAmount || 0;
      const date = data.createdAt?.toDate();
      const method = normalizePaymentMethod(data.paymentMethod);

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
        if (method === 'mobile') stats.mm += amount;
      } else if (date >= lastMonthStart && date < monthStart) {
        stats.lastMonth += amount;
      }

      // Calcul du temps de préparation moyen
      if (normalizeOrderStatus(data.status) === ORDER_STATUS.SERVIE || normalizeOrderStatus(data.status) === ORDER_STATUS.PAYEE) {
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

    // Récupération des commandes actives
    const activeQuery = query(
      ordersRef,
      where('status', 'in', [ORDER_STATUS.NOUVELLE, ORDER_STATUS.PREPARATION, ORDER_STATUS.PRETE]),
      limit(DASHBOARD_QUERY_LIMIT)
    );
    const activeSnapshot = await getDocs(activeQuery);

    // Analyse des stocks bas
    const inventoryRef = collection(this.db, COLLECTION_NAMES.RESTAURANTS, restaurantId, COLLECTION_NAMES.INVENTORY);
    const lowStockSnapshot = await getDocs(query(inventoryRef, limit(DASHBOARD_QUERY_LIMIT)));
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
    });
  }

  /**
   * Génère les données pour le graphique de tendance des ventes.
   */
  async getSalesTrend(restaurantId: string, days: number = 7) {
    return cachedQuery(`sales-trend:${restaurantId}:${days}`, async () => {
    const startDate = subDays(new Date(), days);
    const ordersRef = collection(
      this.db,
      COLLECTION_NAMES.RESTAURANTS,
      restaurantId,
      COLLECTION_NAMES.ORDERS
    );
    const q = query(
      ordersRef,
      where('paymentStatus', '==', PAYMENT_STATUS.VALIDATED),
      where('createdAt', '>=', Timestamp.fromDate(startDate)),
      orderBy('createdAt', 'asc'),
      limit(DASHBOARD_QUERY_LIMIT)
    );

    const snapshot = await getDocs(q);
    const trendMap: Record<string, number> = {};

    snapshot.forEach(doc => {
      const date = format(doc.data().createdAt.toDate(), 'dd/MM');
      trendMap[date] = (trendMap[date] || 0) + (doc.data().totalAmount || 0);
    });

    return Object.entries(trendMap).map(([name, total]) => ({ name, total }));
    });
  }
}
