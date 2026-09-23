"use client";

import * as React from "react";
import { cn } from "@/lib/format";

interface EduAccessBrandBackgroundProps {
  className?: string;
  variant?: "subtle" | "hero" | "ambient";
}

/**
 * EduAccessBrandBackground
 * 
 * Custom, lightweight SVG/CSS visual composition embodying the multimodal compiler journey:
 * Educational Video -> Speech STT + Visual OCR -> Multimodal Alignment -> Gap Detection -> Accessible Learning Twin.
 * 
 * Warm editorial aesthetic with terracotta, soft indigo, and cream earth tones.
 */
export default function EduAccessBrandBackground({
  className,
  variant = "ambient",
}: EduAccessBrandBackgroundProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden select-none",
        className
      )}
    >
      {/* Ambient Warm Gradient Glows */}
      <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-gradient-to-br from-[#B85C38]/8 via-[#C49A5A]/6 to-transparent blur-3xl" />
      <div className="absolute top-1/3 -right-24 h-[28rem] w-[28rem] rounded-full bg-gradient-to-bl from-[#6C63A8]/7 via-[#B85C38]/5 to-transparent blur-3xl" />
      <div className="absolute bottom-6 left-1/4 h-80 w-80 rounded-full bg-gradient-to-tr from-[#5F9A9A]/6 to-transparent blur-3xl" />

      {/* Blueprint Grid Pattern */}
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.035] stroke-[#6F4E37]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="eduaccess-grid-pattern"
            width="36"
            height="36"
            patternUnits="userSpaceOnUse"
          >
            <path d="M 36 0 L 0 0 0 36" fill="none" strokeWidth="1" />
            <circle cx="36" cy="36" r="1.5" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#eduaccess-grid-pattern)" />
      </svg>

      {/* Multimodal Compiler Vector Streams */}
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.09] stroke-current text-[#6F4E37]"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1400 800"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="brand-vector-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#B85C38" stopOpacity="0.9" />
            <stop offset="45%" stopColor="#C49A5A" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#6C63A8" stopOpacity="0.9" />
          </linearGradient>
        </defs>

        {/* 1. Video Frame Ingestion Geometry (Top Right) */}
        <g transform="translate(960, 45)" stroke="url(#brand-vector-grad)" strokeWidth="1.5" fill="none">
          <rect x="0" y="0" width="350" height="200" rx="12" strokeDasharray="5 5" />
          <rect x="18" y="18" width="314" height="144" rx="8" strokeWidth="1.2" />
          <polygon points="170,80 170,100 190,90" fill="currentColor" stroke="none" opacity="0.5" />
          <rect x="24" y="136" width="64" height="18" rx="4" fill="currentColor" opacity="0.2" stroke="none" />
          <text x="30" y="149" fontSize="10" fontFamily="monospace" fontWeight="bold" fill="currentColor" stroke="none" opacity="0.9">00:26.0s</text>
        </g>

        {/* 2. Audio Waveform Stream (Speech Recognition) */}
        <g transform="translate(90, 170)" stroke="url(#brand-vector-grad)" strokeWidth="2" fill="none">
          <path d="M 0 40 Q 30 10, 60 40 T 120 40 T 180 15 T 240 65 T 300 40 T 360 20 T 420 60 T 480 40 T 540 40" />
          <text x="5" y="24" fontSize="11" fontFamily="sans-serif" fontWeight="bold" fill="currentColor" stroke="none" opacity="0.75" letterSpacing="0.05em">
            SPEECH STREAM · WHISPER STT
          </text>
        </g>

        {/* 3. OCR Code Fragment Matrix */}
        <g transform="translate(990, 280)" fill="currentColor" stroke="none" opacity="0.6">
          <rect x="0" y="0" width="290" height="115" rx="8" fill="currentColor" opacity="0.08" />
          <text x="16" y="26" fontSize="11" fontFamily="monospace" fontWeight="bold">for fruit in fruits:</text>
          <text x="36" y="46" fontSize="11" fontFamily="monospace">print(fruit)</text>
          <text x="16" y="74" fontSize="10" fontFamily="sans-serif" opacity="0.8">OCR PARSING: TESSERACT ENGINE</text>
          <text x="16" y="94" fontSize="10" fontFamily="sans-serif" opacity="0.8">KEYFRAME EVENT: CODE_SNIPPET</text>
        </g>

        {/* 4. Temporal Alignment Convergence & Cross-Modal Difference Engine */}
        <g stroke="url(#brand-vector-grad)" strokeWidth="1.5" fill="none" opacity="0.75">
          <path d="M 370 210 C 490 210, 590 310, 690 310" />
          <path d="M 960 145 C 860 145, 790 310, 690 310" />
          
          {/* Multimodal Alignment Node */}
          <circle cx="690" cy="310" r="15" fill="#B85C38" fillOpacity="0.2" />
          <circle cx="690" cy="310" r="6" fill="#B85C38" fillOpacity="0.9" />
          <text x="640" y="340" fontSize="10" fontFamily="sans-serif" fontWeight="bold" fill="currentColor" stroke="none" opacity="0.8">
            MULTIMODAL ALIGNMENT
          </text>
          
          {/* Paths to Accessible Twin & Learning Intelligence */}
          <path d="M 690 310 C 690 430, 540 490, 440 490" strokeDasharray="3 3" />
          <path d="M 690 310 C 690 430, 840 490, 940 490" />
        </g>

        {/* 5. Accessible Outputs (Audio Description Layer & Learning Twin) */}
        <g transform="translate(290, 470)" fill="none" stroke="url(#brand-vector-grad)" strokeWidth="1.5">
          <rect x="0" y="0" width="230" height="72" rx="10" />
          <text x="16" y="28" fontSize="11" fontFamily="sans-serif" fontWeight="bold" fill="currentColor" stroke="none" opacity="0.85">
            AUDIO DESCRIPTION LAYER
          </text>
          <text x="16" y="48" fontSize="10" fontFamily="sans-serif" fill="currentColor" stroke="none" opacity="0.7">
            6 Synchronized Cues Over Audible Audio
          </text>
        </g>

        <g transform="translate(840, 470)" fill="none" stroke="url(#brand-vector-grad)" strokeWidth="1.5">
          <rect x="0" y="0" width="250" height="72" rx="10" />
          <text x="16" y="28" fontSize="11" fontFamily="sans-serif" fontWeight="bold" fill="currentColor" stroke="none" opacity="0.85">
            GENAI LEARNING AGENT &amp; GRAPH
          </text>
          <text x="16" y="48" fontSize="10" fontFamily="sans-serif" fill="currentColor" stroke="none" opacity="0.7">
            Next Best Action &amp; Grounded Q&amp;A
          </text>
        </g>
      </svg>
    </div>
  );
}
