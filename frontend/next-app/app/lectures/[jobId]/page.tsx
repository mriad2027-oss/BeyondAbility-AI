"use client";

import * as React from "react";
import { use, useState, useEffect, useRef, useMemo, useLayoutEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, useParams } from "next/navigation";
import {
  Sparkles,
  ImageIcon,
  ListVideo,
  EyeOff,
  ListChecks,
  Play,
  Pause,
  MessageSquareText,
  ShieldCheck,
  AlertTriangle,
  CircleHelp,
  Send,
  ExternalLink,
  BarChart3,
  Video,
  Quote,
  ScanText,
  ChevronDown,
  BadgeCheck,
  Mic,
  ShieldAlert,
  FileAudio,
  AudioLines,
  FileBarChart2,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowRight,
  Sliders,
  ChevronLeft,
  Layers,
  Sparkles as SparklesIcon,
  Hexagon,
  Activity,
  List as ListIcon,
  Search,
  FileText,
  BrainCircuit,
  MonitorPlay,
} from "lucide-react";
import { useWorkspace } from "@/components/lecture/WorkspaceProvider";
import { WorkspaceProvider } from "@/components/lecture/WorkspaceProvider";
import { isDemo } from "@/components/lecture/LecturePicker";
import { VideoPlayer, VideoPlayerHandle } from "@/components/video/VideoPlayer";
import { GapReasoningChain } from "@/components/accessibility/GapReasoningChain";
import { AudioDescriptionStudioCue } from "@/components/accessibility/AudioDescriptionStudioCue";
import { MultimodalTimeline } from "@/components/timeline/MultimodalTimeline";
import { ContextualIntelligencePanel } from "@/components/studio/ContextualIntelligencePanel";
import { AccessibilityTwin } from "@/components/twin/AccessibilityTwin";
import { SectionRail, TrustPill, EvidenceTimestamp, DataStrip, EvidenceSnippet, ConceptBadge } from "@/components/ui/evidence-primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrustBadge } from "@/components/ui/trust-badge";
import { ScoreRing } from "@/components/ui/score-ring";
import {
  videoUrl,
  narrationUrl,
  resolveFileUrl,
  getVisualEvents,
  getVisualUnderstanding,
  getTranscript,
  getAccessibilityScore,
  getAccessibilityReport,
  getTimeline,
  getMissing,
  getAudioDescription,
  askQuestion,
  getMetrics,
} from "@/lib/api";
import { cn, formatClock, formatSeconds, formatTimestampLabel, trustOf } from "@/lib/format";
import type {
  AnalysisItem,
  TranscriptSegment,
  MissingItem,
  AskResponse,
  TimelineItem,
  VisualUnderstanding,
  AudioDescriptionCue,
  AccessibilityReport,
  AccessibilityScore,
  MetricsResponse,
} from "@/types/backend";
import { getLectureInteractionEvents } from "@/lib/interactionEvents";
import type { VideoInteractionEvent } from "@/types/interaction";

type WorkspaceTab = "overview" | "visual" | "audio" | "missing" | "timeline" | "ask" | "report";

const TAB_ORDER: { id: WorkspaceTab; label: string; Icon: any; hint: string }[] = [
  { id: "overview", label: "Overview",   Icon: MonitorPlay, hint: "Live synchronized intelligence at current moment" },
  { id: "visual",   label: "Visual",     Icon: ImageIcon,   hint: "Keyframes, OCR, and grounded visual claims" },
  { id: "audio",    label: "Audio",      Icon: FileAudio,   hint: "Layered non-destructive Audio Description studio" },
  { id: "missing",  label: "Missing",    Icon: EyeOff,      hint: "Cross-modal gap reasoning chain" },
  { id: "timeline", label: "Timeline",   Icon: ListVideo,   hint: "Full matrix of modalities across time" },
  { id: "ask",      label: "Ask",        Icon: MessageSquareText, hint: "Grounded Q&A with timestamped evidence" },
  { id: "report",   label: "Report",     Icon: FileBarChart2, hint: "Accessibility Health methodology & Twin" },
];

export default function LectureWorkspacePage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = use(params);

  return (
    <WorkspaceProvider initialJobId={jobId}>
      <WorkspaceRoute jobId={jobId} />
    </WorkspaceProvider>
  );
}

function WorkspaceRoute({ jobId }: { jobId: string }) {
  const { setSelectedId, selected, loading } = useWorkspace();

  useEffect(() => {
    setSelectedId(jobId);
  }, [jobId, setSelectedId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-[1500px] p-6 space-y-6">
        <div className="h-9 w-3/5 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-8 w-full animate-pulse rounded-lg bg-slate-100" />
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="h-[460px] animate-pulse rounded-2xl bg-slate-200" />
          <div className="h-[460px] animate-pulse rounded-2xl bg-slate-200" />
        </div>
        <div className="h-48 animate-pulse rounded-2xl bg-slate-200" />
      </div>
    );
  }

  if (!selected) {
    return (
      <div className="mx-auto max-w-3xl py-16 text-center">
        <p className="text-app-soft">Lecture &ldquo;{jobId}&rdquo; was not found.</p>
        <Link href="/upload" className="mt-4 inline-block">
          <Button variant="secondary">Back to Compile &amp; Lectures</Button>
        </Link>
      </div>
    );
  }

  return (
    <Suspense fallback={null}>
      <WorkspaceBody />
    </Suspense>
  );
}

interface LiveVisualData {
  analysis: AnalysisItem[];
  segments: TranscriptSegment[];
  missing: MissingItem[];
  timeline: TimelineItem[];
  score: AccessibilityScore | null;
  report: AccessibilityReport | null;
  metrics: MetricsResponse | null;
  narration: string | null;
  understanding: VisualUnderstanding[];
  adCues: AudioDescriptionCue[];
  adAvailable: boolean;
  adReason: string;
}

