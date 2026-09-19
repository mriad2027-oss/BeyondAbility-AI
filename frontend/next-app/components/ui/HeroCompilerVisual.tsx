"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import {
  Video,
  Mic,
  Eye,
  ScanText,
  GitCompareArrows,
  AlertTriangle,
  Volume2,
  BrainCircuit,
  ShieldCheck,
  Cpu,
  Activity,
  Layers,
  Sparkles,
  Play,
  RotateCw,
  Sliders,
  CheckCircle2,
} from "lucide-react";
import { cn, formatClock } from "@/lib/format";

export interface CompilerPipelineStage {
  id: string;
  step: string;
  label: string;
  subtitle: string;
  category: "input" | "decompile" | "alignment" | "reasoning" | "remediation" | "twin";
  icon: typeof Video;
  color: string;
  glow: string;
  ring: string;
  textColor: string;
  pulseClass: string;
  telemetry: {
    title: string;
    timestamp: string;
    metrics: string;
    detail: string;
    code?: string;
    spoken?: string;
    action?: string;
  };
}

export const COMPILER_STAGES: CompilerPipelineStage[] = [
  {
    id: "video",
    step: "01",
    label: "Raw Educational Video",
    subtitle: "MP4 Ingestion & Frame Demuxing",
    category: "input",
    icon: Video,
    color: "from-rose-500/20 to-pink-600/20 border-rose-500/40 text-rose-400",
    glow: "rgba(220, 38, 38, 0.2)",
    ring: "ring-rose-500/30",
    textColor: "text-rose-400",
    pulseClass: "pulse-critical",
    telemetry: {
      title: "Input Lecture Stream: DEMO_python_loops",
      timestamp: "00:00.0 → 00:54.0",
      metrics: "1080p · 30 FPS · Stereo 44.1kHz",
      detail: "Demuxed 54.0s Python Loops lecture with synchronized stereo audio & 30fps frames.",
    },
  },
  {
    id: "speech",
    step: "02",
    label: "Whisper STT Transcription",
    subtitle: "Timestamped Speech Tokens",
    category: "decompile",
    icon: Mic,
    color: "from-blue-500/20 to-indigo-600/20 border-blue-500/40 text-blue-400",
    glow: "rgba(59, 130, 246, 0.2)",
    ring: "ring-blue-500/30",
    textColor: "text-blue-400",
    pulseClass: "pulse-speech",
    telemetry: {
      title: "Whisper STT Acoustic Model",
      timestamp: "00:26.4 → 00:34.1",
      metrics: "24 segments · Word-level stamps",
      spoken: "“...as we move through the loop, each item is printed in turn.”",
      detail: "Deterministic word-level transcription with confidence scoring (avg 0.96).",
    },
  },
  {
    id: "vision",
    step: "03",
    label: "Visual Understanding",
    subtitle: "Keyframe Detection & Slide Segments",
    category: "decompile",
    icon: Eye,
    color: "from-sky-500/20 to-cyan-600/20 border-sky-500/40 text-sky-400",
    glow: "rgba(14, 165, 233, 0.2)",
    ring: "ring-sky-500/30",
    textColor: "text-sky-400",
    pulseClass: "pulse-vision",
    telemetry: {
      title: "Keyframe Segmentation Engine",
      timestamp: "00:26.0s (Keyframe #04)",
      metrics: "14 Keyframes · 0.98 Visual Confidence",
      detail: "Slide transition detected with code terminal layout and syntax highlight regions.",
    },
  },
  {
    id: "ocr",
    step: "04",
    label: "OCR Syntax Extraction",
    subtitle: "Tesseract Code & Diagram OCR",
    category: "decompile",
    icon: ScanText,
    color: "from-cyan-500/20 to-teal-600/20 border-cyan-500/40 text-cyan-400",
    glow: "rgba(14, 165, 233, 0.25)",
    ring: "ring-cyan-500/30",
    textColor: "text-cyan-400",
    pulseClass: "pulse-vision",
    telemetry: {
      title: "Extracted Code Syntax Block",
      timestamp: "00:26.0s",
      metrics: "98.4% OCR Confidence",
      code: 'fruits = ["apple", "banana", "cherry"]\nfor fruit in fruits:\n    print(fruit)',
      detail: "Identified list variable assignment, for-in loop header, and indented body print statement.",
    },
  },
  {
    id: "align",
    step: "05",
    label: "Cross-Modal Alignment",
    subtitle: "Temporal Synchronization Matrix",
    category: "alignment",
    icon: GitCompareArrows,
    color: "from-indigo-500/20 to-violet-600/20 border-indigo-500/40 text-indigo-400",
    glow: "rgba(108, 79, 247, 0.25)",
    ring: "ring-indigo-500/30",
    textColor: "text-indigo-400",
    pulseClass: "pulse-ai",
    telemetry: {
      title: "Temporal Sync Matrix",
      timestamp: "Δt = 0.4s sync window",
      metrics: "±0.1s Cross-Modal Alignment",
      detail: "Synchronized speech token stream [00:26–00:34] with visual code keyframe [00:26].",
    },
  },
  {
    id: "reason",
    step: "06",
    label: "AI Reasoning Engine",
    subtitle: "Shown vs Spoken Comparison",
    category: "reasoning",
    icon: Cpu,
    color: "from-violet-500/20 to-purple-600/20 border-violet-500/40 text-violet-400",
    glow: "rgba(124, 58, 237, 0.25)",
    ring: "ring-violet-500/30",
    textColor: "text-violet-400",
    pulseClass: "pulse-ai",
    telemetry: {
      title: "Cross-Modal Disparity Analysis",
      timestamp: "00:26.0s",
      metrics: "Shown vs Said Mismatch: 0.88",
      detail: "Speaker describes high-level loop execution without reading syntax `for fruit in fruits:` verbally.",
    },
  },
  {
    id: "gap",
    step: "07",
    label: "Disparity Engine (Gap)",
    subtitle: "Critical Accessibility Gap Flagged",
    category: "reasoning",
    icon: AlertTriangle,
    color: "from-amber-500/20 to-orange-600/20 border-amber-500/40 text-amber-400",
    glow: "rgba(217, 119, 6, 0.25)",
    ring: "ring-amber-500/30",
    textColor: "text-amber-400",
    pulseClass: "pulse-gap",
    telemetry: {
      title: "Accessibility Gap #03 Flagged",
      timestamp: "00:26.0s",
      metrics: "Severity: HIGH (Visual Syntax Omission)",
      detail: "Blind / visually impaired student lacks critical loop syntax required for comprehension.",
    },
  },
  {
    id: "remediation",
    step: "08",
    label: "Audio Description Studio",
    subtitle: "Non-Destructive Dual Audio",
    category: "remediation",
    icon: Volume2,
    color: "from-emerald-500/20 to-teal-600/20 border-emerald-500/40 text-emerald-400",
    glow: "rgba(22, 163, 74, 0.25)",
    ring: "ring-emerald-500/30",
    textColor: "text-emerald-400",
    pulseClass: "pulse-verified",
    telemetry: {
      title: "Synthesized Audio Description Cue #03",
      timestamp: "00:26.2 → 00:30.5",
      metrics: "6 Real AD Cues · Layered Track",
      action: "“On screen: for fruit in fruits colon, indent print fruit.” (Preserving original speaker audio)",
      detail: "Injected synchronized AD narration without altering original lecture audio track.",
    },
  },
  {
    id: "twin",
    step: "09",
    label: "Accessibility Twin",
    subtitle: "Compiled Structured Representation",
    category: "twin",
    icon: BrainCircuit,
    color: "from-indigo-600/20 to-brand-indigo/30 border-brand-indigo/50 text-indigo-300",
    glow: "rgba(108, 79, 247, 0.35)",
    ring: "ring-brand-indigo/40",
    textColor: "text-indigo-300",
    pulseClass: "pulse-ai",
    telemetry: {
      title: "Compiled Accessibility Twin Model",
      timestamp: "Full Lecture Graph Ready",
      metrics: "100% Health Potential · 10 Connected Nodes",
      detail: "Deterministic multi-layered model uniting Video, Speech, Vision, OCR, Gaps, AD, Concepts, & Quiz.",
    },
  },
];

