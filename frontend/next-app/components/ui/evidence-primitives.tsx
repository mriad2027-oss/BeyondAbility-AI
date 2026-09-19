"use client";

import * as React from "react";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  CircleHelp,
  Clock,
  Link2,
  Zap,
  ChevronRight,
  Play,
} from "lucide-react";
import { cn, formatClock } from "@/lib/format";
import type { TrustLevel } from "@/types/backend";

/* =========================================================
   Section Rail — used instead of cards for visual grouping
   ========================================================= */
export function SectionRail({
  label,
  children,
  align = "left",
  className,
}: {
  label: React.ReactNode;
  children?: React.ReactNode;
  align?: "left" | "center" | "right";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-full flex items-center gap-3 py-1.5",
        align === "center" && "justify-center",
        align === "right" && "justify-end",
        className
      )}
    >
      {align !== "right" && (
        <div className="h-px flex-1 bg-slate-200/80" aria-hidden />
      )}
      <div className="shrink-0 max-w-full min-w-0 flex flex-wrap items-center gap-2">
        {typeof label === "string" ? (
          <span className="meta-label truncate">{label}</span>
        ) : (
          label
        )}
        {children}
      </div>
      {align !== "left" && (
        <div className="h-px flex-1 bg-slate-200/80" aria-hidden />
      )}
    </div>
  );
}

/* =========================================================
   Trust Pill
   ========================================================= */
export function TrustPill({
  trust,
  reason,
  compact,
}: {
  trust: TrustLevel;
  reason?: string;
  compact?: boolean;
}) {
  const meta =
    trust === "VERIFIED"
      ? {
          cls: "evidence-marker-verified",
          Icon: ShieldCheck,
          label: "VERIFIED",
        }
      : trust === "UNCERTAIN"
      ? {
          cls: "evidence-marker-uncertain",
          Icon: ShieldAlert,
          label: "UNCERTAIN",
        }
      : trust === "UNAVAILABLE"
      ? {
          cls: "evidence-marker-unavailable",
          Icon: Shield,
          label: "UNAVAILABLE",
        }
      : {
          cls: "evidence-marker-uncertain",
          Icon: CircleHelp,
          label: trust ?? "UNCERTAIN",
        };
  const Icon = meta.Icon;
  if (compact) {
    return (
      <span className={cn(meta.cls, "!px-1.5 !py-0.5")} title={reason}>
        <Icon className="size-3" aria-hidden />
      </span>
    );
  }
  return (
    <span className={meta.cls} title={reason}>
      <Icon className="size-3" aria-hidden />
      {meta.label}
    </span>
  );
}

/* =========================================================
   Evidence Marker (timestamped)
   ========================================================= */
