"use client";

import * as React from "react";
import { Command, Loader2 } from "lucide-react";
import { cn } from "@/lib/format";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-4 animate-spin", className)} aria-hidden />;
}

export function PageLoader({
  label = "Loading…",
  full = true,
}: {
  label?: string;
  full?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-app-soft",
        full ? "min-h-[55vh]" : "py-10"
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-8 animate-spin text-brand-indigo" aria-hidden />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function EmptyState({
  icon: Icon = Command,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-app-edge bg-white px-6 py-12 text-center",
        className
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-xl bg-brand-indigo/10">
        <Icon className="size-6 text-brand-indigo" aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="font-medium text-slate-800">{title}</p>
        {description && <p className="max-w-md text-sm text-app-soft">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-slate-200", className)} />;
}