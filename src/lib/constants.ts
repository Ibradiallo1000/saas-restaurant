export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  OWNER: 'owner',
  MANAGER: 'manager',
  CASHIER: 'cashier',
  KITCHEN: 'kitchen',
  SERVER: 'server',
} as const;

export type UserRole = typeof ROLES[keyof typeof ROLES];

export const ORDER_STATUS = {
  PENDING: 'pending',
  PREPARING: 'preparing',
  READY: 'ready',
  SERVED: 'served',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
} as const;

export const PAYMENT_STATUS = {
  UNPAID: 'unpaid',
  PARTIAL: 'partial',
  PAID: 'paid',
} as const;

export const ORDER_TYPES = {
  TABLE: 'table',
  ROOM: 'room',
  TAKEAWAY: 'takeaway',
  DELIVERY: 'delivery',
} as const;

export const COLLECTION_NAMES = {
  PLANS: 'plans',
  RESTAURANTS: 'restaurants',
  USERS: 'users',
  MENUS: 'menus',
  PRODUCTS: 'products',
  ORDERS: 'orders',
  ORDER_ITEMS: 'orderItems',
  INVENTORY: 'inventory',
  CUSTOMERS: 'customers',
  TABLES: 'tables',
  ROOMS: 'rooms',
  REVIEWS: 'reviews',
} as const;
