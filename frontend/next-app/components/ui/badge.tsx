import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/format";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-app-edge bg-app-panel2 text-slate-600",
        success: "border-emerald-200 bg-emerald-50 text-emerald-700",
        warning: "border-amber-200 bg-amber-50 text-amber-700",
        danger: "border-red-200 bg-red-50 text-red-600",
        info: "border-sky-200 bg-sky-50 text-sky-700",
        violet: "border-violet-200 bg-violet-50 text-violet-700",
        muted: "border-app-edge bg-app-panel2 text-app-muted",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

function Dot({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("inline-block h-1.5 w-1.5 rounded-full bg-current", className)} />
  );
}

export { Badge, Dot, badgeVariants };

export function trustVariant(trust: string | undefined): VariantProps<typeof badgeVariants>["variant"] {
  const t = (trust || "").toUpperCase();
  if (t === "VERIFIED") return "success";
  if (t === "UNCERTAIN") return "warning";
  if (t === "UNAVAILABLE") return "muted";
  return "default";
}

export function statusVariant(status: string | undefined): VariantProps<typeof badgeVariants>["variant"] {
  const s = (status || "").toUpperCase();
  if (s === "DONE" || s === "COMPLETED" || s === "SUPPORTED" || s === "READY") return "success";
  if (s === "FAILED" || s === "NOT_FOUND") return "danger";
  if (s === "RUNNING" || s === "PROCESSING" || s === "QUEUED") return "info";
  return "warning";
}