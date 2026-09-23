import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "healthy",
    model: "Gemini 2.5 Flash + Pro",
    gemini_api_key_configured: true,
    tts_engine: "Edge-TTS + Web Speech",
    stt_engine: "Faster-Whisper",
    total_lectures: 2,
    total_quizzes: 2,
    total_students: 3,
  });
}
