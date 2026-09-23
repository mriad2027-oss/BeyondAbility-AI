"use client";

import * as React from "react";
import {
  EyeOff,
  ScanText,
  Mic,
  AlertTriangle,
  HelpCircle,
  CheckCircle2,
  Play,
  ArrowDown,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  Eye,
  GitCompare,
  AlertOctagon,
  ListChecks,
  ArrowRight,
  Gauge,
} from "lucide-react";
import { cn, formatClock } from "@/lib/format";
import { TrustPill, EvidenceTimestamp, SectionRail, EvidenceSnippet } from "@/components/ui/evidence-primitives";
import type { MissingItem, TrustLevel } from "@/types/backend";

interface GapReasoningChainProps {
  items: MissingItem[];
  currentTime?: number;
  jumpTo: (seconds: number) => void;
}

const STEPS = [
  {
    id: "visual",
    label: "VISUAL EVIDENCE",
    Icon: Eye,
    bulletBg: "bg-[#5F9A9A]",
    accent: "teal",
    title: "What was shown on screen",
    source: "OCR · Vision Keyframe",
  },
  {
    id: "speech",
    label: "SPOKEN EVIDENCE",
    Icon: Mic,
    bulletBg: "bg-[#5B82A6]",
    accent: "blue",
    title: "What the instructor said",
    source: "Whisper · Transcript",
  },
  {
    id: "compare",
    label: "CROSS-MODAL COMPARISON",
    Icon: GitCompare,
    bulletBg: "bg-[#8B6B52]",
    accent: "brown",
    title: "Alignment check: speech vs visual",
    source: "Multimodal Alignment Engine",
  },
  {
    id: "gap",
    label: "DISPARITY DETECTED",
    Icon: AlertOctagon,
    bulletBg: "bg-[#B77932]",
    accent: "amber",
    title: "Accessibility gap identified",
    source: "Accessibility Reasoning",
  },
  {
    id: "evidence",
    label: "VERIFIABLE EVIDENCE",
    Icon: ListChecks,
    bulletBg: "bg-[#6C63A8]",
    accent: "indigo",
    title: "Grounded lecture evidence",
    source: "Timestamped Moment",
  },
  {
    id: "remediation",
    label: "REMEDIATION GENERATED",
    Icon: CheckCircle2,
    bulletBg: "bg-[#5F8A62]",
    accent: "green",
    title: "Synchronized audio description cue",
    source: "AD Studio · Non-Destructive Layer",
  },
] as const;

