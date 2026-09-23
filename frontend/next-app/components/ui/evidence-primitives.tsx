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
        <div className="h-px flex-1 bg-[#DDD0C0]" aria-hidden />
      )}
      <div className="shrink-0 max-w-full min-w-0 flex flex-wrap items-center gap-2">
        {typeof label === "string" ? (
          <span className="meta-label truncate text-[#7A7067]">{label}</span>
        ) : (
          label
        )}
        {children}
      </div>
      {align !== "left" && (
        <div className="h-px flex-1 bg-[#DDD0C0]" aria-hidden />
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
        "group inline-flex items-center gap-2 rounded-lg border border-[#DDD0C0] bg-[#FFFDFC] px-2.5 py-1.5 shadow-surface",
        clickable && "cursor-pointer hover:border-[#B85C38]/60 hover:bg-[#FFF8F4] transition",
        className
      )}
      onClick={() => clickable && onSeek?.(seconds)}
    >
      <Clock className="size-3.5 text-[#8C8177]" aria-hidden />
      <span className="font-mono text-[11px] font-bold text-[#2F2924] tabular-nums">
        {formatClock(seconds)}
      </span>
      {source && (
        <>
          <span className="text-[#DDD0C0]" aria-hidden>·</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#7A7067]">
            {source}
          </span>
        </>
      )}
      {trust && (
        <>
          <span className="text-[#DDD0C0]" aria-hidden>·</span>
          <TrustPill trust={trust} compact />
        </>
      )}
      {clickable && (
        <Play
          className="size-3 ml-0.5 text-[#B85C38] opacity-0 group-hover:opacity-100 transition fill-current"
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
  accent?: "indigo" | "cyan" | "emerald" | "amber" | "rose" | "slate" | "terracotta";
  className?: string;
}) {
  const Icon = icon;
  const accentCls =
    accent === "terracotta"
      ? "text-[#B85C38]"
      : accent === "indigo"
      ? "text-[#6C63A8]"
      : accent === "cyan"
      ? "text-[#5F9A9A]"
      : accent === "emerald"
      ? "text-[#5F8A62]"
      : accent === "amber"
      ? "text-[#B77932]"
      : accent === "rose"
      ? "text-[#B94A48]"
      : "text-[#7A7067]";
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-b border-[#E7DED2] last:border-b-0 px-1 py-2",
        className
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        {Icon && <Icon className={cn("size-3.5 shrink-0", accentCls)} aria-hidden />}
        {typeof label === "string" ? (
          <span className="text-[11px] font-medium text-[#5F554C] whitespace-nowrap">
            {label}
          </span>
        ) : (
          label
        )}
      </div>
      {value !== undefined && (
        <div className="text-[12px] font-bold text-[#2F2924] tabular-nums">
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
          ? "bg-[#FFF8F4] border-[#E8C2B2] text-[#B85C38]"
          : variant === "ghost"
          ? "bg-transparent border-transparent shadow-none"
          : "bg-[#FFFDFC]/95 border-[#DDD0C0] text-[#51483F]",
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
  accent = "terracotta",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
  accent?: "indigo" | "emerald" | "amber" | "terracotta";
}) {
  const Icon = icon;
  const accentCls =
    accent === "emerald"
      ? "text-[#5F8A62]"
      : accent === "amber"
      ? "text-[#B77932]"
      : accent === "indigo"
      ? "text-[#6C63A8]"
      : "text-[#B85C38]";
  const base =
    "group inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap transition cursor-pointer";
  const inner = (
    <>
      <span className="text-[#51483F] group-hover:text-[#B85C38] transition-colors">{children}</span>
      <Icon
        className={cn("size-3.5 transition-transform group-hover:translate-x-0.5", accentCls)}
        aria-hidden
      />
    </>
  );
  if (href) {
    return (
      <a href={href} className={cn(base, "hover:text-[#B85C38]")}>
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
  accent = "terracotta",
  onClick,
}: {
  label: string;
  count?: number;
  accent?: "indigo" | "cyan" | "emerald" | "amber" | "rose" | "terracotta";
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
      : accent === "rose"
      ? "badge-pill-rose"
      : "badge-pill-terracotta";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(cls, "cursor-pointer hover:shadow-surface transition")}
    >
      <Zap className="size-2.5 opacity-70" aria-hidden />
      <span>{label}</span>
      {count !== undefined && (
        <span className="ml-1 font-mono opacity-80">×{count}</span>
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
  variant?: "speech" | "visual" | "ocr" | "ad" | "gap" | "ai";
  className?: string;
}) {
  const variantCls =
    variant === "speech"
      ? "border-[#B8D3E6] bg-[#E5EEF5]/70 text-[#2F2924]"
      : variant === "visual"
      ? "border-[#B2D6D3] bg-[#E2EFED]/70 text-[#2F2924]"
      : variant === "ocr"
      ? "border-[#B2D6D3] bg-[#E2EFED]/70 text-[#2F2924]"
      : variant === "ad"
      ? "border-[#B9D2BC] bg-[#E4F0E5]/70 text-[#2F2924]"
      : variant === "ai"
      ? "border-[#C8C3DF] bg-[#E8E6F4]/70 text-[#2F2924]"
      : "border-[#E3C59D] bg-[#F6E9D6]/80 text-[#2F2924]";
  return (
    <div
      className={cn(
        "relative rounded-xl border p-3 pl-3.5 shadow-xs",
        variantCls,
        className
      )}
    >
      <span
        className={cn(
          "absolute -left-0 top-3 bottom-3 w-1 rounded-full",
          variant === "speech" && "bg-[#5B82A6]",
          variant === "visual" && "bg-[#5F9A9A]",
          variant === "ocr" && "bg-[#5F9A9A]",
          variant === "ad" && "bg-[#5F8A62]",
          variant === "gap" && "bg-[#B77932]",
          variant === "ai" && "bg-[#6C63A8]"
        )}
        aria-hidden
      />
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12.5px] leading-relaxed font-medium">
          {variant === "speech" && <span className="text-[#5B82A6] mr-1">“</span>}
          {text}
          {variant === "speech" && <span className="text-[#5B82A6] ml-1">”</span>}
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          {trust && <TrustPill trust={trust} compact />}
          {timestamp !== undefined && (
            <button
              onClick={() => onSeek?.(timestamp)}
              className="font-mono text-[10.5px] font-semibold text-[#5F554C] hover:text-[#B85C38] transition"
            >
              {formatClock(timestamp)}
            </button>
          )}
          {timestamp !== undefined && onSeek && (
            <Link2 className="size-3 text-[#8C8177]" aria-hidden />
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
  variant?: "indigo" | "cyan" | "emerald" | "amber" | "rose" | "slate" | "blue" | "terracotta" | "violet";
  accent?: "indigo" | "cyan" | "emerald" | "amber" | "rose" | "slate" | "blue" | "terracotta" | "violet";
  className?: string;
}) {
  const effective = accent || variant;
  const cls =
    effective === "terracotta"
      ? "badge-pill-terracotta"
      : effective === "indigo"
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
