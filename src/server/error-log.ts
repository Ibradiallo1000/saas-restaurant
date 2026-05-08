import { FieldValue } from "firebase-admin/firestore"

import { getAdminFirestore } from "@/server/firebase-admin"

interface WriteErrorLogInput {
  message: string
  stack?: string
  context?: Record<string, unknown>
}

export async function writeErrorLog(input: WriteErrorLogInput) {
  await getAdminFirestore()
    .collection("error_logs")
    .add({
      message: input.message,
      ...(input.stack ? { stack: input.stack } : {}),
      ...(input.context ? { context: sanitizeContext(input.context) } : {}),
      createdAt: FieldValue.serverTimestamp(),
    })
}

export async function writeCaughtErrorLog(error: unknown, context?: Record<string, unknown>) {
  const normalizedError = normalizeError(error)

  await writeErrorLog({
    message: normalizedError.message,
    stack: normalizedError.stack,
    context,
  }).catch((logError) => {
    console.error("ERROR_LOG_WRITE_FAILED", logError)
  })
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
    }
  }

  return {
    message: String(error),
    stack: undefined,
  }
}

function sanitizeContext(context: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(context))
}
