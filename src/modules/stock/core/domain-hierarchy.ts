export const STOCK_DOMAIN_HIERARCHY = {
  stock: {
    owns: ["stock_items", "stock_positions", "stock_movements", "stock_counts", "losses", "internal_uses", "zones", "transfers"],
    mayDependOn: ["settings", "authorization", "validation"],
  },
  production: {
    owns: ["product_tracking", "recipes", "recipe_versions", "preparations", "preparation_batches"],
    mayDependOn: ["stock_item_references", "settings", "authorization"],
  },
  supply: {
    owns: ["suppliers", "purchase_needs", "supplier_orders", "receptions", "supplier_returns", "supplier_finance"],
    mayDependOn: ["stock_item_references", "settings", "authorization", "validation"],
  },
  reporting: {
    owns: ["operational_projections", "analytical_projections", "data_quality_indicators"],
    mayDependOn: ["published_events", "published_read_contracts"],
  },
  settings: {
    owns: ["units", "packaging_policies", "reasons", "thresholds", "validation_policies", "capability_policies", "feature_activation"],
    mayDependOn: ["restaurant_identity"],
  },
} as const

export type StockDomainName = keyof typeof STOCK_DOMAIN_HIERARCHY

export const STOCK_DOMAIN_DEPENDENCY_RULES = [
  "Domains never write another domain's internal state.",
  "Stock is the sole owner of physical quantities.",
  "Production emits consumption intents and never mutates stock directly.",
  "Supply validates physical receipts and never mutates stock directly.",
  "Reporting consumes published contracts and is never authoritative.",
  "Settings affect future decisions and never reinterpret history.",
] as const
