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
    return lectures.filter((lec) => {
      const name = (lec.filename || "").toLowerCase();
      const id = (lec.job_id || "").toLowerCase();
      return !name.includes("whatsapp") && !id.includes("whatsapp");
    });
  }, [lectures]);

  if (loading) return null;

  return (
    <div className="space-y-2 text-[#2F2924]">
      {heading && (
        <p className={cn("font-mono font-bold uppercase tracking-wider text-[#7A7067]", compact ? "text-xs" : "text-sm")}>
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
                  ? "border-[#B85C38] bg-[#FFF8F4] ring-1 ring-[#B85C38]/30 shadow-xs"
                  : "border-[#DDD0C0] bg-[#FFFDFC] hover:border-[#B85C38]/40 hover:bg-[#F1E8DC]"
              )}
            >
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-lg font-bold transition-all",
                  active
                    ? "bg-[#B85C38] text-white shadow-xs"
                    : "bg-[#F1E8DC] text-[#7A7067] border border-[#DDD0C0]"
                )}
              >
                {demo ? (
                  <Sparkles className="size-5 text-amber-500" aria-hidden />
                ) : (
                  <FileVideo className="size-5" aria-hidden />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[#2F2924] leading-tight">
                  {lec.filename || lec.job_id}
                </p>
                <p className="truncate text-xs font-mono text-[#7A7067] mt-0.5">
                  {lec.job_id}
                </p>
              </div>
              {demo && (
                <span className="shrink-0 rounded-full bg-[#FFF8F4] px-2.5 py-0.5 text-[11px] font-mono font-bold text-[#B85C38] border border-[#E8C2B2]">
                  SAMPLE
                </span>
              )}
              {active && <Check className="size-4 shrink-0 text-[#B85C38] stroke-[3]" aria-hidden />}
            </button>
          );
        })}
      </div>
    </div>
  );
}