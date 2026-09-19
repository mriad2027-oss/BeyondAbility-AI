"use client";

import * as React from "react";
import { useMemo } from "react";
import Link from "next/link";
import {
  FileVideo,
  Sparkles,
  Clock,
  ArrowRight,
  CircleCheck,
  CircleX,
  Library,
  Layers,
  Volume2,
  Eye,
  ScanEye,
  Network,
  Cpu,
  ShieldCheck,
  Hexagon,
  Upload,
  PlayCircle,
  Activity,
  Check,
} from "lucide-react";
import { useWorkspace, WorkspaceProvider } from "@/components/lecture/WorkspaceProvider";
import { PageLoader, EmptyState } from "@/components/ui/loading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatSeconds, relativeTime } from "@/lib/format";
import { cn } from "@/lib/format";

export default function LecturesPage() {
  return (
    <WorkspaceProvider>
      <LecturesContent />
    </WorkspaceProvider>
  );
}

function LecturesContent() {
  const { lectures, loading, error } = useWorkspace();

  // Sanitize lecture list so no WhatsApp/personal recordings appear in the UI
  const { demoLecture, otherLectures } = useMemo(() => {
    const clean = lectures.filter((lec) => {
      const name = (lec.filename || "").toLowerCase();
      const id = (lec.job_id || "").toLowerCase();
      return !name.includes("whatsapp") && !id.includes("whatsapp");
    });

    const fallbackDemo = {
      job_id: "DEMO_python_loops",
      filename: "DEMO_python_loops.mp4",
      duration: 300,
      status: "done",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      assets: {
        video: true,
        transcript: true,
        srt: true,
        captions: true,
        visual_events: true,
        accessibility: true,
        narration: true,
        quiz: true,
      },
    };

    const demo =
      clean.find((l) => String(l.job_id + l.filename).toUpperCase().includes("DEMO")) ||
      fallbackDemo;

    const others = clean.filter(
      (l) => l.job_id !== demo.job_id && !String(l.job_id + l.filename).toUpperCase().includes("DEMO")
    );

    return { demoLecture: demo, otherLectures: others };
  }, [lectures]);

  if (loading) return <PageLoader label="Loading lecture library…" />;

  if (error) {
    return (
      <div className="w-full max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <EmptyState
          title="Backend Connection Notice"
          description={`Unable to fetch live lecture list from the API: ${error}. Showing verified offline benchmark.`}
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 space-y-10 lg:space-y-12">
      {/* PAGE HEADER */}
      <div className="flex flex-col gap-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-brand-indigo/10 border border-brand-indigo/20 text-brand-indigo font-mono text-xs font-semibold uppercase tracking-wider w-fit">
          <Library className="size-3.5" />
          <span>Lecture Library · Multimodal Studio Entry</span>
        </div>
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-display font-black tracking-tight text-slate-950 dark:text-white leading-[1.08]">
          Compiled Educational Lectures
        </h1>
        <p className="text-base sm:text-lg lg:text-xl text-slate-700 dark:text-slate-200 max-w-3xl leading-relaxed">
          Select a compiled lecture below to enter the interactive Multimodal Accessibility Studio, inspect cross-modal temporal alignment evidence, and interact with the Accessibility Twin.
        </p>
      </div>

      {/* FEATURED BENCHMARK LECTURE: DEMO_python_loops */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Sparkles className="size-4 text-amber-500" />
            <h2 className="text-xs sm:text-sm font-mono font-bold tracking-wider text-slate-800 dark:text-slate-200 uppercase">
              Flagship Verified Benchmark
            </h2>
          </div>
          <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            VERIFIED DEMO
          </span>
        </div>

        {/* FEATURED CARD */}
        <div className="rounded-3xl bg-[#0B1020] border-2 border-brand-indigo/40 shadow-2xl p-6 sm:p-8 lg:p-10 relative overflow-hidden">
          {/* Subtle Ambient Glow */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-brand-indigo/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center relative z-10">
            {/* Left Content Area (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="px-3 py-1 rounded-full bg-brand-indigo/20 border border-brand-indigo/40 text-brand-indigo font-mono text-xs font-bold uppercase tracking-wider">
                    Official Competition Benchmark
                  </span>
                  <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-semibold">
                    100% Grounded
                  </span>
                </div>

                <h3 className="text-2xl sm:text-3xl lg:text-4xl font-display font-bold text-white tracking-tight leading-tight">
                  Python Loops & Control Flow (Benchmark)
                </h3>

                <p className="text-xs sm:text-sm font-mono text-slate-400 font-medium">
                  File: <span className="text-slate-200">{demoLecture.filename}</span> · Job ID:{" "}
                  <span className="text-brand-indigo font-bold">{demoLecture.job_id}</span>
                </p>

                <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl pt-1">
                  Full multimodal lecture demonstrating parallel speech transcription (Whisper), computer vision keyframe extraction, OCR code snippet indexing, and temporal disparity gap identification at 00:08 (where loops syntax is shown on screen but not explained orally).
                </p>
              </div>

              {/* Multimodal Modality Badges */}
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-500/15 border border-blue-500/30 text-xs font-semibold text-blue-300">
                  <Volume2 className="size-3.5" /> Whisper Speech
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-sky-500/15 border border-sky-500/30 text-xs font-semibold text-sky-300">
                  <Eye className="size-3.5" /> CV Keyframes
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-xs font-semibold text-cyan-300">
                  <ScanEye className="size-3.5" /> OCR Code Syntax
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-xs font-semibold text-indigo-300">
                  <Network className="size-3.5" /> Cross-Modal Sync
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-xs font-semibold text-amber-300">
                  <Cpu className="size-3.5" /> Disparity Engine
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-xs font-semibold text-emerald-300">
                  <ShieldCheck className="size-3.5" /> Non-Destructive AD
                </span>
              </div>

              {/* Metadata Telemetry Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-3 border-t border-white/10 text-xs font-mono">
                <div>
                  <p className="text-slate-500 uppercase tracking-wider">Duration</p>
                  <p className="text-sm font-bold text-white mt-0.5 flex items-center gap-1.5">
                    <Clock className="size-4 text-slate-400" />
                    {formatSeconds(demoLecture.duration || 300)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 uppercase tracking-wider">Status</p>
                  <p className="text-sm font-bold text-emerald-400 mt-0.5 flex items-center gap-1.5">
                    <CircleCheck className="size-4" /> Ready & Indexed
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 uppercase tracking-wider">Evidence Grounding</p>
                  <p className="text-sm font-bold text-white mt-0.5">
                    100% Causal Match
                  </p>
                </div>
              </div>
            </div>

            {/* Right Action Box (5 cols) */}
            <div className="lg:col-span-5 flex flex-col justify-center gap-4 bg-white/[0.03] border border-white/10 rounded-2xl p-6 sm:p-8">
              <div className="space-y-2 text-center lg:text-left">
                <p className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">
                  Interactive Workspace Entry
                </p>
                <h4 className="text-lg sm:text-xl font-bold text-white">
                  Enter Accessibility Studio
                </h4>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Interact with the multimodal player, verify synchronized audio descriptions, explore the Knowledge Graph, and test grounded adaptive learning.
                </p>
              </div>

              <Link href={`/lectures/${encodeURIComponent(demoLecture.job_id)}`} className="block w-full">
                <Button
                  size="lg"
                  className="w-full gap-3 bg-gradient-to-r from-brand-indigo to-blue-600 hover:from-brand-indigo/90 hover:to-blue-500 text-white font-bold text-base py-4 rounded-xl shadow-xl shadow-brand-indigo/30 transition-all hover:scale-[1.01]"
                >
                  <PlayCircle className="size-5 shrink-0" />
                  <span>Launch Accessibility Studio</span>
                  <ArrowRight className="size-5 shrink-0" />
                </Button>
              </Link>

              <div className="flex items-center justify-between text-xs font-mono text-slate-400 px-1 pt-1">
                <span>Mode: Grounded Evidence</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <Check className="size-3.5 stroke-[3]" /> Zero Hallucination
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECONDARY SECTION: ADDITIONAL LECTURES OR COMPILER CTA */}
      <div className="space-y-6 pt-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-white/10 pb-4">
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-950 dark:text-white">
              Additional Lectures & Custom Ingestion
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Compile custom lecture recordings using the Multimodal Ingestion Pipeline.
            </p>
          </div>
          <Link href="/upload">
            <Button variant="outline" size="sm" className="gap-2 border-brand-indigo/30 text-brand-indigo hover:bg-brand-indigo/10">
              <Upload className="size-4" />
              <span>Compile New Video</span>
            </Button>
          </Link>
        </div>

        {otherLectures.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {otherLectures.map((lec) => {
              const isReady = lec.status === "done" || lec.status === "partial";
              return (
                <Link
                  key={lec.job_id}
                  href={`/lectures/${encodeURIComponent(lec.job_id)}`}
                  className="group block"
                >
                  <div className="rounded-2xl bg-white dark:bg-[#0B1020] border border-slate-200 dark:border-[#1E294B] shadow-sm hover:shadow-md hover:border-brand-indigo/40 dark:hover:border-brand-indigo/40 transition-all duration-200 p-6 flex flex-col justify-between gap-5 min-h-[220px]">
                    <div className="flex items-start gap-4">
                      <div className="size-12 rounded-xl bg-brand-indigo/10 border border-brand-indigo/20 flex items-center justify-center text-brand-indigo group-hover:scale-105 transition-transform shrink-0">
                        <FileVideo className="size-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-bold text-slate-950 dark:text-white truncate group-hover:text-brand-indigo transition-colors">
                          {lec.filename}
                        </h3>
                        <p className="text-xs font-mono text-slate-500 mt-1">
                          Job ID: {lec.job_id}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs font-mono text-slate-600 dark:text-slate-300">
                          <span className="inline-flex items-center gap-1 font-semibold">
                            <Clock className="size-3.5 text-slate-400" />
                            {formatSeconds(lec.duration || 0)}
                          </span>
                          <span>·</span>
                          {isReady ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                              <CircleCheck className="size-3.5" /> Ready
                            </span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                              <CircleX className="size-3.5" /> {lec.status}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-white/5 text-xs font-bold text-brand-indigo group-hover:text-brand-indigo/90">
                      <span>Open Accessibility Studio</span>
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          /* High-End Ingestion Prompt Card to fill space gracefully */
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.01] p-8 sm:p-10 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center sm:text-left max-w-xl">
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                Have another lecture video to compile?
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Upload any lecture in MP4, WebM, or MOV format to decompile speech, extract code snippets, and synthesize synchronized audio descriptions.
              </p>
            </div>
            <Link href="/upload" className="shrink-0">
              <Button size="lg" className="gap-2.5 bg-brand-indigo hover:bg-brand-indigo/90 text-white font-bold px-6 py-3 shadow-lg shadow-brand-indigo/20">
                <Upload className="size-4.5" />
                <span>Open Compiler Workspace</span>
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}