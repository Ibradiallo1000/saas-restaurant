export const STOCK_NAMING_CONVENTIONS = {
  modulePrefix: "stock",
  commandSuffix: "Command",
  eventTense: "past",
  eventContractVersion: 1,
  commandContractVersion: 1,
  resultContractVersion: 1,
  capabilitySeparator: ".",
  idempotencySeparator: ":",
  aggregateNames: "singular PascalCase",
  commandNames: "imperative PascalCase",
  eventNames: "past-tense PascalCase",
  capabilityNames: "dot-separated lowercase domain.resource.action",
} as const
