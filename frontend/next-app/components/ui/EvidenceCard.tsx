"use client";

import * as React from "react";
import { ShieldCheck, ShieldAlert, FileCode, MessageSquare, Play, Clock, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatClock, cn } from "@/lib/format";

export interface EvidenceCardProps {
  trust?: "VERIFIED" | "UNCERTAIN" | "UNAVAILABLE" | string;
  timestamp?: number;
  timestampStart?: number;
  timestampEnd?: number;
  type?: "ocr" | "speech" | "visual" | "gap" | "ad";
  title?: string;
  content?: string;
  snippet?: string;
  sourceLabel?: string;
  source?: string;
  onJump?: (time: number) => void;
  onSeek?: (time: number) => void;
  className?: string;
  compact?: boolean;
}

export function EvidenceCard({
  trust = "VERIFIED",
  timestamp,
  timestampStart,
  timestampEnd,
  type = "ocr",
  title,
  content,
  snippet,
  sourceLabel,
  source,
  onJump,
  onSeek,
  className,
  compact = false,
}: EvidenceCardProps) {
  const effectiveTimestamp = timestamp ?? timestampStart;
  const effectiveContent = content ?? snippet ?? "";
  const effectiveSource = sourceLabel ?? source;
  const effectiveJump = onJump ?? onSeek;
  const isVerified = trust.toUpperCase() === "VERIFIED";
  const isUnavailable = trust.toUpperCase() === "UNAVAILABLE";

  const typeIcon = {
    ocr: FileCode,
    speech: MessageSquare,
    visual: ShieldCheck,
    gap: ShieldAlert,
    ad: Play,
  }[type] || FileCode;

  const Icon = typeIcon;

  return (
    <div
      className={cn(
        "rounded-2xl border transition-all duration-200 bg-white",
        isVerified
          ? "border-emerald-200/80 bg-gradient-to-br from-emerald-50/40 via-white to-white shadow-2xs hover:border-emerald-300"
          : isUnavailable
          ? "border-slate-200 bg-slate-50/60 text-slate-500"
          : "border-amber-200/80 bg-amber-50/30",
        compact ? "p-3 space-y-1.5" : "p-4 space-y-2.5",
        className
      )}
    >
      {/* Card Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "flex size-6 items-center justify-center rounded-lg text-xs",
              isVerified
                ? "bg-emerald-100 text-emerald-700"
                : isUnavailable
                ? "bg-slate-100 text-slate-500"
                : "bg-amber-100 text-amber-700"
            )}
          >
            <Icon className="size-3.5" />
          </span>

          <span className="text-xs font-bold text-slate-800">
            {title || (type === "ocr" ? "OCR Keyframe Evidence" : type === "speech" ? "Spoken Transcript Evidence" : "Modality Evidence")}
          </span>

          <Badge
            variant={isVerified ? "success" : isUnavailable ? "muted" : "warning"}
            className="text-[10px] font-bold uppercase tracking-wider"
          >
            {isVerified ? "✓ VERIFIED" : isUnavailable ? "UNAVAILABLE" : "UNCERTAIN"}
          </Badge>
        </div>

        {typeof effectiveTimestamp === "number" && (
          <div className="flex items-center gap-1 text-[11px] font-mono text-slate-600">
            <Clock className="size-3 text-brand-indigo" />
            <span>
              {formatClock(effectiveTimestamp)}
              {typeof timestampEnd === "number" && timestampEnd > effectiveTimestamp ? ` – ${formatClock(timestampEnd)}` : ""}
            </span>
          </div>
        )}
      </div>

      {/* Content Text */}
      <div className="text-xs leading-relaxed text-slate-700 font-normal">
        {type === "ocr" ? (
          <div className="rounded-xl bg-slate-900 p-2.5 font-mono text-xs text-emerald-300 shadow-inner overflow-x-auto">
            <code>{effectiveContent}</code>
          </div>
        ) : (
          <p className="italic text-slate-800">{effectiveContent}</p>
        )}
      </div>

      {/* Footer / Jump to Timestamp Action */}
      <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
        <span className="font-mono text-[10px] text-slate-400">
          {effectiveSource || (type === "ocr" ? "Source: Keyframe Optical Character Recognition" : "Source: Whisper STT Multilingual Transcript")}
        </span>

        {typeof effectiveTimestamp === "number" && effectiveJump && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => effectiveJump(effectiveTimestamp)}
            className="h-7 gap-1 px-2 text-[11px] font-semibold text-brand-indigo hover:text-brand-indigo hover:bg-brand-indigo/10"
          >
            <Play className="size-3 fill-current" />
            <span>Seek to {formatClock(effectiveTimestamp)}</span>
          </Button>
        )}
      </div>
    </div>
  );
}
export default EvidenceCard;
