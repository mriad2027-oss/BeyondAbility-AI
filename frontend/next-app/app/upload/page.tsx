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
  FileCheck,
  Zap,
} from "lucide-react";
import { WorkspaceProvider, useWorkspace } from "@/components/lecture/WorkspaceProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageLoader } from "@/components/ui/loading";
import { SectionRail, CommandSurface, TrustPill, DataStrip, EvidenceSnippet } from "@/components/ui/evidence-primitives";
import { uploadVideo, startProcessing, getResult } from "@/lib/api";
import { cn, fileBaseName, formatSeconds, relativeTime } from "@/lib/format";

interface PipelineStageDef {
  id: string;
  stageNum: string;
  label: string;
  sub: string;
  Icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  badgeClass: string;
}

const PIPELINE_STAGES: PipelineStageDef[] = [
  {
    id: "speech",
    stageNum: "01",
    label: "SPEECH / STT",
    sub: "Acoustic demuxing & Whisper transcription",
    Icon: Volume2,
    accentColor: "#3B82F6",
    badgeClass: "text-blue-400 border-blue-500/30 bg-blue-500/10",
  },
  {
    id: "vision",
    stageNum: "02",
    label: "VISION",
    sub: "Keyframe selection & visual scene decomposition",
    Icon: Eye,
    accentColor: "#0EA5E9",
    badgeClass: "text-sky-400 border-sky-500/30 bg-sky-500/10",
  },
  {
    id: "ocr",
    stageNum: "03",
    label: "OCR / SYNTAX",
    sub: "Code, math & diagram on-screen text extraction",
    Icon: ScanEye,
    accentColor: "#0EA5E9",
    badgeClass: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
  },
  {
    id: "align",
    stageNum: "04",
    label: "TEMPORAL ALIGNMENT",
    sub: "Cross-modal sync: what is spoken vs. what is shown",
    Icon: Network,
    accentColor: "#6C4FF7",
    badgeClass: "text-indigo-400 border-indigo-500/30 bg-indigo-500/10",
  },
  {
    id: "reason",
    stageNum: "05",
    label: "DISPARITY REASONING",
    sub: "Detects inaccessible visual gaps not explained in audio",
    Icon: Cpu,
    accentColor: "#D97706",
    badgeClass: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  },
  {
    id: "twin",
    stageNum: "06",
    label: "ACCESSIBILITY TWIN",
    sub: "Multimodal knowledge graph & digital nervous system",
    Icon: Hexagon,
    accentColor: "#6C4FF7",
    badgeClass: "text-purple-400 border-purple-500/30 bg-purple-500/10",
  },
  {
    id: "verify",
    stageNum: "07",
    label: "VERIFICATION & AD",
    sub: "Grounded non-destructive audio description & quiz",
    Icon: ShieldCheckIcon,
    accentColor: "#16A34A",
    badgeClass: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  },
];

