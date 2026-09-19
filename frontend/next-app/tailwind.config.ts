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
        app: {
          bg: "#070A14",
          panel: "#0B1020",
          panel2: "#11172A",
          panel3: "#1A2238",
          edge: "#1E294B",
          soft: "#94A3B8",
          muted: "#64748B",
          surface: "#0B1020",
          canvas: "#070A14",
          rails: "#0B1020",
          ink: "#070A14",
        },
        ink: {
          deep: "#070A14",
          obsidian: "#0B1020",
          midnight: "#11172A",
          card: "#0B1020",
          surface: "#11172A",
          border: "#1E294B",
          glow: "rgba(108, 79, 247, 0.15)",
        },
        warm: {
          bg: "#F7F5F0",
          ivory: "#EFEEE9",
          surface: "#FFFFFF",
          muted: "#E8E6DF",
          border: "#DDD9CE",
          ink: "#0E1118",
          text: "#1A202C",
        },
        brand: {
          indigo: "#6C4FF7",
          blue: "#3B82F6",
          cyan: "#0EA5E9",
          amber: "#D97706",
          green: "#16A34A",
          emerald: "#16A34A",
          red: "#DC2626",
          rose: "#DC2626",
          violet: "#7C3AED",
          purple: "#6C4FF7",
        },
        slate: {
          50: "#F8FAFC",
          100: "#F1F5F9",
          200: "#E2E8F0",
          300: "#CBD5E1",
          400: "#94A3B8",
          500: "#64748B",
          600: "#475569",
          700: "#334155",
          800: "#1E293B",
          900: "#0F172A",
          950: "#070A14",
        },
        rail: {
          speech: "rgba(59, 130, 246, 0.12)",
          visual: "rgba(14, 165, 233, 0.12)",
          ocr: "rgba(108, 79, 247, 0.12)",
          gaps: "rgba(217, 119, 6, 0.12)",
          events: "rgba(220, 38, 38, 0.12)",
          ad: "rgba(22, 163, 74, 0.12)",
          assessment: "rgba(124, 58, 237, 0.12)",
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
        surface: "0 1px 2px rgba(15, 23, 42, 0.04)",
        rail: "inset 0 1px 0 rgba(15, 23, 42, 0.03)",
        float: "0 8px 24px rgba(15, 23, 42, 0.08), 0 2px 6px rgba(15, 23, 42, 0.04)",
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
          "50%": { opacity: "1", transform: "scale(1.03)" },
        },
        "shimmer": {
          "100%": { transform: "translateX(100%)" },
        },
        "wave-bar": {
          "0%, 100%": { height: "20%" },
          "50%": { height: "100%" },
        },
        "stage-activate": {
          "0%": { opacity: "0.3", transform: "scale(0.94)", boxShadow: "0 0 0 0 rgba(108, 79, 247, 0)" },
          "50%": { opacity: "1", transform: "scale(1.02)", boxShadow: "0 0 0 8px rgba(108, 79, 247, 0.08)" },
          "100%": { opacity: "1", transform: "scale(1)", boxShadow: "0 0 0 0 rgba(108, 79, 247, 0)" },
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