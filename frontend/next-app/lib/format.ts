import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fileBaseName(p: string | null | undefined): string {
  if (!p) return "";
  const parts = String(p).replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] ?? "";
}

export function formatSeconds(seconds: number | null | undefined): string {
  if (seconds == null || !isFinite(seconds)) return "00:00";
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function formatClock(seconds: number | null | undefined): string {
  return formatSeconds(seconds);
}

export function formatTimestampLabel(start: number | null | undefined, end?: number | null | undefined): string {
  return `${formatClock(start)}${end != null && end !== start ? "–" + formatClock(end) : ""}`;
}

export function isDemoRecord(record: { job_id?: string; filename?: string } | null | undefined): boolean {
  return String(record?.job_id ?? record?.filename ?? "").toUpperCase().includes("DEMO");
}

export function normalizeAccessibilityMode(mode: string | undefined): string {
  const m = (mode || "standard").toLowerCase();
  if (m === "hearing") return "deaf";
  if (m === "standard" || m === "default") return "default";
  return m;
}

export function modeLabel(mode: string | undefined): string {
  switch (normalizeAccessibilityMode(mode)) {
    case "blind":
      return "Blind";
    case "low_vision":
      return "Low vision";
    case "deaf":
      return "Deaf / hard of hearing";
    default:
      return "Default";
  }
}

export function truncate(s: string, n: number): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

export function trustOf(trust: unknown): string {
  if (typeof trust === "string") return trust;
  if (trust && typeof trust === "object") {
    const t = (trust as { trust?: unknown }).trust;
    if (typeof t === "string") return t;
  }
  return "";
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (isNaN(t)) return "";
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}