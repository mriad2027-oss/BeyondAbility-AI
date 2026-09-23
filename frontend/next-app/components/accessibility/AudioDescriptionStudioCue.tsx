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
        "group relative overflow-hidden rounded-2xl border transition-all duration-300 text-[#2F2924]",
        isActive
          ? "border-[#C5E3C7] bg-gradient-to-r from-[#EBF5EC] via-[#FFFDFC] to-[#EBF5EC]/60 shadow-md ring-2 ring-[#5F8A62]/20"
          : "border-[#DDD0C0] bg-[#FFFDFC] hover:border-[#B85C38] hover:shadow-xs"
      )}
    >
      <div className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Cue Identifier & Timestamp */}
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex size-9 items-center justify-center rounded-xl transition-colors shadow-xs",
                isActive
                  ? "bg-[#5F8A62] text-white"
                  : "bg-[#F1E8DC] text-[#7A7067] group-hover:bg-[#EDE2D3]"
              )}
            >
              <Volume2 className="size-4" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-[#2F2924]">
                  Cue {String(index + 1).padStart(2, "0")}
                </span>
                <span className="font-mono text-xs text-[#B85C38] font-bold">
                  {formatClock(cue.start)} – {formatClock(cue.end)}
                </span>
                <span className="text-[10px] text-[#7A7067] font-mono">
                  ({cueDuration.toFixed(1)}s)
                </span>
              </div>
              <p className="text-[11px] text-[#7A7067]">
                Visual Event: <span className="font-medium text-[#2F2924]">{cue.visual_type || "Slide Content"}</span>
              </p>
            </div>
          </div>

          {/* Action Button & Active Waveform Pill */}
          <div className="flex items-center gap-2.5">
            {isActive && (
              <div className="flex items-center gap-1.5 rounded-full bg-[#EBF5EC] border border-[#C5E3C7] px-3 py-1 text-[10px] font-bold text-[#2D5A30] uppercase tracking-wider">
                <span className="size-2 rounded-full bg-[#5F8A62] animate-ping" />
                <span>NARRATING</span>
                {/* Micro Animated Waveform */}
                <div className="flex items-end gap-0.5 h-3 ml-1">
                  <span className="w-0.5 bg-[#5F8A62] rounded-full animate-pulse h-2" />
                  <span className="w-0.5 bg-[#5F8A62] rounded-full animate-bounce h-3" />
                  <span className="w-0.5 bg-[#5F8A62] rounded-full animate-pulse h-1.5" />
                  <span className="w-0.5 bg-[#5F8A62] rounded-full animate-bounce h-2.5" />
                </div>
              </div>
            )}

            <Button
              size="sm"
              variant={isActive ? "primary" : "secondary"}
              onClick={() => onJump(cue.start)}
              className="gap-1.5 text-xs font-semibold shadow-xs"
            >
              <Play className="size-3 fill-current" />
              {isActive ? "Replay Cue" : "Jump to Moment"}
            </Button>
          </div>
        </div>

        {/* Narration Script Text */}
        <div className="mt-3.5 rounded-xl border border-[#EDE2D3] bg-[#FBF8F2] p-3.5">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#7A7067] block mb-1">
            Synthesized Narration Description:
          </span>
          <p className="text-xs sm:text-sm font-medium text-[#2F2924] leading-relaxed">
            {cue.description}
          </p>
        </div>

        {/* Spoken Context Anchor */}
        {cue.transcript && (
          <div className="mt-2 flex items-start gap-1.5 text-xs text-[#7A7067]">
            <span className="font-semibold text-[#51483F] shrink-0">Original Lecture Audio:</span>
            <span className="italic line-clamp-1 text-[#2F2924]">&ldquo;{cue.transcript}&rdquo;</span>
          </div>
        )}
      </div>
    </div>
  );
}
