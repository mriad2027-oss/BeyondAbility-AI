import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    tools: [
      { name: "seek_video", description: "Seek video player to specific timestamp", parameters: { timestamp: "number" } },
      { name: "read_captions", description: "Read captions or transcript snippet", parameters: { start: "number", end: "number" } },
      { name: "describe_screen", description: "Provide visual description for video timestamp", parameters: { timestamp: "number" } },
      { name: "launch_quiz", description: "Open interactive comprehension quiz", parameters: { quiz_id: "string" } },
    ],
  });
}
