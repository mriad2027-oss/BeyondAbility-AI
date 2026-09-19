"use client";

import * as React from "react";
import { FileVideo, Sparkles, Check } from "lucide-react";
import { cn } from "@/lib/format";
import { useWorkspace } from "@/components/lecture/WorkspaceProvider";
import type { LectureRecord } from "@/types/backend";

export function isDemo(r: LectureRecord | undefined) {
  return Boolean(r && String(r.job_id + r.filename).toUpperCase().includes("DEMO"));
}

export function LecturePicker({
  heading = "Lectures",
  compact = false,
}: {
  heading?: string;
  compact?: boolean;
}) {
  const { lectures, selectedId, setSelectedId, loading } = useWorkspace();

  if (loading) return null;

  return (
    <div>
      <p className={cn("mb-2 font-medium text-app-soft", compact ? "text-xs" : "text-sm")}>{heading}</p>
      <div className={cn("space-y-1.5", compact ? "overflow-y-auto scrollbar-thin" : "")}>
        {lectures.map((lec) => {
          const active = lec.job_id === selectedId;
          const demo = isDemo(lec);
          return (
            <button
              key={lec.job_id}
              onClick={() => setSelectedId(lec.job_id)}
              aria-pressed={active}
              className={cn(
                "group flex w-full items-center gap-3 rounded-xl border px-3 text-left transition-colors",
                compact ? "py-2" : "py-2.5",
                active
                  ? "border-brand-indigo/40 bg-brand-indigo/5"
                  : "border-app-edge bg-app-panel2/60 hover:border-app-edge hover:bg-slate-100"
              )}
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-app-edge group-hover:bg-slate-50">
                {demo ? (
                  <Sparkles className="size-4 text-amber-500" aria-hidden />
                ) : (
                  <FileVideo className="size-4 text-app-soft" aria-hidden />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">{lec.filename}</p>
                <p className="truncate text-[11px] text-app-muted">{lec.job_id}</p>
              </div>
              {demo && (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">
                  DEMO
                </span>
              )}
              {active && <Check className="size-4 shrink-0 text-brand-indigo" aria-hidden />}
            </button>
          );
        })}
        {lectures.length === 0 && (
          <p className="text-xs text-app-muted">No processed lectures available yet.</p>
        )}
      </div>
    </div>
  );
}