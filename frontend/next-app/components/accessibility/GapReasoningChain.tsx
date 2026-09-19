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
    bulletBg: "bg-brand-blue",
    accent: "blue",
    title: "What was shown on screen",
    source: "OCR · Vision Keyframe",
  },
  {
    id: "speech",
    label: "SPOKEN EVIDENCE",
    Icon: Mic,
    bulletBg: "bg-brand-cyan",
    accent: "cyan",
    title: "What the instructor said",
    source: "Whisper · Transcript",
  },
  {
    id: "compare",
    label: "CROSS-MODAL COMPARISON",
    Icon: GitCompare,
    bulletBg: "bg-slate-500",
    accent: "slate",
    title: "Alignment check: speech vs visual",
    source: "Multimodal Alignment Engine",
  },
  {
    id: "gap",
    label: "DISPARITY DETECTED",
    Icon: AlertOctagon,
    bulletBg: "bg-brand-amber",
    accent: "amber",
    title: "Accessibility gap identified",
    source: "Accessibility Reasoning",
  },
  {
    id: "evidence",
    label: "VERIFIABLE EVIDENCE",
    Icon: ListChecks,
    bulletBg: "bg-brand-indigo",
    accent: "indigo",
    title: "Grounded lecture evidence",
    source: "Timestamped Moment",
  },
  {
    id: "remediation",
    label: "REMEDIATION GENERATED",
    Icon: CheckCircle2,
    bulletBg: "bg-brand-emerald",
    accent: "emerald",
    title: "Synchronized audio description cue",
    source: "AD Studio · Non-Destructive Layer",
  },
] as const;

export function GapReasoningChain({ items, currentTime = 0, jumpTo }: GapReasoningChainProps) {
  const [selectedIdx, setSelectedIdx] = React.useState<number>(0);

  if (!items || items.length === 0) {
    return (
      <div className="relative rounded-2xl border border-emerald-200/70 bg-emerald-50/50 p-8 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none opacity-50"
          aria-hidden
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(22,163,74,0.08), transparent 45%)",
          }}
        />
        <div className="relative flex flex-col items-center text-center gap-3 max-w-lg mx-auto">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-200">
            <ShieldCheck className="size-7" />
          </div>
          <h3 className="workspace-heading text-xl md:text-2xl text-emerald-950">
            Zero Accessibility Disparities
          </h3>
          <p className="text-[13px] text-emerald-900/80 leading-relaxed">
            Whisper spoken speech and visual on-screen keyframes are fully aligned.
            All visual concepts have matching verbal explanations in the lecture audio.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <span className="badge-pill-emerald">VERIFIED ALIGNMENT</span>
            <span className="badge-pill-slate">CROSS-MODAL MATCH · 100%</span>
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
    <div className="w-full flex flex-col gap-5">
      {/* TOP: Disparity Moments Selector Rail */}
      <div className="rounded-2xl border border-slate-200/70 bg-white p-3.5 shadow-surface">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <span className="badge-pill-amber">{items.length} GAPS</span>
            <span className="meta-label">Disparity selector</span>
          </div>
          <div className="h-4 w-px bg-slate-200" aria-hidden />
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
                      ? "border-brand-amber bg-brand-amber/10 text-brand-amber shadow-surface scale-[1.02]"
                      : isCurrent
                      ? "border-brand-amber/50 bg-amber-50 text-brand-amber ring-1 ring-brand-amber/30"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  )}
                >
                  <EyeOff className="size-3 opacity-80" aria-hidden />
                  <span className="font-mono tabular-nums">{formatClock(itemStart)}</span>
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      sev === "high"
                        ? "bg-brand-rose"
                        : sev === "low"
                        ? "bg-brand-blue"
                        : "bg-brand-amber"
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
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 text-white px-3 py-1.5 text-[11px] font-semibold hover:bg-slate-800 transition shadow-surface"
            >
              <Play className="size-3 fill-current" aria-hidden />
              Watch Moment
            </button>
          </div>
        </div>
      </div>

      {/* HEADER: Meta Strip */}
      <div className="section-rail-left pl-1">
        <Gauge className="size-3.5 text-brand-amber" aria-hidden />
        <span className="section-rail-label">
          Accessibility Reasoning Chain · {formatClock(startSec)} – {formatClock(endSec)}
        </span>
        <span className="badge-pill-slate ml-1">{severity.toUpperCase()} IMPACT</span>
        {activeItem.status && (
          <span className="badge-pill-amber ml-1">
            {String(activeItem.status).replace(/_/g, " ")}
          </span>
        )}
      </div>

      {/* 6-STEP VERTICAL REASONING CHAIN */}
      <div className="relative pl-4">
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
            <div key={step.id} className="gap-chain-step animate-fade-slide-ltr" style={{ animationDelay: `${i * 60}ms` }}>
              <div className={cn("gap-chain-bullet text-white", step.bulletBg)}>
                <step.Icon className="size-3" aria-hidden />
              </div>

              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="meta-label text-slate-500">
                      {String(i + 1).padStart(2, "0")} · {step.label}
                    </span>
                  </div>
                  <span className="meta-label text-slate-400">
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
                    <span className="badge-pill-emerald">
                      <Sparkles className="size-2.5" aria-hidden />
                      CUE GENERATED · SYNCHRONIZED
                    </span>
                    <button
                      onClick={() => jumpTo(startSec)}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 text-white px-2.5 py-1 text-[10px] font-bold hover:bg-emerald-700 transition"
                    >
                      <Play className="size-2.5 fill-current" />
                      Preview AD with Lecture Audio
                    </button>
                  </div>
                )}
              </div>

              {/* Down arrow connector */}
              {i < STEPS.length - 1 && (
                <div className="col-span-full flex justify-start pl-[5px] pt-1 pb-1">
                  <div className="flex flex-col items-center gap-0.5">
                    <ArrowDown
                      className={cn(
                        "size-3.5 text-slate-400",
                        step.id === "compare" && "text-brand-amber animate-pulse-soft"
                      )}
                      aria-hidden
                    />
                    <ArrowRight
                      className={cn(
                        "size-3 text-slate-300",
                        step.id === "compare" && "text-brand-amber/60"
                      )}
                      aria-hidden
                      style={{ transform: "translateY(-3px) translateX(4px) rotate(90deg)" }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* FOOTER: Architecture Note */}
      <div className="mt-1 rounded-xl border border-slate-200/70 bg-slate-50/50 p-3 flex items-start gap-3">
        <AlertTriangle className="size-4 text-slate-400 shrink-0 mt-0.5" aria-hidden />
        <div className="text-[11.5px] leading-relaxed text-slate-600">
          <span className="font-semibold text-slate-800">Evidence-first reasoning.</span>{" "}
          Each disparity is produced by comparing two independent modalities (vision vs speech)
          and survives only when grounded in verifiable lecture timestamps. The remediation
          step layers a synchronized audio description cue non-destructively over the original
          lecture track.
        </div>
      </div>
    </div>
  );
}
