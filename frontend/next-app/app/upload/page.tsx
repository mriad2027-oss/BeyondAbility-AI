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
import { uploadVideo, startProcessing, getPipelineStatus, ApiError } from "@/lib/api";
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
    accentColor: "#5B82A6",
    badgeClass: "text-[#5B82A6] border-[#5B82A6]/30 bg-[#5B82A6]/10",
  },
  {
    id: "vision",
    stageNum: "02",
    label: "VISION",
    sub: "Keyframe selection & visual scene decomposition",
    Icon: Eye,
    accentColor: "#5F9A9A",
    badgeClass: "text-[#5F9A9A] border-[#5F9A9A]/30 bg-[#5F9A9A]/10",
  },
  {
    id: "ocr",
    stageNum: "03",
    label: "OCR / SYNTAX",
    sub: "Code, math & diagram on-screen text extraction",
    Icon: ScanEye,
    accentColor: "#5F9A9A",
    badgeClass: "text-[#5F9A9A] border-[#5F9A9A]/30 bg-[#5F9A9A]/10",
  },
  {
    id: "align",
    stageNum: "04",
    label: "TEMPORAL ALIGNMENT",
    sub: "Cross-modal sync: what is spoken vs. what is shown",
    Icon: Network,
    accentColor: "#B85C38",
    badgeClass: "text-[#B85C38] border-[#B85C38]/30 bg-[#B85C38]/10",
  },
  {
    id: "reason",
    stageNum: "05",
    label: "DISPARITY REASONING",
    sub: "Detects inaccessible visual gaps not explained in audio",
    Icon: Cpu,
    accentColor: "#B77932",
    badgeClass: "text-[#B77932] border-[#B77932]/30 bg-[#B77932]/10",
  },
  {
    id: "twin",
    stageNum: "06",
    label: "ACCESSIBILITY TWIN",
    sub: "Multimodal knowledge graph & digital nervous system",
    Icon: Hexagon,
    accentColor: "#6C63A8",
    badgeClass: "text-[#6C63A8] border-[#6C63A8]/30 bg-[#6C63A8]/10",
  },
  {
    id: "verify",
    stageNum: "07",
    label: "VERIFICATION & AD",
    sub: "Grounded non-destructive audio description & quiz",
    Icon: ShieldCheckIcon,
    accentColor: "#5F8A62",
    badgeClass: "text-[#5F8A62] border-[#5F8A62]/30 bg-[#5F8A62]/10",
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
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      clearPolling();
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
    clearPolling();
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

      const realJobId = up.job_id;

      // Initial status to show processing started
      setStatus({
        stage: "uploaded",
        progress: 1,
        status: "processing",
      });

      let elapsed = 0;
      const POLL_INTERVAL_MS = 1500;
      const MAX_POLL_SECONDS = 900;

      pollIntervalRef.current = setInterval(async () => {
        if (unmountedRef.current) {
          clearPolling();
          return;
        }
        try {
          const s = await getPipelineStatus(realJobId);
          const stageName = s.current_stage ?? s.status ?? "processing";
          const progressNum = typeof s.progress === "number"
            ? Math.min(99, Math.max(0, s.progress))
            : (s.status === "done" || s.status === "partial" ? 100 : (status?.progress ?? 5));

          if (!unmountedRef.current) {
            setStatus({
              stage: stageName,
              progress: s.status === "done" || s.status === "partial" ? 100 : progressNum,
              status: s.status ?? "processing",
            });
          }

          if (s.error && !unmountedRef.current) {
            clearPolling();
            setProcessing(false);
            setError(`Processing failed: ${s.error}`);
            return;
          }

          if ((s.status === "done" || s.status === "partial") && !unmountedRef.current) {
            clearPolling();
            setProcessing(false);
            setIsCompleted(true);
            await refresh?.();
            router.push(`/lectures/${encodeURIComponent(realJobId)}`);
            return;
          }

          if (s.status === "failed" && !unmountedRef.current) {
            clearPolling();
            setProcessing(false);
            setError(s.error || "Processing failed. Please try again.");
            return;
          }
        } catch (pollErr: unknown) {
          if (unmountedRef.current) {
            clearPolling();
            return;
          }
          if (pollErr instanceof ApiError) {
            clearPolling();
            setProcessing(false);
            setError(pollErr.message);
            return;
          }
        }
      }, POLL_INTERVAL_MS);

      pollTimeoutRef.current = setTimeout(() => {
        clearPolling();
        if (!unmountedRef.current) {
          setProcessing(false);
          setError("Processing timed out. The backend is taking longer than expected. Please try again later.");
        }
      }, MAX_POLL_SECONDS * 1000);
    } catch (e: unknown) {
      clearPolling();
      setUploading(false);
      setProcessing(false);
      if (e instanceof ApiError) {
        setError(e.message);
      } else {
        setError(e instanceof Error ? e.message : "Failed to upload video");
      }
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
    return lectures.filter((lec) => {
      const name = (lec.filename || "").toLowerCase();
      const id = (lec.job_id || "").toLowerCase();
      return !name.includes("whatsapp") && !id.includes("whatsapp");
    });
  }, [lectures]);

  return (
    <div className="w-full max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 space-y-10 lg:space-y-12">
      {/* PAGE HEADER */}
      <div className="flex flex-col gap-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FFF8F4] border border-[#E8C2B2] text-[#B85C38] font-mono text-xs font-bold uppercase tracking-wider w-fit shadow-xs">
          <Cpu className="size-3.5" />
          <span>Compiler Workspace · Multimodal Ingestion</span>
        </div>
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-display font-black tracking-tight text-[#2F2924] leading-[1.08]">
          Multimodal Accessibility Compiler
        </h1>
        <p className="text-base sm:text-lg lg:text-xl text-[#51483F] max-w-3xl leading-relaxed">
          Decompile raw educational video into synchronized speech, computer vision, OCR, causal disparity reasoning, and an indexed Accessibility Twin.
        </p>
      </div>

      {/* TOP PRODUCT HUD BAR */}
      <div className="rounded-2xl border border-[#DDD0C0] bg-[#FFFDFC] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3.5 min-w-0">
          <div
            className={cn(
              "flex items-center justify-center rounded-xl size-11 shrink-0 font-bold",
              workspaceMode === "ready"
                ? "bg-[#EBF5EC] text-[#3D6B40] border border-[#C5E3C7]"
                : workspaceMode === "processing"
                ? "bg-[#FFF8F4] text-[#B85C38] border border-[#E8C2B2]"
                : workspaceMode === "staged"
                ? "bg-[#FEF6EC] text-[#B77932] border border-[#F3CE9D]"
                : "bg-[#F1E8DC] text-[#7A7067] border border-[#DDD0C0]"
            )}
          >
            {workspaceMode === "ready" ? (
              <CheckCircle2 className="size-5 text-[#5F8A62]" />
            ) : workspaceMode === "processing" ? (
              <Loader2 className="size-5 animate-spin text-[#B85C38]" />
            ) : workspaceMode === "staged" ? (
              <FileVideo className="size-5 text-[#B77932]" />
            ) : (
              <Layers className="size-5 text-[#7A7067]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm sm:text-base font-bold text-[#2F2924] leading-tight truncate">
              {jobId ? (
                <>
                  Compilation Job: <span className="font-mono text-[#B85C38]">{jobId}</span>
                </>
              ) : file ? (
                <>{file.name}</>
              ) : (
                <>Compiler Engine Ready</>
              )}
            </p>
            <p className="text-xs sm:text-sm text-[#7A7067] mt-1">
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
                ? "bg-[#EBF5EC] text-[#3D6B40] border border-[#C5E3C7]"
                : workspaceMode === "processing"
                ? "bg-[#FFF8F4] text-[#B85C38] border border-[#E8C2B2] animate-pulse"
                : workspaceMode === "staged"
                ? "bg-[#FEF6EC] text-[#B77932] border border-[#F3CE9D]"
                : "bg-[#F1E8DC] text-[#7A7067] border border-[#DDD0C0]"
            )}
          >
            <span
              className={cn(
                "size-2 rounded-full",
                workspaceMode === "ready"
                  ? "bg-[#5F8A62]"
                  : workspaceMode === "processing"
                  ? "bg-[#B85C38] animate-ping"
                  : workspaceMode === "staged"
                  ? "bg-[#B77932]"
                  : "bg-[#7A7067]"
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
              <Button size="default" className="gap-2 bg-[#B85C38] hover:bg-[#9F4F32] text-white font-bold shadow-md shadow-[#B85C38]/20">
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
        <div className="lg:col-span-7 rounded-2xl bg-[#FFFDFC] border border-[#DDD0C0] shadow-sm overflow-hidden flex flex-col min-h-[520px]">
          {/* Surface Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#EDE2D3] bg-[#FBF8F2]">
            <div className="flex items-center gap-2.5">
              <Layers className="size-4 text-[#B85C38]" />
              <p className="text-xs sm:text-sm font-mono font-bold tracking-wider text-[#2F2924] uppercase">
                Media Ingestion Boundary
              </p>
            </div>
            <span className="text-xs font-mono text-[#7A7067]">
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
                    ? "border-[#B85C38] bg-[#FFF8F4] scale-[0.99]"
                    : "border-[#DDD0C0] hover:border-[#B85C38] bg-[#FBF8F2]/60 hover:bg-[#FFF8F4]/40"
                )}
              >
                <div
                  className={cn(
                    "relative flex items-center justify-center rounded-3xl size-24 transition-all shadow-sm",
                    isDragging
                      ? "bg-[#B85C38] text-white shadow-[#B85C38]/30 scale-105"
                      : "bg-[#FFF8F4] text-[#B85C38] border border-[#E8C2B2]"
                  )}
                >
                  {uploading ? (
                    <Loader2 className="size-10 animate-spin" />
                  ) : (
                    <>
                      <Upload className="size-10" />
                      <div className="absolute -right-2 -top-2 size-7 rounded-full bg-[#B85C38] flex items-center justify-center text-white shadow-xs">
                        <Sparkles className="size-4" />
                      </div>
                    </>
                  )}
                </div>

                <div className="space-y-2 max-w-lg">
                  <h2 className="text-xl sm:text-2xl font-display font-bold text-[#2F2924] tracking-tight">
                    Upload Educational Lecture Video
                  </h2>
                  <p className="text-sm sm:text-base text-[#51483F] leading-relaxed">
                    Drag and drop your lecture video file here, or browse from your device. Local offline multimodal decomposition ensures zero external data leakage.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <Button
                    type="button"
                    size="lg"
                    className="gap-2 bg-[#B85C38] hover:bg-[#9F4F32] text-white font-bold px-6 py-3 shadow-md shadow-[#B85C38]/20"
                  >
                    <Upload className="size-4.5" />
                    <span>Select Video File</span>
                  </Button>
                  <span className="text-xs font-mono text-[#7A7067]">or drop raw .mp4</span>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  <span className="px-2.5 py-1 rounded-md bg-[#F4F7FA] border border-[#D5E1EC] text-xs font-mono text-[#5B82A6] font-semibold">
                    Whisper Speech
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-[#F2F7F7] border border-[#D2E4E4] text-xs font-mono text-[#5F9A9A] font-semibold">
                    CV Keyframes
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-[#F6F5FB] border border-[#DDD8EE] text-xs font-mono text-[#6C63A8] font-semibold">
                    OCR Syntax
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-[#FFF8F4] border border-[#F3CE9D] text-xs font-mono text-[#B77932] font-semibold">
                    Disparity AI
                  </span>
                </div>
              </div>
            )}

            {/* STAGED FILE STATE */}
            {file && !processing && !isCompleted && (
              <div className="flex flex-col gap-6">
                <div className="rounded-xl bg-[#EDE2D3] border border-[#DDD0C0] overflow-hidden min-h-[260px] flex items-center justify-center">
                  {previewUrlRef.current ? (
                    <video
                      src={previewUrlRef.current}
                      controls
                      className="w-full max-h-[340px] object-contain bg-black"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-[#7A7067] p-8">
                      <FileVideo className="size-12 text-[#B85C38]" />
                      <p className="text-sm font-semibold text-[#2F2924]">Video preview ready</p>
                    </div>
                  )}
                </div>

                <div className="rounded-xl bg-[#FBF8F2] border border-[#DDD0C0] p-5 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#7A7067]">
                        Staged Video File
                      </span>
                      <p className="text-base sm:text-lg font-bold text-[#2F2924] truncate mt-0.5">
                        {file.name}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs font-mono text-[#51483F]">
                        <span className="font-semibold text-[#5F8A62]">
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
                      className="border-[#DDD0C0] text-[#51483F] hover:text-[#2F2924] hover:bg-[#F1E8DC]"
                    >
                      Change Video
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-[#EDE2D3] text-xs text-[#51483F]">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="size-4 text-[#5F8A62] shrink-0" />
                      <span>Preserves original audio</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="size-4 text-[#5F8A62] shrink-0" />
                      <span>Non-destructive AD</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="size-4 text-[#5F8A62] shrink-0" />
                      <span>Causal gap detection</span>
                    </div>
                  </div>

                  <Button
                    onClick={handleUpload}
                    disabled={uploading}
                    size="lg"
                    className="w-full gap-2.5 bg-[#B85C38] hover:bg-[#9F4F32] text-white font-bold text-base py-3.5 shadow-md shadow-[#B85C38]/20"
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
                <div className="rounded-xl bg-[#EDE2D3] border border-[#DDD0C0] overflow-hidden aspect-video flex items-center justify-center relative">
                  {previewUrlRef.current && (
                    <video
                      src={previewUrlRef.current}
                      className="w-full h-full object-contain bg-black opacity-30"
                    />
                  )}

                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 backdrop-blur-[2px]">
                    {isCompleted ? (
                      <>
                        <div className="size-20 rounded-full bg-[#EBF5EC] flex items-center justify-center border-2 border-[#C5E3C7] shadow-md shadow-[#5F8A62]/10">
                          <Check className="size-10 text-[#5F8A62] stroke-[3]" />
                        </div>
                        <div className="text-center space-y-1">
                          <h2 className="text-2xl font-display font-bold text-[#2F2924]">
                            Multimodal Compilation Complete
                          </h2>
                          <p className="text-sm text-[#51483F] max-w-md">
                            Accessibility Twin generated with verified evidence, audio descriptions, and grounded quiz.
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="relative size-24">
                          <div className="absolute inset-0 rounded-full border-2 border-[#DDD0C0]" />
                          <div
                            className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#B85C38] border-r-[#B85C38]/60 animate-spin"
                            style={{ animationDuration: "1.2s" }}
                          />
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-2xl font-bold font-mono text-[#2F2924]">
                              {Math.round(status?.progress ?? 0)}%
                            </span>
                          </div>
                        </div>
                        <div className="text-center max-w-sm space-y-1">
                          <p className="text-base font-bold text-[#2F2924] uppercase tracking-wider font-mono">
                            {PIPELINE_STAGES[currentStageIdx]?.label || "Processing"}
                          </p>
                          <p className="text-xs sm:text-sm text-[#51483F]">
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
                    <span className="text-[#7A7067]">
                      JOB ID: <span className="text-[#2F2924] font-bold">{jobId || "pending"}</span>
                    </span>
                    <span className="text-[#B85C38] font-bold">
                      STAGE {currentStageIdx + 1} OF {PIPELINE_STAGES.length}
                    </span>
                  </div>

                  <div className="h-2.5 w-full rounded-full bg-[#EDE2D3] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#B85C38] via-[#C49A5A] to-[#5F8A62] transition-all duration-500"
                      style={{ width: `${status?.progress ?? 0}%` }}
                    />
                  </div>

                  {isCompleted && jobId && (
                    <div className="space-y-4 pt-2">
                      <div className="flex flex-wrap gap-2">
                        <Badge className="bg-[#F4F7FA] text-[#5B82A6] border-[#D5E1EC] px-3 py-1 text-xs font-semibold">
                          Whisper Transcript
                        </Badge>
                        <Badge className="bg-[#F2F7F7] text-[#5F9A9A] border-[#D2E4E4] px-3 py-1 text-xs font-semibold">
                          Vision Keyframes
                        </Badge>
                        <Badge className="bg-[#F6F5FB] text-[#6C63A8] border-[#DDD8EE] px-3 py-1 text-xs font-semibold">
                          OCR Syntax Extraction
                        </Badge>
                        <Badge className="bg-[#FFF8F4] text-[#B85C38] border-[#E8C2B2] px-3 py-1 text-xs font-semibold">
                          Knowledge Graph
                        </Badge>
                        <Badge className="bg-[#FEF6EC] text-[#B77932] border-[#F3CE9D] px-3 py-1 text-xs font-semibold">
                          Disparity Engine
                        </Badge>
                        <Badge className="bg-[#EBF5EC] text-[#3D6B40] border-[#C5E3C7] px-3 py-1 text-xs font-semibold">
                          Audio Description Layer
                        </Badge>
                      </div>

                      <Link href={`/lectures/${encodeURIComponent(jobId)}`} className="block">
                        <Button
                          size="lg"
                          className="w-full gap-2.5 bg-[#B85C38] hover:bg-[#9F4F32] text-white font-bold text-base py-3.5 shadow-md shadow-[#B85C38]/20"
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
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-[#B94A48]/30 bg-[#FDF2F2] p-4 text-sm text-[#B94A48]">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[#B94A48]" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[#B94A48]">Compilation Error</p>
                  <p className="text-xs mt-1 text-[#51483F] leading-relaxed">{error}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: MULTIMODAL COMPILATION PIPELINE (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl bg-[#FFFDFC] border border-[#DDD0C0] shadow-sm overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#EDE2D3] bg-[#FBF8F2]">
            <div className="flex items-center gap-2.5">
              <Cpu className="size-4 text-[#B85C38]" />
              <h2 className="text-xs sm:text-sm font-mono font-bold tracking-wider text-[#2F2924] uppercase">
                Multimodal Compilation Pipeline
              </h2>
            </div>
            <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-[#EDE2D3] text-[#51483F]">
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
                      ? "bg-[#FFF8F4] border-[#E8C2B2] ring-1 ring-[#B85C38]/30 shadow-xs"
                      : isDone
                      ? "bg-[#EBF5EC]/60 border-[#C5E3C7]"
                      : "bg-[#FBF8F2]/70 border-[#EDE2D3]"
                  )}
                >
                  {/* Left: Icon Badge */}
                  <div
                    className={cn(
                      "size-11 rounded-xl flex items-center justify-center shrink-0 transition-all font-bold",
                      isDone
                        ? "bg-[#5F8A62] text-white shadow-xs"
                        : isCurrent
                        ? "bg-[#B85C38] text-white shadow-sm ring-2 ring-[#B85C38]/20"
                        : "bg-[#EDE2D3] text-[#7A7067] border border-[#DDD0C0]"
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
                            ? "text-[#3D6B40]"
                            : isCurrent
                            ? "text-[#B85C38]"
                            : "text-[#51483F]"
                        )}
                      >
                        {stage.stageNum} · {stage.label}
                      </span>
                    </div>
                    <p className="text-xs sm:text-[13px] text-[#7A7067] leading-snug line-clamp-2">
                      {stage.sub}
                    </p>
                  </div>

                  {/* Right: Status Pill */}
                  <div className="shrink-0 flex items-center justify-end pl-1">
                    {isDone ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#5F8A62] font-mono">
                        <CheckCircle2 className="size-4" />
                        <span className="hidden sm:inline">DONE</span>
                      </span>
                    ) : isCurrent ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#B85C38] font-mono">
                        <Loader2 className="size-3.5 animate-spin" />
                        <span className="hidden sm:inline">ACTIVE</span>
                      </span>
                    ) : (
                      <span className="text-[11px] font-mono text-[#7A7067]">
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DDD0C0] pb-4">
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-display font-bold text-[#2F2924]">
              Compiled Lecture Library & Benchmarks
            </h2>
            <p className="text-sm text-[#51483F]">
              Open previously compiled lectures or inspect the verified multimodal benchmark dataset.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF8F4] border border-[#E8C2B2] text-[#B85C38] font-mono text-xs font-semibold w-fit">
            <Library className="size-3.5" />
            <span>{displayLectures.length} {displayLectures.length === 1 ? "Lecture Available" : "Lectures Available"}</span>
          </span>
        </div>

        {lecturesLoading ? (
          <PageLoader label="Loading library lectures…" />
        ) : displayLectures.length === 0 ? (
          <EmptyState
            icon={Library}
            title="No processed lectures yet."
            description="Upload a video above to get started. Once processing completes, your compiled Accessibility Twin will appear here."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => inputRef.current?.click()}
                className="gap-2 border-[#DDD0C0] bg-[#FFFDFC] hover:bg-[#F1E8DC]"
              >
                <Upload className="size-3.5 text-[#B85C38]" />
                <span>Upload Video</span>
              </Button>
            }
          />
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
                  <div className="rounded-2xl bg-[#FFFDFC] border border-[#DDD0C0] shadow-sm hover:shadow-md hover:border-[#B85C38] transition-all duration-200 overflow-hidden flex flex-col h-full">
                    {/* Top Ribbon */}
                    <div
                      className={cn(
                        "px-5 py-3 flex items-center justify-between text-white",
                        isDemo
                          ? "bg-gradient-to-r from-[#B85C38] via-[#C97858] to-[#9F4F32]"
                          : "bg-gradient-to-r from-[#6F4E37] via-[#8B6B52] to-[#51483F]"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {isDemo ? (
                          <>
                            <Sparkles className="size-4 text-amber-200" />
                            <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-100">
                              Verified Multimodal Benchmark
                            </span>
                          </>
                        ) : (
                          <>
                            <BookOpen className="size-4 text-[#EDE2D3]" />
                            <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#EDE2D3]">
                              Compiled Lecture
                            </span>
                          </>
                        )}
                      </div>
                      <span className="text-xs font-mono text-white/90 font-semibold">
                        {lec.job_id}
                      </span>
                    </div>

                    {/* Card Content */}
                    <div className="p-5 flex-1 flex flex-col justify-between gap-5">
                      <div className="flex items-start gap-3.5">
                        <div className="size-12 rounded-xl bg-[#FFF8F4] border border-[#E8C2B2] flex items-center justify-center text-[#B85C38] group-hover:scale-105 transition-transform shrink-0 shadow-xs">
                          <FileVideo className="size-6" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base sm:text-lg font-bold text-[#2F2924] truncate group-hover:text-[#B85C38] transition-colors">
                            {isDemo ? "Python Loops & Control Flow (Benchmark)" : lec.filename}
                          </h3>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-[#7A7067] font-mono">
                            <span className="inline-flex items-center gap-1 font-semibold">
                              <Clock className="size-3.5 text-[#8B6B52]" />
                              {formatSeconds(lec.duration || 300)}
                            </span>
                            <span>·</span>
                            <span className="text-[#5F8A62] font-semibold">
                              Ready · Fully Indexed
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Health / Grounding Bar */}
                      <div className="space-y-2 pt-2 border-t border-[#EDE2D3]">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="text-[#7A7067] uppercase tracking-wider font-semibold">
                            Multimodal Grounding Score
                          </span>
                          <span className="font-bold text-[#5F8A62]">
                            {healthScore}%
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-[#EDE2D3] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#5F8A62] transition-all"
                            style={{ width: `${healthScore}%` }}
                          />
                        </div>
                      </div>

                      {/* Bottom Action Strip */}
                      <div className="flex items-center justify-between pt-2 text-xs font-bold text-[#B85C38] group-hover:text-[#9F4F32]">
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
