"use client";

import * as React from "react";
import {
  Mic,
  Eye,
  ScanText,
  Volume2,
  AlertTriangle,
  MousePointer2,
  GraduationCap,
  ChevronUp,
  Clock,
  Search,
} from "lucide-react";
import { cn, formatClock } from "@/lib/format";
import type {
  TranscriptSegment,
  AnalysisItem,
  AccessibilityEvent,
  MissingItem,
  VisualEventItem,
} from "@/types/backend";

type TrackKind =
  | "speech"
  | "visual"
  | "ocr"
  | "ad"
  | "gaps"
  | "events"
  | "assessment";

interface TrackInfo {
  kind: TrackKind;
  label: string;
  Icon: typeof Mic;
  cls: string;
  markerColor: string;
}

const TRACKS: TrackInfo[] = [
  {
    kind: "speech",
    label: "SPEECH",
    Icon: Mic,
    cls: "timeline-track-speech",
    markerColor: "bg-brand-cyan",
  },
  {
    kind: "visual",
    label: "VISUAL",
    Icon: Eye,
    cls: "timeline-track-visual",
    markerColor: "bg-brand-blue",
  },
  {
    kind: "ocr",
    label: "OCR",
    Icon: ScanText,
    cls: "timeline-track-ocr",
    markerColor: "bg-brand-indigo",
  },
  {
    kind: "ad",
    label: "AUDIO DESCRIPTION",
    Icon: Volume2,
    cls: "timeline-track-ad",
    markerColor: "bg-brand-emerald",
  },
  {
    kind: "gaps",
    label: "GAPS",
    Icon: AlertTriangle,
    cls: "timeline-track-gaps",
    markerColor: "bg-brand-amber",
  },
  {
    kind: "events",
    label: "EVENTS",
    Icon: MousePointer2,
    cls: "timeline-track-events",
    markerColor: "bg-brand-rose",
  },
  {
    kind: "assessment",
    label: "ASSESSMENT",
    Icon: GraduationCap,
    cls: "timeline-track-assessment",
    markerColor: "bg-brand-violet",
  },
];

interface Mark {
  kind: TrackKind;
  start: number;
  end?: number;
  label: string;
  tooltip?: string;
  id?: string;
  selected?: boolean;
  data?: unknown;
}

export interface MultimodalTimelineProps {
  duration: number;
  currentTime: number;
  onSeek: (t: number) => void;
  segments?: TranscriptSegment[];
  visuals?: VisualEventItem[];
  analysis?: AnalysisItem[];
  adCues?: AccessibilityEvent[];
  missing?: MissingItem[];
  interactionEvents?: Array<{
    time: number;
    type?: string;
    label?: string;
    description?: string;
  }>;
  selectedGapId?: string | number | null;
  onSelectGap?: (item: MissingItem | null, idx?: number) => void;
  mini?: boolean;
  className?: string;
}