export function EvidenceTimestamp({
  seconds,
  onSeek,
  trust,
  source,
  tone,
  children,
  className,
}: {
  seconds: number;
  onSeek?: (s: number) => void;
  trust?: TrustLevel;
  source?: string;
  tone?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const clickable = Boolean(onSeek);
  return (
    <div
      className={cn(
        "group inline-flex items-center gap-2 rounded-lg border border-slate-200/70 bg-white px-2.5 py-1.5 shadow-surface",
        clickable && "cursor-pointer hover:border-brand-indigo/40 hover:shadow-rail",
        className
      )}
      onClick={() => clickable && onSeek?.(seconds)}
    >
      <Clock className="size-3.5 text-slate-400" aria-hidden />
      <span className="font-mono text-[11px] font-semibold text-slate-700 tabular-nums">
        {formatClock(seconds)}
      </span>
      {source && (
        <>
          <span className="text-slate-300" aria-hidden>·</span>
          <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
            {source}
          </span>
        </>
      )}
      {trust && (
        <>
          <span className="text-slate-300" aria-hidden>·</span>
          <TrustPill trust={trust} compact />
        </>
      )}
      {clickable && (
        <Play
          className="size-3 ml-0.5 text-brand-indigo opacity-0 group-hover:opacity-100 transition fill-current"
          aria-hidden
        />
      )}
      {children}
    </div>
  );
}

/* =========================================================
   Data Strip Row (use instead of card rows)
   ========================================================= */
export function DataStrip({
  label,
  value,
  icon,
  accent,
  className,
}: {
  label: React.ReactNode;
  value?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  accent?: "indigo" | "cyan" | "emerald" | "amber" | "rose" | "slate";
  className?: string;
}) {
  const Icon = icon;
  const accentCls =
    accent === "indigo"
      ? "text-brand-indigo"
      : accent === "cyan"
      ? "text-brand-cyan"
      : accent === "emerald"
      ? "text-brand-emerald"
      : accent === "amber"
      ? "text-brand-amber"
      : accent === "rose"
      ? "text-brand-rose"
      : "text-slate-500";
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-b border-slate-200/60 last:border-b-0 px-1 py-2",
        className
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        {Icon && <Icon className={cn("size-3.5 shrink-0", accentCls)} aria-hidden />}
        {typeof label === "string" ? (
          <span className="text-[11px] font-medium text-slate-500 whitespace-nowrap">
            {label}
          </span>
        ) : (
          label
        )}
      </div>
      {value !== undefined && (
        <div className="text-[12px] font-semibold text-slate-800 tabular-nums">
          {value}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   Command Surface — floating actions area
   ========================================================= */
export function CommandSurface({
  children,
  className,
  variant = "default",
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "primary" | "ghost";
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-xl px-3 py-2 border shadow-surface backdrop-blur-sm",
        variant === "primary"
          ? "bg-brand-indigo/[0.03] border-brand-indigo/20"
          : variant === "ghost"
          ? "bg-transparent border-transparent shadow-none"
          : "bg-white/90 border-slate-200/70",
        className
      )}
    >
      {children}
    </div>
  );
}

/* =========================================================
   Workspace Link Arrow
   ========================================================= */
export function WorkspaceCta({
  children,
  onClick,
  href,
  icon = ChevronRight,
  accent = "indigo",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
  accent?: "indigo" | "emerald" | "amber";
}) {
  const Icon = icon;
  const accentCls =
    accent === "emerald"
      ? "text-brand-emerald"
      : accent === "amber"
      ? "text-brand-amber"
      : "text-brand-indigo";
  const base =
    "group inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap transition";
  const inner = (
    <>
      <span className="text-slate-700 group-hover:text-slate-900">{children}</span>
      <Icon
        className={cn("size-3.5 transition-transform group-hover:translate-x-0.5", accentCls)}
        aria-hidden
      />
    </>
  );
  if (href) {
    return (
      <a href={href} className={cn(base, accent === "indigo" ? "hover:text-brand-indigo" : "")}>
        {inner}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={base}
    >
      {inner}
    </button>
  );
}

/* =========================================================
   Concept Badge (pill with concept name)
   ========================================================= */
export function ConceptBadge({
  label,
  count,
  accent = "indigo",
  onClick,
}: {
  label: string;
  count?: number;
  accent?: "indigo" | "cyan" | "emerald" | "amber" | "rose";
  onClick?: () => void;
}) {
  const cls =
    accent === "indigo"
      ? "badge-pill-indigo"
      : accent === "cyan"
      ? "badge-pill-cyan"
      : accent === "emerald"
      ? "badge-pill-emerald"
      : accent === "amber"
      ? "badge-pill-amber"
      : "badge-pill-rose";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(cls, "cursor-pointer hover:shadow-surface transition")}
    >
      <Zap className="size-2.5 opacity-60" aria-hidden />
      {label}
      {count !== undefined && (
        <span className="ml-1 font-mono opacity-70">×{count}</span>
      )}
    </button>
  );
}

/* =========================================================
   Evidence Snippet — small inline evidence with border accent
   ========================================================= */
export function EvidenceSnippet({
  text,
  trust,
  timestamp,
  onSeek,
  variant = "speech",
  className,
}: {
  text: string;
  trust?: TrustLevel;
  timestamp?: number;
  onSeek?: (s: number) => void;
  variant?: "speech" | "visual" | "ocr" | "ad" | "gap";
  className?: string;
}) {
  const variantCls =
    variant === "speech"
      ? "border-brand-cyan/20 bg-cyan-50/40"
      : variant === "visual"
      ? "border-brand-blue/20 bg-blue-50/40"
      : variant === "ocr"
      ? "border-brand-indigo/20 bg-indigo-50/40"
      : variant === "ad"
      ? "border-brand-emerald/20 bg-emerald-50/40"
      : "border-brand-amber/20 bg-amber-50/40";
  return (
    <div
      className={cn(
        "relative rounded-xl border p-3 pl-3.5",
        variantCls,
        className
      )}
    >
      <span
        className={cn(
          "absolute -left-0 top-3 bottom-3 w-1 rounded-full",
          variant === "speech" && "bg-brand-cyan",
          variant === "visual" && "bg-brand-blue",
          variant === "ocr" && "bg-brand-indigo",
          variant === "ad" && "bg-brand-emerald",
          variant === "gap" && "bg-brand-amber"
        )}
        aria-hidden
      />
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12.5px] leading-relaxed text-slate-800 font-medium">
          {variant === "speech" && <span className="text-brand-cyan/80 mr-1">“</span>}
          {text}
          {variant === "speech" && <span className="text-brand-cyan/80 ml-1">”</span>}
        </p>
        <div className="flex items-center gap-1 shrink-0">
          {trust && <TrustPill trust={trust} compact />}
          {timestamp !== undefined && (
            <button
              onClick={() => onSeek?.(timestamp)}
              className="font-mono text-[10px] text-slate-500 hover:text-brand-indigo transition"
            >
              {formatClock(timestamp)}
            </button>
          )}
          {timestamp !== undefined && onSeek && (
            <Link2 className="size-3 text-slate-400" aria-hidden />
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   BadgePill — versatile color pill
   ========================================================= */
export function BadgePill({
  children,
  variant = "slate",
  accent,
  className,
}: {
  children: React.ReactNode;
  variant?: "indigo" | "cyan" | "emerald" | "amber" | "rose" | "slate" | "blue" | "violet";
  accent?: "indigo" | "cyan" | "emerald" | "amber" | "rose" | "slate" | "blue" | "violet";
  className?: string;
}) {
  const effective = accent || variant;
  const cls =
    effective === "indigo"
      ? "badge-pill-indigo"
      : effective === "cyan"
      ? "badge-pill-cyan"
      : effective === "emerald"
      ? "badge-pill-emerald"
      : effective === "amber"
      ? "badge-pill-amber"
      : effective === "rose"
      ? "badge-pill-rose"
      : effective === "blue"
      ? "badge-pill-cyan"
      : effective === "violet"
      ? "badge-pill-indigo"
      : "badge-pill-slate";
  return <span className={cn(cls, className)}>{children}</span>;
}

