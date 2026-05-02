import { FieldValue } from "firebase-admin/firestore"

import { getAdminFirestore } from "@/server/firebase-admin"
import type { AuditAction } from "@/types"

interface WriteAuditLogInput {
  action: AuditAction
  actorId: string
  targetId: string
  metadata?: Record<string, unknown>
}

export async function writeAuditLog(input: WriteAuditLogInput) {
  await getAdminFirestore()
    .collection("audit_logs")
    .add({
      action: input.action,
      actorId: input.actorId,
      targetId: input.targetId,
      ...(input.metadata ? { metadata: input.metadata } : {}),
      createdAt: FieldValue.serverTimestamp(),
    })
}
