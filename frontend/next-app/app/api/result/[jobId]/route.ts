import { NextRequest, NextResponse } from "next/server";
import { getDemoJob } from "@/lib/demoStore";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const job = getDemoJob(jobId);
  if (!job) {
    return NextResponse.json({ detail: `Job ${jobId} not found` }, { status: 404 });
  }
  return NextResponse.json(job);
}
