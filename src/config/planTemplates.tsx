export const PLAN_TEMPLATES = {
  starter: {
    name: "Starter",
    price: 15000,
    features: {
      pos: true,
      analytics: false,
      multiUser: false,
      ai: false,
    },
    limits: {
      maxUsers: 1,
      maxOrdersPerMonth: 100,
    },
  },

  pro: {
    name: "Pro",
    price: 50000,
    features: {
      pos: true,
      analytics: true,
      multiUser: true,
      ai: false,
    },
    limits: {
      maxUsers: 5,
      maxOrdersPerMonth: 0,
    },
  },

  enterprise: {
    name: "Enterprise",
    price: 100000,
    features: {
      pos: true,
      analytics: true,
      multiUser: true,
      ai: true,
    },
    limits: {
      maxUsers: 999,
      maxOrdersPerMonth: 0,
    },
  },
}