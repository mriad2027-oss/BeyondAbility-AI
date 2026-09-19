"use client";

import { Badge, trustVariant } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, CircleHelp, ShieldCheck } from "lucide-react";

const TRUST_META: Record<string, { label: string; icon: typeof CheckCircle2; hint: string }> = {
  VERIFIED: {
    label: "Verified",
    icon: ShieldCheck,
    hint: "Backed by on-screen evidence reviewed against the lecture data.",
  },
  UNCERTAIN: {
    label: "Uncertain",
    icon: AlertTriangle,
    hint: "Partial or low-confidence evidence — treat with caution.",
  },
  UNAVAILABLE: {
    label: "Unavailable",
    icon: CircleHelp,
    hint: "No readable/verifiable source exists for this content; not stated as fact.",
  },
};

export function TrustBadge({
  trust,
  showHint = true,
  compact = false,
}: {
  trust?: string;
  showHint?: boolean;
  compact?: boolean;
}) {
  const meta = TRUST_META[(trust || "").toUpperCase()] ?? {
    label: trust || "Unknown",
    icon: CircleHelp,
    hint: "Trust level not specified by the system.",
  };
  const Icon = meta.icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs"
      title={showHint ? meta.hint : undefined}
      aria-label={`Trust: ${meta.label}. ${meta.hint}`}
    >
      <Badge variant={trustVariant(trust)}>
        <Icon aria-hidden />
        {meta.label}
        {!compact && trust === "UNAVAILABLE" && (
          <span className="max-w-[24ch] truncate text-[10px] font-normal opacity-80">
            — not stated as fact
          </span>
        )}
      </Badge>
    </span>
  );
}

export function CheckState({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      {ok ? (
        <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden />
      ) : (
        <AlertTriangle className="size-3.5 text-amber-600" aria-hidden />
      )}
      {label}
    </span>
  );
}