import { NextResponse } from "next/server"

import { customerMarketingAssistant } from "@/ai/flows/customer-marketing-assistant"

export async function POST(request: Request) {
  try {
    const input = await request.json()
    const result = await customerMarketingAssistant(input)
    return NextResponse.json(result)
  } catch (error) {
    console.error("customer marketing assistant failed:", error)
    return NextResponse.json(
      { error: "Unable to generate customer marketing analysis." },
      { status: 500 }
    )
  }
}
