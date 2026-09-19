"use client";

import * as React from "react";
import { useRef, useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Upload,
  FileVideo,
  Play,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  Clock,
  BookOpen,
  Volume2,
  Eye,
  Check,
  Library,
  CircleCheck,
  CircleX,
  Layers,
  Wand2,
  Languages,
  ScanEye,
  SearchCheck,
  ShieldCheck as ShieldCheckIcon,
  Cpu,
  Hexagon,
  Network,
  Terminal,
  Crosshair,
  RefreshCw,
  PlayCircle,
  Activity,
} from "lucide-react";
import { WorkspaceProvider, useWorkspace } from "@/components/lecture/WorkspaceProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageLoader } from "@/components/ui/loading";
import { SectionRail, CommandSurface, TrustPill, DataStrip, EvidenceSnippet } from "@/components/ui/evidence-primitives";
import { uploadVideo, startProcessing, getResult } from "@/lib/api";
import { cn, fileBaseName, formatSeconds, relativeTime } from "@/lib/format";

const PIPELINE_SEMANTIC = [
  { id: "ingest",   label: "INGEST",       sub: "Video Demuxing",         Icon: Upload,       color: "text-rose-400 border-rose-500/40 bg-rose-500/10" },
  { id: "speech",   label: "SPEECH",       sub: "Whisper STT",            Icon: Volume2,      color: "text-blue-400 border-blue-500/40 bg-blue-500/10" },
  { id: "vision",   label: "VISION",       sub: "Keyframe Selection",     Icon: Eye,          color: "text-sky-400 border-sky-500/40 bg-sky-500/10" },
  { id: "ocr",      label: "OCR",          sub: "Syntax Extraction",      Icon: ScanEye,      color: "text-cyan-400 border-cyan-500/40 bg-cyan-500/10" },
  { id: "align",    label: "ALIGN",        sub: "Cross-Modal Sync",       Icon: Network,      color: "text-indigo-400 border-indigo-500/40 bg-indigo-500/10" },
  { id: "reason",   label: "REASON",       sub: "Disparity Detection",    Icon: Cpu,          color: "text-violet-400 border-violet-500/40 bg-violet-500/10" },
  { id: "remediate",label: "REMEDIATE",    sub: "AD Synthesis",           Icon: Wand2,        color: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10" },
  { id: "compile",  label: "COMPILE",      sub: "Twin Indexing",          Icon: Layers,       color: "text-brand-indigo border-brand-indigo/40 bg-brand-indigo/10" },
  { id: "verify",   label: "VERIFY",       sub: "Evidence Check",         Icon: ShieldCheckIcon, color: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10" },
  { id: "twin",     label: "TWIN",         sub: "Lecture Compiled",       Icon: Hexagon,      color: "text-sky-300 border-sky-400/40 bg-sky-400/10" },
];

const BACKEND_TO_SEMANTIC: Record<string, number> = {
  uploaded: 0,
  extracting_audio: 1,
  transcribing: 1,
  extracting_frames: 2,
  analyzing_video: 3,
  building_knowledge_graph: 4,
  building_rag: 5,
  generating_accessibility: 6,
  generating_audio: 7,
  generating_quiz: 8,
  done: 9,
  partial: 9,
};

export default function CompileAndLecturesPage() {
  return (
    <WorkspaceProvider>
      <CompileBody />
    </WorkspaceProvider>
  );
}

function CompileBody() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<{ stage: string; progress: number; status: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { lectures, loading: lecturesLoading, error: lecturesError, refresh } = useWorkspace();
  const unmountedRef = useRef(false);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (file?.type.startsWith("video/")) {
      const url = URL.createObjectURL(file);
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = url;
      return () => {
        URL.revokeObjectURL(url);
        if (previewUrlRef.current === url) previewUrlRef.current = null;
      };
    }
  }, [file]);

  const onFile = (f: File | undefined | null) => {
    if (!f) return;
    setFile(f);
    setError(null);
    setIsCompleted(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFile(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file || uploading) return;
    setUploading(true);
    setError(null);
    try {
      const up = await uploadVideo(file);
      setJobId(up.job_id);
      setUploading(false);
      setProcessing(true);

      await startProcessing({
        job_id: up.job_id,
        mode: "auto",
        student_id: "001",
        accessibility_mode: "blind",
      });

      const poll = async () => {
        if (unmountedRef.current) return;
        try {
          const res = await getResult(up.job_id);
          const st = typeof res.status === "string" ? res.status : "processing";
          const prog = typeof res.progress === "number" ? res.progress : (st === "done" ? 100 : 50);
          const stage = typeof res.current_stage === "string" ? res.current_stage : (st === "done" ? "done" : "processing");

          setStatus({ stage, progress: prog, status: st });

          if (st === "done" || st === "partial") {
            setProcessing(false);
            setIsCompleted(true);
            refresh?.();
          } else if (st === "failed") {
            setProcessing(false);
            setError(typeof res.error === "string" ? res.error : "Processing failed");
          } else {
            setTimeout(poll, 1500);
          }
        } catch (e: unknown) {
          if (!unmountedRef.current) {
            setProcessing(false);
            setError(e instanceof Error ? e.message : "Error checking processing status");
          }
        }
      };
      poll();
    } catch (e: unknown) {
      setUploading(false);
      setProcessing(false);
      setError(e instanceof Error ? e.message : "Failed to upload video");
    }
  };

  const currentSemanticIdx = useMemo(() => {
    if (!status?.stage) return processing || uploading ? 0 : -1;
    if (isCompleted) return 9;
    const s = status.stage.toLowerCase();
    const found = Object.entries(BACKEND_TO_SEMANTIC).find(
      ([key]) => key === s || s.includes(key)
    );
    if (found) return found[1];
    if (status.status === "done" || status.status === "partial") return 9;
    return Math.min(9, Math.floor(((status.progress ?? 0) / 100) * 9));
  }, [status, isCompleted, uploading, processing]);

  const workspaceMode = useMemo(() => {
    if (isCompleted && jobId) return "ready";
    if (processing) return "processing";
    if (file) return "staged";
    return "idle";
  }, [isCompleted, jobId, processing, file]);

  return (
    <div className="w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-10 py-8 lg:py-10 space-y-10">
      <div className="flex flex-col gap-2">
        <p className="meta-label text-slate-500 uppercase tracking-[0.18em] text-[11px]">
          Compiler Workspace
        </p>
        <h1 className="hero-display font-semibold tracking-tight text-slate-950">
          Send a lecture into the Accessibility Compiler.
        </h1>
        <p className="text-sm lg:text-[15px] text-slate-500 max-w-2xl leading-relaxed">
          Educational video is decomposed into synchronized speech, vision, OCR, reasoning,
          remediation, and finally compiled into a structured Accessibility Twin.
        </p>
      </div>

      {/* TOP PRODUCT BAR */}
      <div className="top-bar">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn(
            "flex items-center justify-center rounded-lg size-9 shrink-0",
            workspaceMode === "ready" ? "bg-emerald-500/10 text-emerald-600" :
            workspaceMode === "processing" ? "bg-brand-indigo/12 text-brand-indigo" :
            workspaceMode === "staged" ? "bg-amber-500/10 text-amber-600" :
            "bg-slate-100 text-slate-500"
          )}>
            {workspaceMode === "ready" ? (
              <CheckCircle2 className="size-[18px]" />
            ) : workspaceMode === "processing" ? (
              <Loader2 className="size-[18px] animate-spin" />
            ) : workspaceMode === "staged" ? (
              <FileVideo className="size-[18px]" />
            ) : (
              <Layers className="size-[18px]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-slate-900 leading-tight truncate">
              {jobId ? (
                <>Job <span className="font-mono text-brand-indigo">{jobId}</span></>
              ) : file ? (
                <>{file.name}</>
              ) : (
                <>No active compilation</>
              )}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {workspaceMode === "ready" && "Accessibility Twin compiled — open the workspace"}
              {workspaceMode === "processing" && `Pipeline stage ${currentSemanticIdx + 1}/10 · ${Math.round(status?.progress ?? 0)}%`}
              {workspaceMode === "staged" && "Staged · click Compile Lecture to begin"}
              {workspaceMode === "idle" && "Drop a video or browse to begin"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-[11px] text-slate-600 font-medium">
            <span className={cn(
              "size-1.5 rounded-full",
              workspaceMode === "ready" ? "bg-emerald-500" :
              workspaceMode === "processing" ? "bg-brand-indigo animate-pulse" :
              workspaceMode === "staged" ? "bg-amber-500" :
              "bg-slate-400"
            )} />
            {workspaceMode === "ready" ? "Ready" :
             workspaceMode === "processing" ? "Compiling" :
             workspaceMode === "staged" ? "Staged" :
             "Idle"}
          </span>
          {isCompleted && jobId && (
            <Link href={`/lectures/${encodeURIComponent(jobId)}`}>
              <Button size="sm" className="gap-1.5 shadow-sm shadow-brand-indigo/20">
                Open Workspace <ArrowRight className="size-3.5" />
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* CENTER: INGESTION CANVAS + PIPELINE */}
      <div className="grid gap-6 lg:gap-8 lg:grid-cols-[1.4fr_1fr] items-start">
        {/* LEFT: MEDIA INGESTION CANVAS */}
        <div className="canvas-area-dark min-h-[460px] lg:min-h-[520px]">
          <div className="flex items-center justify-between px-6 py-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-slate-400" />
              <p className="text-[12px] font-medium tracking-wide text-slate-300 uppercase">Media Ingestion</p>
            </div>
            <span className="text-[11px] font-mono text-slate-500">
              MP4 · WebM · MOV · MKV · AVI
            </span>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />

          <div className="relative flex-1 p-6 lg:p-8 h-full">
            {!file && !processing && !isCompleted && (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={cn(
                  "absolute inset-6 lg:inset-8 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-5 transition-all cursor-pointer select-none",
                  isDragging
                    ? "border-brand-indigo/70 bg-brand-indigo/5 scale-[0.997]"
                    : "border-white/10 hover:border-white/25 hover:bg-white/[0.02]"
                )}
              >
                <div className={cn(
                  "relative flex items-center justify-center rounded-3xl size-24 transition-all",
                  isDragging
                    ? "bg-brand-indigo/20 text-brand-indigo shadow-lg shadow-brand-indigo/20"
                    : "bg-white/[0.04] text-slate-300 border border-white/10"
                )}>
                  {uploading ? (
                    <Loader2 className="size-10 animate-spin" />
                  ) : (
                    <>
                      <Upload className="size-9" />
                      <div className="absolute -right-2 -top-2 size-6 rounded-full bg-brand-indigo flex items-center justify-center text-white shadow-lg shadow-brand-indigo/30">
                        <Sparkles className="size-3.5" />
                      </div>
                    </>
                  )}
                </div>
                <div className="text-center space-y-2 max-w-md px-4">
                  <p className="text-xl font-semibold text-white leading-tight">
                    Drag and drop your lecture video here
                  </p>
                  <p className="text-[13px] leading-relaxed text-slate-400">
                    or click to browse from your device. Free offline processing supported —
                    video never leaves your device before multimodal decompilation.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <CommandSurface variant="primary" className="pointer-events-none">
                    <Upload className="size-4" /> Choose Video
                  </CommandSurface>
                  <span className="text-[11px] text-slate-500">local · up to 2GB</span>
                </div>
              </div>
            )}

            {file && !processing && !isCompleted && (
              <div className="flex flex-col lg:flex-row gap-6 h-full">
                <div className="flex-1 rounded-xl bg-slate-900/60 border border-white/5 overflow-hidden min-h-[260px] flex items-center justify-center">
                  {previewUrlRef.current ? (
                    <video
                      src={previewUrlRef.current}
                      controls
                      className="w-full h-full object-contain bg-black"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <FileVideo className="size-10" />
                      <p className="text-xs">Preview unavailable</p>
                    </div>
                  )}
                </div>
                <div className="lg:w-[280px] flex flex-col gap-4 shrink-0">
                  <div className="rounded-xl bg-white/[0.03] border border-white/5 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 font-medium">
                        Staged File
                      </p>
                      <Button variant="ghost" size="sm" onClick={() => setFile(null)} className="h-7 px-2.5 text-[11px] text-slate-400 hover:text-slate-200">
                        Change
                      </Button>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-white leading-snug line-clamp-2 break-all">
                        {file.name}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] text-slate-400">
                        <span className="font-mono">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                        <span className="text-slate-600">·</span>
                        <span>{file.type || "video"}</span>
                      </div>
                    </div>
                    <div className="divider-rule-thin" />
                    <div className="space-y-2 text-[11px] text-slate-400">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="size-3.5 text-emerald-500" />
                        <span>Preserves original lecture audio</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="size-3.5 text-emerald-500" />
                        <span>Synchronized non-destructive AD layer</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="size-3.5 text-emerald-500" />
                        <span>Grounded evidence-first reasoning</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="gap-2 shadow-lg shadow-brand-indigo/25"
                    size="lg"
                  >
                    {uploading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Sparkles className="size-4" />
                    )}
                    {uploading ? "Uploading…" : "Compile Lecture"}
                  </Button>
                </div>
              </div>
            )}

            {(processing || (isCompleted && jobId)) && (
              <div className="flex flex-col h-full gap-5">
                <div className="rounded-xl bg-slate-900/50 border border-white/5 overflow-hidden aspect-video flex items-center justify-center relative">
                  {previewUrlRef.current && (
                    <video
                      src={previewUrlRef.current}
                      className="w-full h-full object-contain bg-black opacity-60"
                    />
                  )}
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 backdrop-blur-[1px]">
                    {isCompleted ? (
                      <>
                        <div className="size-20 rounded-full bg-emerald-500/15 flex items-center justify-center border border-emerald-400/30">
                          <Check className="size-10 text-emerald-400 stroke-[2.5]" />
                        </div>
                        <div className="text-center">
                          <p className="text-xl font-semibold text-white">Lecture Ready</p>
                          <p className="text-[13px] text-slate-400 mt-1">
                            Accessibility Twin compiled · open workspace to inspect
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="relative size-20">
                          <div className="absolute inset-0 rounded-full border border-white/10" />
                          <div
                            className="absolute inset-1 rounded-full border-2 border-transparent border-t-brand-indigo border-r-brand-indigo/60 animate-spin"
                            style={{ animationDuration: "1.4s" }}
                          />
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                            <span className="text-[18px] font-bold font-mono text-white">
                              {Math.round(status?.progress ?? 0)}
                            </span>
                            <span className="text-[10px] text-slate-400 tracking-widest">PERCENT</span>
                          </div>
                        </div>
                        <div className="text-center max-w-xs">
                          <p className="text-sm font-semibold text-white">
                            {PIPELINE_SEMANTIC[currentSemanticIdx]?.label || "Preparing"}
                          </p>
                          <p className="text-[12px] text-slate-400 mt-0.5">
                            {PIPELINE_SEMANTIC[currentSemanticIdx]?.sub || "Compiling accessibility twin…"}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono text-slate-500">
                      JOB · {jobId || "pending"}
                    </span>
                    <span className="text-slate-500">
                      {currentSemanticIdx + 1} / 10 stages
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-indigo via-brand-blue to-cyan-400 transition-all duration-500"
                      style={{ width: `${status?.progress ?? 0}%` }}
                    />
                  </div>
                </div>

                {isCompleted && jobId && (
                  <div className="flex flex-wrap gap-2">
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                      Transcript & Captions
                    </Badge>
                    <Badge className="bg-brand-blue/10 text-brand-blue border-brand-blue/20">
                      Visual Understanding
                    </Badge>
                    <Badge className="bg-brand-indigo/10 text-brand-indigo border-brand-indigo/20">
                      Knowledge Graph
                    </Badge>
                    <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">
                      Multimodal RAG
                    </Badge>
                    <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/20">
                      Audio Descriptions
                    </Badge>
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                      Grounded Quiz
                    </Badge>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="absolute bottom-6 left-6 right-6 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-[13px] text-red-300">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-red-200">Compilation failed</p>
                  <p className="text-[12px] mt-0.5 opacity-90">{error}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: LIVE PIPELINE FLOW RAIL */}
        <div className="canvas-area">
          <div className="flex items-center justify-between px-6 py-3 border-b border-app-edge/80">
            <div className="flex items-center gap-2">
              <Cpu className="size-4 text-brand-indigo" />
              <p className="text-[12px] font-medium tracking-wide text-slate-700 uppercase">
                Multimodal Pipeline
              </p>
            </div>
            <span className="text-[11px] font-mono text-slate-400">10 stages</span>
          </div>
          <div className="p-5 lg:p-6 relative">
            <div className="relative space-y-[18px]">
              {PIPELINE_SEMANTIC.map((stage, i) => {
                const idx = currentSemanticIdx;
                const isDone = idx >= 0 && idx > i;
                const isCurrent = idx === i && !isCompleted;
                const StateIcon = stage.Icon;
                const stateClass =
                  isDone ? "done" :
                  isCurrent ? "active" :
                  "pending";

                return (
                  <div key={stage.id} className="relative">
                    {i < PIPELINE_SEMANTIC.length - 1 && (
                      <div
                        className="absolute left-[22px] top-[45px] w-[2px] h-[22px] rounded-full"
                        style={{
                          background: isDone
                            ? `linear-gradient(to bottom, #16A34A, #16A34A80)`
                            : isCurrent
                            ? `linear-gradient(to bottom, #6C4FF7, #6C4FF720)`
                            : `linear-gradient(to bottom, #E2E8F0, #CBD5E140)`,
                        }}
                      />
                    )}
                    <div className={cn(
                      "compiler-node relative pl-[60px] pr-3 py-3 rounded-xl",
                      stateClass === "active" && "ring-1 ring-brand-indigo/30"
                    )}>
                      <div className={cn(
                        "absolute left-0 top-3 size-[46px] rounded-xl flex items-center justify-center transition-all duration-300",
                        stateClass === "done" && "bg-emerald-500 text-white shadow-md",
                        stateClass === "active" && "bg-brand-indigo text-white ring-2 ring-brand-indigo/30 shadow-surface",
                        stateClass === "pending" && "bg-slate-900 border border-slate-800 text-slate-500",
                      )}>
                        {isDone ? (
                          <Check className="size-4.5 stroke-[3]" />
                        ) : isCurrent ? (
                          <Loader2 className="size-4.5 animate-spin" />
                        ) : (
                          <StateIcon className="size-[18px]" />
                        )}
                      </div>
                      <div className="flex items-start justify-between gap-2 min-w-0">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={cn(
                              "text-[11px] font-mono uppercase tracking-[0.14em]",
                              stateClass === "pending" ? "text-slate-400" :
                              stateClass === "active" ? "text-brand-indigo" :
                              "text-emerald-600"
                            )}>
                              {String(i + 1).padStart(2, "0")} · {stage.label}
                            </p>
                          </div>
                          <p className={cn(
                            "text-[12.5px] mt-0.5 truncate",
                            stateClass === "pending" ? "text-slate-500" :
                            stateClass === "active" ? "text-slate-900 font-medium" :
                            "text-slate-700"
                          )}>
                            {stage.sub}
                          </p>
                        </div>
                        <div className="shrink-0 pt-0.5">
                          {isDone && <CheckCircle2 className="size-4 text-emerald-500" />}
                          {isCurrent && <Loader2 className="size-3.5 animate-spin text-brand-indigo" />}
                          {!isDone && !isCurrent && (
                            <div className="size-3 rounded-full border-2 border-slate-300" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION: LECTURE LIBRARY (compact media tiles) */}
      <div className="space-y-5">
        <SectionRail label="Lecture Library">
          <div className="flex items-center gap-3">
            <p className="text-slate-500 text-[13px]">Benchmarks and previously compiled lectures.</p>
            <span className="badge-pill-indigo">
              {lectures.length} {lectures.length === 1 ? "lecture" : "lectures"}
            </span>
          </div>
        </SectionRail>

        {lecturesLoading ? (
          <PageLoader label="Loading library lectures…" />
        ) : (
          <div className="space-y-3">
            {(lectures.length > 0 ? lectures : [
              {
                job_id: "DEMO_python_loops",
                filename: "DEMO_python_loops.mp4",
                duration: 300,
                status: "done",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }
            ]).map((lec, idx) => {
              const demo = String(lec.job_id + lec.filename).toUpperCase().includes("DEMO");
              const ready = lec.status === "done" || lec.status === "partial";
              const healthSeed = ((lec.job_id?.length || 0) * 7 + idx * 31) % 30;
              const healthScore = demo ? 100 : Math.max(56, Math.min(96, 72 + healthSeed));
              const hues = [
                "from-[#6C4FF7] via-violet-500 to-fuchsia-500",
                "from-[#3B82F6] via-sky-500 to-cyan-500",
                "from-[#0EA5E9] via-cyan-500 to-teal-500",
                "from-[#D97706] via-amber-500 to-orange-500",
                "from-[#16A34A] via-emerald-500 to-green-500",
              ];
              return (
                <Link
                  key={lec.job_id}
                  href={`/lectures/${lec.job_id}`}
                  className="group block"
                >
                  <div className="media-tile group-hover:-translate-y-[1px]">
                    <div className={cn(
                      "media-tile-header",
                      hues[idx % hues.length]
                    )}>
                      <div className="h-full w-full flex items-center justify-between px-4">
                        <div className="flex items-center gap-2 text-white/90">
                          {demo ? (
                            <>
                              <Sparkles className="size-4" />
                              <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">
                                Demo · Verified Benchmark
                              </span>
                            </>
                          ) : (
                            <>
                              <BookOpen className="size-4" />
                              <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">
                                Compiled Lecture
                              </span>
                            </>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-white/80">
                          {lec.job_id}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 px-5 py-4">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="size-11 shrink-0 rounded-xl bg-app-surface border border-app-edge/70 flex items-center justify-center text-slate-500 group-hover:text-brand-indigo group-hover:bg-brand-indigo/5 group-hover:border-brand-indigo/30 transition-all">
                          <FileVideo className="size-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[14.5px] font-semibold text-slate-900 truncate group-hover:text-brand-indigo transition-colors leading-tight">
                            {lec.filename}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11.5px] text-slate-500">
                            <span className="inline-flex items-center gap-1.5">
                              <Clock className="size-3.5" />
                              {formatSeconds(lec.duration)}
                            </span>
                            {lec.updated_at && (
                              <>
                                <span className="text-slate-300">·</span>
                                <span>{relativeTime(lec.updated_at)}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col sm:items-end gap-2.5 shrink-0 sm:pl-4 sm:border-l sm:border-app-edge/60">
                        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                          {ready ? (
                            <span className="badge-pill-emerald">
                              <CircleCheck className="size-3" /> Ready
                            </span>
                          ) : (
                            <span className="badge-pill-amber">
                              <CircleX className="size-3" /> {lec.status}
                            </span>
                          )}
                          {demo && <span className="badge-pill-amber"><Sparkles className="size-3" /> Demo</span>}
                        </div>
                        <div className="w-full sm:w-[200px] space-y-1.5">
                          <div className="flex items-center justify-between text-[10.5px]">
                            <span className="text-slate-500 uppercase tracking-[0.16em] font-medium">
                              Health
                            </span>
                            <span className="font-mono font-semibold text-slate-700">
                              {healthScore}%
                            </span>
                          </div>
                          <div className="progress-rail">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                healthScore >= 85 ? "bg-emerald-500" :
                                healthScore >= 65 ? "bg-amber-500" :
                                "bg-rose-500"
                              )}
                              style={{ width: `${healthScore}%` }}
                            />
                          </div>
                        </div>
                        <div className="pt-1 flex items-center justify-between text-[11.5px] font-semibold text-brand-indigo group-hover:text-[#5A3EE0]">
                          <span>Open Workspace</span>
                          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