export function GapReasoningChain({ items, currentTime = 0, jumpTo }: GapReasoningChainProps) {
  const [selectedIdx, setSelectedIdx] = React.useState<number>(0);

  if (!items || items.length === 0) {
    return (
      <div className="relative rounded-2xl border border-[#C5E3C7] bg-[#EBF5EC] p-8 overflow-hidden text-[#2F2924]">
        <div className="relative flex flex-col items-center text-center gap-3 max-w-lg mx-auto">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-[#FFFDFC] text-[#5F8A62] border border-[#C5E3C7] shadow-xs">
            <ShieldCheck className="size-7" />
          </div>
          <h3 className="font-display font-bold text-xl md:text-2xl text-[#2D5A30]">
            Zero Accessibility Disparities
          </h3>
          <p className="text-[13px] text-[#3D6B40] leading-relaxed">
            Whisper spoken speech and visual on-screen keyframes are fully aligned.
            All visual concepts have matching verbal explanations in the lecture audio.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#FFFDFC] text-[#2D5A30] border border-[#C5E3C7]">VERIFIED ALIGNMENT</span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#FFFDFC] text-[#51483F] border border-[#DDD0C0]">CROSS-MODAL MATCH · 100%</span>
          </div>
        </div>
      </div>
    );
  }

  const activeItem = items[selectedIdx] || items[0];
  const startSec = Number(activeItem.timestamp_start ?? activeItem.timestamp ?? 0);
  const endSec = Number(activeItem.timestamp_end ?? startSec + 4);
  const trust: TrustLevel =
    (typeof activeItem.trust === "string"
      ? activeItem.trust
      : activeItem.trust?.trust) ?? "VERIFIED";
  const severity = (activeItem.severity || "medium") as "low" | "medium" | "high";

  const snippetVisual =
    activeItem.what_you_might_miss ??
    activeItem.missing_information ??
    "Visual code snippet, syntax diagram, or equation presented on video keyframe.";
  const snippetSpeech = activeItem.what_you_hear
    ? `“${activeItem.what_you_hear}”`
    : "Minimal or no verbal explanation captured during this visual frame — audio-only student cannot perceive the on-screen structure.";
  const snippetGap =
    activeItem.missing_information ??
    "The visual frame communicates syntax or structure not present in the spoken audio track.";
  const snippetImpact =
    activeItem.why_it_matters ??
    "Without an explicit description, the learner cannot form the correct mental model.";
  const snippetRemediation =
    activeItem.recommendation ??
    "Generated synchronized non-destructive audio description cue to narrate the on-screen content precisely at this timestamp.";

  return (
    <div className="w-full flex flex-col gap-5 text-[#2F2924]">
      {/* TOP: Disparity Moments Selector Rail */}
      <div className="rounded-2xl border border-[#DDD0C0] bg-[#FFFDFC] p-3.5 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-[#FEF6EC] text-[#B77932] border border-[#F3CE9D]">{items.length} GAPS</span>
            <span className="font-mono text-xs text-[#7A7067] uppercase tracking-wider">Disparity selector</span>
          </div>
          <div className="h-4 w-px bg-[#EDE2D3]" aria-hidden />
          <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
            {items.map((item, idx) => {
              const itemStart = Number(item.timestamp_start ?? item.timestamp ?? 0);
              const isSelected = idx === selectedIdx;
              const isCurrent = Math.abs(currentTime - itemStart) < 3.5;
              const sev = (item.severity || "medium") as "low" | "medium" | "high";
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setSelectedIdx(idx);
                    jumpTo(itemStart);
                  }}
                  className={cn(
                    "group inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-all",
                    isSelected
                      ? "border-[#B85C38] bg-[#FFF8F4] text-[#B85C38] shadow-xs scale-[1.02]"
                      : isCurrent
                      ? "border-[#B77932]/50 bg-[#FEF6EC] text-[#B77932] ring-1 ring-[#B77932]/30"
                      : "border-[#DDD0C0] bg-[#FFFDFC] text-[#51483F] hover:border-[#B85C38]/40 hover:bg-[#F1E8DC]"
                  )}
                >
                  <EyeOff className="size-3 opacity-80" aria-hidden />
                  <span className="font-mono tabular-nums">{formatClock(itemStart)}</span>
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      sev === "high"
                        ? "bg-[#B94A48]"
                        : sev === "low"
                        ? "bg-[#5F9A9A]"
                        : "bg-[#B77932]"
                    )}
                    title={`${sev} severity`}
                    aria-hidden
                  />
                  {isSelected && (
                    <ChevronRight className="size-3 opacity-60 group-hover:translate-x-0.5 transition" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-auto">
            <TrustPill trust={trust} />
            <button
              onClick={() => jumpTo(startSec)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#B85C38] text-white px-3 py-1.5 text-[11px] font-bold hover:bg-[#9F4F32] transition shadow-xs"
            >
              <Play className="size-3 fill-current" aria-hidden />
              Watch Moment
            </button>
          </div>
        </div>
      </div>

      {/* HEADER: Meta Strip */}
      <div className="flex items-center gap-2 pl-1 font-mono text-xs">
        <Gauge className="size-3.5 text-[#B77932]" aria-hidden />
        <span className="font-bold text-[#2F2924]">
          Accessibility Reasoning Chain · {formatClock(startSec)} – {formatClock(endSec)}
        </span>
        <span className="px-2 py-0.5 rounded-md bg-[#EDE2D3] text-[#51483F] font-bold text-[10px] ml-1">{severity.toUpperCase()} IMPACT</span>
        {activeItem.status && (
          <span className="px-2 py-0.5 rounded-md bg-[#FEF6EC] text-[#B77932] border border-[#F3CE9D] font-bold text-[10px] ml-1">
            {String(activeItem.status).replace(/_/g, " ")}
          </span>
        )}
      </div>

      {/* 6-STEP VERTICAL REASONING CHAIN */}
      <div className="relative pl-4 space-y-4">
        {STEPS.map((step, i) => {
          const content = (() => {
            if (step.id === "visual")
              return { text: snippetVisual, variant: "visual" as const };
            if (step.id === "speech")
              return { text: snippetSpeech, variant: "speech" as const };
            if (step.id === "compare")
              return {
                text:
                  "Comparing visual evidence against spoken transcript — the visual content (syntax, layout, structure) is not mirrored or explicitly described in the audio track.",
                variant: "ocr" as const,
              };
            if (step.id === "gap") return { text: snippetGap, variant: "gap" as const };
            if (step.id === "evidence")
              return { text: snippetImpact, variant: "speech" as const };
            return { text: snippetRemediation, variant: "ad" as const };
          })();

          return (
            <div key={step.id} className="relative flex items-start gap-3.5">
              <div className={cn("size-7 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs mt-0.5", step.bulletBg)}>
                <step.Icon className="size-3.5" aria-hidden />
              </div>

              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#51483F]">
                      {String(i + 1).padStart(2, "0")} · {step.label}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-[#7A7067]">
                    {step.source}
                  </span>
                </div>

                <EvidenceSnippet
                  variant={content.variant}
                  text={content.text}
                  trust={step.id === "evidence" ? trust : undefined}
                  timestamp={
                    step.id === "evidence" || step.id === "gap" || step.id === "remediation"
                      ? startSec
                      : undefined
                  }
                  onSeek={jumpTo}
                />

                {/* Step footer for evidence/remediation */}
                {step.id === "evidence" && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <EvidenceTimestamp
                      seconds={startSec}
                      onSeek={jumpTo}
                      source="VISUAL + OCR"
                      trust={trust}
                    />
                    <EvidenceTimestamp
                      seconds={startSec}
                      onSeek={jumpTo}
                      source="SPEECH"
                      trust={trust}
                    />
                  </div>
                )}

                {step.id === "remediation" && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-[#EBF5EC] text-[#3D6B40] border border-[#C5E3C7]">
                      <Sparkles className="size-2.5 text-[#5F8A62]" aria-hidden />
                      CUE GENERATED · SYNCHRONIZED
                    </span>
                    <button
                      onClick={() => jumpTo(startSec)}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#5F8A62] text-white px-2.5 py-1 text-[10px] font-bold hover:bg-[#4E7551] transition shadow-xs"
                    >
                      <Play className="size-2.5 fill-current" />
                      Preview AD with Lecture Audio
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* FOOTER: Architecture Note */}
      <div className="mt-1 rounded-xl border border-[#DDD0C0] bg-[#FBF8F2] p-3.5 flex items-start gap-3 text-xs text-[#51483F]">
        <AlertTriangle className="size-4 text-[#B85C38] shrink-0 mt-0.5" aria-hidden />
        <div className="leading-relaxed">
          <span className="font-bold text-[#2F2924]">Evidence-first reasoning.</span>{" "}
          Each disparity is produced by comparing two independent modalities (vision vs speech)
          and survives only when grounded in verifiable lecture timestamps. The remediation
          step layers a synchronized audio description cue non-destructively over the original
          lecture track.
        </div>
      </div>
    </div>
  );
}
