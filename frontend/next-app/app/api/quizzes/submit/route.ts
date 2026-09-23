import { NextRequest, NextResponse } from "next/server";
import { submitDemoQuiz } from "@/lib/demoStore";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = submitDemoQuiz(body);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ detail: e.message || "Invalid payload" }, { status: 400 });
  }
}
