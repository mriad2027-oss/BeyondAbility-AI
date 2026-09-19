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
    source: "DEMO_python_loops · Keyframe @ 00:26.0",
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
          color: "text-blue-400",
          bg: "bg-blue-500/10 border-blue-500/30",
          pulse: "pulse-speech",
        };
      case "VISUAL":
        return {
          icon: Eye,
          label: "VISION · KEYFRAME",
          color: "text-sky-400",
          bg: "bg-sky-500/10 border-sky-500/30",
          pulse: "pulse-vision",
        };
      case "OCR":
        return {
          icon: ScanText,
          label: "OCR · SYNTAX",
          color: "text-indigo-400",
          bg: "bg-indigo-500/10 border-indigo-500/30",
          pulse: "pulse-ai",
        };
      case "GAP":
        return {
          icon: AlertTriangle,
          label: "DISPARITY · GAP",
          color: "text-amber-400",
          bg: "bg-amber-500/10 border-amber-500/30",
          pulse: "pulse-gap",
        };
      case "AD":
        return {
          icon: Volume2,
          label: "AUDIO DESCRIPTION",
          color: "text-emerald-400",
          bg: "bg-emerald-500/10 border-emerald-500/30",
          pulse: "pulse-verified",
        };
      case "REASONING":
        return {
          icon: Cpu,
          label: "CROSS-MODAL REASONING",
          color: "text-violet-400",
          bg: "bg-violet-500/10 border-violet-500/30",
          pulse: "pulse-ai",
        };
      case "TWIN":
      default:
        return {
          icon: Layers,
          label: "ACCESSIBILITY TWIN",
          color: "text-brand-indigo",
          bg: "bg-brand-indigo/10 border-brand-indigo/30",
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
          textColor: "text-emerald-400",
          bg: "bg-emerald-500/10 border-emerald-500/30",
        };
      case "GAP_DETECTED":
        return {
          label: "UNMITIGATED DISPARITY",
          icon: AlertTriangle,
          textColor: "text-amber-400",
          bg: "bg-amber-500/10 border-amber-500/30",
        };
      case "UNCERTAIN":
        return {
          label: "UNCERTAIN EVIDENCE",
          icon: ShieldAlert,
          textColor: "text-amber-300",
          bg: "bg-amber-500/10 border-amber-500/30",
        };
      case "UNAVAILABLE":
      default:
        return {
          label: "NO GROUNDING DATA",
          icon: Shield,
          textColor: "text-slate-400",
          bg: "bg-slate-800 border-slate-700",
        };
    }
  };

  const statusMeta = getStatusMeta(sampleData.status);
  const StatusIcon = statusMeta.icon;

  return (
    <div
      className={cn(
        "scientific-lens relative overflow-hidden text-white font-sans transition-all duration-300",
        isFloating && "shadow-2xl border-indigo-500/30",
        className
      )}
    >
      {/* Corner crosshair markers */}
      <div className="pointer-events-none absolute top-2 left-2 size-2 border-t border-l border-indigo-400/40" />
      <div className="pointer-events-none absolute top-2 right-2 size-2 border-t border-r border-indigo-400/40" />
      <div className="pointer-events-none absolute bottom-2 left-2 size-2 border-b border-l border-indigo-400/40" />
      <div className="pointer-events-none absolute bottom-2 right-2 size-2 border-b border-r border-indigo-400/40" />

      {/* Header bar: Instrument Telemetry */}
      <div className="relative flex items-center justify-between border-b border-slate-800/80 px-4 py-2.5 bg-slate-950/60">
        <div className="flex items-center gap-2">
          <Crosshair className="size-3.5 text-brand-cyan animate-spin-slow" aria-hidden />
          <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-300">
            EVIDENCE LENS
          </span>
          <span className="font-mono text-[9px] text-slate-500">v2.4</span>
        </div>

        {/* Timestamp button */}
        <button
          type="button"
          onClick={() => onSeek?.(sampleData.timestamp)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-900/90 px-2 py-0.5 font-mono text-[11px] font-bold text-sky-300 hover:border-sky-400/50 hover:bg-slate-800 transition"
          title={`Seek video to ${formatClock(sampleData.timestamp)}`}
        >
          <Play className="size-2.5 fill-sky-300" />
          <span>{formatClock(sampleData.timestamp)}</span>
          <span className="text-slate-500 text-[9px]">({sampleData.timestamp.toFixed(1)}s)</span>
        </button>
      </div>

      {/* Main scientific telemetry body */}
      <div className="p-4 space-y-3">
        {/* Modality and Status Row */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold uppercase", modMeta.bg, modMeta.color)}>
            <ModIcon className="size-3" />
            <span>{modMeta.label}</span>
          </div>

          <div className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-wider", statusMeta.bg, statusMeta.textColor)}>
            <StatusIcon className="size-3" />
            <span>{statusMeta.label}</span>
          </div>
        </div>

        {/* Source citation */}
        <div className="flex items-center gap-1.5 text-[10.5px] font-mono text-slate-400">
          <span className="text-slate-500">SOURCE:</span>
          <span className="text-slate-300 truncate">{sampleData.source}</span>
        </div>

        {/* Evidence Snippet / Code block */}
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-2">
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className="text-slate-400">EXTRACTED GROUND TRUTH:</span>
            <span className="text-emerald-400 font-bold">
              CONFIDENCE: {(sampleData.confidence * 100).toFixed(1)}%
            </span>
          </div>

          <p className="text-[11.5px] text-slate-200 leading-relaxed">
            {sampleData.evidence}
          </p>

          {sampleData.codeSnippet && (
            <div className="rounded-lg bg-black/90 border border-slate-800/80 p-2.5 font-mono text-[11px] text-emerald-400 whitespace-pre leading-relaxed overflow-x-auto">
              {sampleData.codeSnippet}
            </div>
          )}
        </div>

        {/* Disparity or Remediation Note */}
        {sampleData.remediation && (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5 text-[11px] space-y-1">
            <div className="flex items-center gap-1 text-emerald-400 font-mono text-[10px] font-bold">
              <Sparkles className="size-3" />
              <span>GROUNDED REMEDIATION ACTION:</span>
            </div>
            <p className="text-slate-300 leading-relaxed">{sampleData.remediation}</p>
          </div>
        )}

        {/* Telemetry metadata footer */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 font-mono text-[9.5px] text-slate-500">
          <span>DETERMINISTIC CITATION</span>
          <span>LATENCY: &lt;140ms</span>
        </div>
      </div>
    </div>
  );
}