export function MultimodalTimeline({
  duration,
  currentTime,
  onSeek,
  segments = [],
  visuals = [],
  analysis = [],
  adCues = [],
  missing = [],
  interactionEvents = [],
  selectedGapId,
  onSelectGap,
  mini = false,
  className,
}: MultimodalTimelineProps) {
  const [hoverTime, setHoverTime] = React.useState<number | null>(null);
  const trackRef = React.useRef<HTMLDivElement | null>(null);
  const safeDuration = Math.max(1, duration || 1);

  const pct = (t: number) => (t / safeDuration) * 100;
  const fromClientX = (x: number) => {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (x - rect.left) / rect.width));
    return ratio * safeDuration;
  };

  const marksByTrack = React.useMemo(() => {
    const out: Record<TrackKind, Mark[]> = {
      speech: [],
      visual: [],
      ocr: [],
      ad: [],
      gaps: [],
      events: [],
      assessment: [],
    };
    segments.forEach((s, i) =>
      out.speech.push({
        kind: "speech",
        start: s.start,
        end: s.end,
        label: `S${i + 1}`,
        tooltip: s.text.slice(0, 120),
        data: s,
      })
    );
    visuals.forEach((v, i) =>
      out.visual.push({
        kind: "visual",
        start: v.start,
        end: v.end,
        label: v.type || `V${i + 1}`,
        tooltip: v.description?.slice(0, 120),
        data: v,
      })
    );
    analysis.forEach((a, i) => {
      const t = a.start ?? i * 3;
      if (a.ocr_text) {
        out.ocr.push({
          kind: "ocr",
          start: t,
          end: a.end ?? t + 2,
          label: a.type || `O${i + 1}`,
          tooltip: a.ocr_text.slice(0, 120),
          data: a,
        });
      }
    });
    adCues.forEach((c, i) =>
      out.ad.push({
        kind: "ad",
        start: c.start,
        end: c.end,
        label: `AD-${i + 1}`,
        tooltip: c.description?.slice(0, 120),
        data: c,
      })
    );
    missing.forEach((m, i) =>
      out.gaps.push({
        kind: "gaps",
        start: m.timestamp_start ?? m.timestamp,
        end: m.timestamp_end ?? m.timestamp + 3,
        label: `GAP-${i + 1}`,
        tooltip: m.missing_information?.slice(0, 120),
        id: String(i),
        selected:
          selectedGapId === i ||
          (selectedGapId !== undefined && selectedGapId !== null &&
            String(selectedGapId) === String(m.timestamp)),
        data: m,
      })
    );
    interactionEvents.forEach((e, i) =>
      out.events.push({
        kind: "events",
        start: e.time,
        label: e.type || `E${i + 1}`,
        tooltip: e.description || e.label,
      })
    );
    // assessment: synthetic (1 marker each 20% of lecture + at gaps)
    if (!mini) {
      const markCount = 4;
      for (let i = 1; i <= markCount; i++) {
        out.assessment.push({
          kind: "assessment",
          start: (safeDuration * i) / (markCount + 1),
          label: `AS-${i}`,
          tooltip: "Assessment checkpoint",
        });
      }
    }
    return out;
  }, [segments, visuals, analysis, adCues, missing, interactionEvents, safeDuration, selectedGapId, mini]);

  const activePct = pct(currentTime);
  const hoverPct = hoverTime !== null ? pct(hoverTime) : null;

  const timeTicks = React.useMemo(() => {
    const count = mini ? 4 : 7;
    return Array.from({ length: count }, (_, i) =>
      Math.round((safeDuration * i) / (count - 1))
    );
  }, [safeDuration, mini]);

  return (
    <div
      className={cn(
        "flex flex-col gap-2 w-full",
        mini ? "py-2" : "p-3 rounded-2xl bg-white border border-slate-200/70 shadow-surface",
        className
      )}
    >
      {!mini && (
        <div className="flex items-center justify-between px-1 mb-1">
          <div className="flex items-center gap-2">
            <Search className="size-3.5 text-slate-400" aria-hidden />
            <span className="meta-label">Multimodal Timeline Matrix</span>
            <span className="font-mono text-[10px] text-slate-400 tabular-nums">
              {safeDuration ? formatClock(safeDuration) : "00:00"}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <Clock className="size-3 text-brand-indigo" aria-hidden />
            <span className="font-mono font-semibold tabular-nums text-brand-indigo">
              {formatClock(currentTime)}
            </span>
          </div>
        </div>
      )}

      <div className="relative">
        <div className="flex">
          <div
            className={cn(
              "shrink-0 flex flex-col gap-1 pr-2 pt-0.5",
              mini ? "w-[72px]" : "w-[152px]"
            )}
          >
            {TRACKS.map((t) => {
              const Icon = t.Icon;
              return (
                <div
                  key={t.kind}
                  className={cn(
                    "flex items-center gap-2 shrink-0",
                    mini ? "h-8" : "h-16"
                  )}
                >
                  <div className={cn(
                    "flex items-center gap-1.5 rounded-md px-1.5 py-0.5 shrink-0",
                    mini ? "scale-[0.85] origin-left" : ""
                  )}>
                    <Icon className={cn(
                      mini ? "size-3" : "size-3.5",
                      t.kind === "speech" && "text-brand-cyan",
                      t.kind === "visual" && "text-brand-blue",
                      t.kind === "ocr" && "text-brand-indigo",
                      t.kind === "ad" && "text-brand-emerald",
                      t.kind === "gaps" && "text-brand-amber",
                      t.kind === "events" && "text-brand-rose",
                      t.kind === "assessment" && "text-brand-violet",
                    )} aria-hidden />
                    <span className="meta-label leading-none">
                      {mini ? t.label.slice(0, 3) : t.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="relative flex-1 min-w-0">
            <div
              ref={trackRef}
              className="relative flex flex-col gap-1 select-none"
              onMouseMove={(e) => {
                const t = fromClientX(e.clientX);
                setHoverTime(t);
              }}
              onMouseLeave={() => setHoverTime(null)}
              onClick={(e) => {
                const t = fromClientX(e.clientX);
                onSeek(t);
              }}
            >
              {TRACKS.map((track) => (
                <TrackRow
                  key={track.kind}
                  track={track}
                  marks={marksByTrack[track.kind]}
                  pct={pct}
                  mini={mini}
                  onSelectGap={(m, idx) => {
                    if (track.kind === "gaps" && m && onSelectGap) {
                      onSelectGap(m.data as MissingItem, Number(m.id));
                    }
                  }}
                />
              ))}

              {/* Grid ticks */}
              <div
                className="pointer-events-none absolute inset-0"
                aria-hidden
              >
                {timeTicks.map((t, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 border-l border-slate-200/60"
                    style={{ left: `${pct(t)}%` }}
                  />
                ))}
              </div>

              {/* Current time vertical indicator */}
              <div
                className="pointer-events-none absolute top-0 bottom-0 z-20"
                style={{ left: `${activePct}%` }}
                aria-hidden
              >
                <div className="absolute -top-1 -translate-x-1/2 bg-brand-indigo text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md tabular-nums shadow-float animate-time-travel whitespace-nowrap">
                  {formatClock(currentTime)}
                </div>
                <div className="absolute top-[18px] bottom-0 -translate-x-1/2 w-[2px] bg-brand-indigo rounded-full" />
                <div className="absolute top-[18px] -translate-x-1/2 size-2.5 rounded-full bg-white border-2 border-brand-indigo shadow-float" />
              </div>

              {/* Hover indicator */}
              {hoverPct !== null && !mini && (
                <div
                  className="pointer-events-none absolute top-0 bottom-0 z-10"
                  style={{ left: `${hoverPct}%` }}
                  aria-hidden
                >
                  <div className="absolute top-0 -translate-x-1/2 bg-slate-800 text-white text-[9px] font-mono px-1.5 py-0.5 rounded-md tabular-nums opacity-80 whitespace-nowrap">
                    {formatClock(hoverTime ?? 0)}
                  </div>
                  <div className="absolute top-[18px] bottom-0 -translate-x-1/2 w-[1px] bg-slate-400/70" />
                </div>
              )}
            </div>

            {/* Time axis */}
            <div className="relative mt-1.5 h-4" aria-hidden>
              {timeTicks.map((t, i) => (
                <div
                  key={i}
                  className="absolute -translate-x-1/2 font-mono text-[9px] text-slate-400 tabular-nums"
                  style={{ left: `${pct(t)}%` }}
                >
                  {formatClock(t)}
                </div>
              ))}
            </div>
          </div>
        </div>

        {!mini && (
          <div className="mt-3 flex flex-wrap items-center gap-3 px-2">
            {TRACKS.slice(0, 4).map((t) => {
              const count = marksByTrack[t.kind].length;
              const Icon = t.Icon;
              return (
                <div key={t.kind} className="flex items-center gap-1.5">
                  <span className={cn("size-2 rounded-full", t.markerColor)} />
                  <span className="meta-label text-slate-500">{t.label}</span>
                  <span className="font-mono text-[10px] font-semibold text-slate-700 tabular-nums">
                    {count}
                  </span>
                </div>
              );
            })}
            <div className="flex items-center gap-1.5 ml-auto">
              <ChevronUp className="size-3 text-slate-400" aria-hidden />
              <span className="text-[10px] text-slate-500">
                Click anywhere on timeline to seek · Hover tracks to inspect evidence
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TrackRow({
  track,
  marks,
  pct,
  mini,
  onSelectGap,
}: {
  track: TrackInfo;
  marks: Mark[];
  pct: (t: number) => number;
  mini: boolean;
  onSelectGap: (m: Mark | null, idx?: number) => void;
}) {
  return (
    <div
      className={cn(
        "timeline-track relative",
        track.cls,
        mini ? "!h-8" : ""
      )}
    >
      {marks.map((m, idx) => {
        const width = m.end ? Math.max(0.4, pct(m.end - m.start)) : mini ? 0.7 : 1;
        return (
          <div
            key={idx}
            className={cn(
              "timeline-event-marker flex items-center justify-center",
              track.markerColor,
              m.selected && "ring-4 ring-offset-1 ring-brand-amber/60 scale-150",
              m.end && m.end !== m.start ? "rounded-sm" : "rounded-full",
              mini ? "!size-1.5" : ""
            )}
            style={{
              left: `${pct(m.start)}%`,
              width: m.end && m.end !== m.start ? `${width}%` : undefined,
            }}
            title={m.tooltip || m.label}
            onClick={(e) => {
              if (track.kind === "gaps") {
                e.stopPropagation();
                onSelectGap(m, idx);
              }
            }}
          >
            {!mini && m.end && m.end - m.start > 3 && (
              <span className="hidden md:block text-[8px] font-bold text-white/90 font-mono whitespace-nowrap px-1 overflow-hidden text-ellipsis max-w-full">
                {m.label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
