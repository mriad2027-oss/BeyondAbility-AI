import { NextRequest, NextResponse } from "next/server";
import { getDemoQuiz } from "@/lib/demoStore";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  const { quizId } = await params;
  return NextResponse.json(getDemoQuiz(quizId));
}