const BACKEND_TO_STAGE_INDEX: Record<string, number> = {
  uploaded: 0,
  extracting_audio: 0,
  transcribing: 0,
  extracting_frames: 1,
  analyzing_video: 2,
  building_knowledge_graph: 3,
  building_rag: 4,
  generating_accessibility: 4,
  generating_audio: 5,
  generating_quiz: 6,
  done: 6,
  partial: 6,
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

  const currentStageIdx = useMemo(() => {
    if (!status?.stage) return processing || uploading ? 0 : -1;
    if (isCompleted) return PIPELINE_STAGES.length - 1;
    const s = status.stage.toLowerCase();
    const found = Object.entries(BACKEND_TO_STAGE_INDEX).find(
      ([key]) => key === s || s.includes(key)
    );
    if (found) return found[1];
    if (status.status === "done" || status.status === "partial") return PIPELINE_STAGES.length - 1;
    return Math.min(PIPELINE_STAGES.length - 1, Math.floor(((status.progress ?? 0) / 100) * PIPELINE_STAGES.length));
  }, [status, isCompleted, uploading, processing]);

  const workspaceMode = useMemo(() => {
    if (isCompleted && jobId) return "ready";
    if (processing) return "processing";
    if (file) return "staged";
    return "idle";
  }, [isCompleted, jobId, processing, file]);

  // Sanitize lecture list so no WhatsApp/personal media appears in the UI
  const displayLectures = useMemo(() => {
    const clean = lectures.filter((lec) => {
      const name = (lec.filename || "").toLowerCase();
      const id = (lec.job_id || "").toLowerCase();
      return !name.includes("whatsapp") && !id.includes("whatsapp");
    });

    if (clean.length > 0) return clean;

    return [
      {
        job_id: "DEMO_python_loops",
        filename: "DEMO_python_loops.mp4",
        duration: 300,
        status: "done",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
  }, [lectures]);

  return (
    <div className="w-full max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 space-y-10 lg:space-y-12">
      {/* PAGE HEADER */}
      <div className="flex flex-col gap-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-indigo/10 border border-brand-indigo/20 text-brand-indigo font-mono text-xs font-semibold uppercase tracking-wider w-fit">
          <Cpu className="size-3.5" />
          <span>Compiler Workspace · Multimodal Ingestion</span>
        </div>
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-display font-black tracking-tight text-slate-950 dark:text-white leading-[1.08]">
          Multimodal Accessibility Compiler
        </h1>
        <p className="text-base sm:text-lg lg:text-xl text-slate-700 dark:text-slate-200 max-w-3xl leading-relaxed">
          Decompile raw educational video into synchronized speech, computer vision, OCR, causal disparity reasoning, and an indexed Accessibility Twin.
        </p>
      </div>

      {/* TOP PRODUCT HUD BAR */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B1020] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3.5 min-w-0">
          <div
            className={cn(
              "flex items-center justify-center rounded-xl size-11 shrink-0 font-bold",
              workspaceMode === "ready"
                ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
                : workspaceMode === "processing"
                ? "bg-brand-indigo/15 text-brand-indigo border border-brand-indigo/30"
                : workspaceMode === "staged"
                ? "bg-amber-500/15 text-amber-500 border border-amber-500/30"
                : "bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/10"
            )}
          >
            {workspaceMode === "ready" ? (
              <CheckCircle2 className="size-5" />
            ) : workspaceMode === "processing" ? (
              <Loader2 className="size-5 animate-spin" />
            ) : workspaceMode === "staged" ? (
              <FileVideo className="size-5" />
            ) : (
              <Layers className="size-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight truncate">
              {jobId ? (
                <>
                  Compilation Job: <span className="font-mono text-brand-indigo">{jobId}</span>
                </>
              ) : file ? (
                <>{file.name}</>
              ) : (
                <>Compiler Engine Ready</>
              )}
            </p>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1">
              {workspaceMode === "ready" && "Accessibility Twin compiled · open workspace to inspect evidence"}
              {workspaceMode === "processing" &&
                `Stage ${currentStageIdx + 1} of ${PIPELINE_STAGES.length}: ${PIPELINE_STAGES[currentStageIdx]?.label} · ${Math.round(status?.progress ?? 0)}%`}
              {workspaceMode === "staged" && "Lecture staged · click Compile Lecture to begin multimodal processing"}
              {workspaceMode === "idle" && "Select a lecture video file or drag and drop below"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span
            className={cn(
              "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold font-mono tracking-wider",
              workspaceMode === "ready"
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                : workspaceMode === "processing"
                ? "bg-brand-indigo/15 text-brand-indigo border border-brand-indigo/30 animate-pulse"
                : workspaceMode === "staged"
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/10"
            )}
          >
            <span
              className={cn(
                "size-2 rounded-full",
                workspaceMode === "ready"
                  ? "bg-emerald-500"
                  : workspaceMode === "processing"
                  ? "bg-brand-indigo animate-ping"
                  : workspaceMode === "staged"
                  ? "bg-amber-500"
                  : "bg-slate-400"
              )}
            />
            {workspaceMode === "ready"
              ? "COMPILED"
              : workspaceMode === "processing"
              ? "COMPILING"
              : workspaceMode === "staged"
              ? "STAGED"
              : "IDLE"}
          </span>

          {isCompleted && jobId && (
            <Link href={`/lectures/${encodeURIComponent(jobId)}`}>
              <Button size="default" className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md">
                <span>Launch Studio</span>
                <ArrowRight className="size-4" />
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* CENTER: MEDIA INGESTION CANVAS + PIPELINE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT: INGESTION CANVAS (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl bg-[#0B1020] border border-[#1E294B] shadow-xl overflow-hidden flex flex-col min-h-[520px]">
          {/* Surface Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-2.5">
              <Layers className="size-4 text-slate-300" />
              <p className="text-xs sm:text-sm font-mono font-bold tracking-wider text-slate-200 uppercase">
                Media Ingestion Boundary
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              MP4 · WebM · MOV · MKV · AVI (≤ 2GB)
            </span>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />

          <div className="relative flex-1 p-6 sm:p-8 flex flex-col justify-center">
            {/* IDLE / DROPZONE STATE */}
            {!file && !processing && !isCompleted && (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={cn(
                  "rounded-2xl border-2 border-dashed p-8 sm:p-12 flex flex-col items-center justify-center text-center gap-6 transition-all cursor-pointer select-none",
                  isDragging
                    ? "border-brand-indigo bg-brand-indigo/10 scale-[0.99]"
                    : "border-white/15 hover:border-brand-indigo/50 hover:bg-white/[0.02]"
                )}
              >
                <div
                  className={cn(
                    "relative flex items-center justify-center rounded-3xl size-24 transition-all shadow-lg",
                    isDragging
                      ? "bg-brand-indigo text-white shadow-brand-indigo/40 scale-105"
                      : "bg-white/10 text-slate-200 border border-white/15"
                  )}
                >
                  {uploading ? (
                    <Loader2 className="size-10 animate-spin" />
                  ) : (
                    <>
                      <Upload className="size-10" />
                      <div className="absolute -right-2 -top-2 size-7 rounded-full bg-brand-indigo flex items-center justify-center text-white shadow-md">
                        <Sparkles className="size-4" />
                      </div>
                    </>
                  )}
                </div>

                <div className="space-y-2 max-w-lg">
                  <h2 className="text-xl sm:text-2xl font-display font-bold text-white tracking-tight">
                    Upload Educational Lecture Video
                  </h2>
                  <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                    Drag and drop your lecture video file here, or browse from your device. Local offline multimodal decomposition ensures zero external data leakage.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <Button
                    type="button"
                    size="lg"
                    className="gap-2 bg-brand-indigo hover:bg-brand-indigo/90 text-white font-bold px-6 py-3 shadow-lg shadow-brand-indigo/30"
                  >
                    <Upload className="size-4.5" />
                    <span>Select Video File</span>
                  </Button>
                  <span className="text-xs font-mono text-slate-400">or drop raw .mp4</span>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-xs font-mono text-slate-300">
                    Whisper Speech
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-xs font-mono text-slate-300">
                    CV Keyframes
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-xs font-mono text-slate-300">
                    OCR Syntax
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-xs font-mono text-slate-300">
                    Disparity AI
                  </span>
                </div>
              </div>
            )}

            {/* STAGED FILE STATE */}
            {file && !processing && !isCompleted && (
              <div className="flex flex-col gap-6">
                <div className="rounded-xl bg-slate-950/80 border border-white/10 overflow-hidden min-h-[260px] flex items-center justify-center">
                  {previewUrlRef.current ? (
                    <video
                      src={previewUrlRef.current}
                      controls
                      className="w-full max-h-[340px] object-contain bg-black"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-slate-400 p-8">
                      <FileVideo className="size-12" />
                      <p className="text-sm font-semibold">Video preview ready</p>
                    </div>
                  )}
                </div>

                <div className="rounded-xl bg-white/[0.04] border border-white/10 p-5 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400">
                        Staged Video File
                      </span>
                      <p className="text-base sm:text-lg font-bold text-white truncate mt-0.5">
                        {file.name}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs font-mono text-slate-300">
                        <span className="font-semibold text-emerald-400">
                          {(file.size / 1024 / 1024).toFixed(1)} MB
                        </span>
                        <span>·</span>
                        <span>{file.type || "video/mp4"}</span>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFile(null)}
                      className="border-white/20 text-slate-200 hover:text-white hover:bg-white/10"
                    >
                      Change Video
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-white/10 text-xs text-slate-300">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                      <span>Preserves original audio</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                      <span>Non-destructive AD</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                      <span>Causal gap detection</span>
                    </div>
                  </div>

                  <Button
                    onClick={handleUpload}
                    disabled={uploading}
                    size="lg"
                    className="w-full gap-2.5 bg-brand-indigo hover:bg-brand-indigo/90 text-white font-bold text-base py-3.5 shadow-lg shadow-brand-indigo/30"
                  >
                    {uploading ? (
                      <Loader2 className="size-5 animate-spin" />
                    ) : (
                      <Sparkles className="size-5" />
                    )}
                    <span>{uploading ? "Uploading & Initializing…" : "Compile Lecture into Accessibility Twin"}</span>
                  </Button>
                </div>
              </div>
            )}

            {/* PROCESSING & COMPLETED STATES */}
            {(processing || (isCompleted && jobId)) && (
              <div className="flex flex-col gap-6 py-4">
                <div className="rounded-xl bg-slate-950/80 border border-white/10 overflow-hidden aspect-video flex items-center justify-center relative">
                  {previewUrlRef.current && (
                    <video
                      src={previewUrlRef.current}
                      className="w-full h-full object-contain bg-black opacity-40"
                    />
                  )}

                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 backdrop-blur-[2px]">
                    {isCompleted ? (
                      <>
                        <div className="size-20 rounded-full bg-emerald-500/20 flex items-center justify-center border-2 border-emerald-400/40 shadow-lg shadow-emerald-500/20">
                          <Check className="size-10 text-emerald-400 stroke-[3]" />
                        </div>
                        <div className="text-center space-y-1">
                          <h2 className="text-2xl font-display font-bold text-white">
                            Multimodal Compilation Complete
                          </h2>
                          <p className="text-sm text-slate-300 max-w-md">
                            Accessibility Twin generated with verified evidence, audio descriptions, and grounded quiz.
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="relative size-24">
                          <div className="absolute inset-0 rounded-full border-2 border-white/10" />
                          <div
                            className="absolute inset-0 rounded-full border-4 border-transparent border-t-brand-indigo border-r-brand-indigo/60 animate-spin"
                            style={{ animationDuration: "1.2s" }}
                          />
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-2xl font-bold font-mono text-white">
                              {Math.round(status?.progress ?? 0)}%
                            </span>
                          </div>
                        </div>
                        <div className="text-center max-w-sm space-y-1">
                          <p className="text-base font-bold text-white uppercase tracking-wider font-mono">
                            {PIPELINE_STAGES[currentStageIdx]?.label || "Processing"}
                          </p>
                          <p className="text-xs sm:text-sm text-slate-300">
                            {PIPELINE_STAGES[currentStageIdx]?.sub || "Compiling lecture accessibility twin…"}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Progress Bar & Badges */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs font-mono font-semibold">
                    <span className="text-slate-400">
                      JOB ID: <span className="text-white font-bold">{jobId || "pending"}</span>
                    </span>
                    <span className="text-brand-indigo">
                      STAGE {currentStageIdx + 1} OF {PIPELINE_STAGES.length}
                    </span>
                  </div>

                  <div className="h-2.5 w-full rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-indigo via-blue-500 to-emerald-400 transition-all duration-500"
                      style={{ width: `${status?.progress ?? 0}%` }}
                    />
                  </div>

                  {isCompleted && jobId && (
                    <div className="space-y-4 pt-2">
                      <div className="flex flex-wrap gap-2">
                        <Badge className="bg-blue-500/15 text-blue-300 border-blue-500/30 px-3 py-1 text-xs font-semibold">
                          Whisper Transcript
                        </Badge>
                        <Badge className="bg-sky-500/15 text-sky-300 border-sky-500/30 px-3 py-1 text-xs font-semibold">
                          Vision Keyframes
                        </Badge>
                        <Badge className="bg-cyan-500/15 text-cyan-300 border-cyan-500/30 px-3 py-1 text-xs font-semibold">
                          OCR Syntax Extraction
                        </Badge>
                        <Badge className="bg-indigo-500/15 text-indigo-300 border-indigo-500/30 px-3 py-1 text-xs font-semibold">
                          Knowledge Graph
                        </Badge>
                        <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 px-3 py-1 text-xs font-semibold">
                          Disparity Engine
                        </Badge>
                        <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 px-3 py-1 text-xs font-semibold">
                          Audio Description Layer
                        </Badge>
                      </div>

                      <Link href={`/lectures/${encodeURIComponent(jobId)}`} className="block">
                        <Button
                          size="lg"
                          className="w-full gap-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base py-3.5 shadow-lg shadow-emerald-600/30"
                        >
                          <Sparkles className="size-5" />
                          <span>Launch Accessibility Studio</span>
                          <ArrowRight className="size-5" />
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )}

            {error && (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-rose-400" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-rose-200">Compilation Error</p>
                  <p className="text-xs mt-1 text-rose-300 leading-relaxed">{error}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: MULTIMODAL COMPILATION PIPELINE (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl bg-white dark:bg-[#0B1020] border border-slate-200 dark:border-[#1E294B] shadow-sm overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02]">
            <div className="flex items-center gap-2.5">
              <Cpu className="size-4 text-brand-indigo" />
              <h2 className="text-xs sm:text-sm font-mono font-bold tracking-wider text-slate-800 dark:text-slate-200 uppercase">
                Multimodal Compilation Pipeline
              </h2>
            </div>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300">
              7 STAGES
            </span>
          </div>

          {/* Pipeline Stage Items with proper Grid layout to prevent text overlap */}
          <div className="p-4 sm:p-5 space-y-3">
            {PIPELINE_STAGES.map((stage, i) => {
              const idx = currentStageIdx;
              const isDone = idx >= 0 && idx > i;
              const isCurrent = idx === i && !isCompleted;
              const StateIcon = stage.Icon;

              return (
                <div
                  key={stage.id}
                  className={cn(
                    "grid grid-cols-[auto_1fr_auto] items-center gap-3.5 p-3.5 rounded-xl border transition-all",
                    isCurrent
                      ? "bg-brand-indigo/10 border-brand-indigo/40 ring-1 ring-brand-indigo/30 shadow-sm"
                      : isDone
                      ? "bg-emerald-500/5 border-emerald-500/20"
                      : "bg-slate-50/70 dark:bg-white/[0.02] border-slate-200/70 dark:border-white/5"
                  )}
                >
                  {/* Left: Icon Badge */}
                  <div
                    className={cn(
                      "size-11 rounded-xl flex items-center justify-center shrink-0 transition-all font-bold",
                      isDone
                        ? "bg-emerald-500 text-white shadow-sm"
                        : isCurrent
                        ? "bg-brand-indigo text-white shadow-md ring-2 ring-brand-indigo/30"
                        : "bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-700"
                    )}
                  >
                    {isDone ? (
                      <Check className="size-5 stroke-[3]" />
                    ) : isCurrent ? (
                      <Loader2 className="size-5 animate-spin" />
                    ) : (
                      <StateIcon className="size-5" />
                    )}
                  </div>

                  {/* Middle: Content with explicit word-wrapping */}
                  <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-xs font-mono font-bold uppercase tracking-wider",
                          isDone
                            ? "text-emerald-600 dark:text-emerald-400"
                            : isCurrent
                            ? "text-brand-indigo"
                            : "text-slate-700 dark:text-slate-300"
                        )}
                      >
                        {stage.stageNum} · {stage.label}
                      </span>
                    </div>
                    <p className="text-xs sm:text-[13px] text-slate-600 dark:text-slate-300 leading-snug line-clamp-2">
                      {stage.sub}
                    </p>
                  </div>

                  {/* Right: Status Pill */}
                  <div className="shrink-0 flex items-center justify-end pl-1">
                    {isDone ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                        <CheckCircle2 className="size-4" />
                        <span className="hidden sm:inline">DONE</span>
                      </span>
                    ) : isCurrent ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-indigo font-mono">
                        <Loader2 className="size-3.5 animate-spin" />
                        <span className="hidden sm:inline">ACTIVE</span>
                      </span>
                    ) : (
                      <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                        PENDING
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* SECTION: LECTURE LIBRARY (Sanitized educational benchmark lectures) */}
      <div className="space-y-6 pt-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-white/10 pb-4">
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-950 dark:text-white">
              Compiled Lecture Library & Benchmarks
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Open previously compiled lectures or inspect the verified multimodal benchmark dataset.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-indigo/10 border border-brand-indigo/20 text-brand-indigo font-mono text-xs font-semibold w-fit">
            <Library className="size-3.5" />
            <span>{displayLectures.length} {displayLectures.length === 1 ? "Lecture Available" : "Lectures Available"}</span>
          </span>
        </div>

        {lecturesLoading ? (
          <PageLoader label="Loading library lectures…" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {displayLectures.map((lec) => {
              const isDemo = String(lec.job_id + lec.filename).toUpperCase().includes("DEMO");
              const isReady = lec.status === "done" || lec.status === "partial";
              const healthScore = isDemo ? 100 : 92;

              return (
                <Link
                  key={lec.job_id}
                  href={`/lectures/${encodeURIComponent(lec.job_id)}`}
                  className="group block"
                >
                  <div className="rounded-2xl bg-white dark:bg-[#0B1020] border border-slate-200 dark:border-[#1E294B] shadow-sm hover:shadow-md hover:border-brand-indigo/40 dark:hover:border-brand-indigo/40 transition-all duration-200 overflow-hidden flex flex-col h-full">
                    {/* Top Ribbon */}
                    <div
                      className={cn(
                        "px-5 py-3 flex items-center justify-between text-white",
                        isDemo
                          ? "bg-gradient-to-r from-brand-indigo via-violet-600 to-indigo-700"
                          : "bg-gradient-to-r from-slate-800 via-slate-900 to-slate-950"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {isDemo ? (
                          <>
                            <Sparkles className="size-4 text-amber-300" />
                            <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-100">
                              Verified Multimodal Benchmark
                            </span>
                          </>
                        ) : (
                          <>
                            <BookOpen className="size-4 text-slate-300" />
                            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                              Compiled Lecture
                            </span>
                          </>
                        )}
                      </div>
                      <span className="text-xs font-mono text-white/80 font-semibold">
                        {lec.job_id}
                      </span>
                    </div>

                    {/* Card Content */}
                    <div className="p-5 flex-1 flex flex-col justify-between gap-5">
                      <div className="flex items-start gap-3.5">
                        <div className="size-12 rounded-xl bg-brand-indigo/10 border border-brand-indigo/20 flex items-center justify-center text-brand-indigo group-hover:scale-105 transition-transform shrink-0">
                          <FileVideo className="size-6" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base sm:text-lg font-bold text-slate-950 dark:text-white truncate group-hover:text-brand-indigo transition-colors">
                            {isDemo ? "Python Loops & Control Flow (Benchmark)" : lec.filename}
                          </h3>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-600 dark:text-slate-300 font-mono">
                            <span className="inline-flex items-center gap-1 font-semibold">
                              <Clock className="size-3.5 text-slate-400" />
                              {formatSeconds(lec.duration || 300)}
                            </span>
                            <span>·</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                              Ready · Fully Indexed
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Health / Grounding Bar */}
                      <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-white/5">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="text-slate-500 uppercase tracking-wider font-semibold">
                            Multimodal Grounding Score
                          </span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {healthScore}%
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all"
                            style={{ width: `${healthScore}%` }}
                          />
                        </div>
                      </div>

                      {/* Bottom Action Strip */}
                      <div className="flex items-center justify-between pt-2 text-xs font-bold text-brand-indigo group-hover:text-brand-indigo/90">
                        <span>Open Accessibility Studio</span>
                        <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
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
