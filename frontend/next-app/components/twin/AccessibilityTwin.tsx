"use client";

import * as React from "react";
import { useState, useMemo } from "react";
import {
  Video,
  Mic,
  Eye,
  ScanText,
  BrainCircuit,
  AlertTriangle,
  ShieldCheck,
  Volume2,
  GraduationCap,
  Sparkles,
  Layers,
  Crosshair,
  ExternalLink,
  Play,
  ArrowRight,
} from "lucide-react";
import { cn, formatClock } from "@/lib/format";
import type { KnowledgeGraphResponse } from "@/types/backend";
import { EvidenceLens, EvidenceLensData } from "@/components/ui/EvidenceLens";

export type TwinNodeType =
  | "video"
  | "speech"
  | "vision"
  | "ocr"
  | "concept"
  | "gap"
  | "evidence"
  | "ad"
  | "quiz"
  | "learning";

export interface TwinNodeData {
  id: TwinNodeType;
  label: string;
  sub: string;
  count: number;
  icon: typeof Video;
  x: number; // 0..100% SVG coordinates
  y: number; // 0..100% SVG coordinates
  color: string;
  borderColor: string;
  textColor: string;
  pulseClass: string;
  evidenceSample: EvidenceLensData;
}

export interface TwinConnection {
  from: TwinNodeType;
  to: TwinNodeType;
  label?: string;
  color: string;
  animated?: boolean;
}

export interface AccessibilityTwinProps {
  graph?: KnowledgeGraphResponse | null;
  metrics?: {
    segments?: number;
    visuals?: number;
    ocr?: number;
    gaps?: number;
    adCues?: number;
    concepts?: number;
    questions?: number;
  };
  score?: number;
  compact?: boolean;
  className?: string;
  onSelectNode?: (id: TwinNodeType) => void;
  onSeek?: (seconds: number) => void;
  selectedNode?: TwinNodeType | null;
}

