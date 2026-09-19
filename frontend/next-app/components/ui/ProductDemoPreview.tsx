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
    <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-b from-white via-white to-slate-50/60 p-6 shadow-md md:p-8">
      {/* Top Header of the Live Studio Preview */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-brand-indigo text-white shadow-sm shadow-brand-indigo/30">
            <Layers className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900">DEMO_python_loops</h3>
              <Badge variant="warning" className="text-[10px] font-bold">
                DEMO FIXTURE
              </Badge>
              <Badge variant="success" className="text-[10px] font-semibold">
                <CheckCircle2 className="mr-1 size-3" /> COMPILED TWIN
              </Badge>
            </div>
            <p className="text-xs text-slate-500">
              Interactive Multimodal Accessibility Twin · 54s duration · 6 Synchronized AD Cues · 4 Disparity Events
            </p>
          </div>
        </div>

        <Link href="/lectures/DEMO_python_loops">
          <Button size="sm" className="gap-2 shadow-sm font-semibold">
            <Play className="size-3.5 fill-current" /> Open Live Studio
          </Button>
        </Link>
      </div>

      {/* Main Grid: Video Player + Timeline + Live Intelligence */}
      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        {/* Left Column: Simulated Central Video Frame & Synchronized Timeline (7 cols) */}
        <div className="space-y-4 lg:col-span-7">
          {/* Simulated Video Frame at 00:26 */}
          <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-4 text-white shadow-inner flex flex-col justify-between">
            {/* Top Video Overlay Bar */}
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-emerald-400">
                <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                PLAYING 00:26 / 00:54
              </span>
              <span className="rounded bg-slate-800/80 px-2 py-0.5 text-[10px] text-slate-300">
                1080p · 30fps
              </span>
            </div>

            {/* Central Visual Code Editor (Actual OCR from DEMO fixture) */}
            <div className="my-auto rounded-xl border border-slate-700/60 bg-slate-900/95 p-3.5 font-mono text-xs shadow-lg backdrop-blur">
              <div className="mb-2 flex items-center justify-between border-b border-slate-700/50 pb-1.5 text-[10px] text-slate-400">
                <span className="flex items-center gap-1 text-indigo-400">
                  <Code2 className="size-3" /> loops_demo.py
                </span>
                <span className="text-slate-400">OCR Keyframe @ 00:26.0s</span>
              </div>
              <p className="text-slate-400"># Python for loop demonstration</p>
              <p className="text-purple-300">
                fruits = [<span className="text-emerald-300">&quot;apple&quot;</span>, <span className="text-emerald-300">&quot;banana&quot;</span>, <span className="text-emerald-300">&quot;cherry&quot;</span>]
              </p>
              <p className="mt-1 text-amber-300">
                for <span className="text-sky-300">fruit</span> in <span className="text-purple-300">fruits</span>:
              </p>
              <p className="pl-4 text-sky-200">
                print(<span className="text-sky-300">fruit</span>)
              </p>
            </div>

            {/* Bottom Caption & Audible Speech */}
            <div className="rounded-lg bg-slate-900/90 p-2 text-center text-xs text-slate-200 backdrop-blur border border-slate-700/50">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Spoken Speech (Audible):</p>
              <p className="font-medium text-white">&ldquo;...as we move through the loop, each item is printed in turn.&rdquo;</p>
            </div>
          </div>

          {/* Synchronized Multi-Track Timeline */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5 text-brand-indigo" /> Multimodal Timeline Alignment
              </span>
              <span className="font-mono text-[11px] text-slate-500">00:26 / 00:54</span>
            </div>

            {/* Track 1: Speech */}
            <div className="flex items-center gap-2 text-[10px]">
              <span className="w-16 text-slate-500 font-medium shrink-0">SPEECH</span>
              <div className="relative h-3 flex-1 rounded bg-slate-100 overflow-hidden">
                <div className="absolute inset-y-0 left-0 w-full bg-blue-500/20" />
                <div className="absolute inset-y-0 left-[48%] w-1.5 bg-brand-indigo rounded" />
              </div>
            </div>

            {/* Track 2: Visual OCR */}
            <div className="flex items-center gap-2 text-[10px]">
              <span className="w-16 text-slate-500 font-medium shrink-0">OCR CODE</span>
              <div className="relative h-3 flex-1 rounded bg-slate-100 overflow-hidden">
                <div className="absolute inset-y-0 left-0 w-[20%] bg-purple-500/40" />
                <div className="absolute inset-y-0 left-[25%] w-[18%] bg-purple-500/40" />
                <div className="absolute inset-y-0 left-[50%] w-[25%] bg-purple-500/40" />
                <div className="absolute inset-y-0 left-[75%] w-[20%] bg-purple-500/40" />
              </div>
            </div>

            {/* Track 3: Audio Description (6 Cues) */}
            <div className="flex items-center gap-2 text-[10px]">
              <span className="w-16 text-slate-500 font-medium shrink-0 flex items-center gap-0.5">
                <Volume2 className="size-2.5 text-emerald-600" /> AD LAYER
              </span>
              <div className="relative h-3 flex-1 rounded bg-slate-100 overflow-hidden">
                <div className="absolute inset-y-0 left-0 w-[8%] bg-emerald-500/70 rounded" title="Cue 1: 00:00 - 00:04.5" />
                <div className="absolute inset-y-0 left-[25%] w-[8%] bg-emerald-500/70 rounded" title="Cue 2: 00:13.5 - 00:18" />
                <div className="absolute inset-y-0 left-[50%] w-[8%] bg-emerald-500/70 rounded" title="Cue 3: 00:27 - 00:31.5" />
                <div className="absolute inset-y-0 left-[75%] w-[8%] bg-emerald-500/70 rounded" title="Cue 4: 00:40.5 - 00:45" />
                <div className="absolute inset-y-0 left-[83%] w-[8%] bg-emerald-500/70 rounded" title="Cue 5: 00:45 - 00:49.5" />
                <div className="absolute inset-y-0 left-[91%] w-[8%] bg-emerald-500/70 rounded" title="Cue 6: 00:49.5 - 00:54" />
              </div>
            </div>

            {/* Track 4: Interaction Events Layer */}
            <div className="flex items-center gap-2 text-[10px]">
              <span className="w-16 text-slate-500 font-medium shrink-0 flex items-center gap-0.5 text-brand-indigo">
                <Sparkles className="size-2.5 text-amber-500" /> EVENTS
              </span>
              <div className="relative h-3 flex-1 rounded bg-slate-100 overflow-hidden">
                <div className="absolute inset-y-0 left-[7.4%] w-2 bg-brand-indigo rounded-full ring-1 ring-amber-400" title="04.0s: OCR Code Event" />
                <div className="absolute inset-y-0 left-[26.8%] w-2 bg-amber-500 rounded-full ring-1 ring-white" title="14.5s: Disparity Gap Detected" />
                <div className="absolute inset-y-0 left-[49.0%] w-2 bg-emerald-500 rounded-full ring-1 ring-white" title="26.5s: Synchronized AD Cue #3" />
                <div className="absolute inset-y-0 left-[66.6%] w-2 bg-violet-600 rounded-full ring-1 ring-amber-400 animate-pulse" title="36.0s: Grounded Ask AI" />
                <div className="absolute inset-y-0 left-[88.8%] w-2 bg-indigo-600 rounded-full ring-1 ring-emerald-400" title="48.0s: Accessibility Health Score" />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Real Accessibility Intelligence Cards (5 cols) */}
        <div className="space-y-4 lg:col-span-5">
          {/* Card 1: What Am I Missing? (The Core Disparity Formula) */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
                <EyeOff className="size-4 text-amber-600" /> What Am I Missing?
              </span>
              <Badge variant="warning" className="text-[10px] font-semibold">
                ACCESSIBILITY GAP
              </Badge>
            </div>

            {/* Visual Formula Callout */}
            <div className="rounded-lg bg-white/90 p-2 text-[10px] text-amber-950 font-mono border border-amber-200/80 flex items-center justify-between">
              <span>SHOWN (Code) + NOT SPOKEN</span>
              <span className="font-bold text-amber-700">➔ GAP DETECTED</span>
            </div>

            <p className="text-xs text-amber-950 font-semibold leading-snug">
              Visual loop syntax written on slide without explicit verbal description.
            </p>
            <div className="rounded-lg bg-white/90 p-2.5 text-[11px] text-slate-800 font-mono border border-amber-200/60">
              for fruit in fruits: print(fruit)
            </div>
            <div className="flex items-center justify-between text-[11px] text-amber-900 pt-1">
              <span>Timestamp: <strong>00:26 – 00:31</strong></span>
              <Link href="/lectures/DEMO_python_loops?tab=missing" className="font-semibold text-brand-indigo hover:underline flex items-center gap-1">
                Watch Moment <ArrowRight className="size-3" />
              </Link>
            </div>
          </div>

          {/* Card 2: Grounded Q&A Assistant with GenAI Reasoning */}
          <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold text-violet-950">
                <MessageSquareText className="size-4 text-violet-600" /> Grounded Ask AI
              </span>
              <TrustBadge trust="VERIFIED" compact />
            </div>
            <p className="text-xs font-medium text-slate-800">
              Q: &ldquo;What is inside the fruits list?&rdquo;
            </p>
            <div className="rounded-lg bg-white/95 p-2.5 text-xs text-slate-700 border border-violet-200/60 leading-relaxed space-y-1">
              <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                <ShieldCheck className="size-3.5" /> VERIFIED EVIDENCE
              </div>
              <p>The list contains three strings: <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px] font-mono">&quot;apple&quot;, &quot;banana&quot;, &quot;cherry&quot;</code>.</p>
              <div className="flex items-center gap-2 pt-1 text-[10px] text-slate-500">
                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono">OCR Citation: [00:00 – 00:05]</span>
              </div>
            </div>
          </div>

          {/* Card 3: Accessibility Health Scorecard */}
          <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">100% Accessibility Health Score</p>
              <div className="mt-0.5 flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-emerald-950">100%</span>
                <span className="text-xs font-semibold text-emerald-700">HIGH AUDIT SCORE</span>
              </div>
              <p className="text-[10px] text-emerald-800/80 mt-0.5">
                80% Baseline + 20% Verified Remediation (EduAccess Health methodology)
              </p>
            </div>
            <Link href="/lectures/DEMO_python_loops?tab=report">
              <Button size="sm" variant="secondary" className="border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-50 text-xs font-semibold">
                View Audit
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