export default function HeroCompilerVisual() {
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const [isAutoCycling, setIsAutoCycling] = useState<boolean>(true);
  const [playbackTime, setPlaybackTime] = useState<number>(26.0);

  useEffect(() => {
    if (!isAutoCycling) return;
    const interval = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % COMPILER_STAGES.length);
    }, 3200);
    return () => clearInterval(interval);
  }, [isAutoCycling]);

  const active = COMPILER_STAGES[activeIdx];
  const ActiveIcon = active.icon;

  return (
    <div
      onMouseEnter={() => setIsAutoCycling(false)}
      onMouseLeave={() => setIsAutoCycling(true)}
      className="scientific-lens relative w-full overflow-hidden p-4 sm:p-6 text-white select-none transition-all duration-500"
      style={{
        boxShadow: `0 20px 50px rgba(0, 0, 0, 0.6), 0 0 40px ${active.glow}`,
      }}
    >
      {/* Background Matrix Grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-15"
        aria-hidden
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(108,79,247,0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(108,79,247,0.2) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Radial soft illumination */}
      <div
        className="pointer-events-none absolute -top-20 -right-20 size-80 rounded-full blur-3xl transition-all duration-700 opacity-20"
        style={{ background: active.glow }}
        aria-hidden
      />

      {/* Top Header: System Instrument Bar */}
      <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-indigo to-brand-blue text-white shadow-md shadow-brand-indigo/40">
            <Cpu className="size-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="font-display text-[14.5px] font-bold tracking-tight text-white">
                EDUACCESS COMPILER CORE
              </h3>
              <span className="rounded-full bg-emerald-500/15 border border-emerald-500/40 px-2.5 py-0.5 text-[10px] font-mono font-bold text-emerald-300 uppercase tracking-wider">
                LIVE COMPILING
              </span>
            </div>
            <p className="text-[11px] font-mono text-slate-300">
              Deterministic Video Ingestion → Multimodal Reasoning → Accessible Twin
            </p>
          </div>
        </div>

        {/* Telemetry controls */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsAutoCycling(!isAutoCycling)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-mono font-bold border transition",
              isAutoCycling
                ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                : "border-slate-700 bg-slate-800 text-slate-300"
            )}
            title="Toggle automatic stage progression"
          >
            <RotateCw className={cn("size-3.5", isAutoCycling && "animate-spin-slow")} />
            <span>{isAutoCycling ? "AUTO" : "PAUSED"}</span>
          </button>

          <span className="font-mono text-xs text-slate-300 font-semibold">
            <span className="text-brand-indigo font-bold text-sm">{active.step}</span>
            <span className="text-slate-500 mx-1">/</span>
            <span>09</span>
          </span>
        </div>
      </div>

      {/* Interactive Horizontal Pipeline Stage Selector (9 Stages) */}
      <div className="relative mt-3.5 grid grid-cols-9 gap-1.5 p-1.5 rounded-xl bg-slate-950 border border-slate-800">
        {COMPILER_STAGES.map((st, i) => {
          const Icon = st.icon;
          const isCurrent = i === activeIdx;
          const isPassed = i < activeIdx;

          return (
            <button
              key={st.id}
              type="button"
              onClick={() => {
                setActiveIdx(i);
                setIsAutoCycling(false);
              }}
              className={cn(
                "relative flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-all duration-300 group",
                isCurrent
                  ? "bg-brand-indigo text-white shadow-md shadow-brand-indigo/40 scale-[1.04] z-10"
                  : isPassed
                  ? "bg-slate-900 text-emerald-400 hover:bg-slate-800"
                  : "bg-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              )}
              title={`${st.step}. ${st.label}`}
            >
              <Icon className="size-3.5 sm:size-4" />
              <span className="mt-1 font-mono text-[9px] sm:text-[10px] font-bold leading-none">
                {st.step}
              </span>
            </button>
          );
        })}
      </div>

      {/* Central Interactive Laboratory Workbench */}
      <div className="relative mt-4 grid gap-4 lg:grid-cols-12 items-stretch">
        {/* Left: Video / Modality Frame Simulation (5 cols) */}
        <div className="lg:col-span-5 flex flex-col rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-slate-300">
            <span className="flex items-center gap-1.5 text-slate-200 font-semibold">
              <span className="size-2 rounded-full bg-rose-500 animate-ping" />
              DEMO_python_loops.mp4
            </span>
            <span className="text-sky-300 font-bold">00:26.0s</span>
          </div>

          {/* Simulated Video Slide Canvas with OCR Overlay */}
          <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-slate-800 bg-[#080C1A] flex flex-col justify-between p-3.5 font-mono">
            {/* Slide title */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-300 font-bold tracking-wider uppercase">
                PYTHON 3.10 · FOR LOOPS
              </span>
              <span className="rounded bg-indigo-500/25 border border-indigo-500/40 px-2 py-0.5 text-[9.5px] font-bold text-indigo-200">
                KEYFRAME #04
              </span>
            </div>

            {/* Code Block in Slide */}
            <div className="rounded-lg bg-black/90 border border-slate-800 p-2.5 text-[11px] sm:text-xs text-emerald-400 leading-relaxed font-mono">
              <div className="text-slate-400"># Iterating over sequence</div>
              <div>fruits = [&quot;apple&quot;, &quot;banana&quot;, &quot;cherry&quot;]</div>
              <div className="text-amber-300 font-bold">for fruit in fruits:</div>
              <div className="pl-3 text-sky-300 font-semibold">print(fruit)</div>
            </div>

            {/* Bottom active audio description overlay strip */}
            <div className="rounded-lg bg-emerald-950/90 border border-emerald-500/40 px-2.5 py-1.5 text-[10px] text-emerald-200 flex items-center justify-between font-semibold">
              <span className="flex items-center gap-1.5 truncate">
                <Volume2 className="size-3 shrink-0 text-emerald-300" />
                AD #03: &ldquo;for fruit in fruits colon, print fruit&rdquo;
              </span>
              <span className="font-bold text-[9px] text-emerald-400 shrink-0 bg-emerald-900/60 px-1.5 py-0.5 rounded">
                ACTIVE
              </span>
            </div>
          </div>

          {/* Modality Stream Waveform Indicator */}
          <div className="flex items-center justify-between px-1 text-[11px] font-mono text-slate-300">
            <span className="flex items-center gap-1.5 font-semibold text-slate-200">
              <Mic className="size-3.5 text-blue-400" /> Speech Stream
            </span>
            <div className="flex items-center gap-1">
              {[35, 60, 20, 85, 45, 95, 30, 70, 40, 80, 50, 90, 25, 65].map((h, idx) => (
                <span
                  key={idx}
                  className="inline-block w-1 rounded-full bg-blue-400 transition-all duration-300"
                  style={{ height: `${(h / 100) * 16}px` }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right: Active Stage Telemetry & Deep Grounding (7 cols) */}
        <div className="lg:col-span-7 flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-3.5">
          {/* Active Stage Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-xl border bg-gradient-to-br text-white shadow-md",
                  active.color
                )}
              >
                <ActiveIcon className="size-4.5" />
              </span>
              <div>
                <p className="text-sm font-bold text-white leading-tight">
                  {active.label}
                </p>
                <p className="text-[11px] text-slate-300 font-mono mt-0.5">{active.subtitle}</p>
              </div>
            </div>

            <span className={cn("rounded-full border px-3 py-1 font-mono text-[10.5px] font-bold uppercase tracking-wider", active.color)}>
              {active.category}
            </span>
          </div>

          {/* Telemetry Live Feed Block */}
          <div className="rounded-xl border border-slate-800 bg-black/70 p-3.5 font-mono text-xs space-y-2.5 flex-1 flex flex-col justify-center">
            <div className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-2 text-brand-cyan font-bold">
                <Activity className="size-3.5 text-brand-cyan animate-pulse" />
                {active.telemetry.title}
              </span>
              <span className="text-emerald-400 font-bold">
                {active.telemetry.metrics}
              </span>
            </div>

            {/* Dynamic Content: Spoken Transcript, Extracted Code, or Narration Action */}
            {active.telemetry.spoken && (
              <div className="rounded-lg bg-blue-950/40 border border-blue-500/30 p-2.5 text-blue-100 text-xs leading-relaxed italic">
                {active.telemetry.spoken}
              </div>
            )}

            {active.telemetry.code && (
              <div className="rounded-lg bg-black border border-slate-800 p-3 text-emerald-400 text-[11.5px] leading-relaxed whitespace-pre font-mono font-semibold">
                {active.telemetry.code}
              </div>
            )}

            {active.telemetry.action && (
              <div className="rounded-lg bg-emerald-950/50 border border-emerald-500/40 p-2.5 text-emerald-200 text-xs leading-relaxed font-semibold">
                {active.telemetry.action}
              </div>
            )}

            <p className="text-slate-200 text-xs leading-relaxed font-sans">
              {active.telemetry.detail}
            </p>
          </div>

          {/* Grounding & Causality Footer */}
          <div className="flex items-center justify-between pt-2.5 border-t border-slate-800 text-[11px] text-slate-300 font-mono">
            <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <ShieldCheck className="size-4" />
              Verified in Ground Truth Media
            </span>
            <span className="text-slate-400 font-semibold">{active.telemetry.timestamp}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
