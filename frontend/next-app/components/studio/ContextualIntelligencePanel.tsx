"use client";

import * as React from "react";
import {
  Eye,
  Mic,
  ScanText,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  Volume2,
  ChevronDown,
  ChevronRight,
  Clock,
  Play,
  BrainCircuit,
  Gauge,
} from "lucide-react";
import { cn, formatClock } from "@/lib/format";
import {
  TrustPill,
  EvidenceTimestamp,
  EvidenceSnippet,
  SectionRail,
} from "@/components/ui/evidence-primitives";
import type {
  TranscriptSegment,
  VisualEventItem,
  AnalysisItem,
  MissingItem,
  AccessibilityEvent,
  TrustLevel,
} from "@/types/backend";

interface SectionDef {
  id: "shown" | "said" | "ocr" | "missing" | "generated" | "evidence";
  label: string;
  Icon: typeof Eye;
  accent: "blue" | "cyan" | "indigo" | "amber" | "emerald" | "slate";
  colorCls: string;
}

const SECTIONS: SectionDef[] = [
  {
    id: "shown",
    label: "WHAT WAS SHOWN",
    Icon: Eye,
    accent: "blue",
    colorCls: "text-brand-blue",
  },
  {
    id: "said",
    label: "WHAT WAS SAID",
    Icon: Mic,
    accent: "cyan",
    colorCls: "text-brand-cyan",
  },
  {
    id: "ocr",
    label: "OCR FOUND",
    Icon: ScanText,
    accent: "indigo",
    colorCls: "text-brand-indigo",
  },
  {
    id: "missing",
    label: "WHAT IS MISSING",
    Icon: AlertTriangle,
    accent: "amber",
    colorCls: "text-brand-amber",
  },
  {
    id: "generated",
    label: "EDUACCESS GENERATED",
    Icon: Sparkles,
    accent: "emerald",
    colorCls: "text-brand-emerald",
  },
  {
    id: "evidence",
    label: "EVIDENCE & TRUST",
    Icon: ShieldCheck,
    accent: "slate",
    colorCls: "text-slate-600",
  },
];

interface ContextualIntelligencePanelProps {
  currentTime: number;
  duration?: number;
  segments: TranscriptSegment[];
  visuals: VisualEventItem[];
  analysis: AnalysisItem[];
  missing: MissingItem[];
  adCues: AccessibilityEvent[];
  jumpTo: (s: number) => void;
  mode?: "default" | "blind" | "lv" | "deaf" | "cognitive";
  className?: string;
}

