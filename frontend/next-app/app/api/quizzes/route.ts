import { NextResponse } from "next/server";
import { getDemoQuizzes } from "@/lib/demoStore";

export async function GET() {
  return NextResponse.json(getDemoQuizzes());
}
