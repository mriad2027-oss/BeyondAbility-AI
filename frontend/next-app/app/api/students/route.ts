import { NextResponse } from "next/server";
import { getDemoStudents } from "@/lib/demoStore";

export async function GET() {
  return NextResponse.json(getDemoStudents());
}
