import { NextResponse } from "next/server";
import { getDemoLectures } from "@/lib/demoStore";

function demoEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_DEMO_MODE === "1";
}

export async function GET() {
  if (!demoEnabled()) {
    return NextResponse.json(
      { lectures: [], detail: "Demo fixtures are not enabled. Use the real backend API." },
      { status: 501 }
    );
  }
  return NextResponse.json({
    lectures: getDemoLectures(),
  });
}
