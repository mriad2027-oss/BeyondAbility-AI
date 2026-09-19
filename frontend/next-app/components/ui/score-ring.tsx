"use client";

import * as React from "react";
import { cn } from "@/lib/format";

const ringSize = 128;

export function ScoreRing({
  score,
  label = "Accessibility score",
  sublabel,
  size = ringSize,
  color = "from-brand-indigo to-brand-cyan",
}: {
  score: number;
  label?: string;
  sublabel?: string;
  size?: number;
  color?: string;
}) {
  const gradId = React.useId();
  const clamped = Math.max(0, Math.min(100, score));
  const r = 52;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;
  const pctSize = Math.max(28, size * 0.22);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${Math.round(clamped)} out of 100`}>
        <svg viewBox="0 0 120 120" width={size} height={size}>
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6C4FF7" />
              <stop offset="100%" stopColor="#0EA5E9" />
            </linearGradient>
          </defs>
          <circle cx="60" cy="60" r={r} fill="none" stroke="#E5E7EB" strokeWidth="10" />
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            transform="rotate(-90 60 60)"
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-bold text-slate-900" style={{ fontSize: pctSize }}>
            {Math.round(clamped)}
          </span>
          <span className="sr-only">out of 100</span>
        </div>
      </div>
      <div className="text-center">
        <p className={cn("bg-gradient-to-r bg-clip-text text-transparent", color)}>
          {label}
        </p>
        {sublabel && <p className="mt-0.5 text-xs text-app-soft">{sublabel}</p>}
      </div>
    </div>
  );
}