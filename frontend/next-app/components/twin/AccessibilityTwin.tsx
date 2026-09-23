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
      color: "rgba(185, 74, 72, 0.15)",
      borderColor: "border-[#B94A48]/50",
      textColor: "text-[#E8C2B2]",
      pulseClass: "pulse-critical",
      evidenceSample: {
        timestamp: 0.0,
        modality: "TWIN",
        source: "lecture_source.mp4",
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
      color: "rgba(91, 130, 166, 0.15)",
      borderColor: "border-[#5B82A6]/50",
      textColor: "text-[#8DB4D6]",
      pulseClass: "pulse-speech",
      evidenceSample: {
        timestamp: 26.4,
        modality: "SPEECH",
        source: "Whisper STT Segment #08",
        evidence: "“...as we move through the loop, each item is printed in turn.”",
        confidence: 0.96,
        status: "VERIFIED",
      },
    },
    {
      id: "vision",
      label: "VISION",
      sub: "Keyframe Analysis",
      count: counts.vision,
      icon: Eye,
      x: 32,
      y: 50,
      color: "rgba(95, 154, 154, 0.15)",
      borderColor: "border-[#5F9A9A]/50",
      textColor: "text-[#8EC5C5]",
      pulseClass: "pulse-vision",
      evidenceSample: {
        timestamp: 26.0,
        modality: "VISUAL",
        source: "Keyframe Detection #04",
        evidence: "Code slide layout showing python syntax with syntax highlighter regions.",
        confidence: 0.98,
        status: "VERIFIED",
      },
    },
    {
      id: "ocr",
      label: "OCR",
      sub: "Syntax Extraction",
      count: counts.ocr,
      icon: ScanText,
      x: 32,
      y: 84,
      color: "rgba(95, 154, 154, 0.15)",
      borderColor: "border-[#5F9A9A]/50",
      textColor: "text-[#8EC5C5]",
      pulseClass: "pulse-vision",
      evidenceSample: {
        timestamp: 26.0,
        modality: "OCR",
        source: "Tesseract OCR AST Parser",
        evidence: 'fruits = ["apple", "banana", "cherry"]\nfor fruit in fruits:\n    print(fruit)',
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
      color: "rgba(183, 121, 50, 0.20)",
      borderColor: "border-[#B77932]/60",
      textColor: "text-[#E6AA68]",
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
      color: "rgba(95, 138, 98, 0.15)",
      borderColor: "border-[#5F8A62]/50",
      textColor: "text-[#8FC493]",
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
      color: "rgba(122, 128, 97, 0.20)",
      borderColor: "border-[#7A8061]/60",
      textColor: "text-[#AAB09A]",
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
      color: "rgba(95, 138, 98, 0.20)",
      borderColor: "border-[#5F8A62]/60",
      textColor: "text-[#8FC493]",
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
      color: "rgba(108, 99, 168, 0.15)",
      borderColor: "border-[#6C63A8]/50",
      textColor: "text-[#AAA4D1]",
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
      color: "rgba(184, 92, 56, 0.20)",
      borderColor: "border-[#B85C38]/60",
      textColor: "text-[#E8C2B2]",
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
    { from: "video", to: "speech", color: "#5B82A6", animated: true },
    { from: "video", to: "vision", color: "#5F9A9A", animated: true },
    { from: "vision", to: "ocr", color: "#5F9A9A", animated: true },
    { from: "speech", to: "gap", color: "#5B82A6" },
    { from: "ocr", to: "gap", color: "#5F9A9A" },
    { from: "gap", to: "ad", color: "#B77932", animated: true },
    { from: "ocr", to: "evidence", color: "#5F8A62" },
    { from: "speech", to: "concept", color: "#7A8061" },
    { from: "ocr", to: "concept", color: "#7A8061" },
    { from: "concept", to: "quiz", color: "#6C63A8" },
    { from: "ad", to: "evidence", color: "#5F8A62" },
    { from: "quiz", to: "learning", color: "#6C63A8", animated: true },
    { from: "evidence", to: "learning", color: "#5F8A62" },
  ];

  const currentNode = nodes.find((n) => n.id === selected) ?? nodes[4]; // Default to GAP

  const handleNodeClick = (id: TwinNodeType) => {
    setActiveNode(id);
    onSelectNode?.(id);
  };

  return (
    <div
      className={cn(
        "scientific-lens relative w-full overflow-hidden p-4 sm:p-6 text-[#FFF8F0] select-none",
        className
      )}
    >
      {/* Background Matrix Grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-15"
        aria-hidden
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(232,194,178,0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(232,194,178,0.15) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Top Header: System Instrument Bar */}
      <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-[#6F4E37] pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#B85C38] to-[#6C63A8] text-white shadow-sm shadow-[#B85C38]/40">
            <BrainCircuit className="size-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-[14px] font-bold tracking-tight text-[#FFF8F0]">
                ACCESSIBILITY TWIN
              </h3>
              <span className="rounded-full bg-[#6C63A8]/20 border border-[#6C63A8]/40 px-2 py-0.5 text-[9px] font-mono font-bold text-[#AAA4D1] uppercase tracking-wider">
                10-NODE NERVOUS SYSTEM
              </span>
            </div>
            <p className="text-[10px] font-mono text-[#E8DCD1]">
              Deterministic Multi-Modality Knowledge & Disparity Graph
            </p>
          </div>
        </div>

        {/* System Health readout */}
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span className="text-[#AAB09A]">HEALTH:</span>
          <span className="rounded-md bg-[#5F8A62]/20 border border-[#5F8A62]/40 px-2 py-0.5 font-bold text-[#8FC493]">
            {score}% VERIFIED
          </span>
        </div>
      </div>

      {/* Main Graph & Evidence Lens Layout */}
      <div className="relative mt-4 grid gap-5 lg:grid-cols-12 items-start">
        {/* Left: Interactive 2D Neural Network Canvas (7 cols) */}
        <div className="lg:col-span-7 relative aspect-[16/10] sm:aspect-[16/9] w-full rounded-2xl border border-[#6F4E37] bg-[#2E2620] p-2 overflow-hidden shadow-inner">
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
                    strokeOpacity={isConnectedToSelected || isHovered ? 0.95 : 0.35}
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
                    ? "bg-[#3F352E] shadow-lg scale-110 z-20 border-[#B85C38] ring-2 ring-[#B85C38]/50"
                    : isHover
                    ? "bg-[#3F352E]/90 scale-105 border-[#8B6B52]"
                    : "bg-[#241E1A]/90 border-[#51483F]"
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
                <span className="mt-1 font-mono text-[8px] sm:text-[9.5px] font-bold leading-none text-[#FFF8F0]">
                  {node.label}
                </span>
                <span className="font-mono text-[7px] text-[#AAB09A]">
                  {node.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right: Floating Scientific Evidence Lens for Selected Node (5 cols) */}
        <div className="lg:col-span-5 flex flex-col space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="font-mono text-[10.5px] font-semibold text-[#AAB09A] flex items-center gap-1.5">
              <Crosshair className="size-3 text-[#B85C38]" />
              NODE TELEMETRY INSPECTOR
            </span>
            <span className="font-mono text-[10px] text-[#B85C38] font-bold">
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
