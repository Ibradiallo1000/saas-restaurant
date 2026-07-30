export const ORDER_CREATION_POLICIES = Object.freeze({
  schemaVersion: 1,
  maxLines: 50,
  maxPublicQuantity: 99,
  maxStaffQuantity: 999,
  idempotencyRetentionDays: 7,
  maxInstructionsLength: 500,
  maxNotesLength: 1000,
  maxCustomerNameLength: 120,
  maxPhoneLength: 32,
  maxAddressLength: 500,
  allowedStaffRoles: new Set(["owner", "manager", "cashier", "server"]),
})