function WorkspaceBody() {
  const { selected: lec, result, selectedId } = useWorkspace();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<WorkspaceTab>("overview");
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const videoRef = useRef<VideoPlayerHandle>(null);
  const adAudioRef = useRef<HTMLAudioElement | null>(null);
  const [adMode, setAdMode] = useState(false);
  const [activeCueIdx, setActiveCueIdx] = useState<number>(-1);
  const [adError, setAdError] = useState<string | null>(null);
  const [lecturePickerOpen, setLecturePickerOpen] = useState(false);
  const [selectedGapId, setSelectedGapId] = useState<string | number | null>(null);

  const [data, setData] = useState<LiveVisualData>({
    analysis: [],
    segments: [],
    missing: [],
    timeline: [],
    score: null,
    report: null,
    metrics: null,
    narration: null,
    understanding: [],
    adCues: [],
    adAvailable: false,
    adReason: "",
  });

  useEffect(() => {
    const t = searchParams?.get("tab");
    if (t && ["overview", "visual", "audio", "missing", "timeline", "ask", "report"].includes(t)) {
      setActiveTab(t as WorkspaceTab);
    }
  }, [searchParams]);

  const seekTarget = useMemo(() => {
    const raw = searchParams?.get("t");
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }, [searchParams]);

  useEffect(() => {
    if (seekTarget == null || !videoReady) return;
    videoRef.current?.seekTo(seekTarget);
  }, [seekTarget, videoReady]);

  useEffect(() => {
    if (!selectedId) return;
    setTime(0);
    let cancelled = false;

    const load = () => {
      getVisualEvents(selectedId).then((r) => !cancelled && setData((d) => ({ ...d, analysis: r.analysis ?? [] }))).catch(() => {});
      getVisualUnderstanding(selectedId).then((r) => !cancelled && setData((d) => ({ ...d, understanding: r.records ?? [] }))).catch(() => {});
      getTranscript(selectedId).then((r) => !cancelled && setData((d) => ({ ...d, segments: r.segments ?? [] }))).catch(() => {});
      getMissing(selectedId, "blind").then((r) => !cancelled && setData((d) => ({ ...d, missing: r.items ?? [] }))).catch(() => {});
      getTimeline(selectedId).then((r) => !cancelled && setData((d) => ({ ...d, timeline: r.timeline ?? [] }))).catch(() => {});
      getAccessibilityScore(selectedId).then((r) => !cancelled && setData((d) => ({ ...d, score: r }))).catch(() => {});
      getAccessibilityReport(selectedId).then((r) => !cancelled && setData((d) => ({ ...d, report: r }))).catch(() => {});
      getMetrics(selectedId).then((r) => !cancelled && setData((d) => ({ ...d, metrics: r }))).catch(() => {});
      getAudioDescription(selectedId)
        .then((r) => !cancelled && setData((d) => ({ ...d, adCues: r.cues ?? [], adAvailable: r.available, adReason: r.reason ?? "" })))
        .catch(() => {});
    };

    load();
    const to = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(to);
    };
  }, [selectedId]);

  useEffect(() => {
    const resultObj = (result?.result as Record<string, unknown> | undefined) ?? {};
    setData((d) => ({
      ...d,
      narration: narrationUrl(resultObj as { narration_audio_path?: string }),
    }));
  }, [result]);

  useEffect(() => {
    if (!adMode || data.adCues.length === 0) {
      setActiveCueIdx(-1);
      return;
    }
    const idx = data.adCues.findIndex((c) => time >= c.start && time < c.end);
    setActiveCueIdx(idx);
  }, [time, adMode, data.adCues]);

  useEffect(() => {
    if (!adMode) return;
    if (!adAudioRef.current) {
      const audio = new Audio();
      audio.preload = "auto";
      audio.volume = 1;
      audio.muted = false;
      audio.addEventListener("error", () => {
        if (adAudioRef.current === audio) setAdError("Could not load narration audio for this moment.");
      });
      audio.addEventListener("playing", () => {
        if (adAudioRef.current === audio) setAdError(null);
      });
      adAudioRef.current = audio;

      const unlock = () => {
        const el = adAudioRef.current;
        if (!el) return;
        el.volume = 1;
        el.muted = false;
        const p = el.play();
        if (p && typeof p.then === "function") p.then(() => { el.pause(); }).catch(() => {});
        document.removeEventListener("pointerdown", unlock);
        document.removeEventListener("keydown", unlock);
      };
      document.addEventListener("pointerdown", unlock);
      document.addEventListener("keydown", unlock);
    }
  }, [adMode]);

  useEffect(() => {
    const audio = adAudioRef.current;

    if (!adMode || activeCueIdx < 0 || !data.adCues[activeCueIdx]) {
      if (audio) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }
      adAudioRef.current = null;
      setAdError(null);
      return;
    }

    const cue = data.adCues[activeCueIdx];
    const url = resolveFileUrl(cue.audio_url);
    if (!url) {
      if (audio) { audio.pause(); adAudioRef.current = null; }
      setAdError("Audio description unavailable for this moment.");
      return;
    }

    let el = audio;
    if (!el) {
      const created = new Audio();
      created.preload = "auto";
      created.volume = 1;
      created.muted = false;
      created.addEventListener("error", () => setAdError("Could not load narration audio for this moment."));
      created.addEventListener("playing", () => setAdError(null));
      el = created;
      adAudioRef.current = created;
    }

    if (el.getAttribute("src") !== url) {
      el.src = url;
      el.load();
    }

    if (!playing) {
      el.pause();
      return;
    }

    const cueSpan = Math.max(0.001, (cue.end ?? cue.start) - (cue.start ?? 0));
    const offset = Math.max(0, Math.min((time ?? cue.start) - (cue.start ?? 0), cueSpan));

    const drift = Math.abs((el.currentTime || 0) - offset);
    if (el.paused || drift > 0.35) {
      try {
        if (!el.paused) el.pause();
        el.currentTime = offset;
      } catch {
        /* ignore */
      }
    }

    if (el.paused) {
      const p = el.play();
      if (p && typeof p.then === "function") {
        p.then(() => setAdError(null)).catch(() => setAdError("Audio description unavailable for this moment."));
      }
    }
  }, [activeCueIdx, playing, adMode, data.adCues, time]);

  const interactionEvents = useMemo(() => {
    return getLectureInteractionEvents(selectedId || "", data.analysis, data.missing, data.adCues);
  }, [selectedId, data.analysis, data.missing, data.adCues]);

  const duration = useMemo(() => {
    const all = [
      Number(lec?.duration ?? 0),
      ...data.segments.map((s) => Number(s.end ?? s.start)),
      ...data.analysis.map((a) => Number(a.end ?? a.start)),
      ...data.timeline.map((t) => Number(t.time ?? 0)),
      ...interactionEvents.map((e) => Number(e.timestamp ?? 0)),
    ];
    return Math.max(1, ...all);
  }, [lec?.duration, data.segments, data.analysis, data.timeline, interactionEvents]);

  if (!lec || !selectedId) return null;

  const src = videoUrl(result ?? {});
  const demo = isDemo(lec);
  const jumpTo = (seconds: number) => videoRef.current?.seekTo(seconds);

  const activeSegment = data.segments.find((s) => time >= s.start && time <= (s.end || s.start + 1));
  const activeAnalysis = data.analysis.find((a) => {
    const s = Number(a.start ?? 0);
    const e = Number(a.end ?? s + 1);
    return time >= s && time <= e;
  }) ?? nearestAnalysis(data.analysis, time);

  const activeUnderstanding = activeAnalysis?.event_id
    ? data.understanding.find((u) => String(u.event_id) === String(activeAnalysis.event_id)) ?? null
    : null;

  const trust = trustOf(activeAnalysis?.trust);

  const selectTab = (t: WorkspaceTab) => {
    setActiveTab(t);
  };

  const healthScore = Math.round(data.score?.score ?? 0);
  const breakdown = data.score?.breakdown;

  return (
    <div className="w-full max-w-[1600px] mx-auto px-3 sm:px-5 lg:px-8 py-5 lg:py-6 space-y-4">
      {/* TOP PRODUCT BAR */}
      <div className="top-bar">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="relative">
            <button
              onClick={() => setLecturePickerOpen((s) => !s)}
              className={cn(
                "flex items-center gap-2.5 rounded-lg transition",
                lecturePickerOpen ? "bg-slate-100" : "hover:bg-slate-50"
              )}
            >
              <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-indigo/15 to-violet-500/10 text-brand-indigo ring-1 ring-brand-indigo/10">
                <Video className="size-[18px]" />
              </div>
              <div className="text-left min-w-0 max-w-[420px]">
                <h1 className="text-[14px] font-semibold text-slate-900 leading-tight truncate pr-1">
                  {lec.filename}
                </h1>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                  <span className="font-mono">{lec.job_id}</span>
                  <span className="mx-1.5 text-slate-400">·</span>
                  <span>{formatSeconds(lec.duration)}</span>
                  {demo && (
                    <>
                      <span className="mx-1.5 text-slate-400">·</span>
                      <span className="inline-flex items-center gap-1 text-amber-600 font-semibold">
                        <SparklesIcon className="size-3" /> Live Demo
                      </span>
                    </>
                  )}
                </p>
              </div>
              <ChevronDown className={cn("size-4 text-slate-400 mr-1.5 transition-transform", lecturePickerOpen && "rotate-180")} />
            </button>
            {lecturePickerOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setLecturePickerOpen(false)} />
                <div className="absolute left-0 top-full mt-2 z-30 w-[320px] rounded-xl bg-white shadow-lg shadow-slate-900/10 ring-1 ring-app-edge/80 overflow-hidden">
                  <div className="px-3.5 py-2.5 border-b border-app-edge/80 flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Lecture Workspace</p>
                    <Badge variant="muted" className="text-[10px]">Switch</Badge>
                  </div>
                  <div className="p-2 max-h-[320px] overflow-y-auto space-y-0.5">
                    <LectureListInline onSelect={() => setLecturePickerOpen(false)} />
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="h-8 w-px bg-app-edge/60 mx-1 hidden sm:block" />
          <div className="hidden md:flex items-center gap-2">
            <span className="badge-pill-emerald">
              <Activity className="size-3" /> Live · {formatClock(time)}
            </span>
            {data.score && (
              <span className={cn(
                "badge-pill",
                healthScore >= 80 ? "badge-pill-emerald" : healthScore >= 60 ? "badge-pill-amber" : "badge-pill-rose"
              )}>
                <ShieldCheck className="size-3" /> Health {healthScore}%
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {data.adAvailable && (
            <label className="relative inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={adMode}
                onChange={(e) => setAdMode(e.target.checked)}
                className="peer sr-only"
                aria-label="Toggle Audio Description"
              />
              <div className={cn(
                "flex items-center gap-1.5 px-2.5 h-8 rounded-full border transition text-[11.5px] font-semibold",
                adMode
                  ? "bg-emerald-500 border-emerald-500 text-white"
                  : "bg-white border-app-edge/80 text-slate-600 hover:border-emerald-400 hover:text-emerald-600"
              )}>
                <AudioLines className="size-3.5" />
                AD Layer
              </div>
            </label>
          )}
          <Link href="/learning">
            <Button size="sm" variant="ghost" className="gap-1.5 h-8 text-[12px] text-slate-700 hover:text-brand-indigo">
              <BrainCircuit className="size-3.5" /> Learning
            </Button>
          </Link>
          <Link href="/upload">
            <Button size="sm" className="gap-1.5 h-8 text-[12px] shadow-sm">
              <Layers className="size-3.5" /> Compiler
            </Button>
          </Link>
        </div>
      </div>

      {/* TAB RAIL */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
        {TAB_ORDER.map((tab) => {
          const Icon = tab.Icon;
          const active = activeTab === tab.id;
          const badge =
            tab.id === "visual" ? data.analysis.length :
            tab.id === "audio" ? data.adCues.length :
            tab.id === "missing" ? data.missing.length :
            null;
          return (
            <button
              key={tab.id}
              onClick={() => selectTab(tab.id)}
              title={tab.hint}
              className={cn(
                "group shrink-0 flex items-center gap-2 h-9 px-3 rounded-lg text-[12.5px] font-semibold transition relative",
                active
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              )}
            >
              <Icon className={cn("size-4", active ? "text-white/90" : "text-slate-400 group-hover:text-slate-600")} />
              {tab.label}
              {typeof badge === "number" && badge > 0 && (
                <span className={cn(
                  "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-bold",
                  active ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700 group-hover:bg-slate-300"
                )}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
        <div className="flex-1" />
        <p className="text-[11px] text-slate-400 hidden lg:block pr-1">
          {TAB_ORDER.find((t) => t.id === activeTab)?.hint}
        </p>
      </div>

      {/* 2-COL WORKSPACE */}
      <div className="grid gap-4 lg:gap-5 lg:grid-cols-[1.6fr_1fr] items-start">
        {/* L+C: VIDEO CANVAS */}
        <div className="canvas-area-dark p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <MonitorPlay className="size-4 text-slate-400" />
              <p className="text-[12px] font-medium tracking-wide text-slate-300 uppercase">
                Lecture Analysis Canvas
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10.5px] font-mono text-slate-500">
                {formatClock(time)} / {formatClock(duration)}
              </span>
              {adMode && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-300 px-2 py-0.5 text-[10.5px] font-semibold border border-emerald-400/20">
                  <AudioLines className="size-3" /> AD ACTIVE
                </span>
              )}
              {playing && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-indigo/15 text-brand-indigo px-2 py-0.5 text-[10.5px] font-semibold">
                  <span className="size-1.5 rounded-full bg-brand-indigo animate-pulse" />
                  Playing
                </span>
              )}
            </div>
          </div>
          <div className="p-4 lg:p-5">
            <VideoPlayer
              ref={videoRef}
              src={src}
              onTimeUpdate={setTime}
              onPlayChange={setPlaying}
              enableCaptions
              onReady={() => setVideoReady(true)}
              ariaLabel={`${lec.filename} video`}
              audioMuted={false}
              overlayBadge={adMode ? "AUDIO DESCRIPTION ACTIVE" : undefined}
              interactionEvents={interactionEvents}
              onInteractionAction={(ev) => {
                if (ev.actionData?.tab) {
                  selectTab(ev.actionData.tab);
                }
              }}
            />
            {adError && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-200">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                {adError}
              </div>
            )}
            {activeSegment && (
              <div className="mt-3 flex items-start gap-3 rounded-xl bg-white/[0.03] border border-white/5 px-4 py-3">
                <div className="size-7 shrink-0 mt-0.5 rounded-lg bg-brand-blue/15 text-brand-blue flex items-center justify-center">
                  <Quote className="size-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-brand-blue">
                      Now Saying
                    </span>
                    <EvidenceTimestamp seconds={activeSegment.start} onSeek={jumpTo} tone="blue" />
                  </div>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-slate-200" dir="auto">
                    {activeSegment.text}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* R: INTELLIGENCE PANEL */}
        <div className="canvas-area p-0 overflow-hidden min-h-[600px] lg:min-h-[680px] flex flex-col">
          {/* Header of right panel */}
          <div className="px-5 py-3 border-b border-app-edge/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BrainCircuit className="size-4 text-brand-indigo" />
              <p className="text-[12px] font-medium tracking-wide text-slate-700 uppercase">
                {TAB_ORDER.find((t) => t.id === activeTab)?.label} Intelligence
              </p>
            </div>
            <div className="text-[11px] font-mono text-slate-400">
              t = {formatClock(time)}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin p-5 space-y-5">
            {activeTab === "overview" && (
              <ContextualIntelligencePanel
                currentTime={time}
                segments={data.segments}
                visuals={data.analysis.map((a) => ({
                  start: Number(a.start ?? 0),
                  end: Number(a.end ?? (a.start ?? 0) + 2),
                  type: a.type || "visual",
                  description: a.description || a.ocr_text || "",
                }))}
                analysis={data.analysis}
                missing={data.missing}
                adCues={data.adCues as any}
                jumpTo={jumpTo}
              />
            )}
            {activeTab === "visual" && (
              <div className="space-y-5">
                <VisualCompanion
                  active={activeAnalysis}
                  understanding={activeUnderstanding}
                  time={time}
                  trust={trust}
                  jumpTo={jumpTo}
                />
                <div className="space-y-2.5">
                  <SectionRail label="All Visual Events">
                    <span className="text-[12px] text-slate-500">{data.analysis.length} keyframes · click to seek</span>
                  </SectionRail>
                  <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1 scrollbar-thin">
                    {data.analysis.map((a, i) => (
                      <button
                        key={i}
                        onClick={() => jumpTo(Number(a.start ?? 0))}
                        className="w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-app-surface transition"
                      >
                        <EvidenceTimestamp seconds={Number(a.start ?? 0)} onSeek={() => {}} tone={trustOf(a.trust) === "VERIFIED" ? "indigo" : "cyan"} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <Badge variant="info" className="text-[10px] h-5 px-1.5">{a.type || "visual"}</Badge>
                            <TrustPill trust={trustOf(a.trust)} />
                          </div>
                          <p className="mt-1 text-[12.5px] text-slate-700 line-clamp-2 leading-relaxed">{a.description || a.ocr_text}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {activeTab === "audio" && (
              <div className="space-y-5">
                <div className="rounded-xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 via-white to-emerald-50/50 p-4">
                  <div className="flex items-center gap-2 font-bold text-[13px] text-emerald-900 mb-1.5">
                    <AudioLines className="size-4 text-emerald-600" />
                    Layered Dual-Audio Architecture
                  </div>
                  <p className="text-[12px] text-slate-600 leading-relaxed">
                    Original lecture audio stays audible. Synchronized narration cues overlay non-destructively at visual moments.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5 font-mono text-[10.5px]">
                    <span className="rounded-md bg-white border border-slate-200 px-2 py-0.5 font-semibold">Lecture Audio</span>
                    <span className="text-slate-400 font-sans">+</span>
                    <span className="rounded-md bg-emerald-100 border border-emerald-300 px-2 py-0.5 font-bold text-emerald-900">AD Narration</span>
                    <span className="text-slate-400 font-sans">→</span>
                    <span className="rounded-md bg-brand-indigo/10 border border-brand-indigo/20 px-2 py-0.5 font-bold text-brand-indigo">Non-Destructive</span>
                  </div>
                </div>

                <AdControlPanelInline
                  adMode={adMode}
                  onToggle={setAdMode}
                  cues={data.adCues}
                  activeCueIdx={activeCueIdx}
                  currentTime={time}
                  jumpTo={jumpTo}
                  reason={data.adReason}
                  error={adError}
                />

                {data.narration && (
                  <div className="space-y-2">
                    <p className="meta-label text-slate-500 uppercase tracking-[0.16em] text-[10.5px] pl-1">
                      Full AD Track
                    </p>
                    <audio controls src={data.narration} className="w-full" aria-label="Full audio description" />
                  </div>
                )}

                <div className="space-y-2.5">
                  <SectionRail label="Cue Timeline">
                    <span className="text-[12px] text-slate-500">{data.adCues.length} synchronized moments</span>
                  </SectionRail>
                  {data.adCues.length === 0 ? (
                    <div className="py-6 text-center space-y-1 rounded-xl border border-dashed border-app-edge/80 bg-app-surface/50">
                      <p className="text-[13px] font-medium text-slate-700">
                        {data.adReason || "No narration cues were generated for this lecture."}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {data.adCues.map((cue, idx) => (
                        <AudioDescriptionStudioCue
                          key={idx}
                          cue={cue}
                          index={idx}
                          isActive={idx === activeCueIdx}
                          isPlaying={playing}
                          onJump={jumpTo}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            {activeTab === "missing" && (
              <div className="space-y-4">
                <div className="rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50/90 via-white to-amber-50/50 p-4">
                  <div className="flex items-center gap-2 font-bold text-[13px] text-amber-900 mb-1.5">
                    <EyeOff className="size-4 text-amber-600" />
                    Cross-Modal Difference Engine
                  </div>
                  <p className="text-[12px] text-slate-600 leading-relaxed">
                    Speech × visual OCR × visual interpretation are cross-referenced to detect pedagogical disparities.
                  </p>
                </div>
                <GapReasoningChain
                  items={data.missing}
                  currentTime={time}
                  jumpTo={jumpTo}
                />
              </div>
            )}
            {activeTab === "timeline" && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2.5 text-center">
                  {[
                    { k: "Speech",    v: data.segments.length, c: "bg-rail-speech/20 text-brand-blue border-rail-speech/30" },
                    { k: "Visual",    v: data.analysis.length, c: "bg-rail-visual/20 text-brand-cyan border-rail-visual/30" },
                    { k: "Gaps",      v: data.missing.length,  c: "bg-rail-gaps/20 text-amber-700 border-rail-gaps/30" },
                  ].map((x) => (
                    <div key={x.k} className={cn("rounded-lg border px-2 py-2.5", x.c)}>
                      <p className="text-[18px] font-bold leading-none">{x.v}</p>
                      <p className="text-[10.5px] mt-1 uppercase tracking-wider opacity-80">{x.k}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-2.5">
                  <SectionRail label="Transcript Rail">
                    <span className="text-[12px] text-slate-500">{data.segments.length} synchronized segments</span>
                  </SectionRail>
                  <TranscriptRail segments={data.segments} activeTime={time} jumpTo={jumpTo} playing={playing} />
                </div>
              </div>
            )}
            {activeTab === "ask" && (
              <AskPanelGrounded jobId={selectedId} jumpTo={jumpTo} />
            )}
            {activeTab === "report" && (
              <div className="space-y-5">
                <div className="rounded-xl bg-gradient-to-br from-app-surface via-white to-app-canvas border border-app-edge/80 p-5">
                  <div className="flex flex-col items-center sm:flex-row sm:justify-around gap-5">
                    <ScoreRing
                      score={data.score?.score ?? 0}
                      label={`${data.score?.level ?? "Good"} accessibility`}
                      sublabel="from verified evidence"
                    />
                    {data.score?.trust?.trust && (
                      <div className="flex flex-col items-center gap-2 text-center max-w-xs">
                        <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-slate-500">Overall Evidence Trust</p>
                        <TrustBadge trust={data.score.trust.trust} />
                        {data.score.trust.reason && (
                          <p className="text-[12px] text-slate-500 leading-relaxed">{data.score.trust.reason}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {breakdown && (
                  <div className="space-y-2.5">
                    <SectionRail label="Health Progression">
                      <span className="text-[12px] text-slate-500">Baseline → Disparities → Remediation → Final</span>
                    </SectionRail>
                    <div className="rounded-xl border border-app-edge/80 p-4 bg-app-surface/40 space-y-3.5">
                      <div className="grid gap-3 sm:grid-cols-3 text-[11.5px]">
                        <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/60 p-3">
                          <span className="font-semibold text-slate-700">1 · Baseline</span>
                          <p className="text-[22px] font-bold text-brand-indigo mt-1 leading-none">
                            +{Math.round(breakdown.modality_baseline * 100)}%
                          </p>
                        </div>
                        <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-3">
                          <span className="font-semibold text-amber-900">2 · Disparities</span>
                          <p className="text-[22px] font-bold text-amber-700 mt-1 leading-none">
                            −{Math.round(breakdown.unresolved_disparities_penalty * 100)}%
                          </p>
                        </div>
                        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-3">
                          <span className="font-semibold text-emerald-900">3 · Remediation</span>
                          <p className="text-[22px] font-bold text-emerald-700 mt-1 leading-none">
                            +{Math.round(breakdown.verified_remediation_benefit * 100)}%
                          </p>
                        </div>
                      </div>
                      <div className="pt-1 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] text-slate-500 px-0.5">
                          <span>0</span>
                          <span className="font-mono">Formula: Baseline − Penalty + Verified AD</span>
                          <span>100%</span>
                        </div>
                        <div className="relative h-4 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="absolute inset-y-0 left-0 bg-brand-indigo/30"
                            style={{ width: `${breakdown.modality_baseline * 100}%` }}
                          />
                          <div
                            className="absolute inset-y-0 bg-amber-500/60"
                            style={{
                              left: `${Math.max(0, (breakdown.modality_baseline - breakdown.unresolved_disparities_penalty) * 100)}%`,
                              width: `${breakdown.unresolved_disparities_penalty * 100}%`,
                            }}
                          />
                          <div
                            className="absolute inset-y-0 bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-inner shadow-emerald-900/10"
                            style={{ width: `${Math.max(0, (breakdown.modality_baseline - breakdown.unresolved_disparities_penalty + breakdown.verified_remediation_benefit) * 100)}%` }}
                          />
                          <div className="absolute top-0 bottom-0 w-0.5 bg-slate-900/70" style={{ left: `${healthScore}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {data.score?.components && (
                  <div className="space-y-2.5">
                    <SectionRail label="Evidence Components">
                      <span className="text-[12px] text-slate-500">Pipeline-derived inputs</span>
                    </SectionRail>
                    <div className="overflow-x-auto rounded-xl border border-app-edge/80">
                      <table className="w-full text-left text-[12px]">
                        <thead>
                          <tr className="bg-app-surface/60 border-b border-app-edge/80 text-slate-500">
                            <th className="py-2.5 px-3 font-semibold">Component</th>
                            <th className="py-2.5 px-3 font-semibold">Evidence</th>
                            <th className="py-2.5 px-3 font-semibold text-right">Value</th>
                            <th className="py-2.5 px-3 font-semibold text-right">Contribution</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-app-edge/60">
                          {Object.entries(data.score.components).map(([key, comp]) => (
                            <tr key={key} className="text-slate-800">
                              <td className="py-2 px-3 font-semibold capitalize">{comp.label || key.replace(/_/g, " ")}</td>
                              <td className="py-2 px-3 text-slate-600 text-[11.5px]">{comp.detail}</td>
                              <td className="py-2 px-3 text-right font-mono text-[11.5px]">{Math.round((comp.value ?? 0) * 100)}%</td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-brand-indigo text-[11.5px]">+{Math.round((comp.contribution ?? 0) * 100)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="space-y-2.5">
                  <SectionRail label="Accessibility Twin">
                    <ConceptBadge label="Compiled Model" accent="indigo" />
                  </SectionRail>
                  <AccessibilityTwin
                    metrics={{
                      segments: data.segments.length,
                      visuals: data.analysis.length,
                      ocr: data.understanding.filter((u) => u.ocr_text).length,
                      gaps: data.missing.length,
                      adCues: data.adCues.length,
                      concepts: 12,
                      questions: 8,
                    }}
                    score={healthScore}
                    compact
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BOTTOM: MULTIMODAL TIMELINE (full width) */}
      <div className="canvas-area p-0 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-app-edge/80">
          <div className="flex items-center gap-2">
            <ListVideo className="size-4 text-brand-indigo" />
            <p className="text-[12px] font-medium tracking-wide text-slate-700 uppercase">
              Multimodal Timeline
            </p>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-rail-speech" /> Speech</span>
            <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-rail-visual" /> Visual</span>
            <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-rail-ocr" /> OCR</span>
            <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-rail-ad" /> AD</span>
            <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-rail-gaps" /> Gaps</span>
            <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-rail-events" /> Events</span>
            <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-rail-assessment" /> Assessment</span>
          </div>
        </div>
        <div className="p-4 lg:p-5">
          <MultimodalTimeline
            segments={data.segments}
            visuals={data.analysis.map((a) => ({
              start: Number(a.start ?? 0),
              end: Number(a.end ?? (a.start ?? 0) + 2),
              type: a.type || "visual",
              description: a.description || a.ocr_text || "",
            }))}
            analysis={data.analysis}
            missing={data.missing}
            adCues={data.adCues as any}
            interactionEvents={interactionEvents.map((e) => ({
              time: e.timestamp,
              type: e.type,
              label: e.label,
              description: e.description,
            }))}
            duration={duration}
            currentTime={time}
            selectedGapId={selectedGapId}
            onSeek={jumpTo}
            onSelectGap={(m, idx) => {
              if (m) {
                jumpTo(m.timestamp_start ?? m.timestamp ?? 0);
                setSelectedGapId(idx ?? null);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

function LectureListInline({ onSelect }: { onSelect: () => void }) {
  const { lectures, selectedId, setSelectedId } = useWorkspace();
  return (
    <>
      {lectures.map((lec) => {
        const active = lec.job_id === selectedId;
        const demo = isDemo(lec);
        return (
          <button
            key={lec.job_id}
            onClick={() => {
              setSelectedId(lec.job_id);
              onSelect();
            }}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-start text-[12.5px] transition",
              active ? "bg-brand-indigo/10 font-semibold text-brand-indigo" : "text-slate-700 hover:bg-slate-100"
            )}
          >
            <Video className={cn("size-4 shrink-0", active ? "text-brand-indigo" : "text-slate-400")} />
            <div className="min-w-0 flex-1">
              <p className="truncate leading-tight">{lec.filename}</p>
              <p className="text-[10.5px] text-slate-400 mt-0.5 truncate font-mono">{lec.job_id}</p>
            </div>
            {demo && <SparklesIcon className="size-3 text-amber-500 shrink-0" />}
          </button>
        );
      })}
    </>
  );
}

function TranscriptRail({
  segments,
  activeTime,
  jumpTo,
  playing,
}: {
  segments: TranscriptSegment[];
  activeTime: number;
  jumpTo: (s: number) => void;
  playing: boolean;
}) {
  const activeIndex = segments.findIndex((s) => activeTime >= s.start && activeTime <= (s.end || s.start + 1));
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const btn = listRef.current.querySelector(`[data-tsidx="${activeIndex}"]`);
    if (btn) btn.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeIndex]);

  return (
    <div ref={listRef} className="max-h-[420px] overflow-y-auto pr-1 scrollbar-thin space-y-1">
      {segments.length === 0 ? (
        <p className="p-4 text-center text-[12.5px] text-slate-500">No transcript.</p>
      ) : (
        segments.map((seg, i) => {
          const isActive = activeIndex === i;
          return (
            <button
              key={seg.id ?? seg.start}
              data-tsidx={i}
              onClick={() => jumpTo(seg.start)}
              className={cn(
                "flex w-full items-start gap-3 rounded-lg px-3 py-2 text-start transition",
                isActive ? "bg-brand-indigo/8 ring-1 ring-brand-indigo/20 font-medium text-slate-900" : "text-slate-600 hover:bg-slate-100/70"
              )}
            >
              <EvidenceTimestamp seconds={seg.start} onSeek={() => {}} tone={isActive ? "indigo" : "slate"} />
              <span dir="auto" className="text-[12.5px] leading-relaxed flex-1">
                {seg.text}
              </span>
            </button>
          );
        })
      )}
    </div>
  );
}

function nearestAnalysis(list: AnalysisItem[], t: number): AnalysisItem | null {
  if (!list?.length) return null;
  return list.reduce((best, a) => {
    const start = Number(a.start ?? 0);
    const d = Math.abs(start - t);
    const bd = Math.abs(Number(best?.start ?? 0) - t);
    return d < bd ? a : best;
  }, list[0]);
}

function VisualCompanion({
  active,
  understanding,
  time,
  trust,
  jumpTo,
}: {
  active: AnalysisItem | null;
  understanding: VisualUnderstanding | null;
  time: number;
  trust: string;
  jumpTo: (s: number) => void;
}) {
  const meta =
    trust.toUpperCase() === "VERIFIED"
      ? { icon: ShieldCheck, cls: "text-emerald-700 bg-emerald-50 border-emerald-200", label: "VERIFIED EVIDENCE" }
      : trust.toUpperCase() === "UNCERTAIN"
      ? { icon: AlertTriangle, cls: "text-amber-700 bg-amber-50 border-amber-200", label: "UNCERTAIN EVIDENCE" }
      : { icon: CircleHelp, cls: "text-slate-700 bg-slate-50 border-slate-200", label: "UNAVAILABLE" };
  const Icon = meta.icon;

  const [showClaims, setShowClaims] = useState(true);
  const vtype = understanding?.visual_type ?? active?.type ?? "visual";
  const comp = understanding?.complement_level;
  const numClaims = understanding?.visual_claims?.length ?? 0;

  return (
    <div className="rounded-xl border border-app-edge/80 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-app-edge/80 px-4 py-3 bg-app-surface/50">
        <span className="flex size-7 items-center justify-center rounded-lg bg-brand-indigo/10 text-brand-indigo">
          <ImageIcon className="size-4" />
        </span>
        <span className="text-[13px] font-semibold text-slate-900">Visual Intelligence</span>
        <span className="ms-auto text-[11.5px] font-mono font-semibold text-brand-indigo">{formatClock(time)}</span>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10.5px] font-bold border", meta.cls)}>
            <Icon className="size-3.5" />
            {meta.label}
          </span>
          {vtype && (
            <Badge variant="info" className="capitalize text-[10.5px] h-5 px-1.5">
              {String(vtype).replace(/_/g, " ")}
            </Badge>
          )}
          {comp && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold bg-brand-indigo/8 text-brand-indigo ring-1 ring-brand-indigo/15">
              <BadgeCheck className="size-3" />
              {comp.replace(/_/g, " ")}
            </span>
          )}
        </div>

        {!active ? (
          <div className="rounded-xl border border-dashed border-app-edge/80 bg-app-surface/50 p-5 text-center">
            <CircleHelp className="mx-auto size-6 text-slate-400" />
            <p className="mt-2 text-[13px] font-medium text-slate-700">No visual evidence at this moment.</p>
            <p className="mt-1 text-[11.5px] text-slate-500">EduAccess will never invent visual info.</p>
          </div>
        ) : (
          <div className="space-y-3.5">
            <EvidenceSnippet
              variant="visual"
              text={understanding?.accessibility_description?.short || active.description || "On-screen educational content."}
            />

            {(understanding?.ocr_text || active?.ocr_text) && (
              <div className="rounded-xl border border-app-edge/80 bg-app-surface/60 p-3 space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1">
                  <ScanText className="size-3" /> OCR On-Screen Text
                </p>
                <pre className="max-h-36 overflow-y-auto whitespace-pre-wrap font-mono text-[11.5px] text-slate-800 bg-white p-2.5 rounded-lg border border-app-edge/70 scrollbar-thin">
                  {understanding?.ocr_text || active?.ocr_text}
                </pre>
              </div>
            )}

            {numClaims > 0 && (
              <div className="rounded-xl border border-app-edge/80 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowClaims((s) => !s)}
                  className="flex w-full items-center justify-between px-3.5 py-2.5 text-start bg-app-surface/50 border-b border-app-edge/80"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
                    Grounded Claims ({numClaims})
                  </span>
                  <ChevronDown className={cn("size-3.5 text-slate-400 transition-transform", showClaims && "rotate-180")} />
                </button>
                {showClaims && (
                  <ul className="space-y-2 p-3">
                    {understanding!.visual_claims.map((c, i) => (
                      <li key={i} className="flex items-start gap-2 text-[11.5px] bg-app-surface/60 p-2.5 rounded-lg border border-app-edge/60">
                        <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[9px] font-bold text-emerald-700">
                          ✓
                        </span>
                        <div className="text-slate-800 flex-1">
                          <p className="font-medium leading-relaxed">{c.claim}</p>
                          <p className="mt-0.5 text-[10.5px] text-slate-500">Evidence: {c.evidence}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AskPanelGrounded({ jobId, jumpTo }: { jobId: string; jumpTo: (s: number) => void }) {
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState<AskResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await askQuestion(jobId, q);
      setResponse(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ask failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="meta-label text-slate-500 uppercase tracking-[0.16em] text-[10.5px] pl-0.5">
          Question → Retrieval → Lecture Evidence → Answer
        </p>
        <div className="flex gap-2 items-stretch">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input
              aria-label="Ask lecture question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit(question)}
              placeholder="Ask about this lecture…"
              className="w-full rounded-xl border border-app-edge/80 bg-app-surface/40 pl-9 pr-3 py-2.5 text-[13px] text-slate-800 placeholder:text-slate-400 focus:border-brand-indigo focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-indigo/40"
            />
          </div>
          <Button onClick={() => submit(question)} disabled={busy || !question.trim()} className="gap-1.5 h-10">
            {busy ? <Loader2Spin /> : <Send className="size-3.5" />}
            <span className="text-[12.5px]">Ask</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-[12px] text-rose-700 bg-rose-50 p-2.5 rounded-lg border border-rose-200/80">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!response && !busy && (
        <div className="space-y-1.5">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-500">Try a grounded query</p>
          <div className="flex flex-wrap gap-1.5">
            {["What Python code was written?", "What is a while loop?", "Key takeaways"].map((s) => (
              <button
                key={s}
                onClick={() => { setQuestion(s); submit(s); }}
                className="rounded-full border border-app-edge/80 bg-app-surface/40 px-3 py-1 text-[11.5px] text-slate-600 hover:border-brand-indigo hover:text-brand-indigo transition"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {busy && (
        <div className="flex items-center gap-2 p-3.5 text-[12px] text-brand-indigo bg-brand-indigo/5 rounded-xl border border-brand-indigo/20">
          <Loader2Spin />
          <span>Retrieving evidence from transcript, OCR, and visual keyframes…</span>
        </div>
      )}

      {response && <GroundedAnswerCard response={response} jumpTo={jumpTo} />}
    </div>
  );
}

function Loader2Spin() {
  return <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />;
}

function GroundedAnswerCard({ response, jumpTo }: { response: AskResponse; jumpTo: (s: number) => void }) {
  const jumpTimestamp = response.jump?.timestamp ?? (response.timestamps && response.timestamps.length > 0 ? response.timestamps[0] : null);
  const trustUp = (response.trust || "").toUpperCase();

  return (
    <div className="space-y-3.5 rounded-2xl border border-brand-indigo/20 bg-gradient-to-b from-brand-indigo/[0.04] to-white p-4.5">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-brand-indigo">Grounded Answer</p>
          <TrustPill trust={response.trust} />
        </div>
        <p className="text-[13.5px] font-medium leading-relaxed text-slate-900">{response.answer}</p>
      </div>

      <div className="rounded-xl border border-app-edge/80 bg-white p-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-600">Why you can trust this</p>
        </div>
        <p className="text-[11.5px] text-slate-600 leading-relaxed">
          {response.trust_reason || "Derived exclusively from recorded lecture evidence and cross-modal verification."}
        </p>
      </div>

      {response.evidence && response.evidence.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-600 pl-0.5">Evidence records</p>
          <div className="space-y-1.5">
            {response.evidence.map((ev, i) => (
              <div key={i} className="flex items-start justify-between gap-2 rounded-lg border border-app-edge/80 bg-white p-2.5 text-[11.5px]">
                <div className="space-y-0.5 min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant="info" className="text-[10px] font-mono h-5 px-1.5">
                      {ev.source_type || "lecture"}
                    </Badge>
                    {ev.timestamp != null && <EvidenceTimestamp seconds={ev.timestamp} onSeek={() => {}} tone="slate" />}
                  </div>
                  {(ev.snippet || ev.text_hint) && (
                    <p className="text-slate-700 italic truncate max-w-md leading-relaxed">“{ev.snippet || ev.text_hint}”</p>
                  )}
                </div>
                {ev.timestamp != null && (
                  <button
                    onClick={() => jumpTo(ev.timestamp!)}
                    className="shrink-0 inline-flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-semibold text-brand-indigo bg-brand-indigo/6 hover:bg-brand-indigo/10"
                  >
                    <Play className="size-3 fill-current" /> Jump
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {jumpTimestamp != null && (
        <div className="flex items-center justify-between border-t border-app-edge/60 pt-3 gap-3">
          <span className="text-[11.5px] text-slate-600">
            Primary anchor · <strong className="font-mono text-brand-indigo">{formatClock(jumpTimestamp)}</strong>
          </span>
          <Button size="sm" onClick={() => jumpTo(jumpTimestamp)} className="gap-1.5 text-[11.5px] shadow-sm">
            <Play className="size-3 fill-current" />
            Jump to Moment
          </Button>
        </div>
      )}
    </div>
  );
}

function AdControlPanelInline({
  adMode,
  onToggle,
  cues,
  activeCueIdx,
  currentTime,
  jumpTo,
  reason,
  error,
}: {
  adMode: boolean;
  onToggle: (v: boolean) => void;
  cues: AudioDescriptionCue[];
  activeCueIdx: number;
  currentTime: number;
  jumpTo: (s: number) => void;
  reason?: string;
  error?: string | null;
}) {
  const activeCue = activeCueIdx >= 0 ? cues[activeCueIdx] : null;

  return (
    <div className="rounded-xl border border-emerald-200/70 bg-gradient-to-r from-emerald-50/70 via-white to-brand-blue/[0.04] p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/12 text-emerald-600 shrink-0">
            <Mic className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-slate-900 leading-tight">Audio Description Layer</p>
            <p className="text-[11px] text-slate-500 mt-0.5 truncate">
              {cues.length > 0
                ? `${cues.length} narrated cue${cues.length === 1 ? "" : "s"} · Lecture audio stays audible`
                : (reason || "No narration cues available.")}
            </p>
          </div>
        </div>
        <label htmlFor="ad-inline-toggle" className="relative inline-flex cursor-pointer items-center">
          <input
            id="ad-inline-toggle"
            type="checkbox"
            checked={adMode}
            onChange={(e) => onToggle(e.target.checked)}
            disabled={cues.length === 0}
            className="peer sr-only"
            aria-label="Toggle AD"
          />
          <div className="h-6 w-11 rounded-full bg-slate-200 transition-colors peer-checked:bg-emerald-500" />
          <span className="absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
        </label>
      </div>
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] text-amber-800">
          <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
          {error}
        </div>
      )}
      {adMode && activeCue && (
        <div className="rounded-xl border border-app-edge/80 bg-white p-3">
          <div className="flex items-center justify-between text-[11.5px]">
            <span className="font-semibold text-emerald-700 inline-flex items-center gap-1.5">
              <AudioLines className="size-3.5" />
              Narrating <EvidenceTimestamp seconds={activeCue.start} onSeek={jumpTo} tone="emerald" />
            </span>
          </div>
          <p className="mt-1 text-[13px] text-slate-800 leading-relaxed">{activeCue.description}</p>
        </div>
      )}
    </div>
  );
}
