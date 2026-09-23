import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/format";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold [&_svg]:size-3 [&_svg]:shrink-0 transition-colors",
  {
    variants: {
      variant: {
        default: "border-[#DDD0C0] bg-[#EDE2D3] text-[#51483F]",
        success: "border-[#B9D2BC] bg-[#E4F0E5] text-[#416A47]",
        warning: "border-[#E3C59D] bg-[#F6E9D6] text-[#8A5A25]",
        danger: "border-[#D9AAA7] bg-[#F4E0DF] text-[#8E3F3C]",
        info: "border-[#B8D3E6] bg-[#E5EEF5] text-[#466B8A]",
        speech: "border-[#B8D3E6] bg-[#E5EEF5] text-[#466B8A]",
        vision: "border-[#B2D6D3] bg-[#E2EFED] text-[#46716F]",
        ai: "border-[#C8C3DF] bg-[#E8E6F4] text-[#554F86]",
        terracotta: "border-[#E8C2B2] bg-[#FFF8F4] text-[#B85C38]",
        violet: "border-[#C8C3DF] bg-[#E8E6F4] text-[#554F86]",
        muted: "border-[#E7DED2] bg-[#FBF8F2] text-[#7A7067]",
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