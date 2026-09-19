"use client";

import * as React from "react";
import Link from "next/link";
import { FileVideo, Sparkles, Clock, ArrowRight, CircleCheck, CircleX } from "lucide-react";
import { useWorkspace } from "@/components/lecture/WorkspaceProvider";
import { WorkspaceProvider } from "@/components/lecture/WorkspaceProvider";
import { PageLoader, EmptyState } from "@/components/ui/loading";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatSeconds, relativeTime } from "@/lib/format";

export default function LecturesPage() {
  return (
    <WorkspaceProvider>
      <LecturesContent />
    </WorkspaceProvider>
  );
}

function LecturesContent() {
  const { lectures, loading, error } = useWorkspace();

  if (loading) return <PageLoader label="Loading lectures…" />;

  if (error) {
    return (
      <EmptyState
        title="Backend unreachable"
        description={`Could not load lectures from the API: ${error}. Start the backend with \`uvicorn backend.main:app --reload\` and refresh.`}
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Accessibility Workspace</h1>
        <p className="mt-1 text-sm text-app-soft">Select any compiled lecture to enter the multimodal accessibility studio.</p>
      </div>

      {lectures.length === 0 ? (
        <EmptyState
          icon={FileVideo}
          title="No lectures yet"
          description="Process a video first, or start from the built-in demo lecture."
          action={
            <Link href="/upload">
              <Button>
                <Sparkles className="size-4" aria-hidden /> Upload a video
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lectures.map((lec) => {
            const demo = String(lec.job_id + lec.filename).toUpperCase().includes("DEMO");
            const ready = lec.status === "done" || lec.status === "partial";
            return (
              <Link key={lec.job_id} href={`/lectures/${lec.job_id}`} className="group">
                <Card className="flex h-full flex-col transition-all group-hover:-translate-y-0.5 group-hover:border-brand-indigo/40 group-hover:shadow-md">
                  <CardContent className="flex flex-1 flex-col gap-3 p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex size-11 items-center justify-center rounded-xl bg-brand-indigo/10 text-brand-indigo group-hover:bg-brand-indigo/15">
                        {demo ? (
                          <Sparkles className="size-5 text-amber-500" aria-hidden />
                        ) : (
                          <FileVideo className="size-5" aria-hidden />
                        )}
                      </div>
                      {demo && (
                        <Badge variant="warning">
                          <Sparkles className="size-3" aria-hidden /> Demo
                        </Badge>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold leading-snug text-slate-900">{lec.filename}</p>
                      <p className="mt-0.5 truncate text-xs text-app-muted">{lec.job_id}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-app-soft">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3.5" aria-hidden />
                        {formatSeconds(lec.duration)}
                      </span>
                      {ready ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600">
                          <CircleCheck className="size-3.5" aria-hidden /> Ready
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-600">
                          <CircleX className="size-3.5" aria-hidden /> {lec.status}
                        </span>
                      )}
                      {lec.updated_at && <span>{relativeTime(lec.updated_at)}</span>}
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex flex-wrap gap-1">
                        {legible(lec.assets).map((k) => (
                          <span key={k} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                            {K[k] ?? k}
                          </span>
                        ))}
                      </div>
                      <ArrowRight className="size-4 text-app-muted transition-transform group-hover:translate-x-0.5 group-hover:text-brand-indigo" aria-hidden />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

const K: Record<string, string> = {
  video: "Video",
  transcript: "Transcript",
  srt: "SRT",
  captions: "Captions",
  visual_events: "Visual",
  accessibility: "A11y",
  narration: "Narration",
  quiz: "Quiz",
};

function legible(assets: Record<string, boolean> | undefined): string[] {
  return Object.entries(assets ?? {})
    .filter(([, v]) => v)
    .map(([k]) => k);
}