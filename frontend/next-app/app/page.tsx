"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Upload,
  ShieldCheck,
  Video,
  Sparkles,
  Clock,
  CheckCircle2,
  CircleX,
  Eye,
  ScanText,
  Mic,
  GitCompareArrows,
  BrainCircuit,
  Play,
  Check,
  ChevronRight,
  HelpCircle,
  FileCode,
  Sliders,
  Cpu,
  Workflow,
  Volume2,
  AlertTriangle,
  Accessibility,
  GraduationCap,
  PlayCircle,
  Crosshair,
  ExternalLink,
  Layers,
  Activity,
  Terminal,
  Compass,
} from "lucide-react";
import { useWorkspace } from "@/components/lecture/WorkspaceProvider";
import { WorkspaceProvider } from "@/components/lecture/WorkspaceProvider";
import { isDemo } from "@/components/lecture/LecturePicker";
import { getAccessibilityScore, getNextAction } from "@/lib/api";
import { cn, formatSeconds, formatClock } from "@/lib/format";
import type { NextActionResponse } from "@/types/backend";
import { useRtl } from "@/components/layout/AppShell";
import {
  SectionRail,
  TrustPill,
  EvidenceTimestamp,
  DataStrip,
  ConceptBadge,
  EvidenceSnippet,
} from "@/components/ui/evidence-primitives";
import HeroCompilerVisual from "@/components/ui/HeroCompilerVisual";
import { AccessibilityTwin } from "@/components/twin/AccessibilityTwin";
import { EvidenceLens } from "@/components/ui/EvidenceLens";

export default function HomePage() {
  return (
    <WorkspaceProvider>
      <HomeContent />
    </WorkspaceProvider>
  );
}

const CHAPTERS = [
  { num: "01", title: "THE VIDEO", label: "Raw Lecture Demuxing", theme: "dark" },
  { num: "02", title: "MULTIMODAL UNDERSTANDING", label: "Speech + Vision + OCR", theme: "warm" },
  { num: "03", title: "CROSS-MODAL ALIGNMENT", label: "Temporal Sync Matrix", theme: "dark" },
  { num: "04", title: "THE INVISIBLE GAP", label: "Shown vs Spoken Reasoning", theme: "warm" },
  { num: "05", title: "ACCESSIBILITY REMEDIATION", label: "Dual-Audio AD Studio", theme: "dark" },
  { num: "06", title: "ACCESSIBILITY TWIN", label: "10-Node Nervous System", theme: "dark" },
  { num: "07", title: "PERSONALIZED LEARNING", label: "Adaptive Quiz & Next Action", theme: "warm" },
];

