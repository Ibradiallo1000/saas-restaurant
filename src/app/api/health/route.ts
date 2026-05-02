import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: process.env.APP_ENV ?? process.env.NODE_ENV ?? "unknown",
  })
}
