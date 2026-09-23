"use client";

import * as React from "react";
import Link from "next/link";
import {
  Play,
  Sparkles,
  ShieldCheck,
  EyeOff,
  FileAudio,
  MessageSquareText,
  CheckCircle2,
  Layers,
  ArrowRight,
  Code2,
  Clock,
  Volume2,
  BrainCircuit,
  Cpu,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrustBadge } from "@/components/ui/trust-badge";

export default function ProductDemoPreview() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-[#E4D9CC] bg-[#FFFDFC] p-6 shadow-surface md:p-8 text-[#2F2924]">
      {/* Top Header of the Live Studio Preview */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E7DED2] pb-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#B85C38] text-white shadow-sm shadow-[#B85C38]/25">
            <Layers className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-[#2F2924] text-base">DEMO_python_loops</h3>
              <Badge variant="warning" className="text-[10px] font-bold">
                DEMO FIXTURE
              </Badge>
              <Badge variant="success" className="text-[10px] font-bold">
                <CheckCircle2 className="mr-1 size-3" /> COMPILED TWIN
              </Badge>
            </div>
            <p className="text-xs text-[#5F554C] mt-0.5">
              Interactive Multimodal Accessibility Twin · 54s duration · 6 Synchronized AD Cues · 4 Disparity Events
            </p>
          </div>
        </div>

        <Link href="/lectures/DEMO_python_loops">
          <Button size="sm" className="gap-2 shadow-sm font-bold bg-[#B85C38] hover:bg-[#9F4F32] text-white cursor-pointer">
            <Play className="size-3.5 fill-current" /> Open Live Studio
          </Button>
        </Link>
      </div>

      {/* Main Grid: Video Player + Timeline + Live Intelligence */}
      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        {/* Left Column: Simulated Central Video Frame & Synchronized Timeline (7 cols) */}
        <div className="space-y-4 lg:col-span-7">
          {/* Simulated Video Frame at 00:26 */}
          <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-[#6F4E37] bg-[#2E2620] p-4 text-[#FFF8F0] shadow-inner flex flex-col justify-between">
            {/* Top Video Overlay Bar */}
            <div className="flex items-center justify-between text-xs text-[#E8DCD1]">
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-[#8FC493]">
                <span className="size-2 rounded-full bg-[#5F8A62] animate-pulse" />
                PLAYING 00:26 / 00:54
              </span>
              <span className="rounded bg-[#3F352E] px-2 py-0.5 text-[10px] text-[#E8DCD1] border border-[#6F4E37]">
                1080p · 30fps
              </span>
            </div>

            {/* Central Visual Code Editor (Actual OCR from DEMO fixture) */}
            <div className="my-auto rounded-xl border border-[#51483F] bg-[#241E1A] p-3.5 font-mono text-xs shadow-md backdrop-blur">
              <div className="mb-2 flex items-center justify-between border-b border-[#3F352E] pb-1.5 text-[10px] text-[#AAB09A]">
                <span className="flex items-center gap-1 text-[#AAA4D1]">
                  <Code2 className="size-3" /> loops_demo.py
                </span>
                <span>OCR Keyframe @ 00:26.0s</span>
              </div>
              <p className="text-[#AAB09A]"># Python for loop demonstration</p>
              <p className="text-[#AAA4D1]">
                fruits = [<span className="text-[#A7D8A9]">&quot;apple&quot;</span>, <span className="text-[#A7D8A9]">&quot;banana&quot;</span>, <span className="text-[#A7D8A9]">&quot;cherry&quot;</span>]
              </p>
              <p className="mt-1 text-[#E6AA68]">
                for <span className="text-[#8DB4D6]">fruit</span> in <span className="text-[#AAA4D1]">fruits</span>:
              </p>
              <p className="pl-4 text-[#8DB4D6]">
                print(<span className="text-[#8DB4D6]">fruit</span>)
              </p>
            </div>

            {/* Bottom Caption & Audible Speech */}
            <div className="rounded-lg bg-[#241E1A]/90 p-2 text-center text-xs text-[#E8DCD1] backdrop-blur border border-[#51483F]">
              <p className="text-[10px] font-bold text-[#AAB09A] uppercase tracking-wider">Spoken Speech (Audible):</p>
              <p className="font-semibold text-[#FFF8F0]">&ldquo;...as we move through the loop, each item is printed in turn.&rdquo;</p>
            </div>
          </div>

          {/* Synchronized Multi-Track Timeline */}
          <div className="rounded-2xl border border-[#E4D9CC] bg-[#FFFDFC] p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-[#2F2924]">
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5 text-[#B85C38]" /> Multimodal Timeline Alignment
              </span>
              <span className="font-mono text-[11px] text-[#5F554C]">00:26 / 00:54</span>
            </div>

            {/* Track 1: Speech */}
            <div className="flex items-center gap-2 text-[10px]">
              <span className="w-16 text-[#7A7067] font-semibold shrink-0">SPEECH</span>
              <div className="relative h-3 flex-1 rounded bg-[#E5EEF5] overflow-hidden border border-[#B8D3E6]">
                <div className="absolute inset-y-0 left-0 w-full bg-[#5B82A6]/20" />
                <div className="absolute inset-y-0 left-[48%] w-1.5 bg-[#B85C38] rounded" />
              </div>
            </div>

            {/* Track 2: Visual OCR */}
            <div className="flex items-center gap-2 text-[10px]">
              <span className="w-16 text-[#7A7067] font-semibold shrink-0">OCR CODE</span>
              <div className="relative h-3 flex-1 rounded bg-[#E2EFED] overflow-hidden border border-[#B2D6D3]">
                <div className="absolute inset-y-0 left-0 w-[20%] bg-[#5F9A9A]/40" />
                <div className="absolute inset-y-0 left-[25%] w-[18%] bg-[#5F9A9A]/40" />
                <div className="absolute inset-y-0 left-[50%] w-[25%] bg-[#5F9A9A]/40" />
                <div className="absolute inset-y-0 left-[75%] w-[20%] bg-[#5F9A9A]/40" />
              </div>
            </div>

            {/* Track 3: Audio Description (6 Cues) */}
            <div className="flex items-center gap-2 text-[10px]">
              <span className="w-16 text-[#7A7067] font-semibold shrink-0 flex items-center gap-0.5">
                <Volume2 className="size-2.5 text-[#5F8A62]" /> AD LAYER
              </span>
              <div className="relative h-3 flex-1 rounded bg-[#E4F0E5] overflow-hidden border border-[#B9D2BC]">
                <div className="absolute inset-y-0 left-0 w-[8%] bg-[#5F8A62]/70 rounded" title="Cue 1: 00:00 - 00:04.5" />
                <div className="absolute inset-y-0 left-[25%] w-[8%] bg-[#5F8A62]/70 rounded" title="Cue 2: 00:13.5 - 00:18" />
                <div className="absolute inset-y-0 left-[50%] w-[8%] bg-[#5F8A62]/70 rounded" title="Cue 3: 00:27 - 00:31.5" />
                <div className="absolute inset-y-0 left-[75%] w-[8%] bg-[#5F8A62]/70 rounded" title="Cue 4: 00:40.5 - 00:45" />
                <div className="absolute inset-y-0 left-[83%] w-[8%] bg-[#5F8A62]/70 rounded" title="Cue 5: 00:45 - 00:49.5" />
                <div className="absolute inset-y-0 left-[91%] w-[8%] bg-[#5F8A62]/70 rounded" title="Cue 6: 00:49.5 - 00:54" />
              </div>
            </div>

            {/* Track 4: Interaction Events Layer */}
            <div className="flex items-center gap-2 text-[10px]">
              <span className="w-16 text-[#7A7067] font-semibold shrink-0 flex items-center gap-0.5 text-[#B85C38]">
                <Sparkles className="size-2.5 text-[#C49A5A]" /> EVENTS
              </span>
              <div className="relative h-3 flex-1 rounded bg-[#EDE2D3] overflow-hidden border border-[#DDD0C0]">
                <div className="absolute inset-y-0 left-[7.4%] w-2 bg-[#B85C38] rounded-full ring-1 ring-white" title="04.0s: OCR Code Event" />
                <div className="absolute inset-y-0 left-[26.8%] w-2 bg-[#B77932] rounded-full ring-1 ring-white" title="14.5s: Disparity Gap Detected" />
                <div className="absolute inset-y-0 left-[49.0%] w-2 bg-[#5F8A62] rounded-full ring-1 ring-white" title="26.5s: Synchronized AD Cue #3" />
                <div className="absolute inset-y-0 left-[66.6%] w-2 bg-[#6C63A8] rounded-full ring-1 ring-white" title="36.0s: Grounded Ask AI" />
                <div className="absolute inset-y-0 left-[88.8%] w-2 bg-[#B85C38] rounded-full ring-1 ring-white" title="48.0s: Accessibility Health Score" />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Real Accessibility Intelligence Cards (5 cols) */}
        <div className="space-y-4 lg:col-span-5">
          {/* Card 1: What Am I Missing? (The Core Disparity Formula) */}
          <div className="rounded-2xl border border-[#E3C59D] bg-[#F6E9D6] p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold text-[#8A5A25]">
                <EyeOff className="size-4 text-[#B77932]" /> What Am I Missing?
              </span>
              <Badge variant="warning" className="text-[10px] font-bold">
                ACCESSIBILITY GAP
              </Badge>
            </div>

            {/* Visual Formula Callout */}
            <div className="rounded-lg bg-[#FFFDFC] p-2 text-[10px] text-[#8A5A25] font-mono border border-[#E3C59D] flex items-center justify-between">
              <span>SHOWN (Code) + NOT SPOKEN</span>
              <span className="font-bold text-[#B77932]">➔ GAP DETECTED</span>
            </div>

            <p className="text-xs text-[#2F2924] font-semibold leading-snug">
              Visual loop syntax written on slide without explicit verbal description.
            </p>
            <div className="rounded-lg bg-[#FFFDFC] p-2.5 text-[11px] text-[#2F2924] font-mono border border-[#E3C59D]">
              for fruit in fruits: print(fruit)
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#8A5A25] pt-1">
              <span>Timestamp: <strong>00:26 – 00:31</strong></span>
              <Link href="/lectures/DEMO_python_loops?tab=missing" className="font-bold text-[#B85C38] hover:underline flex items-center gap-1">
                Watch Moment <ArrowRight className="size-3" />
              </Link>
            </div>
          </div>

          {/* Card 2: Grounded Q&A Assistant with GenAI Reasoning */}
          <div className="rounded-2xl border border-[#C8C3DF] bg-[#E8E6F4] p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold text-[#554F86]">
                <MessageSquareText className="size-4 text-[#6C63A8]" /> Grounded Ask AI
              </span>
              <TrustBadge trust="VERIFIED" compact />
            </div>
            <p className="text-xs font-semibold text-[#2F2924]">
              Q: &ldquo;What is inside the fruits list?&rdquo;
            </p>
            <div className="rounded-lg bg-[#FFFDFC] p-2.5 text-xs text-[#51483F] border border-[#C8C3DF] leading-relaxed space-y-1">
              <div className="flex items-center gap-1 text-[11px] font-bold text-[#416A47]">
                <ShieldCheck className="size-3.5 text-[#5F8A62]" /> VERIFIED EVIDENCE
              </div>
              <p>The list contains three strings: <code className="bg-[#F1E8DC] text-[#2F2924] px-1 py-0.5 rounded text-[11px] font-mono font-bold">&quot;apple&quot;, &quot;banana&quot;, &quot;cherry&quot;</code>.</p>
              <div className="flex items-center gap-2 pt-1 text-[10px] text-[#7A7067]">
                <span className="rounded bg-[#EDE2D3] px-1.5 py-0.5 font-mono font-semibold">OCR Citation: [00:00 – 00:05]</span>
              </div>
            </div>
          </div>

          {/* Card 3: Accessibility Health Scorecard */}
          <div className="flex items-center justify-between rounded-2xl border border-[#B9D2BC] bg-[#E4F0E5] p-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#416A47]">100% Accessibility Health Score</p>
              <div className="mt-0.5 flex items-baseline gap-2">
                <span className="text-2xl font-black text-[#416A47]">100%</span>
                <span className="text-xs font-bold text-[#5F8A62]">HIGH AUDIT SCORE</span>
              </div>
              <p className="text-[10px] text-[#51483F] mt-0.5">
                80% Baseline + 20% Verified Remediation (EduAccess Health methodology)
              </p>
            </div>
            <Link href="/lectures/DEMO_python_loops?tab=report">
              <Button size="sm" variant="secondary" className="border-[#B9D2BC] bg-[#FFFDFC] text-[#416A47] hover:bg-[#D2E7D4] text-xs font-bold cursor-pointer">
                View Audit
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