export function ContextualIntelligencePanel({
  currentTime,
  segments,
  visuals,
  analysis,
  missing,
  adCues,
  jumpTo,
  className,
}: ContextualIntelligencePanelProps) {
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});
  const toggle = (id: string) =>
    setCollapsed((c) => ({ ...c, [id]: !c[id] }));

  // Find active content around currentTime
  const range = 2.5;
  const activeSegment = segments.find(
    (s) => currentTime >= s.start - range * 0.5 && currentTime <= (s.end ?? s.start) + range
  ) ?? [...segments].reverse().find((s) => s.start <= currentTime);

  const activeVisual = visuals.find(
    (v) => currentTime >= v.start - 0.5 && currentTime <= (v.end ?? v.start) + range
  ) ?? [...visuals].reverse().find((v) => v.start <= currentTime);

  const activeAnalysis = analysis.find(
    (a) =>
      (a.start ?? 0) - 0.5 <= currentTime &&
      ((a.end ?? a.start ?? 0) + range) >= currentTime
  ) ?? [...analysis].reverse().find((a) => (a.start ?? 0) <= currentTime);

  const activeGap = missing.find(
    (m) => {
      const s = m.timestamp_start ?? m.timestamp;
      const e = m.timestamp_end ?? s + 3;
      return s - 0.5 <= currentTime && e + 1 >= currentTime;
    }
  ) ?? [...missing].reverse().find((m) => (m.timestamp_start ?? m.timestamp) <= currentTime);

  const activeAd = adCues.find(
    (c) => c.start - 0.5 <= currentTime && (c.end ?? c.start + 2) + 1 >= currentTime
  ) ?? [...adCues].reverse().find((c) => c.start <= currentTime);

  const renderCollapsible = (
    section: SectionDef,
    content: React.ReactNode,
    defaultOpen = true
  ) => {
    const isCollapsed = collapsed[section.id] ?? !defaultOpen;
    const Icon = section.Icon;
    return (
      <div
        className="rounded-xl border border-slate-200/70 bg-white shadow-surface overflow-hidden"
        key={section.id}
      >
        <button
          type="button"
          onClick={() => toggle(section.id)}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-slate-50/60 transition"
        >
          <div className={cn("shrink-0 size-7 rounded-lg flex items-center justify-center bg-slate-50", section.colorCls)}>
            <Icon className="size-3.5" aria-hidden />
          </div>
          <span className="meta-label text-slate-600">{section.label}</span>
          <div className="ml-auto flex items-center gap-1.5">
            {isCollapsed ? (
              <ChevronRight className="size-3.5 text-slate-400" aria-hidden />
            ) : (
              <ChevronDown className="size-3.5 text-slate-400" aria-hidden />
            )}
          </div>
        </button>
        {!isCollapsed && (
          <div className="px-3 pb-3 pt-0.5 space-y-2 animate-fade-in border-t border-slate-100">
            {content}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      className={cn(
        "flex h-full flex-col gap-3 bg-app-surface/50 p-3 overflow-y-auto scrollbar-thin",
        className
      )}
    >
      {/* Panel Identity */}
      <div className="rounded-2xl border border-slate-200/70 bg-white shadow-surface p-3">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-indigo to-brand-blue text-white shadow-sm">
            <BrainCircuit className="size-4.5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-bold tracking-tight text-slate-900 leading-none">
              Contextual Intelligence
            </p>
            <p className="meta-label mt-1">
              <Clock className="size-2.5" aria-hidden />
              Synced to {formatClock(currentTime)}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200/60 px-2.5 py-1.5">
          <div className="flex items-center gap-2">
            <Gauge className="size-3 text-brand-indigo" aria-hidden />
            <span className="text-[11px] font-semibold text-slate-600">
              Active inference window
            </span>
          </div>
          <span className="font-mono text-[10px] text-slate-500 tabular-nums">
            ±{range}s
          </span>
        </div>
      </div>

      {/* 6 Sections */}
      {renderCollapsible(
        SECTIONS[0],
        activeVisual ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="badge-pill-cyan">{activeVisual.type || "VISUAL"}</span>
              {activeVisual.importance !== undefined && (
                <span className="badge-pill-slate">
                  importance {activeVisual.importance}
                </span>
              )}
              <EvidenceTimestamp
                seconds={activeVisual.start}
                onSeek={jumpTo}
                source="KEYFRAME"
              />
            </div>
            <EvidenceSnippet
              variant="visual"
              text={activeVisual.description || activeVisual.ocr_text || "Visual content frame detected."}
            />
            {activeVisual.ocr_text && (
              <div className="rounded-lg border border-indigo-200/50 bg-indigo-50/40 p-2.5 space-y-1">
                <span className="meta-label text-indigo-600 inline-flex items-center gap-1">
                  <ScanText className="size-2.5" aria-hidden />
                  INLINE OCR
                </span>
                <p className="text-[11.5px] font-mono text-indigo-950 leading-relaxed whitespace-pre-wrap">
                  {activeVisual.ocr_text}
                </p>
              </div>
            )}
          </div>
        ) : (
          <EmptyState label="No visual event at this timestamp" hint="Seek to a moment with visual content." />
        ),
        true
      )}

      {renderCollapsible(
        SECTIONS[1],
        activeSegment ? (
          <div className="space-y-2">
            <EvidenceTimestamp
              seconds={activeSegment.start}
              onSeek={jumpTo}
              source="WHISPER TRANSCRIPT"
            />
            <EvidenceSnippet variant="speech" text={activeSegment.text} />
          </div>
        ) : (
          <EmptyState label="No speech segment at this moment" hint="Seek to a moment when the instructor is speaking." />
        ),
        true
      )}

      {renderCollapsible(
        SECTIONS[2],
        activeAnalysis?.ocr_text ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="badge-pill-indigo">OCR EXTRACTED</span>
              {activeAnalysis.trust && (
                <TrustPill
                  trust={
                    (typeof activeAnalysis.trust === "string"
                      ? activeAnalysis.trust
                      : activeAnalysis.trust?.trust) as TrustLevel
                  }
                  compact
                />
              )}
              {activeAnalysis.start !== undefined && (
                <EvidenceTimestamp seconds={activeAnalysis.start} onSeek={jumpTo} source="FRAME" />
              )}
            </div>
            <div className="rounded-lg border border-indigo-200/50 bg-indigo-50/30 p-2.5">
              <p className="text-[11.5px] font-mono text-indigo-950 leading-relaxed whitespace-pre-wrap">
                {activeAnalysis.ocr_text}
              </p>
            </div>
          </div>
        ) : (
          <EmptyState label="No OCR text aligned to this moment" hint="OCR extraction is performed on detected keyframes with written content." />
        ),
        false
      )}

      {renderCollapsible(
        SECTIONS[3],
        activeGap ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="badge-pill-amber">ACCESSIBILITY GAP</span>
              {activeGap.severity && (
                <span
                  className={cn(
                    "badge-pill",
                    activeGap.severity === "high"
                      ? "badge-pill-rose"
                      : activeGap.severity === "low"
                      ? "badge-pill-cyan"
                      : "badge-pill-amber"
                  )}
                >
                  {String(activeGap.severity).toUpperCase()} SEVERITY
                </span>
              )}
              <EvidenceTimestamp
                seconds={activeGap.timestamp_start ?? activeGap.timestamp}
                onSeek={jumpTo}
                source="DISPARITY"
              />
            </div>
            <EvidenceSnippet
              variant="gap"
              text={activeGap.missing_information || "Visual content is not explained in spoken audio."}
              timestamp={activeGap.timestamp_start ?? activeGap.timestamp}
              onSeek={jumpTo}
              trust={
                (typeof activeGap.trust === "string"
                  ? activeGap.trust
                  : activeGap.trust?.trust) as TrustLevel
              }
            />
            {activeGap.why_it_matters && (
              <p className="text-[11.5px] leading-relaxed text-slate-600 px-1">
                <span className="font-semibold text-slate-800">Why it matters: </span>
                {activeGap.why_it_matters}
              </p>
            )}
            <button
              onClick={() =>
                jumpTo(activeGap.timestamp_start ?? activeGap.timestamp ?? 0)
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-amber text-white px-2.5 py-1.5 text-[11px] font-semibold hover:bg-amber-600 transition"
            >
              <Play className="size-3 fill-current" aria-hidden />
              Jump to gap moment
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/50 p-2.5 flex items-start gap-2">
            <ShieldCheck className="size-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden />
            <div>
              <p className="text-[11.5px] font-semibold text-emerald-950">
                No accessibility gap at this timestamp.
              </p>
              <p className="text-[10.5px] text-emerald-900/80">
                Spoken and visual modalities appear aligned.
              </p>
            </div>
          </div>
        ),
        true
      )}

      {renderCollapsible(
        SECTIONS[4],
        activeAd ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="badge-pill-emerald">
                <Volume2 className="size-2.5" aria-hidden />
                AUDIO DESCRIPTION CUE
              </span>
              <EvidenceTimestamp seconds={activeAd.start} onSeek={jumpTo} source="AD LAYER" />
              {activeAd.confidence !== undefined && (
                <TrustPill
                  trust={activeAd.confidence > 0.75 ? "VERIFIED" : "UNCERTAIN"}
                  compact
                />
              )}
            </div>
            <EvidenceSnippet
              variant="ad"
              text={activeAd.description || activeAd.transcript || "[Non-destructive audio description narration]"}
            />
            {activeAd.should_describe && (
              <p className="text-[11px] text-emerald-900/80 px-1">
                EduAccess layered this cue non-destructively over the original lecture audio.
              </p>
            )}
          </div>
        ) : (
          <EmptyState label="No AD cue active at this moment" hint="The system inserts cues only where a visual gap requires remediation." />
        ),
        false
      )}

      {renderCollapsible(
        SECTIONS[5],
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-1.5">
            <div className="rounded-lg bg-slate-50 border border-slate-200/60 p-2">
              <span className="meta-label block text-[9px]">MODALITIES</span>
              <div className="mt-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] text-slate-600">Speech</span>
                  <span className={cn("size-1.5 rounded-full", activeSegment ? "bg-brand-cyan" : "bg-slate-300")} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] text-slate-600">Vision</span>
                  <span className={cn("size-1.5 rounded-full", activeVisual ? "bg-brand-blue" : "bg-slate-300")} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] text-slate-600">OCR</span>
                  <span className={cn("size-1.5 rounded-full", activeAnalysis?.ocr_text ? "bg-brand-indigo" : "bg-slate-300")} />
                </div>
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200/60 p-2">
              <span className="meta-label block text-[9px]">ACCESSIBILITY</span>
              <div className="mt-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] text-slate-600">Gap</span>
                  <span className={cn("size-1.5 rounded-full", activeGap ? "bg-brand-amber" : "bg-slate-300")} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] text-slate-600">AD</span>
                  <span className={cn("size-1.5 rounded-full", activeAd ? "bg-brand-emerald" : "bg-slate-300")} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] text-slate-600">Events</span>
                  <span className="size-1.5 rounded-full bg-brand-rose/30" />
                </div>
              </div>
            </div>
          </div>

          <SectionRail
            label={<span className="meta-label text-[9px]">TIMESTAMPED EVIDENCE</span>}
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <EvidenceTimestamp seconds={Math.max(0, currentTime - 2)} onSeek={jumpTo} source="-2s" />
            <EvidenceTimestamp seconds={currentTime} onSeek={jumpTo} source="NOW" trust="VERIFIED" />
            <EvidenceTimestamp seconds={currentTime + 2} onSeek={jumpTo} source="+2s" />
          </div>

          <p className="text-[10.5px] leading-relaxed text-slate-500 px-1">
            All EduAccess outputs are grounded in the source lecture material and marked with
            a trust level. Use <span className="font-semibold text-slate-700">Jump to moment</span> to
            verify any AI claim against the original video.
          </p>
        </div>,
        false
      )}
    </aside>
  );
}

function EmptyState({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="rounded-xl border border-slate-200/50 bg-slate-50/40 p-3 text-center">
      <p className="text-[11.5px] font-medium text-slate-600">{label}</p>
      <p className="text-[10px] text-slate-500 mt-0.5">{hint}</p>
    </div>
  );
}
