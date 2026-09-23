import { NextRequest, NextResponse } from "next/server";
import { chatDemoAssistant } from "@/lib/demoStore";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = chatDemoAssistant(body);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ detail: e.message || "Chat failed" }, { status: 400 });
  }
}
