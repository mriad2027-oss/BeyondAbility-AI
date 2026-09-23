"use client";

import * as React from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Shield,
  ScanText,
  Eye,
  Mic,
  Volume2,
  AlertTriangle,
  Play,
  Crosshair,
  Sparkles,
  ExternalLink,
  Cpu,
  Layers,
} from "lucide-react";
import { cn, formatClock } from "@/lib/format";
import type { TrustLevel } from "@/types/backend";

export interface EvidenceLensData {
  timestamp: number;
  modality: "SPEECH" | "VISUAL" | "OCR" | "GAP" | "AD" | "REASONING" | "TWIN";
  source: string;
  evidence: string;
  codeSnippet?: string;
  confidence: number;
  status: "VERIFIED" | "UNCERTAIN" | "UNAVAILABLE" | "GAP_DETECTED" | "REMEDIATED";
  contextNotes?: string;
  remediation?: string;
}

export interface EvidenceLensProps {
  data?: EvidenceLensData | null;
  onSeek?: (seconds: number) => void;
  className?: string;
  isFloating?: boolean;
}

export function EvidenceLens({
  data,
  onSeek,
  className,
  isFloating = false,
}: EvidenceLensProps) {
  const sampleData: EvidenceLensData = data ?? {
    timestamp: 26.0,
    modality: "OCR",
    source: "Lecture Frame · Keyframe @ 00:26.0",
    evidence: "On-screen code snippet defines fruits list and loop header with indented block statement.",
    codeSnippet: 'fruits = ["apple", "banana", "cherry"]\nfor fruit in fruits:\n    print(fruit)',
    confidence: 0.984,
    status: "VERIFIED",
    contextNotes: "Spoken narration introduces looping concept; visual syntax verified via OCR engine.",
    remediation: "AD Cue #03 injected: 'On screen: for fruit in fruits colon, indent print fruit.'",
  };

  const getModalityMeta = (mod: EvidenceLensData["modality"]) => {
    switch (mod) {
      case "SPEECH":
        return {
          icon: Mic,
          label: "SPEECH · STT",
          color: "text-[#8DB4D6]",
          bg: "bg-[#5B82A6]/20 border-[#5B82A6]/40",
          pulse: "pulse-speech",
        };
      case "VISUAL":
        return {
          icon: Eye,
          label: "VISION · KEYFRAME",
          color: "text-[#8EC5C5]",
          bg: "bg-[#5F9A9A]/20 border-[#5F9A9A]/40",
          pulse: "pulse-vision",
        };
      case "OCR":
        return {
          icon: ScanText,
          label: "OCR · SYNTAX",
          color: "text-[#8EC5C5]",
          bg: "bg-[#5F9A9A]/20 border-[#5F9A9A]/40",
          pulse: "pulse-vision",
        };
      case "GAP":
        return {
          icon: AlertTriangle,
          label: "DISPARITY · GAP",
          color: "text-[#E6AA68]",
          bg: "bg-[#B77932]/25 border-[#B77932]/50",
          pulse: "pulse-gap",
        };
      case "AD":
        return {
          icon: Volume2,
          label: "AUDIO DESCRIPTION",
          color: "text-[#8FC493]",
          bg: "bg-[#5F8A62]/20 border-[#5F8A62]/40",
          pulse: "pulse-verified",
        };
      case "REASONING":
        return {
          icon: Cpu,
          label: "CROSS-MODAL REASONING",
          color: "text-[#AAA4D1]",
          bg: "bg-[#6C63A8]/20 border-[#6C63A8]/40",
          pulse: "pulse-ai",
        };
      case "TWIN":
      default:
        return {
          icon: Layers,
          label: "ACCESSIBILITY TWIN",
          color: "text-[#E8C2B2]",
          bg: "bg-[#B85C38]/20 border-[#B85C38]/40",
          pulse: "pulse-ai",
        };
    }
  };

  const modMeta = getModalityMeta(sampleData.modality);
  const ModIcon = modMeta.icon;

  const getStatusMeta = (status: EvidenceLensData["status"]) => {
    switch (status) {
      case "VERIFIED":
      case "REMEDIATED":
        return {
          label: status === "REMEDIATED" ? "REMEDIATED (AD READY)" : "VERIFIED GROUND TRUTH",
          icon: ShieldCheck,
          textColor: "text-[#8FC493]",
          bg: "bg-[#5F8A62]/20 border-[#5F8A62]/40",
        };
      case "GAP_DETECTED":
        return {
          label: "UNMITIGATED DISPARITY",
          icon: AlertTriangle,
          textColor: "text-[#E6AA68]",
          bg: "bg-[#B77932]/25 border-[#B77932]/50",
        };
      case "UNCERTAIN":
        return {
          label: "UNCERTAIN EVIDENCE",
          icon: ShieldAlert,
          textColor: "text-[#E6AA68]",
          bg: "bg-[#B77932]/25 border-[#B77932]/50",
        };
      case "UNAVAILABLE":
      default:
        return {
          label: "NO GROUNDING DATA",
          icon: Shield,
          textColor: "text-[#AAB09A]",
          bg: "bg-[#6F4E37]/30 border-[#8B6B52]/40",
        };
    }
  };

  const statusMeta = getStatusMeta(sampleData.status);
  const StatusIcon = statusMeta.icon;

  return (
    <div
      className={cn(
        "scientific-lens relative overflow-hidden text-[#FFF8F0] font-sans transition-all duration-300",
        isFloating && "shadow-xl border-[#B85C38]/40",
        className
      )}
    >
      {/* Corner crosshair markers */}
      <div className="pointer-events-none absolute top-2 left-2 size-2 border-t border-l border-[#B85C38]/50" />
      <div className="pointer-events-none absolute top-2 right-2 size-2 border-t border-r border-[#B85C38]/50" />
      <div className="pointer-events-none absolute bottom-2 left-2 size-2 border-b border-l border-[#B85C38]/50" />
      <div className="pointer-events-none absolute bottom-2 right-2 size-2 border-b border-r border-[#B85C38]/50" />

      {/* Header bar: Instrument Telemetry */}
      <div className="relative flex items-center justify-between border-b border-[#6F4E37] px-4 py-3 bg-[#332A24]/90">
        <div className="flex items-center gap-2.5">
          <Crosshair className="size-4 text-[#C97858]" aria-hidden />
          <span className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[#FFF8F0]">
            EVIDENCE LENS
          </span>
          <span className="font-mono text-[10px] text-[#C97858] font-semibold">v2.4</span>
        </div>

        {/* Timestamp button */}
        <button
          type="button"
          onClick={() => onSeek?.(sampleData.timestamp)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#8B6B52] bg-[#3F352E] px-2.5 py-1 font-mono text-xs font-bold text-[#E8C2B2] hover:border-[#B85C38] hover:bg-[#51483F] transition shadow-xs cursor-pointer"
          title={`Seek video to ${formatClock(sampleData.timestamp)}`}
        >
          <Play className="size-3 fill-[#E8C2B2]" />
          <span>{formatClock(sampleData.timestamp)}</span>
          <span className="text-[#AAB09A] text-[10px]">({sampleData.timestamp.toFixed(1)}s)</span>
        </button>
      </div>

      {/* Main scientific telemetry body */}
      <div className="p-4.5 sm:p-5 space-y-3.5">
        {/* Modality and Status Row */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className={cn("inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-[11px] font-bold uppercase", modMeta.bg, modMeta.color)}>
            <ModIcon className="size-3.5" />
            <span>{modMeta.label}</span>
          </div>

          <div className={cn("inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-[10.5px] font-bold uppercase tracking-wider", statusMeta.bg, statusMeta.textColor)}>
            <StatusIcon className="size-3.5" />
            <span>{statusMeta.label}</span>
          </div>
        </div>

        {/* Source citation */}
        <div className="flex items-center gap-2 text-xs font-mono text-[#E8DCD1]">
          <span className="text-[#AAB09A] font-semibold">SOURCE:</span>
          <span className="text-[#FFF8F0] font-semibold truncate">{sampleData.source}</span>
        </div>

        {/* Evidence Snippet / Code block */}
        <div className="rounded-xl border border-[#6F4E37] bg-[#2E2620] p-3.5 space-y-2.5">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-[#E8DCD1] font-semibold">EXTRACTED GROUND TRUTH:</span>
            <span className="text-[#8FC493] font-bold">
              CONFIDENCE: {(sampleData.confidence * 100).toFixed(1)}%
            </span>
          </div>

          <p className="text-[13px] text-[#FFF8F0] leading-relaxed font-sans font-normal">
            {sampleData.evidence}
          </p>

          {sampleData.codeSnippet && (
            <div className="rounded-lg bg-[#241E1A] border border-[#51483F] p-3 font-mono text-xs text-[#A7D8A9] font-semibold whitespace-pre leading-relaxed overflow-x-auto">
              {sampleData.codeSnippet}
            </div>
          )}
        </div>

        {/* Disparity or Remediation Note */}
        {sampleData.remediation && (
          <div className="rounded-xl border border-[#5F8A62]/40 bg-[#5F8A62]/15 p-3 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 text-[#8FC493] font-mono text-[11px] font-bold">
              <Sparkles className="size-3.5 text-[#8FC493]" />
              <span>GROUNDED REMEDIATION ACTION:</span>
            </div>
            <p className="text-[#FFF8F0] text-xs sm:text-[12.5px] leading-relaxed font-sans">{sampleData.remediation}</p>
          </div>
        )}

        {/* Telemetry metadata footer */}
        <div className="flex items-center justify-between pt-2 border-t border-[#6F4E37]/80 font-mono text-[10.5px] text-[#AAB09A] font-semibold">
          <span>DETERMINISTIC CITATION</span>
          <span>LATENCY: &lt;140ms</span>
        </div>
      </div>
    </div>
  );
}
