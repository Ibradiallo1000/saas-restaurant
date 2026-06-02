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
  GRACE: 'grace',
  EXPIRED: 'expired',
  SUSPENDED: 'suspended',
  LIFETIME: 'lifetime',
} as const;

export type SubscriptionStatus =
  typeof SUBSCRIPTION_STATUS[keyof typeof SUBSCRIPTION_STATUS];

export const SUBSCRIPTION_STATUS_LABELS = {
  [SUBSCRIPTION_STATUS.TRIAL]: 'Essai',
  [SUBSCRIPTION_STATUS.ACTIVE]: 'Actif',
  [SUBSCRIPTION_STATUS.GRACE]: 'Tolerance',
  [SUBSCRIPTION_STATUS.EXPIRED]: 'Expire',
  [SUBSCRIPTION_STATUS.SUSPENDED]: 'Suspendu',
  [SUBSCRIPTION_STATUS.LIFETIME]: 'Illimite',
} as const;

export const SUBSCRIPTION_PLAN = {
  TRIAL: 'trial',
  BASIC: 'basic',
  PRO: 'pro',
  CUSTOM: 'custom',
  BUSINESS: 'business',
} as const;

export const SUBSCRIPTION_PLAN_LABELS = {
  [SUBSCRIPTION_PLAN.TRIAL]: 'Essai',
  [SUBSCRIPTION_PLAN.BASIC]: 'Basic',
  [SUBSCRIPTION_PLAN.PRO]: 'Pro',
  [SUBSCRIPTION_PLAN.CUSTOM]: 'Custom',
  [SUBSCRIPTION_PLAN.BUSINESS]: 'Business',
} as const;


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

export const ORDER_SOURCE = {
  CLIENT: 'client',
  QR: 'qr',
  MANUAL: 'manual',
  POS: 'pos',
} as const;

export const ORDER_TYPE = {
  DINE_IN: 'table',
  TABLE: 'table',
  TAKEAWAY: 'takeaway',
  DELIVERY: 'delivery',
  ROOM_SERVICE: 'room',
} as const;

export const POS_SESSION_STATUS = {
  OPEN: 'open',
  OPENED: 'opened',
  CLOSED: 'closed',
  VALIDATED: 'validated',
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
  OPEN: 'open',
  OPENED: 'opened',
  CLOSED: 'closed',
  VALIDATED: 'validated',
} as const;


// ===============================
// 🔥 COLLECTIONS (CORRIGÉ)
// ===============================

export const COLLECTION_NAMES = {
  PLATFORM: 'platform',
  PLATFORM_SETTINGS: 'platformSettings',
  PLATFORM_MEDIA: 'platformMedia',
  PLATFORM_COUNTRIES: 'platformCountries',
  PLATFORM_PAYMENT_METHODS: 'platformPaymentMethods',
  PLATFORM_PAYMENT_VARIANTS: 'platformPaymentVariants',
  PLATFORM_MENU_PACKS: 'platformMenuPacks',
  PLATFORM_MENU_CATEGORIES: 'platformMenuCategories',
  PLATFORM_MENU_PRODUCTS: 'platformMenuProducts',
  RESTAURANT_PAYMENT_CONFIGS: 'restaurantPaymentConfigs',

  // 🔥 séparation claire
  USERS: 'users',                 // ← restaurant users

  PLANS: 'plans',
  SUBSCRIPTIONS: 'subscriptions',
  REQUESTS: 'requests',

  RESTAURANTS: 'restaurants',
  MENUS: 'menus',
  PRODUCTS: 'products',
  ORDERS: 'orders',
  ORDER_ITEMS: 'orderItems',
  PAYMENTS: 'payments',
  CASH_MOVEMENTS: 'cashMovements',
  TREASURY_ACCOUNTS: 'treasuryAccounts',
  EXPENSES: 'expenses',
  EXPENSE_LOGS: 'expenseLogs',
  SUPPLIERS: 'suppliers',
  SUPPLIER_PAYMENTS: 'supplierPayments',
  INVENTORY_MOVEMENTS: 'inventoryMovements',
  INVENTORY: 'inventory',
  CUSTOMERS: 'customers',
  TABLES: 'tables',
  TABLE_SESSIONS: 'tableSessions',
  VISITS: 'visits',
  ROOMS: 'rooms',
  REVIEWS: 'reviews',
  CASHIER_SESSIONS: 'cashierSessions',
  CASH_SESSIONS: 'cashSessions',
  INVOICES: 'invoices',
  CONTACT_REQUESTS: 'contactRequests',
  ERROR_LOGS: 'errorLogs',
  COMPANIES: 'companies',
} as const;
