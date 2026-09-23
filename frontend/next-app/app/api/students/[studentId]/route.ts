import { NextRequest, NextResponse } from "next/server";
import { getDemoStudentDetail } from "@/lib/demoStore";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { studentId } = await params;
  return NextResponse.json(getDemoStudentDetail(studentId));
}
