/**
 * @fileOverview Définition des constantes globales du système.
 */

// ===============================
// 🔹 ROLES
// ===============================

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

export const RESTAURANT_ROLES = {
  OWNER: ROLES.OWNER,
  MANAGER: ROLES.MANAGER,
  CASHIER: ROLES.CASHIER,
  KITCHEN: ROLES.KITCHEN,
  SERVER: ROLES.SERVER,
} as const;


// ===============================
// 🔥 SUBSCRIPTIONS
// ===============================

export const SUBSCRIPTION_STATUS = {
  TRIAL: 'trial',          // 🔥 AJOUT CRITIQUE
  ACTIVE: 'active',
  EXPIRED: 'expired',
  SUSPENDED: 'suspended',
} as const;

export type SubscriptionStatus =
  typeof SUBSCRIPTION_STATUS[keyof typeof SUBSCRIPTION_STATUS];


// ===============================
// 🔹 ORDERS
// ===============================

export const ORDER_STATUS = {
  NOUVELLE: 'nouvelle',
  PREPARATION: 'preparation',
  PRETE: 'prete',
  SERVIE: 'servie',
  PAYEE: 'payee',
} as const;

export const DEFAULT_GRACE_DAYS = 7;


// ===============================
// 🔹 PAYMENTS
// ===============================

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  VALIDATED: 'validated',
} as const;


// ===============================
// 🔹 SESSIONS
// ===============================

export const SESSION_STATUS = {
  OPENED: 'opened',
  CLOSED: 'closed',
  VALIDATED: 'validated',
} as const;


// ===============================
// 🔥 COLLECTIONS (CORRIGÉ)
// ===============================

export const COLLECTION_NAMES = {
  PLATFORM: 'platform',
  PLATFORM_COUNTRIES: 'platformCountries',
  PLATFORM_PAYMENT_METHODS: 'platformPaymentMethods',
  PLATFORM_PAYMENT_VARIANTS: 'platformPaymentVariants',
  RESTAURANT_PAYMENT_CONFIGS: 'restaurantPaymentConfigs',

  // 🔥 séparation claire
  USERS: 'users',                 // ← restaurant users

  PLANS: 'plans',
  SUBSCRIPTIONS: 'subscriptions',

  RESTAURANTS: 'restaurants',
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
  COMPANIES: 'companies',
} as const;