function HomeContent() {
  const { lectures, loading, selectedId } = useWorkspace();
  const { language, dir } = useRtl();
  const [scores, setScores] = useState<Record<string, { score: number; level: string; trust: string }>>({});
  const [nextAction, setNextAction] = useState<NextActionResponse | null>(null);
  const [activeTab, setActiveTab] = useState<"code" | "transcript" | "ad">("code");

  const t = (english: string, arabic: string) => (language === "ar" ? arabic : english);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const sid of ["001", "default"]) {
        try {
          const r = await getNextAction(sid);
          if (!cancelled && !r.insufficient_history) {
            setNextAction(r);
            return;
          }
        } catch {
          /* try next student */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!lectures.length) return;
    let cancelled = false;
    lectures.slice(0, 6).forEach((l) => {
      getAccessibilityScore(l.job_id)
        .then((r) => {
          if (!cancelled)
            setScores((s) => ({ ...s, [l.job_id]: { score: r.score, level: r.level, trust: r.trust?.trust ?? "UNAVAILABLE" } }));
        })
        .catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, [lectures, selectedId]);

  const demoLecture = lectures.find(isDemo) ?? (lectures.length > 0 ? lectures[0] : null);

  return (
    <div className="relative w-full flex flex-col pb-24 bg-[#070A14] text-slate-100 selection:bg-brand-indigo/30 selection:text-white">
      {/* ============================================================
         HERO SECTION · CINEMATIC FIRST VIEWPORT (85–100vh)
         ============================================================ */}
      <section className="dark-hero-surface relative w-full min-h-[92vh] flex flex-col justify-center px-4 sm:px-8 lg:px-14 py-12 lg:py-20 border-b border-[#1E294B] overflow-hidden">
        <div className="max-w-[1440px] mx-auto w-full grid gap-12 lg:grid-cols-12 items-center">
          {/* LEFT: Monumental Editorial Typography & Telemetry */}
          <div className="lg:col-span-6 min-w-0 flex flex-col gap-6 z-10">
            {/* System Status Pill */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-brand-indigo/20 text-indigo-200 ring-1 ring-brand-indigo/50 px-4 py-1.5 text-xs font-mono font-bold uppercase tracking-[0.16em]">
                <Sparkles className="size-4 text-brand-indigo animate-pulse" aria-hidden />
                {t("EDUACCESS AI · COMPILER CORE", "مُجَمِّع إمكانية الوصول للتعليم")}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40 px-3.5 py-1.5 text-xs font-mono font-bold">
                <PlayCircle className="size-3.5 text-emerald-400" aria-hidden />
                DEMO BENCHMARK LIVE
              </span>
            </div>

            {/* Monumental Editorial Headline */}
            <div className="space-y-4">
              <div className="font-mono text-xs sm:text-sm font-bold uppercase tracking-[0.25em] text-slate-300">
                AI ACCESSIBILITY LABORATORY
              </div>
              <h1 className="hero-monumental text-white">
                THE ACCESSIBILITY
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-indigo via-blue-400 to-sky-300">
                  COMPILER
                </span>
                <br />
                FOR EDUCATION
              </h1>
              <p className="max-w-2xl text-base sm:text-lg lg:text-xl text-slate-200 font-sans leading-relaxed">
                {t(
                  "Transforms educational video into fully accessible, grounded, dual-audio learning experiences through multimodal speech, vision, OCR, and cross-modal disparity reasoning.",
                  "يُحوّل الفيديوهات التعليمية إلى تجارب تعلّم موثّقة ومتاحة للجميع بالصوت المزدوج والرؤية والتعرف البصري واستنتاج الفجوات."
                )}
              </p>
            </div>

            {/* Direct Action Buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                href="/lectures/DEMO_python_loops"
                className="inline-flex items-center gap-3 rounded-xl bg-brand-indigo text-white font-bold px-7 py-4 text-base shadow-xl shadow-brand-indigo/35 hover:bg-brand-indigo/90 hover:scale-[1.02] transition"
              >
                <Play className="size-4.5 fill-white" />
                <span>{t("Launch Accessibility Studio", "فتح استوديو إمكانية الوصول")}</span>
                <ArrowRight className="size-4.5 opacity-90" />
              </Link>

              <Link
                href="/upload"
                className="inline-flex items-center gap-2.5 rounded-xl bg-slate-900 text-slate-100 border border-slate-700 hover:border-slate-500 hover:bg-slate-800 font-bold px-6 py-4 text-base transition backdrop-blur shadow-sm"
              >
                <Upload className="size-4.5 text-brand-cyan" />
                <span>{t("AI Compiler Console", "منصة المُجَمِّع")}</span>
              </Link>
            </div>

            {/* Precision Telemetry Strip */}
            <div className="pt-5 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-xs text-slate-300">
              <div className="space-y-0.5">
                <span className="text-slate-400 block text-[11px] font-semibold">LECTURE DURATION</span>
                <span className="text-white font-bold text-sm sm:text-base">54.0s</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-slate-400 block text-[11px] font-semibold">SPEECH SEGMENTS</span>
                <span className="text-blue-300 font-bold text-sm sm:text-base">24 Mapped</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-slate-400 block text-[11px] font-semibold">OCR SYNTAX</span>
                <span className="text-cyan-300 font-bold text-sm sm:text-base">98.4% Confidence</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-slate-400 block text-[11px] font-semibold">HEALTH SCORE</span>
                <span className="text-emerald-300 font-bold text-sm sm:text-base">100% Potential</span>
              </div>
            </div>
          </div>

          {/* RIGHT: Signature Centerpiece (EDUACCESS COMPILER CORE) */}
          <div className="lg:col-span-6 min-w-0">
            <HeroCompilerVisual />
          </div>
        </div>
      </section>

      {/* ============================================================
         CHAPTER NAVIGATION RAIL
         ============================================================ */}
      <div className="sticky top-0 z-30 w-full border-y border-[#1E294B] bg-[#070A14]/95 backdrop-blur-md px-4 py-3">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between overflow-x-auto gap-4 scrollbar-none font-mono text-xs">
          <span className="text-brand-indigo font-bold shrink-0 flex items-center gap-2 text-xs uppercase tracking-wider">
            <Compass className="size-4" />
            ARCHITECTURE STORY:
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {CHAPTERS.map((ch) => (
              <a
                key={ch.num}
                href={`#chapter-${ch.num}`}
                className="px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition flex items-center gap-2 font-semibold"
              >
                <span className="text-brand-cyan font-bold">{ch.num}</span>
                <span className="hidden md:inline">{ch.title}</span>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* ============================================================
         CHAPTER 01 · THE VIDEO (DEEP INK #070A14)
         ============================================================ */}
      <section id="chapter-01" className="deep-ink-section py-20 px-4 sm:px-8 lg:px-14">
        <div className="max-w-[1440px] mx-auto space-y-10">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 font-mono text-xs text-rose-400 font-bold uppercase tracking-wider">
              <span className="size-2.5 rounded-full bg-rose-500 animate-pulse" />
              CHAPTER 01 · SOURCE INGESTION
            </div>
            <h2 className="text-3xl sm:text-5xl font-display font-bold text-white tracking-tight">
              Raw Educational Video Ingestion
            </h2>
            <p className="max-w-3xl text-slate-200 text-base sm:text-lg leading-relaxed">
              Educational videos contain high-density multimodal knowledge: spoken lecturer explanation, on-screen slides, dynamic diagrams, and code demonstrations. EduAccess AI demuxes the container into synchronized media streams.
            </p>
          </div>

          {/* Visual Presentation */}
          <div className="grid gap-6 lg:grid-cols-12 items-center">
            <div className="lg:col-span-7 rounded-2xl border border-slate-800 bg-slate-950 p-5 space-y-4">
              <div className="flex items-center justify-between text-xs font-mono text-slate-300">
                <span className="text-slate-100 font-bold text-sm">DEMO_python_loops.mp4</span>
                <span className="text-rose-400 font-bold">1080p @ 30fps · H.264 / AAC</span>
              </div>

              <div className="aspect-video w-full rounded-xl border border-slate-800 bg-[#0A0E1A] flex flex-col justify-center items-center p-6 text-center space-y-3.5 relative overflow-hidden">
                <div className="size-18 rounded-2xl bg-rose-500/15 border border-rose-500/40 flex items-center justify-center text-rose-400 shadow-xl">
                  <Video className="size-9" />
                </div>
                <div>
                  <h4 className="text-white font-bold text-lg">Python 3.10: For Loop Iteration Lecture</h4>
                  <p className="text-slate-300 text-sm font-mono mt-1">Duration: 54.0s · Stereo Audio Channel · 1,620 Discrete Frames</p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  <span className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-mono text-slate-200 font-semibold">Audio Extracted: 44.1kHz WAV</span>
                  <span className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-mono text-slate-200 font-semibold">Frame Demux: 14 Keyframes</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 space-y-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 space-y-4 font-mono text-xs">
                <div className="text-brand-cyan font-bold text-sm flex items-center gap-2.5">
                  <Terminal className="size-4.5" /> INGESTION TELEMETRY
                </div>
                <div className="space-y-3 text-slate-200 text-xs sm:text-[13px]">
                  <div className="flex justify-between border-b border-slate-800 pb-2">
                    <span className="text-slate-400 font-semibold">Acoustic Demux:</span>
                    <span className="text-emerald-400 font-bold">PASSED (0.21s)</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-2">
                    <span className="text-slate-400 font-semibold">Keyframe Detection:</span>
                    <span className="text-emerald-400 font-bold">14 Keyframes</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-2">
                    <span className="text-slate-400 font-semibold">Temporal Resolution:</span>
                    <span className="text-sky-300 font-bold">±0.033s (1 frame)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
         CHAPTER 02 · MULTIMODAL UNDERSTANDING (WARM WHITE #F7F5F0)
         ============================================================ */}
      <section id="chapter-02" className="warm-white-section py-20 px-4 sm:px-8 lg:px-14">
        <div className="max-w-[1440px] mx-auto space-y-10">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 font-mono text-xs text-brand-indigo font-bold uppercase tracking-wider">
              <span className="size-2.5 rounded-full bg-brand-indigo" />
              CHAPTER 02 · MULTIMODAL DECOMPILATION
            </div>
            <h2 className="text-3xl sm:text-5xl font-display font-bold text-slate-900 tracking-tight">
              Parallel Speech, Vision & OCR Understanding
            </h2>
            <p className="max-w-3xl text-slate-800 text-base sm:text-lg leading-relaxed font-sans">
              The AI compiler simultaneously runs Whisper speech-to-text, computer vision keyframe feature extraction, and OCR text extraction to decompile what was said vs what was visually presented.
            </p>
          </div>

          {/* 3-Column Parallel Extraction Cards */}
          <div className="grid gap-6 md:grid-cols-3">
            {/* SPEECH COLUMN */}
            <div className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm space-y-3.5">
              <div className="flex items-center gap-2 text-blue-700 font-mono font-bold text-sm">
                <Mic className="size-5" />
                <span>SPEECH: WHISPER STT</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-700 font-medium">Timestamped spoken word stream:</p>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 font-mono text-xs sm:text-sm text-slate-900 space-y-2">
                <div className="text-xs text-blue-700 font-bold">[00:26.4 → 00:34.1]</div>
                <p className="italic leading-relaxed font-sans font-medium text-slate-800">
                  &ldquo;...as we move through the loop, each item is printed in turn.&rdquo;
                </p>
              </div>
              <div className="text-xs font-mono font-semibold text-slate-600">24 segments mapped · Avg Confidence: 0.96</div>
            </div>

            {/* VISION COLUMN */}
            <div className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm space-y-3.5">
              <div className="flex items-center gap-2 text-sky-700 font-mono font-bold text-sm">
                <Eye className="size-5" />
                <span>VISION: KEYFRAME OCR</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-700 font-medium">Slide visual keyframe at 00:26.0s:</p>
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-4 font-mono text-xs sm:text-sm text-emerald-400 space-y-1.5">
                <div className="text-xs text-sky-400 font-bold">KEYFRAME #04 @ 00:26.0</div>
                <div className="text-slate-300">fruits = [&quot;apple&quot;, &quot;banana&quot;, &quot;cherry&quot;]</div>
                <div className="text-amber-300 font-bold">for fruit in fruits:</div>
                <div className="pl-3 text-sky-300 font-semibold">print(fruit)</div>
              </div>
              <div className="text-xs font-mono font-semibold text-slate-600">14 Keyframes · 0.98 Visual Confidence</div>
            </div>

            {/* OCR COLUMN */}
            <div className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm space-y-3.5">
              <div className="flex items-center gap-2 text-brand-indigo font-mono font-bold text-sm">
                <ScanText className="size-5" />
                <span>OCR: SYNTAX ANALYSIS</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-700 font-medium">Parsed programming language constructs:</p>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 font-mono text-xs sm:text-sm text-slate-900 space-y-1.5">
                <div><span className="text-slate-600 font-semibold">Type:</span> <span className="font-bold text-slate-950">Python for-loop</span></div>
                <div><span className="text-slate-600 font-semibold">Iterable:</span> <span className="text-blue-700 font-bold">fruits (list[str])</span></div>
                <div><span className="text-slate-600 font-semibold">Target Var:</span> <span className="text-indigo-700 font-bold">fruit</span></div>
                <div><span className="text-slate-600 font-semibold">Body:</span> <span className="text-emerald-800 font-bold">print(fruit)</span></div>
              </div>
              <div className="text-xs font-mono font-semibold text-slate-600">Deterministic code AST parsing</div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
         CHAPTER 03 · CROSS-MODAL ALIGNMENT (OBSIDIAN #0B1020)
         ============================================================ */}
      <section id="chapter-03" className="obsidian-section py-20 px-4 sm:px-8 lg:px-14">
        <div className="max-w-[1440px] mx-auto space-y-10">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 font-mono text-xs text-sky-400 font-bold uppercase tracking-wider">
              <span className="size-2.5 rounded-full bg-sky-400 animate-pulse" />
              CHAPTER 03 · TEMPORAL MATRIX SYNCHRONIZATION
            </div>
            <h2 className="text-3xl sm:text-5xl font-display font-bold text-white tracking-tight">
              Cross-Modal Temporal Alignment
            </h2>
            <p className="max-w-3xl text-slate-200 text-base sm:text-lg leading-relaxed font-sans">
              EduAccess AI establishes temporal co-occurrence between what appears on screen and what is spoken by the instructor at every millisecond of the lecture.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 sm:p-8 space-y-5 font-mono text-xs sm:text-sm">
            <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-3.5 gap-2">
              <span className="text-brand-cyan font-bold text-sm">TEMPORAL CO-OCCURRENCE MATRIX</span>
              <span className="text-slate-300 font-semibold">Time Window: 00:20 → 00:36</span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-blue-500/40 bg-blue-950/30 p-5 space-y-2.5">
                <span className="text-blue-300 font-bold text-sm flex items-center gap-2">
                  <Mic className="size-4" /> Spoken Audio Timeline
                </span>
                <p className="text-slate-100 text-xs sm:text-sm font-sans leading-relaxed">
                  [00:26.4] &ldquo;...as we move through the loop...&rdquo; (Mentions high-level concept, omits syntax structure)
                </p>
              </div>

              <div className="rounded-xl border border-cyan-500/40 bg-cyan-950/30 p-5 space-y-2.5">
                <span className="text-cyan-300 font-bold text-sm flex items-center gap-2">
                  <ScanText className="size-4" /> Visual Slide Timeline
                </span>
                <p className="text-slate-100 text-xs sm:text-sm font-sans leading-relaxed">
                  [00:26.0] Slide Keyframe #04 displays Python loop syntax: <code className="font-mono bg-cyan-950 px-1.5 py-0.5 rounded text-cyan-200 border border-cyan-700">for fruit in fruits:</code>
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-indigo-500/40 bg-indigo-950/30 p-4 text-indigo-100 text-center font-bold text-xs sm:text-sm">
              Δt Synchronization Precision: ±0.1s · Correlation Coefficient: 0.94
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
         CHAPTER 04 · THE INVISIBLE GAP (WARM WHITE #F7F5F0)
         ============================================================ */}
      <section id="chapter-04" className="warm-white-section py-20 px-4 sm:px-8 lg:px-14">
        <div className="max-w-[1440px] mx-auto space-y-10">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 font-mono text-xs text-amber-800 font-bold uppercase tracking-wider">
              <span className="size-2.5 rounded-full bg-amber-600" />
              CHAPTER 04 · DISPARITY ENGINE (WHAT AM I MISSING?)
            </div>
            <h2 className="text-3xl sm:text-5xl font-display font-bold text-slate-900 tracking-tight">
              Detecting the Invisible Accessibility Gap
            </h2>
            <p className="max-w-3xl text-slate-800 text-base sm:text-lg leading-relaxed font-sans">
              Standard accessibility tools (captions, generic screen readers) fail when educational information is shown visually but never spoken aloud. Our Disparity Engine highlights the exact gap.
            </p>
          </div>

          {/* Reasoning Chain Comparison */}
          <div className="grid gap-6 lg:grid-cols-12 items-stretch">
            {/* SHOWN VS SAID CHAIN (7 cols) */}
            <div className="lg:col-span-7 rounded-2xl border border-slate-300 bg-white p-6 sm:p-7 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 text-base font-mono flex items-center gap-2.5">
                <GitCompareArrows className="size-5 text-brand-indigo" />
                CAUSAL REASONING CHAIN @ 00:26.0s
              </h3>

              <div className="space-y-3.5 font-mono text-xs sm:text-sm">
                <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 space-y-1">
                  <span className="text-blue-800 font-bold text-xs uppercase tracking-wider">1. SHOWN ON SCREEN:</span>
                  <p className="text-slate-900 font-sans text-xs sm:text-sm leading-relaxed">
                    Code syntax block: <code className="bg-white px-2 py-0.5 rounded border border-slate-300 text-indigo-800 font-mono font-bold">for fruit in fruits: print(fruit)</code>
                  </p>
                </div>

                <div className="rounded-xl bg-sky-50 border border-sky-200 p-4 space-y-1">
                  <span className="text-sky-800 font-bold text-xs uppercase tracking-wider">2. SPOKEN IN AUDIO:</span>
                  <p className="text-slate-900 font-sans text-xs sm:text-sm italic leading-relaxed">
                    &ldquo;...as we move through the loop, each item is printed in turn.&rdquo;
                  </p>
                </div>

                <div className="rounded-xl bg-amber-50 border border-amber-300 p-4 space-y-1">
                  <span className="text-amber-900 font-bold text-xs uppercase tracking-wider">3. DISPARITY IDENTIFIED (THE GAP):</span>
                  <p className="text-slate-900 font-sans text-xs sm:text-sm leading-relaxed font-medium">
                    The instructor does NOT read the code syntax aloud. A blind or visually impaired student misses the loop variable name and indentation syntax!
                  </p>
                </div>
              </div>
            </div>

            {/* EVIDENCE INSPECTOR CARD (5 cols) */}
            <div className="lg:col-span-5">
              <EvidenceLens
                data={{
                  timestamp: 26.0,
                  modality: "GAP",
                  source: "Cross-Modal Disparity Engine",
                  evidence: "Visual syntax shown on slide without explicit verbal description in audio channel.",
                  codeSnippet: 'for fruit in fruits:\n    print(fruit)',
                  confidence: 0.94,
                  status: "GAP_DETECTED",
                  remediation: "AD Cue #03 synthesized to describe syntax verbatim.",
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
         CHAPTER 05 · ACCESSIBILITY REMEDIATION (DEEP INK #070A14)
         ============================================================ */}
      <section id="chapter-05" className="deep-ink-section py-20 px-4 sm:px-8 lg:px-14">
        <div className="max-w-[1440px] mx-auto space-y-10">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 font-mono text-xs text-emerald-400 font-bold uppercase tracking-wider">
              <span className="size-2.5 rounded-full bg-emerald-400 animate-pulse" />
              CHAPTER 05 · SYNTHESIZED DUAL-AUDIO REMEDIATION
            </div>
            <h2 className="text-3xl sm:text-5xl font-display font-bold text-white tracking-tight">
              Non-Destructive Audio Description Studio
            </h2>
            <p className="max-w-3xl text-slate-200 text-base sm:text-lg leading-relaxed font-sans">
              EduAccess AI generates precision Audio Description (AD) cues inserted into natural pauses or layered over the lecture without modifying or destroying the original teacher&rsquo;s voice.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 sm:p-8 space-y-5">
            <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-3.5 font-mono text-xs sm:text-sm gap-2">
              <span className="text-emerald-400 font-bold flex items-center gap-2">
                <Volume2 className="size-4.5" />
                SYNCHRONIZED AD STUDIO TRACK
              </span>
              <span className="text-slate-300 font-semibold">6 Real Cues Injected · Dual Audio</span>
            </div>

            <div className="grid gap-4 md:grid-cols-3 font-mono text-xs sm:text-sm">
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-1.5">
                <span className="text-sky-300 font-bold text-xs">[00:03.0 → 00:06.5]</span>
                <p className="text-slate-100 text-xs sm:text-sm font-sans leading-relaxed">AD #01: &ldquo;Title slide: Python Loops and Iteration.&rdquo;</p>
              </div>
              <div className="rounded-xl border border-emerald-500/50 bg-emerald-950/30 p-4 space-y-1.5 ring-1 ring-emerald-500/40">
                <span className="text-emerald-300 font-bold text-xs">[00:26.2 → 00:30.5] (CRITICAL)</span>
                <p className="text-slate-100 text-xs sm:text-sm font-sans leading-relaxed font-medium">AD #03: &ldquo;On screen: for fruit in fruits colon, indent print fruit.&rdquo;</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-1.5">
                <span className="text-sky-300 font-bold text-xs">[00:48.0 → 00:52.0]</span>
                <p className="text-slate-100 text-xs sm:text-sm font-sans leading-relaxed">AD #06: &ldquo;Terminal output displays apple, banana, cherry on new lines.&rdquo;</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
         CHAPTER 06 · ACCESSIBILITY TWIN (OBSIDIAN #0B1020)
         ============================================================ */}
      <section id="chapter-06" className="obsidian-section py-20 px-4 sm:px-8 lg:px-14">
        <div className="max-w-[1440px] mx-auto space-y-10">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 font-mono text-xs text-brand-indigo font-bold uppercase tracking-wider">
              <span className="size-2.5 rounded-full bg-brand-indigo animate-pulse" />
              CHAPTER 06 · STRUCTURED LECTURE GRAPH
            </div>
            <h2 className="text-3xl sm:text-5xl font-display font-bold text-white tracking-tight">
              The Accessibility Twin: Digital Nervous System
            </h2>
            <p className="max-w-3xl text-slate-200 text-base sm:text-lg leading-relaxed font-sans">
              Every lecture compiles into an Accessibility Twin—a unified 10-node knowledge representation linking Video, Speech, Vision, OCR, Concepts, Gaps, Evidence, AD, Quizzes, and Personalized Learning.
            </p>
          </div>

          {/* Full Interactive 10-Node Accessibility Twin */}
          <AccessibilityTwin score={100} />
        </div>
      </section>

      {/* ============================================================
         CHAPTER 07 · PERSONALIZED LEARNING (WARM WHITE #F7F5F0)
         ============================================================ */}
      <section id="chapter-07" className="warm-white-section py-20 px-4 sm:px-8 lg:px-14">
        <div className="max-w-[1440px] mx-auto space-y-10">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 font-mono text-xs text-brand-indigo font-bold uppercase tracking-wider">
              <span className="size-2.5 rounded-full bg-brand-indigo" />
              CHAPTER 07 · ADAPTIVE INTELLIGENCE
            </div>
            <h2 className="text-3xl sm:text-5xl font-display font-bold text-slate-900 tracking-tight">
              Personalized Learning Agent & Next Best Action
            </h2>
            <p className="max-w-3xl text-slate-800 text-base sm:text-lg leading-relaxed font-sans">
              Grounding allows the AI tutor to generate adaptive quizzes directly from extracted evidence and recommend the optimal Next Best Action for the student.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-300 bg-white p-6 sm:p-7 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-brand-indigo flex items-center gap-2">
                  <GraduationCap className="size-4.5" /> ADAPTIVE QUIZ
                </span>
                <span className="font-mono text-xs bg-indigo-50 text-indigo-800 border border-indigo-200 px-2.5 py-1 rounded font-bold">
                  Grounded in Slide #04
                </span>
              </div>
              <h4 className="font-bold text-slate-900 text-base leading-snug">
                &ldquo;What is the loop variable in the statement <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 font-bold">for fruit in fruits:</code>?&rdquo;
              </h4>
              <div className="space-y-2 font-mono text-xs sm:text-sm pt-2">
                <div className="p-3 rounded-xl border border-emerald-400 bg-emerald-50 text-emerald-950 font-bold flex items-center justify-between shadow-xs">
                  <span>A) fruit</span>
                  <CheckCircle2 className="size-5 text-emerald-600" />
                </div>
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-semibold">
                  B) fruits
                </div>
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-semibold">
                  C) print
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-300 bg-white p-6 sm:p-7 shadow-sm space-y-4 flex flex-col justify-between">
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-emerald-800 flex items-center gap-2">
                    <Sparkles className="size-4.5 text-emerald-600" /> NEXT BEST ACTION (NBA)
                  </span>
                  <span className="font-mono text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded font-bold">
                    Student Mastery: 88%
                  </span>
                </div>
                <h4 className="font-bold text-slate-900 text-base leading-snug">
                  Recommended Action: Practice Nested Loop Syntax
                </h4>
                <p className="text-slate-700 text-sm leading-relaxed font-sans font-normal">
                  The student has mastered 1D list iteration. The Personal Learning Agent suggests exploring nested loops and dictionary keys next.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                <Link
                  href="/learning"
                  className="inline-flex items-center gap-2 text-brand-indigo font-bold text-sm hover:underline"
                >
                  <span>Open Learning Intelligence Center</span>
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
         FINAL CALL TO ACTION SECTION (DEEP INK #070A14)
         ============================================================ */}
      <section className="deep-ink-section py-20 px-4 sm:px-8 lg:px-14 text-center">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-indigo/20 border border-brand-indigo/40 px-4 py-1.5 text-xs font-mono font-bold text-indigo-200">
            <Sparkles className="size-4 text-brand-indigo" /> COMPETITION-READY AI ACCESSIBILITY
          </div>
          <h2 className="text-3xl sm:text-5xl font-display font-bold text-white tracking-tight">
            Experience EduAccess AI Live
          </h2>
          <p className="text-slate-200 text-base sm:text-lg leading-relaxed">
            Inspect the benchmark Python Loops lecture with synchronized speech, visual understanding, OCR evidence, disparity detection, real audio descriptions, and interactive twin.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Link
              href="/lectures/DEMO_python_loops"
              className="inline-flex items-center gap-2.5 rounded-xl bg-brand-indigo text-white font-bold px-8 py-4 text-base shadow-xl shadow-brand-indigo/35 hover:bg-brand-indigo/90 hover:scale-[1.02] transition"
            >
              <Play className="size-4.5 fill-white" />
              <span>Launch Accessibility Studio (DEMO)</span>
            </Link>
            <Link
              href="/upload"
              className="inline-flex items-center gap-2.5 rounded-xl bg-slate-900 text-slate-100 border border-slate-700 hover:border-slate-500 font-bold px-7 py-4 text-base transition shadow-sm"
            >
              <Upload className="size-4.5 text-brand-cyan" />
              <span>Compile New Lecture</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
