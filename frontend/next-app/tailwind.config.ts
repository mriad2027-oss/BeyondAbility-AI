import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        terracotta: {
          DEFAULT: "#B85C38",
          deep: "#9F4F32",
          soft: "#C97858",
          light: "#E8C2B2",
          surface: "#FFF8F4",
        },
        cream: {
          DEFAULT: "#F7F1E8",
          warm: "#FBF8F2",
          secondary: "#F1E8DC",
          elevated: "#FFFDFC",
          soft: "#EDE2D3",
        },
        earth: {
          brown: "#6F4E37",
          softBrown: "#8B6B52",
          olive: "#7A8061",
          sage: "#AAB09A",
          gold: "#C49A5A",
        },
        ai: {
          indigo: "#6C63A8",
          lightIndigo: "#AAA4D1",
        },
        semantic: {
          speech: "#5B82A6",
          vision: "#5F9A9A",
          learning: "#7A8061",
          gap: "#B77932",
          verified: "#5F8A62",
          critical: "#B94A48",
        },
        app: {
          bg: "#F7F1E8",
          panel: "#FFFDFC",
          panel2: "#F1E8DC",
          panel3: "#EDE2D3",
          edge: "#DDD0C0",
          soft: "#7A7067",
          muted: "#8C8177",
          surface: "#FFFDFC",
          canvas: "#F7F1E8",
          rails: "#F1E8DC",
          ink: "#2F2924",
        },
        ink: {
          deep: "#2F2924",
          obsidian: "#3F352E",
          midnight: "#51483F",
          card: "#FFFDFC",
          surface: "#FBF8F2",
          border: "#DDD0C0",
          glow: "rgba(184, 92, 56, 0.12)",
        },
        warm: {
          bg: "#F7F1E8",
          ivory: "#FBF8F2",
          surface: "#FFFDFC",
          muted: "#EDE2D3",
          border: "#DDD0C0",
          ink: "#2F2924",
          text: "#2F2924",
        },
        brand: {
          terracotta: "#B85C38",
          indigo: "#6C63A8",
          blue: "#5B82A6",
          cyan: "#5F9A9A",
          amber: "#B77932",
          green: "#5F8A62",
          emerald: "#5F8A62",
          red: "#B94A48",
          rose: "#B94A48",
          violet: "#6C63A8",
          purple: "#6C63A8",
        },
        rail: {
          speech: "rgba(91, 130, 166, 0.10)",
          visual: "rgba(95, 154, 154, 0.10)",
          ocr: "rgba(95, 154, 154, 0.10)",
          gaps: "rgba(183, 121, 50, 0.12)",
          events: "rgba(185, 74, 72, 0.10)",
          ad: "rgba(95, 138, 98, 0.10)",
          assessment: "rgba(108, 99, 168, 0.10)",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "var(--font-noto-sans-arabic)",
          "ui-sans-serif",
          "system-ui",
        ],
        display: [
          "var(--font-inter)",
          "var(--font-noto-sans-arabic)",
          "ui-sans-serif",
          "system-ui",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      boxShadow: {
        surface: "0 1px 3px rgba(47, 41, 36, 0.05), 0 1px 2px rgba(47, 41, 36, 0.03)",
        rail: "inset 0 1px 0 rgba(47, 41, 36, 0.03)",
        float: "0 8px 24px rgba(47, 41, 36, 0.07), 0 2px 6px rgba(47, 41, 36, 0.04)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-slide-ltr": {
          from: { opacity: "0", transform: "translateX(-12px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.8", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.02)" },
        },
        "shimmer": {
          "100%": { transform: "translateX(100%)" },
        },
        "wave-bar": {
          "0%, 100%": { height: "20%" },
          "50%": { height: "100%" },
        },
        "stage-activate": {
          "0%": { opacity: "0.4", transform: "scale(0.96)", boxShadow: "0 0 0 0 rgba(184, 92, 56, 0)" },
          "50%": { opacity: "1", transform: "scale(1.02)", boxShadow: "0 0 0 8px rgba(184, 92, 56, 0.12)" },
          "100%": { opacity: "1", transform: "scale(1)", boxShadow: "0 0 0 0 rgba(184, 92, 56, 0)" },
        },
        "time-travel": {
          "0%": { opacity: "0.8", transform: "scaleY(0.85)" },
          "100%": { opacity: "1", transform: "scaleY(1)" },
        },
        "evidence-converge": {
          "0%": { opacity: "0", transform: "translateX(var(--conv-from, -16px))" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "node-pop": {
          "0%": { opacity: "0", transform: "scale(0.6)" },
          "60%": { opacity: "1", transform: "scale(1.08)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.35s ease-out both",
        "fade-in-up": "fade-in-up 0.45s ease-out both",
        "fade-slide-ltr": "fade-slide-ltr 0.4s ease-out both",
        "pulse-soft": "pulse-soft 1.8s ease-in-out infinite",
        "glow-pulse": "glow-pulse 2.5s ease-in-out infinite",
        "shimmer": "shimmer 2s infinite",
        "stage-activate": "stage-activate 0.9s ease-out both",
        "time-travel": "time-travel 0.2s ease-out both",
        "evidence-converge": "evidence-converge 0.55s ease-out both",
        "node-pop": "node-pop 0.55s cubic-bezier(0.2, 0.8, 0.2, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;