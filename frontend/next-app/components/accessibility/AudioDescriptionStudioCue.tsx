"use client";

import * as React from "react";
import {
  Volume2,
  Play,
  Pause,
  Clock,
  Sparkles,
  CheckCircle2,
  Waves,
  AudioLines,
  FileAudio,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatClock } from "@/lib/format";
import type { AudioDescriptionCue } from "@/types/backend";

interface AudioDescriptionStudioCueProps {
  cue: AudioDescriptionCue;
  index: number;
  isActive: boolean;
  isPlaying: boolean;
  onJump: (time: number) => void;
}

export function AudioDescriptionStudioCue({
  cue,
  index,
  isActive,
  isPlaying,
  onJump,
}: AudioDescriptionStudioCueProps) {
  const cueDuration = Math.max(0.5, (cue.end ?? cue.start + 2) - cue.start);

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border transition-all duration-300",
        isActive
          ? "border-emerald-500 bg-gradient-to-r from-emerald-50/80 via-white to-emerald-50/40 shadow-md ring-2 ring-emerald-500/20"
          : "border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-xs"
      )}
    >
      <div className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Cue Identifier & Timestamp */}
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex size-9 items-center justify-center rounded-xl transition-colors shadow-2xs",
                isActive
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"
              )}
            >
              <Volume2 className="size-4" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-slate-900">
                  Cue {String(index + 1).padStart(2, "0")}
                </span>
                <span className="font-mono text-xs text-brand-indigo font-bold">
                  {formatClock(cue.start)} – {formatClock(cue.end)}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  ({cueDuration.toFixed(1)}s)
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Visual Event: <span className="font-medium text-slate-700">{cue.visual_type || "Slide Content"}</span>
              </p>
            </div>
          </div>

          {/* Action Button & Active Waveform Pill */}
          <div className="flex items-center gap-2.5">
            {isActive && (
              <div className="flex items-center gap-1.5 rounded-full bg-emerald-100 border border-emerald-300 px-3 py-1 text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                <span className="size-2 rounded-full bg-emerald-500 animate-ping" />
                <span>NARRATING</span>
                {/* Micro Animated Waveform */}
                <div className="flex items-end gap-0.5 h-3 ml-1">
                  <span className="w-0.5 bg-emerald-600 rounded-full animate-pulse h-2" />
                  <span className="w-0.5 bg-emerald-600 rounded-full animate-bounce h-3" />
                  <span className="w-0.5 bg-emerald-600 rounded-full animate-pulse h-1.5" />
                  <span className="w-0.5 bg-emerald-600 rounded-full animate-bounce h-2.5" />
                </div>
              </div>
            )}

            <Button
              size="sm"
              variant={isActive ? "primary" : "secondary"}
              onClick={() => onJump(cue.start)}
              className="gap-1.5 text-xs font-semibold shadow-2xs"
            >
              <Play className="size-3 fill-current" />
              {isActive ? "Replay Cue" : "Jump to Moment"}
            </Button>
          </div>
        </div>

        {/* Narration Script Text */}
        <div className="mt-3.5 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Synthesized Narration Description:
          </span>
          <p className="text-xs sm:text-sm font-medium text-slate-900 leading-relaxed">
            {cue.description}
          </p>
        </div>

        {/* Spoken Context Anchor */}
        {cue.transcript && (
          <div className="mt-2 flex items-start gap-1.5 text-xs text-app-soft">
            <span className="font-semibold text-slate-600 shrink-0">Original Lecture Audio:</span>
            <span className="italic line-clamp-1">&ldquo;{cue.transcript}&rdquo;</span>
          </div>
        )}
      </div>
    </div>
  );
}
