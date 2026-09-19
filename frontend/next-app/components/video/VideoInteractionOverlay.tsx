"use client";

import * as React from "react";
import { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  MousePointer2,
  EyeOff,
  Volume2,
  MessageSquareText,
  FileCode,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  Cpu,
} from "lucide-react";
import type { VideoInteractionEvent } from "@/types/interaction";
import { playInteractionClick, playEventChime } from "@/lib/sound";
import { cn } from "@/lib/format";

interface VideoInteractionOverlayProps {
  currentTime: number;
  playing: boolean;
  events?: VideoInteractionEvent[];
  enabled?: boolean;
  onToggleEnabled?: (enabled: boolean) => void;
  onEventAction?: (event: VideoInteractionEvent) => void;
  enableSound?: boolean;
}

export default function VideoInteractionOverlay({
  currentTime,
  playing,
  events = [],
  enabled = true,
  onToggleEnabled,
  onEventAction,
  enableSound = true,
}: VideoInteractionOverlayProps) {
  const [activeEvent, setActiveEvent] = useState<VideoInteractionEvent | null>(null);
  const [isClicking, setIsClicking] = useState(false);
  const triggeredRef = useRef<Set<string>>(new Set());
  const lastTimeRef = useRef<number>(currentTime);

  // Reset triggered IDs if user seeks backwards significantly or loops
  useEffect(() => {
    if (Math.abs(currentTime - lastTimeRef.current) > 2.5) {
      triggeredRef.current.clear();
      setActiveEvent(null);
      setIsClicking(false);
    }
    lastTimeRef.current = currentTime;
  }, [currentTime]);

  // Find active event based on currentTime
  useEffect(() => {
    if (!enabled || events.length === 0) {
      setActiveEvent(null);
      setIsClicking(false);
      return;
    }

    const matched = events.find((ev) => {
      const dur = ev.duration ?? 2.8;
      return currentTime >= ev.timestamp && currentTime <= ev.timestamp + dur;
    });

    if (matched) {
      setActiveEvent(matched);

      // Trigger click animation & sound once per encounter
      if (!triggeredRef.current.has(matched.id)) {
        triggeredRef.current.add(matched.id);

        if (matched.type === "click" || matched.type === "ai_ask" || matched.type === "ad_cue" || matched.type === "gap_detected") {
          setIsClicking(true);
          if (enableSound) {
            playInteractionClick(0.08);
          }
          setTimeout(() => setIsClicking(false), 600);
        } else if (enableSound) {
          playEventChime(0.05);
        }

        // Notify parent workspace for contextual preview
        onEventAction?.(matched);
      }
    } else {
      setActiveEvent(null);
      setIsClicking(false);
    }
  }, [currentTime, enabled, events, enableSound, onEventAction]);

  if (!enabled) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden select-none">
      {/* Interactive Demo Mode Status Badge */}
      <div className="pointer-events-auto absolute top-3 left-3 z-30 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onToggleEnabled?.(!enabled)}
          aria-pressed={enabled}
          aria-label="Toggle Interactive Demo Layer"
          className={cn(
            "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase backdrop-blur-md transition-all shadow-sm border",
            enabled
              ? "bg-slate-900/85 text-brand-indigo border-brand-indigo/40 ring-1 ring-brand-indigo/30"
              : "bg-slate-900/60 text-slate-400 border-slate-700/50 hover:text-white"
          )}
        >
          <Sparkles className={cn("size-3", enabled ? "text-amber-400 animate-pulse" : "text-slate-400")} />
          <span className="text-white font-semibold">Interactive Demo Layer</span>
          <span className={cn("size-1.5 rounded-full", enabled ? "bg-emerald-400" : "bg-slate-500")} />
        </button>
      </div>

      {/* Active Interaction Event Elements */}
      {activeEvent && (
        <>
          {/* Animated Cursor */}
          <div
            className="absolute transition-all duration-700 ease-out z-30"
            style={{
              left: `${activeEvent.x ?? 50}%`,
              top: `${activeEvent.y ?? 50}%`,
              transform: "translate(-2px, -2px)",
            }}
          >
            <div className="relative">
              {/* Realistic SVG Cursor */}
              <MousePointer2
                className={cn(
                  "size-5 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] fill-brand-indigo transition-transform duration-200",
                  isClicking && "scale-90 translate-y-0.5"
                )}
              />

              {/* Click Ripple Effect */}
              {isClicking && (
                <span className="absolute -left-3 -top-3 size-10 rounded-full border-2 border-brand-indigo/80 bg-brand-indigo/30 animate-ping pointer-events-none" />
              )}
            </div>
          </div>

          {/* Target Spotlight / Focus Bounding Box */}
          {activeEvent.type === "highlight" && (
            <div
              className="absolute rounded-xl border-2 border-dashed border-brand-indigo/80 bg-brand-indigo/10 shadow-[0_0_20px_rgba(79,70,229,0.3)] animate-pulse pointer-events-none transition-all duration-500"
              style={{
                left: `${Math.max(5, (activeEvent.x ?? 30) - 20)}%`,
                top: `${Math.max(5, (activeEvent.y ?? 30) - 15)}%`,
                width: "40%",
                height: "35%",
              }}
            >
              <div className="absolute -top-3 left-3 rounded bg-brand-indigo px-1.5 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider flex items-center gap-1 shadow-sm">
                <FileCode className="size-2.5" />
                OCR Target
              </div>
            </div>
          )}

          {/* Floating Smart Callout Pill / Card */}
          <div
            className="pointer-events-auto absolute transition-all duration-500 ease-out z-30 max-w-[280px] sm:max-w-[320px]"
            style={{
              left: `${Math.min(65, Math.max(10, (activeEvent.x ?? 50) - 15))}%`,
              top: `${Math.min(72, Math.max(15, (activeEvent.y ?? 50) + 6))}%`,
            }}
          >
            <div className="rounded-2xl border border-white/20 bg-slate-900/90 p-3 text-white shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300">
              {/* Card Header with Event Badge */}
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="inline-flex items-center gap-1 rounded-md bg-brand-indigo/30 border border-brand-indigo/40 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-indigo-300">
                  {activeEvent.type === "gap_detected" && <EyeOff className="size-2.5 text-amber-400" />}
                  {activeEvent.type === "ad_cue" && <Volume2 className="size-2.5 text-emerald-400" />}
                  {activeEvent.type === "ai_ask" && <MessageSquareText className="size-2.5 text-violet-400" />}
                  {activeEvent.type === "highlight" && <Sparkles className="size-2.5 text-amber-400" />}
                  {activeEvent.badge || activeEvent.type.toUpperCase()}
                </span>
                <span className="font-mono text-[9px] text-slate-400">
                  {activeEvent.timestamp.toFixed(1)}s
                </span>
              </div>

              {/* Title & Description */}
              <p className="text-xs font-bold leading-tight text-white">{activeEvent.label}</p>
              {activeEvent.description && (
                <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
                  {activeEvent.description}
                </p>
              )}

              {/* Grounded Evidence Q&A Preview Snippet */}
              {activeEvent.actionData?.question && (
                <div className="mt-2 rounded-lg bg-slate-800/80 p-2 border border-slate-700/60 text-[10px] space-y-1">
                  <div className="flex items-center gap-1 text-emerald-400 font-semibold">
                    <ShieldCheck className="size-3" /> VERIFIED CITATION
                  </div>
                  <p className="text-slate-200">{activeEvent.actionData.answer}</p>
                  {activeEvent.actionData.citation && (
                    <span className="inline-block rounded bg-slate-700 px-1.5 py-0.5 font-mono text-slate-300 text-[9px]">
                      {activeEvent.actionData.citation}
                    </span>
                  )}
                </div>
              )}

              {/* Action Button */}
              {activeEvent.actionData?.tab && (
                <button
                  type="button"
                  onClick={() => onEventAction?.(activeEvent)}
                  className="mt-2 flex w-full items-center justify-between rounded-lg bg-brand-indigo/30 hover:bg-brand-indigo/50 border border-brand-indigo/40 px-2.5 py-1 text-[10px] font-semibold text-indigo-200 transition"
                >
                  <span>Inspect in {activeEvent.actionData.tab.toUpperCase()}</span>
                  <ArrowRight className="size-3" />
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