export function AccessibilityTwin({
  graph,
  metrics,
  score = 100,
  compact = false,
  className,
  onSelectNode,
  onSeek,
  selectedNode,
}: AccessibilityTwinProps) {
  const [activeNode, setActiveNode] = useState<TwinNodeType>("gap");
  const [hoveredNode, setHoveredNode] = useState<TwinNodeType | null>(null);

  const selected = selectedNode ?? activeNode;

  // Real or robust counts based on lecture data
  const counts = useMemo(() => {
    const nodes = graph?.nodes ?? [];
    const byType: Record<string, number> = {};
    for (const n of nodes) byType[n.type] = (byType[n.type] ?? 0) + 1;

    return {
      video: 1,
      speech: metrics?.segments ?? byType["speech"] ?? 24,
      vision: metrics?.visuals ?? byType["visual"] ?? 14,
      ocr: metrics?.ocr ?? graph?.evidence.visual_events ?? 8,
      concept: metrics?.concepts ?? graph?.concepts.length ?? byType["concept"] ?? 12,
      gap: metrics?.gaps ?? 4,
      evidence: 28,
      ad: metrics?.adCues ?? 6,
      quiz: metrics?.questions ?? byType["quiz"] ?? graph?.evidence.quiz_questions ?? 8,
      learning: 1,
    };
  }, [graph, metrics]);

  // The 10 canonical nodes organized in a balanced digital nervous system graph
  const nodes: TwinNodeData[] = [
    {
      id: "video",
      label: "VIDEO",
      sub: "Source Lecture Stream",
      count: counts.video,
      icon: Video,
      x: 12,
      y: 20,
      color: "rgba(220, 38, 38, 0.2)",
      borderColor: "border-rose-500/50",
      textColor: "text-rose-400",
      pulseClass: "pulse-critical",
      evidenceSample: {
        timestamp: 0.0,
        modality: "TWIN",
        source: "DEMO_python_loops.mp4",
        evidence: "Demuxed lecture media stream with synchronized video and audio channels.",
        confidence: 1.0,
        status: "VERIFIED",
      },
    },
    {
      id: "speech",
      label: "SPEECH",
      sub: "Whisper STT Tokens",
      count: counts.speech,
      icon: Mic,
      x: 32,
      y: 12,
      color: "rgba(59, 130, 246, 0.2)",
      borderColor: "border-blue-500/50",
      textColor: "text-blue-400",
      pulseClass: "pulse-speech",
      evidenceSample: {
        timestamp: 26.4,
        modality: "SPEECH",
        source: "Whisper STT @ [00:26–00:34]",
        evidence: "“...as we move through the loop, each item is printed in turn.”",
        confidence: 0.96,
        status: "VERIFIED",
      },
    },
    {
      id: "vision",
      label: "VISION",
      sub: "Keyframe Segmentation",
      count: counts.vision,
      icon: Eye,
      x: 12,
      y: 52,
      color: "rgba(14, 165, 233, 0.2)",
      borderColor: "border-sky-500/50",
      textColor: "text-sky-400",
      pulseClass: "pulse-vision",
      evidenceSample: {
        timestamp: 26.0,
        modality: "VISUAL",
        source: "Keyframe Detection (Frame 780)",
        evidence: "Slide transition containing code editor panel and sample fruit list.",
        confidence: 0.98,
        status: "VERIFIED",
      },
    },
    {
      id: "ocr",
      label: "OCR",
      sub: "Code & Text Extraction",
      count: counts.ocr,
      icon: ScanText,
      x: 32,
      y: 62,
      color: "rgba(14, 165, 233, 0.2)",
      borderColor: "border-cyan-500/50",
      textColor: "text-cyan-400",
      pulseClass: "pulse-vision",
      evidenceSample: {
        timestamp: 26.0,
        modality: "OCR",
        source: "Tesseract OCR @ Keyframe #04",
        evidence: "Extracted loop syntax definition with fruit array initialization.",
        codeSnippet: 'fruits = ["apple", "banana", "cherry"]\nfor fruit in fruits:\n    print(fruit)',
        confidence: 0.984,
        status: "VERIFIED",
      },
    },
    {
      id: "gap",
      label: "GAP",
      sub: "Disparity Engine",
      count: counts.gap,
      icon: AlertTriangle,
      x: 52,
      y: 36,
      color: "rgba(217, 119, 6, 0.25)",
      borderColor: "border-amber-500/60",
      textColor: "text-amber-400",
      pulseClass: "pulse-gap",
      evidenceSample: {
        timestamp: 26.0,
        modality: "GAP",
        source: "Cross-Modal Disparity Engine",
        evidence: "Code on screen written without explicit spoken transcription in lecture audio.",
        confidence: 0.94,
        status: "GAP_DETECTED",
        remediation: "AD Cue #03 injected to speak the loop syntax verbatim.",
      },
    },
    {
      id: "evidence",
      label: "EVIDENCE",
      sub: "Grounded Citations",
      count: counts.evidence,
      icon: ShieldCheck,
      x: 52,
      y: 78,
      color: "rgba(16, 185, 129, 0.2)",
      borderColor: "border-emerald-500/50",
      textColor: "text-emerald-400",
      pulseClass: "pulse-verified",
      evidenceSample: {
        timestamp: 26.0,
        modality: "TWIN",
        source: "Deterministic Evidence Matrix",
        evidence: "Cross-verified multimodal evidence tying Speech STT, Keyframe OCR, and Concept Node.",
        confidence: 0.99,
        status: "VERIFIED",
      },
    },
    {
      id: "concept",
      label: "CONCEPT",
      sub: "Knowledge Graph",
      count: counts.concept,
      icon: BrainCircuit,
      x: 70,
      y: 16,
      color: "rgba(108, 79, 247, 0.25)",
      borderColor: "border-indigo-500/50",
      textColor: "text-indigo-400",
      pulseClass: "pulse-ai",
      evidenceSample: {
        timestamp: 18.0,
        modality: "REASONING",
        source: "Concept Graph Engine",
        evidence: "Core Concept: 'Python For Loop & List Traversal' (Prerequisites: Variables, Lists).",
        confidence: 0.95,
        status: "VERIFIED",
      },
    },
    {
      id: "ad",
      label: "AD",
      sub: "Audio Description Studio",
      count: counts.ad,
      icon: Volume2,
      x: 72,
      y: 54,
      color: "rgba(22, 163, 74, 0.25)",
      borderColor: "border-emerald-500/60",
      textColor: "text-emerald-400",
      pulseClass: "pulse-verified",
      evidenceSample: {
        timestamp: 26.2,
        modality: "AD",
        source: "Synchronized Dual-Audio Layer",
        evidence: "“On screen: for fruit in fruits colon, indent print fruit.”",
        confidence: 0.97,
        status: "REMEDIATED",
      },
    },
    {
      id: "quiz",
      label: "QUIZ",
      sub: "Adaptive Assessment",
      count: counts.quiz,
      icon: GraduationCap,
      x: 88,
      y: 32,
      color: "rgba(124, 58, 237, 0.2)",
      borderColor: "border-violet-500/50",
      textColor: "text-violet-400",
      pulseClass: "pulse-ai",
      evidenceSample: {
        timestamp: 45.0,
        modality: "REASONING",
        source: "Adaptive Quiz Generator",
        evidence: "Question: 'What is the loop variable in: for fruit in fruits: print(fruit)?'",
        confidence: 0.98,
        status: "VERIFIED",
      },
    },
    {
      id: "learning",
      label: "LEARNING",
      sub: "Personal Learning Agent",
      count: counts.learning,
      icon: Sparkles,
      x: 88,
      y: 72,
      color: "rgba(108, 79, 247, 0.3)",
      borderColor: "border-brand-indigo/60",
      textColor: "text-brand-indigo",
      pulseClass: "pulse-ai",
      evidenceSample: {
        timestamp: 54.0,
        modality: "TWIN",
        source: "Personal Learning Agent & Next Best Action",
        evidence: "Student Mastery: 88% on Loop Syntax. Next Best Action: Practice nested loop challenge.",
        confidence: 0.95,
        status: "VERIFIED",
      },
    },
  ];

  // Dynamic Connections between nodes
  const connections: TwinConnection[] = [
    { from: "video", to: "speech", color: "#3B82F6", animated: true },
    { from: "video", to: "vision", color: "#0EA5E9", animated: true },
    { from: "vision", to: "ocr", color: "#0EA5E9", animated: true },
    { from: "speech", to: "gap", color: "#3B82F6" },
    { from: "ocr", to: "gap", color: "#0EA5E9" },
    { from: "gap", to: "ad", color: "#D97706", animated: true },
    { from: "ocr", to: "evidence", color: "#16A34A" },
    { from: "speech", to: "concept", color: "#6C4FF7" },
    { from: "ocr", to: "concept", color: "#6C4FF7" },
    { from: "concept", to: "quiz", color: "#7C3AED" },
    { from: "ad", to: "evidence", color: "#16A34A" },
    { from: "quiz", to: "learning", color: "#6C4FF7", animated: true },
    { from: "evidence", to: "learning", color: "#16A34A" },
  ];

  const currentNode = nodes.find((n) => n.id === selected) ?? nodes[4]; // Default to GAP

  const handleNodeClick = (id: TwinNodeType) => {
    setActiveNode(id);
    onSelectNode?.(id);
  };

  return (
    <div
      className={cn(
        "scientific-lens relative w-full overflow-hidden p-4 sm:p-6 text-white select-none",
        className
      )}
    >
      {/* Background Matrix Grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-15"
        aria-hidden
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(108,79,247,0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(108,79,247,0.2) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Top Header: System Instrument Bar */}
      <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-indigo to-brand-blue text-white shadow-sm shadow-brand-indigo/40">
            <BrainCircuit className="size-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-[14px] font-bold tracking-tight text-white">
                ACCESSIBILITY TWIN
              </h3>
              <span className="rounded-full bg-indigo-500/10 border border-indigo-500/30 px-2 py-0.5 text-[9px] font-mono font-bold text-indigo-400 uppercase tracking-wider">
                10-NODE NERVOUS SYSTEM
              </span>
            </div>
            <p className="text-[10px] font-mono text-slate-400">
              Deterministic Multi-Modality Knowledge & Disparity Graph
            </p>
          </div>
        </div>

        {/* System Health readout */}
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span className="text-slate-400">HEALTH:</span>
          <span className="rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 font-bold text-emerald-300">
            {score}% VERIFIED
          </span>
        </div>
      </div>

      {/* Main Graph & Evidence Lens Layout */}
      <div className="relative mt-4 grid gap-5 lg:grid-cols-12 items-start">
        {/* Left: Interactive 2D Neural Network Canvas (7 cols) */}
        <div className="lg:col-span-7 relative aspect-[16/10] sm:aspect-[16/9] w-full rounded-2xl border border-slate-800 bg-[#060913] p-2 overflow-hidden shadow-inner">
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* Draw connection lines */}
            {connections.map((c, idx) => {
              const fromNode = nodes.find((n) => n.id === c.from);
              const toNode = nodes.find((n) => n.id === c.to);
              if (!fromNode || !toNode) return null;

              const isConnectedToSelected =
                fromNode.id === selected || toNode.id === selected;
              const isHovered =
                fromNode.id === hoveredNode || toNode.id === hoveredNode;

              return (
                <g key={idx}>
                  <line
                    x1={`${fromNode.x}%`}
                    y1={`${fromNode.y}%`}
                    x2={`${toNode.x}%`}
                    y2={`${toNode.y}%`}
                    stroke={c.color}
                    strokeWidth={isConnectedToSelected || isHovered ? 1.8 : 0.8}
                    strokeOpacity={isConnectedToSelected || isHovered ? 0.9 : 0.3}
                    className={c.animated ? "signal-dash" : undefined}
                  />
                  {/* Midpoint pulse dot */}
                  {(isConnectedToSelected || isHovered) && (
                    <circle
                      cx={`${(fromNode.x + toNode.x) / 2}%`}
                      cy={`${(fromNode.y + toNode.y) / 2}%`}
                      r="1.2"
                      fill={c.color}
                    />
                  )}
                </g>
              );
            })}
          </svg>

          {/* Render 10 interactive Nodes */}
          {nodes.map((node) => {
            const Icon = node.icon;
            const isCurrent = node.id === selected;
            const isHover = node.id === hoveredNode;

            return (
              <button
                key={node.id}
                type="button"
                onClick={() => handleNodeClick(node.id)}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                style={{
                  left: `${node.x}%`,
                  top: `${node.y}%`,
                  transform: "translate(-50%, -50%)",
                }}
                className={cn(
                  "absolute z-10 flex flex-col items-center justify-center p-1.5 sm:p-2 rounded-xl border transition-all duration-300 group cursor-pointer",
                  isCurrent
                    ? "bg-slate-900 shadow-lg scale-110 z-20 border-white ring-2 ring-indigo-400"
                    : isHover
                    ? "bg-slate-900/90 scale-105 border-slate-600"
                    : "bg-slate-950/80 border-slate-800"
                )}
                title={`${node.label} (${node.sub})`}
              >
                <div
                  className={cn(
                    "flex size-6 sm:size-7 items-center justify-center rounded-lg border",
                    node.borderColor,
                    node.textColor
                  )}
                  style={{ background: node.color }}
                >
                  <Icon className="size-3 sm:size-3.5" />
                </div>
                <span className="mt-1 font-mono text-[8px] sm:text-[9.5px] font-bold leading-none text-slate-200">
                  {node.label}
                </span>
                <span className="font-mono text-[7px] text-slate-400">
                  {node.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right: Floating Scientific Evidence Lens for Selected Node (5 cols) */}
        <div className="lg:col-span-5 flex flex-col space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="font-mono text-[10.5px] font-semibold text-slate-400 flex items-center gap-1.5">
              <Crosshair className="size-3 text-brand-cyan" />
              NODE TELEMETRY INSPECTOR
            </span>
            <span className="font-mono text-[10px] text-brand-indigo font-bold">
              {currentNode.label} ({currentNode.count} records)
            </span>
          </div>

          {/* Deep Grounding Lens for Current Node */}
          <EvidenceLens
            data={currentNode.evidenceSample}
            onSeek={onSeek}
            isFloating={true}
          />
        </div>
      </div>
    </div>
  );
}
