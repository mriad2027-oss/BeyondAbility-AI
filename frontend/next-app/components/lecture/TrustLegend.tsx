"use client";

import * as React from "react";
import { ShieldCheck, AlertTriangle, CircleHelp } from "lucide-react";

export function TrustLegend({
  showUnavailableNote = true,
}: {
  showUnavailableNote?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-app-soft">
      <span className="inline-flex items-center gap-1">
        <ShieldCheck className="size-3.5 text-emerald-600" aria-hidden /> Verified
      </span>
      <span className="inline-flex items-center gap-1">
        <AlertTriangle className="size-3.5 text-amber-600" aria-hidden /> Uncertain
      </span>
      <span className="inline-flex items-center gap-1">
        <CircleHelp className="size-3.5 text-app-muted" aria-hidden /> Unavailable (not stated as fact)
      </span>
      {showUnavailableNote && (
        <span className="text-app-muted">Every claim is grounded in real on-screen/audio evidence.</span>
      )}
    </div>
  );
}