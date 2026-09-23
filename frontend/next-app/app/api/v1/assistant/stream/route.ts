import { NextRequest } from "next/server";
import { chatDemoAssistant } from "@/lib/demoStore";

export async function POST(req: NextRequest) {
  let payload: any = {};
  try {
    payload = await req.json();
  } catch {
    payload = { message: "Hello" };
  }

  const demoResp = chatDemoAssistant(payload);
  const words = demoResp.reply.split(" ");

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for (let i = 0; i < words.length; i++) {
        const chunk = {
          token: words[i] + (i < words.length - 1 ? " " : ""),
          done: i === words.length - 1,
          action: i === words.length - 1 ? (demoResp.action ?? null) : null,
          action_payload: i === words.length - 1 ? (demoResp.action_payload ?? null) : null,
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        await new Promise((r) => setTimeout(r, 25));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
