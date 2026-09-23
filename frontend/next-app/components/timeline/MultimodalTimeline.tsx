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
    cls: "border-[#D5E1EC] bg-[#F4F7FA]",
    markerColor: "bg-[#5B82A6]",
  },
  {
    kind: "visual",
    label: "VISUAL",
    Icon: Eye,
    cls: "border-[#D2E4E4] bg-[#F2F7F7]",
    markerColor: "bg-[#5F9A9A]",
  },
  {
    kind: "ocr",
    label: "OCR",
    Icon: ScanText,
    cls: "border-[#DDD8EE] bg-[#F6F5FB]",
    markerColor: "bg-[#6C63A8]",
  },
  {
    kind: "ad",
    label: "AUDIO DESCRIPTION",
    Icon: Volume2,
    cls: "border-[#C5E3C7] bg-[#EBF5EC]",
    markerColor: "bg-[#5F8A62]",
  },
  {
    kind: "gaps",
    label: "GAPS",
    Icon: AlertTriangle,
    cls: "border-[#F3CE9D] bg-[#FEF6EC]",
    markerColor: "bg-[#B77932]",
  },
  {
    kind: "events",
    label: "EVENTS",
    Icon: MousePointer2,
    cls: "border-[#E8C2B2] bg-[#FFF8F4]",
    markerColor: "bg-[#B85C38]",
  },
  {
    kind: "assessment",
    label: "ASSESSMENT",
    Icon: GraduationCap,
    cls: "border-[#E1D5C8] bg-[#F1E8DC]",
    markerColor: "bg-[#7A8061]",
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
        "flex flex-col gap-2 w-full text-[#2F2924]",
        mini ? "py-2" : "p-3 rounded-2xl bg-[#FFFDFC] border border-[#DDD0C0] shadow-xs",
        className
      )}
    >
      {!mini && (
        <div className="flex items-center justify-between px-1 mb-1">
          <div className="flex items-center gap-2">
            <Search className="size-3.5 text-[#7A7067]" aria-hidden />
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#7A7067]">Multimodal Timeline Matrix</span>
            <span className="font-mono text-[10px] text-[#7A7067] tabular-nums">
              {safeDuration ? formatClock(safeDuration) : "00:00"}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <Clock className="size-3 text-[#B85C38]" aria-hidden />
            <span className="font-mono font-bold tabular-nums text-[#B85C38]">
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
                    mini ? "h-8" : "h-14"
                  )}
                >
                  <div className={cn(
                    "flex items-center gap-1.5 rounded-md px-1.5 py-0.5 shrink-0",
                    mini ? "scale-[0.85] origin-left" : ""
                  )}>
                    <Icon className={cn(
                      mini ? "size-3" : "size-3.5",
                      t.kind === "speech" && "text-[#5B82A6]",
                      t.kind === "visual" && "text-[#5F9A9A]",
                      t.kind === "ocr" && "text-[#6C63A8]",
                      t.kind === "ad" && "text-[#5F8A62]",
                      t.kind === "gaps" && "text-[#B77932]",
                      t.kind === "events" && "text-[#B85C38]",
                      t.kind === "assessment" && "text-[#7A8061]",
                    )} aria-hidden />
                    <span className="font-mono text-[10px] font-bold text-[#51483F] leading-none uppercase tracking-wider">
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
              className="relative flex flex-col gap-1 select-none cursor-pointer"
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
                    className="absolute top-0 bottom-0 border-l border-[#DDD0C0]/60"
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
                <div className="absolute -top-1 -translate-x-1/2 bg-[#B85C38] text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md tabular-nums shadow-sm whitespace-nowrap">
                  {formatClock(currentTime)}
                </div>
                <div className="absolute top-[18px] bottom-0 -translate-x-1/2 w-[2px] bg-[#B85C38] rounded-full" />
                <div className="absolute top-[18px] -translate-x-1/2 size-2.5 rounded-full bg-white border-2 border-[#B85C38] shadow-sm" />
              </div>

              {/* Hover indicator */}
              {hoverPct !== null && !mini && (
                <div
                  className="pointer-events-none absolute top-0 bottom-0 z-10"
                  style={{ left: `${hoverPct}%` }}
                  aria-hidden
                >
                  <div className="absolute top-0 -translate-x-1/2 bg-[#3F352E] text-[#FFF8F0] text-[9px] font-mono px-1.5 py-0.5 rounded-md tabular-nums opacity-90 whitespace-nowrap">
                    {formatClock(hoverTime ?? 0)}
                  </div>
                  <div className="absolute top-[18px] bottom-0 -translate-x-1/2 w-[1px] bg-[#7A7067]/70" />
                </div>
              )}
            </div>

            {/* Time axis */}
            <div className="relative mt-1.5 h-4" aria-hidden>
              {timeTicks.map((t, i) => (
                <div
                  key={i}
                  className="absolute -translate-x-1/2 font-mono text-[9px] text-[#7A7067] tabular-nums"
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
              return (
                <div key={t.kind} className="flex items-center gap-1.5">
                  <span className={cn("size-2 rounded-full", t.markerColor)} />
                  <span className="font-mono text-[10px] font-semibold text-[#7A7067]">{t.label}</span>
                  <span className="font-mono text-[10px] font-bold text-[#2F2924] tabular-nums">
                    {count}
                  </span>
                </div>
              );
            })}
            <div className="flex items-center gap-1.5 ml-auto">
              <ChevronUp className="size-3 text-[#7A7067]" aria-hidden />
              <span className="text-[10px] text-[#7A7067]">
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
        "relative rounded-lg border my-0.5 transition-colors",
        track.cls,
        mini ? "h-7" : "h-12"
      )}
    >
      {marks.map((m, idx) => {
        const width = m.end ? Math.max(0.4, pct(m.end - m.start)) : mini ? 0.7 : 1;
        return (
          <div
            key={idx}
            className={cn(
              "absolute top-1/2 -translate-y-1/2 flex items-center justify-center cursor-pointer transition-transform hover:scale-110 shadow-xs",
              track.markerColor,
              m.selected && "ring-3 ring-offset-1 ring-[#B85C38] scale-125 z-10",
              m.end && m.end !== m.start ? "rounded-sm h-5" : "rounded-full size-3",
              mini ? "!size-2" : ""
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
              <span className="hidden md:block text-[8px] font-bold text-white font-mono whitespace-nowrap px-1 overflow-hidden text-ellipsis max-w-full">
                {m.label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
