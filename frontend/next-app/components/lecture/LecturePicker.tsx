"use client";

import * as React from "react";
import { useMemo } from "react";
import { FileVideo, Sparkles, Check } from "lucide-react";
import { cn } from "@/lib/format";
import { useWorkspace } from "@/components/lecture/WorkspaceProvider";
import type { LectureRecord } from "@/types/backend";

export function isDemo(r: { job_id?: string; filename?: string } | undefined) {
  return Boolean(r && String((r.job_id || "") + (r.filename || "")).toUpperCase().includes("DEMO"));
}

export function LecturePicker({
  heading = "Lectures",
  compact = false,
}: {
  heading?: string;
  compact?: boolean;
}) {
  const { lectures, selectedId, setSelectedId, loading } = useWorkspace();

  // Sanitize lecture list so no WhatsApp/personal recordings appear in the UI
  const displayLectures: LectureRecord[] = useMemo(() => {
    const clean = lectures.filter((lec) => {
      const name = (lec.filename || "").toLowerCase();
      const id = (lec.job_id || "").toLowerCase();
      return !name.includes("whatsapp") && !id.includes("whatsapp");
    });

    if (clean.length > 0) return clean;

    return [
      {
        job_id: "DEMO_python_loops",
        filename: "DEMO_python_loops.mp4",
        duration: 300,
        status: "done",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        assets: {},
        has_result: true,
        cached: true,
      },
    ];
  }, [lectures]);

  if (loading) return null;

  return (
    <div className="space-y-2">
      {heading && (
        <p className={cn("font-mono font-semibold uppercase tracking-wider text-slate-400", compact ? "text-xs" : "text-sm")}>
          {heading}
        </p>
      )}
      <div className={cn("space-y-2", compact ? "max-h-[320px] overflow-y-auto scrollbar-thin" : "")}>
        {displayLectures.map((lec) => {
          const active = lec.job_id === selectedId;
          const demo = isDemo(lec);
          return (
            <button
              key={lec.job_id}
              onClick={() => setSelectedId(lec.job_id)}
              aria-pressed={active}
              className={cn(
                "group flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all",
                active
                  ? "border-brand-indigo bg-brand-indigo/15 ring-1 ring-brand-indigo/30 shadow-sm"
                  : "border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] hover:border-brand-indigo/40 hover:bg-brand-indigo/5"
              )}
            >
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-lg font-bold transition-all",
                  active
                    ? "bg-brand-indigo text-white shadow-sm"
                    : "bg-white dark:bg-white/10 text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-white/10"
                )}
              >
                {demo ? (
                  <Sparkles className="size-5 text-amber-400" aria-hidden />
                ) : (
                  <FileVideo className="size-5" aria-hidden />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900 dark:text-white leading-tight">
                  {demo ? "Python Loops (Benchmark)" : lec.filename}
                </p>
                <p className="truncate text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                  {lec.job_id}
                </p>
              </div>
              {demo && (
                <span className="shrink-0 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-mono font-bold text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  DEMO
                </span>
              )}
              {active && <Check className="size-4 shrink-0 text-brand-indigo stroke-[3]" aria-hidden />}
            </button>
          );
        })}
      </div>
    </div>
  );
}