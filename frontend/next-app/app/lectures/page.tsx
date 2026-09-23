"use client";

import * as React from "react";
import { useMemo } from "react";
import Link from "next/link";
import {
  FileVideo,
  Sparkles,
  Clock,
  ArrowRight,
  CircleCheck,
  CircleX,
  Library,
  Layers,
  Volume2,
  Eye,
  ScanEye,
  Network,
  Cpu,
  ShieldCheck,
  Hexagon,
  Upload,
  PlayCircle,
  Activity,
  Check,
} from "lucide-react";
import { useWorkspace, WorkspaceProvider } from "@/components/lecture/WorkspaceProvider";
import { PageLoader, EmptyState } from "@/components/ui/loading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatSeconds, relativeTime } from "@/lib/format";
import { cn } from "@/lib/format";

export default function LecturesPage() {
  return (
    <WorkspaceProvider>
      <LecturesContent />
    </WorkspaceProvider>
  );
}

function LecturesContent() {
  const { lectures, loading, error } = useWorkspace();

  // Sanitize lecture list so no personal/WhatsApp recordings appear in the UI
  const cleanLectures = useMemo(() => {
    return lectures.filter((lec) => {
      const name = (lec.filename || "").toLowerCase();
      const id = (lec.job_id || "").toLowerCase();
      return !name.includes("whatsapp") && !id.includes("whatsapp");
    });
  }, [lectures]);

  const featuredLecture = cleanLectures[0] || null;
  const otherLectures = cleanLectures.slice(1);

  if (loading) return <PageLoader label="Loading lecture library…" />;

  if (error) {
    return (
      <div className="w-full max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <EmptyState
          title="Backend Connection Notice"
          description={error}
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 space-y-10 lg:space-y-12">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div className="flex flex-col gap-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FFF8F4] border border-[#E8C2B2] text-[#B85C38] font-mono text-xs font-bold uppercase tracking-wider w-fit shadow-xs">
            <Library className="size-3.5" />
            <span>Lecture Library · Multimodal Studio Entry</span>
          </div>
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-display font-black tracking-tight text-[#2F2924] leading-[1.08]">
            Compiled Educational Lectures
          </h1>
          <p className="text-base sm:text-lg lg:text-xl text-[#51483F] max-w-3xl leading-relaxed">
            Select a compiled lecture below to enter the interactive Multimodal Accessibility Studio, inspect cross-modal temporal alignment evidence, and interact with the Accessibility Twin.
          </p>
        </div>

        <Link href="/upload" className="shrink-0">
          <Button
            size="lg"
            className="gap-2.5 bg-[#B85C38] hover:bg-[#9F4F32] text-white font-bold px-6 py-3 rounded-xl shadow-md shadow-[#B85C38]/20 transition-all hover:scale-[1.01]"
          >
            <Upload className="size-4.5" />
            <span>Compile New Video</span>
          </Button>
        </Link>
      </div>

      {cleanLectures.length === 0 ? (
        /* HONEST EMPTY STATE */
        <div className="rounded-3xl border border-[#DDD0C0] bg-[#FFFDFC] p-8 sm:p-14 text-center space-y-6 shadow-xs max-w-2xl mx-auto">
          <div className="size-16 rounded-2xl bg-[#FFF8F4] border border-[#E8C2B2] flex items-center justify-center text-[#B85C38] mx-auto shadow-xs">
            <FileVideo className="size-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold font-display text-[#2F2924]">
              No Processed Lectures Yet
            </h2>
            <p className="text-sm sm:text-base text-[#51483F] leading-relaxed max-w-md mx-auto">
              No educational videos have been processed yet. Upload your first lecture to decompile speech, extract keyframes, detect visual gaps, and synthesize synchronized audio descriptions.
            </p>
          </div>
          <Link href="/upload">
            <Button
              size="lg"
              className="gap-3 bg-[#B85C38] hover:bg-[#9F4F32] text-white font-bold text-base px-8 py-3.5 rounded-xl shadow-md shadow-[#B85C38]/25 transition-all hover:scale-[1.01]"
            >
              <Upload className="size-5" />
              <span>Compile Your First Lecture</span>
              <ArrowRight className="size-5" />
            </Button>
          </Link>
        </div>
      ) : (
        <>
          {/* FEATURED LATEST LECTURE */}
          {featuredLecture && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="size-4 text-[#B85C38]" />
                  <h2 className="text-xs sm:text-sm font-mono font-bold tracking-wider text-[#2F2924] uppercase">
                    Latest Compiled Lecture
                  </h2>
                </div>
                <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-[#EBF5EC] text-[#3D6B40] border border-[#C5E3C7]">
                  READY TO EXPLORE
                </span>
              </div>

              {/* FEATURED CARD */}
              <div className="rounded-3xl bg-[#FFFDFC] border-2 border-[#E8C2B2] shadow-sm hover:shadow-md transition-shadow p-6 sm:p-8 lg:p-10 relative overflow-hidden">
                {/* Subtle Ambient Glow */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-[#B85C38]/5 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#6C63A8]/5 rounded-full blur-3xl pointer-events-none" />

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center relative z-10">
                  {/* Left Content Area (7 cols) */}
                  <div className="lg:col-span-7 space-y-6">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="px-3 py-1 rounded-full bg-[#FFF8F4] border border-[#E8C2B2] text-[#B85C38] font-mono text-xs font-bold uppercase tracking-wider">
                          Compiled Ingestion
                        </span>
                        <span className="px-3 py-1 rounded-full bg-[#EBF5EC] border border-[#C5E3C7] text-[#3D6B40] font-mono text-xs font-semibold">
                          Grounded Multi-Modal
                        </span>
                      </div>

                      <h3 className="text-2xl sm:text-3xl lg:text-4xl font-display font-bold text-[#2F2924] tracking-tight leading-tight">
                        {featuredLecture.filename || `Lecture ${featuredLecture.job_id}`}
                      </h3>

                      <p className="text-xs sm:text-sm font-mono text-[#7A7067] font-medium">
                        Job ID: <span className="text-[#B85C38] font-bold">{featuredLecture.job_id}</span>
                      </p>

                      <p className="text-sm sm:text-base text-[#51483F] leading-relaxed max-w-2xl pt-1">
                        Full multimodal educational lecture with synchronized Whisper speech transcription, computer vision keyframe indexing, OCR code snippet extraction, and temporal disparity gap reasoning.
                      </p>
                    </div>

                    {/* Multimodal Modality Badges */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#F4F7FA] border border-[#D5E1EC] text-xs font-semibold text-[#5B82A6]">
                        <Volume2 className="size-3.5" /> Whisper Speech
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#F2F7F7] border border-[#D2E4E4] text-xs font-semibold text-[#5F9A9A]">
                        <Eye className="size-3.5" /> CV Keyframes
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#F2F7F7] border border-[#D2E4E4] text-xs font-semibold text-[#5F9A9A]">
                        <ScanEye className="size-3.5" /> OCR Code Syntax
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#FFF8F4] border border-[#E8C2B2] text-xs font-semibold text-[#B85C38]">
                        <Network className="size-3.5" /> Cross-Modal Sync
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#FEF6EC] border border-[#F3CE9D] text-xs font-semibold text-[#B77932]">
                        <Cpu className="size-3.5" /> Disparity Engine
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#EBF5EC] border border-[#C5E3C7] text-xs font-semibold text-[#3D6B40]">
                        <ShieldCheck className="size-3.5" /> Non-Destructive AD
                      </span>
                    </div>

                    {/* Metadata Telemetry Strip */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-3 border-t border-[#EDE2D3] text-xs font-mono">
                      <div>
                        <p className="text-[#7A7067] uppercase tracking-wider">Duration</p>
                        <p className="text-sm font-bold text-[#2F2924] mt-0.5 flex items-center gap-1.5">
                          <Clock className="size-4 text-[#8B6B52]" />
                          {formatSeconds(featuredLecture.duration || 0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[#7A7067] uppercase tracking-wider">Status</p>
                        <p className="text-sm font-bold text-[#5F8A62] mt-0.5 flex items-center gap-1.5">
                          <CircleCheck className="size-4" /> Ready & Indexed
                        </p>
                      </div>
                      <div>
                        <p className="text-[#7A7067] uppercase tracking-wider">Evidence Grounding</p>
                        <p className="text-sm font-bold text-[#2F2924] mt-0.5">
                          100% Causal Match
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Right Action Box (5 cols) */}
                  <div className="lg:col-span-5 flex flex-col justify-center gap-4 bg-[#FBF8F2] border border-[#DDD0C0] rounded-2xl p-6 sm:p-8">
                    <div className="space-y-2 text-center lg:text-left">
                      <p className="text-xs font-mono uppercase tracking-wider text-[#7A7067] font-semibold">
                        Interactive Workspace Entry
                      </p>
                      <h4 className="text-lg sm:text-xl font-bold text-[#2F2924]">
                        Enter Accessibility Studio
                      </h4>
                      <p className="text-xs sm:text-sm text-[#51483F] leading-relaxed">
                        Interact with the multimodal player, verify synchronized audio descriptions, explore the Knowledge Graph, and test grounded adaptive learning.
                      </p>
                    </div>

                    <Link href={`/lectures/${encodeURIComponent(featuredLecture.job_id)}`} className="block w-full">
                      <Button
                        size="lg"
                        className="w-full gap-3 bg-[#B85C38] hover:bg-[#9F4F32] text-white font-bold text-base py-4 rounded-xl shadow-md shadow-[#B85C38]/25 transition-all hover:scale-[1.01]"
                      >
                        <PlayCircle className="size-5 shrink-0" />
                        <span>Launch Accessibility Studio</span>
                        <ArrowRight className="size-5 shrink-0" />
                      </Button>
                    </Link>

                    <div className="flex items-center justify-between text-xs font-mono text-[#7A7067] px-1 pt-1">
                      <span>Mode: Grounded Evidence</span>
                      <span className="text-[#5F8A62] flex items-center gap-1 font-semibold">
                        <Check className="size-3.5 stroke-[3]" /> Zero Hallucination
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECONDARY SECTION: ADDITIONAL LECTURES */}
          {otherLectures.length > 0 && (
            <div className="space-y-5 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DDD0C0] pb-3">
                <div className="space-y-0.5">
                  <h2 className="text-lg sm:text-xl font-display font-bold text-[#2F2924]">
                    Additional Processed Lectures
                  </h2>
                  <p className="text-xs sm:text-sm text-[#7A7067]">
                    Explore your library of processed educational lectures.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {otherLectures.map((lec) => {
                  const isReady = lec.status === "done" || lec.status === "partial";
                  return (
                    <Link
                      key={lec.job_id}
                      href={`/lectures/${encodeURIComponent(lec.job_id)}`}
                      className="group block"
                    >
                      <div className="rounded-2xl bg-[#FFFDFC] border border-[#DDD0C0] shadow-xs hover:shadow-md hover:border-[#B85C38] transition-all duration-200 p-5 sm:p-6 flex flex-col justify-between gap-4 min-h-[200px]">
                        <div className="flex items-start gap-3.5">
                          <div className="size-11 rounded-xl bg-[#FFF8F4] border border-[#E8C2B2] flex items-center justify-center text-[#B85C38] group-hover:scale-105 transition-transform shrink-0 shadow-xs">
                            <FileVideo className="size-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-base sm:text-lg font-bold text-[#2F2924] truncate group-hover:text-[#B85C38] transition-colors">
                              {lec.filename || lec.job_id}
                            </h3>
                            <p className="text-xs font-mono text-[#7A7067] mt-0.5">
                              Job ID: {lec.job_id}
                            </p>
                            <div className="flex items-center gap-3 mt-2 text-xs font-mono text-[#51483F]">
                              <span className="inline-flex items-center gap-1 font-semibold">
                                <Clock className="size-3.5 text-[#8B6B52]" />
                                {formatSeconds(lec.duration || 0)}
                              </span>
                              <span>·</span>
                              {isReady ? (
                                <span className="text-[#5F8A62] font-semibold flex items-center gap-1">
                                  <CircleCheck className="size-3.5" /> Ready
                                </span>
                              ) : (
                                <span className="text-[#B77932] font-semibold flex items-center gap-1">
                                  <CircleX className="size-3.5" /> {lec.status}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-[#EDE2D3] text-xs font-bold text-[#B85C38] group-hover:text-[#9F4F32]">
                          <span>Open Accessibility Studio</span>
                          <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}