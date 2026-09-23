"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/format";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B85C38]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F7F1E8] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-[#B85C38] text-white shadow-sm hover:bg-[#9F4F32] active:scale-[0.99]",
        primary:
          "bg-[#B85C38] text-white shadow-sm hover:bg-[#9F4F32] active:scale-[0.99]",
        secondary:
          "bg-[#FFFDFC] text-[#5A493D] border border-[#CDBEAF] shadow-xs hover:bg-[#F1E4D8] active:scale-[0.99]",
        ai:
          "bg-[#6C63A8] text-white shadow-sm hover:bg-[#59518E] active:scale-[0.99]",
        ghost:
          "text-[#51483F] hover:bg-[#F1E8DC] hover:text-[#2F2924]",
        outline:
          "border border-[#DDD0C0] bg-transparent text-[#51483F] hover:bg-[#F1E8DC] hover:text-[#2F2924]",
        danger:
          "bg-[#F4E0DF] text-[#8E3F3C] border border-[#D9AAA7] hover:bg-[#EAC8C6]",
        success:
          "bg-[#E4F0E5] text-[#416A47] border border-[#B9D2BC] hover:bg-[#D2E7D4]",
        link:
          "text-[#B85C38] underline-offset-4 hover:underline hover:text-[#9F4F32]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-xl px-6 text-base font-bold",
        icon: "h-10 w-10 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
);
Button.displayName = "Button";

export { Button, buttonVariants };