
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  OWNER: 'owner',
  MANAGER: 'manager',
  ACCOUNTANT: 'accountant',
  CASHIER: 'cashier',
  KITCHEN: 'kitchen',
  SERVER: 'server',
} as const;

export type UserRole = typeof ROLES[keyof typeof ROLES];

export const SUBSCRIPTION_STATUS = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  SUSPENDED: 'suspended',
} as const;

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

export const SESSION_STATUS = {
  OPENED: 'opened',
  CLOSED: 'closed',
  VALIDATED: 'validated',
} as const;

export const COLLECTION_NAMES = {
  PLATFORM: 'platform',
  PLATFORM_USERS: 'platformUsers',
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
  CASHIER_SESSIONS: 'cashierSessions',
  INVOICES: 'invoices',
  CONTACT_REQUESTS: 'contactRequests',
} as const;
