"use client";

import * as React from "react";
import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  BrainCircuit,
  Network,
  AlertTriangle,
  ListChecks,
  TrendingUp,
  Sparkles,
  CheckCircle2,
  XCircle,
  Send,
  Play,
  BookOpenCheck,
  ScanText,
  ChevronDown,
  ArrowRight,
  Target,
  GraduationCap,
  Headphones,
  BookOpen,
  ScanEye,
  CircleHelp,
  Clock,
  Layers,
  Check,
} from "lucide-react";
import { WorkspaceProvider, useWorkspace } from "@/components/lecture/WorkspaceProvider";
import { LecturePicker } from "@/components/lecture/LecturePicker";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton, Spinner } from "@/components/ui/loading";
import {
  getKnowledgeGraph,
  getLectureGaps,
  getStudentLectureGaps,
  getQuiz,
  submitQuiz,
  listQuizzes,
  listStudents,
  getStudentProgress,
  getNextAction,
  getLearningAgent,
} from "@/lib/api";
import { cn, formatClock } from "@/lib/format";
import type {
  KnowledgeConcept,
  KnowledgeGraphResponse,
  LearningGap,
  LearningGapsResponse,
  StudentGap,
  StudentGapsResponse,
  StudentRecord,
  Quiz,
  QuizSubmissionResponse,
  LearningProgress,
  NextActionResponse,
  LearningAgentView,
  RecommendedAction,
} from "@/types/backend";

type LearningTab = "graph" | "gaps" | "quiz" | "progress" | "agent";

export default function LearningIntelligencePage() {
  return (
    <WorkspaceProvider>
      <Suspense fallback={<div className="p-12 text-center text-base font-semibold text-slate-400">Loading Learning Intelligence Models...</div>}>
        <LearningIntelligenceBody />
      </Suspense>
    </WorkspaceProvider>
  );
}

function statusInfo(status: string) {
  switch (status) {
    case "EXPLAINED":
      return {
        badgeClass: "bg-blue-500/15 text-blue-400 border-blue-500/30",
        label: "Explained in speech",
      };
    case "PARTIALLY_EXPLAINED":
      return {
        badgeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
        label: "Explained + shown",
      };
    case "VISUALLY_SHOWN":
      return {
        badgeClass: "bg-sky-500/15 text-sky-400 border-sky-500/30",
        label: "Shown on screen",
      };
    case "ASSESSED":
      return {
        badgeClass: "bg-purple-500/15 text-purple-400 border-purple-500/30",
        label: "Assessed in quiz",
      };
    case "MISSING_EXPLANATION":
      return {
        badgeClass: "bg-amber-500/15 text-amber-400 border-amber-500/30",
        label: "Missing explanation",
      };
    default:
      return {
        badgeClass: "bg-rose-500/15 text-rose-400 border-rose-500/30",
        label: "Attention required",
      };
  }
}

function LearningIntelligenceBody() {
  const searchParams = useSearchParams();
  const { selectedId, loading, lectures } = useWorkspace();
  const [activeTab, setActiveTab] = useState<LearningTab>("graph");

  // Knowledge Graph State
  const [graph, setGraph] = useState<KnowledgeGraphResponse | null>(null);
  const [graphError, setGraphError] = useState(false);
  const [openLabel, setOpenLabel] = useState<string | null>(null);

  // Learning Gaps State
  const [gaps, setGaps] = useState<LearningGapsResponse | null>(null);
  const [studentGaps, setStudentGaps] = useState<StudentGapsResponse | null>(null);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [studentId, setStudentId] = useState<string>("001");

  // Quiz State
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [quizResult, setQuizResult] = useState<QuizSubmissionResponse | null>(null);
  const [quizBusy, setQuizBusy] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);

  // Progress & NBA State
  const [progress, setProgress] = useState<LearningProgress | null>(null);
  const [nextAction, setNextAction] = useState<NextActionResponse | null>(null);
  const [agentView, setAgentView] = useState<LearningAgentView | null>(null);

  useEffect(() => {
    const tabParam = searchParams.get("tab") as LearningTab | null;
    if (tabParam && ["graph", "gaps", "quiz", "progress", "agent"].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  useEffect(() => {
    listStudents()
      .then((r) => {
        setStudents(r.students);
        if (r.students.length && !r.students.some((s) => s.student_id === "001")) {
          setStudentId(r.students[0].student_id);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch Data when lecture or tab changes
  useEffect(() => {
    if (!selectedId) return;

    // Load Knowledge Graph
    getKnowledgeGraph(selectedId)
      .then(setGraph)
      .catch(() => setGraphError(true));

    // Load Learning Gaps
    getLectureGaps(selectedId)
      .then(setGaps)
      .catch(() => setGaps(null));

    // Load Quiz
    getQuiz(`${selectedId}_quiz`)
      .then((q) => setQuiz(q))
      .catch(async () => {
        try {
          const lq = await listQuizzes();
          const found = lq.quizzes.find((qid) => qid.startsWith(selectedId));
          if (found) setQuiz(await getQuiz(found));
          else setQuiz(null);
        } catch {
          setQuiz(null);
        }
      });
  }, [selectedId]);

  useEffect(() => {
    if (!studentId) return;
    if (selectedId) {
      getStudentLectureGaps(selectedId, studentId)
        .then(setStudentGaps)
        .catch(() => setStudentGaps(null));
    }
    getStudentProgress(studentId)
      .then(setProgress)
      .catch(() => setProgress(null));
    getNextAction(studentId)
      .then(setNextAction)
      .catch(() => setNextAction(null));
    getLearningAgent(studentId)
      .then(setAgentView)
      .catch(() => setAgentView(null));
  }, [selectedId, studentId]);

  const handleQuizSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quiz || !selectedId) return;
    setQuizBusy(true);
    setQuizError(null);
    try {
      const resp = await submitQuiz({
        quiz_id: `${selectedId}_quiz`,
        answers,
        student_id: studentId,
        lesson_title: selectedId,
      });
      setQuizResult(resp);
      // Refresh student progress
      getStudentProgress(studentId).then(setProgress).catch(() => {});
      getNextAction(studentId).then(setNextAction).catch(() => {});
      getLearningAgent(studentId).then(setAgentView).catch(() => {});
    } catch (err) {
      setQuizError(err instanceof Error ? err.message : "Failed to grade quiz");
    } finally {
      setQuizBusy(false);
    }
  };

  return (
    <div className="w-full max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 space-y-8 lg:space-y-10 min-w-0 overflow-x-hidden">
      {/* PAGE HEADER */}
      <div className="flex flex-col gap-4 min-w-0">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-brand-indigo/10 border border-brand-indigo/20 text-brand-indigo font-mono text-xs font-semibold uppercase tracking-wider w-fit">
          <BrainCircuit className="size-3.5" />
          <span>Learning Intelligence · Multimodal Knowledge System</span>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-display font-black tracking-tight text-slate-950 dark:text-white leading-[1.08]">
              Multimodal Learning Intelligence
            </h1>
            <p className="text-base sm:text-lg lg:text-xl text-slate-700 dark:text-slate-200 leading-relaxed">
              Evidence-grounded concept graphs, cross-modal disparity gaps, adaptive quizzes with semantic grading, and student progress tracking.
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-1.5 shrink-0">
            <button
              onClick={() => setActiveTab("graph")}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold transition-all",
                activeTab === "graph"
                  ? "bg-brand-indigo text-white font-bold shadow-md ring-2 ring-brand-indigo/30"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/10"
              )}
            >
              <Network className="size-4" />
              <span>Knowledge Graph</span>
            </button>
            <button
              onClick={() => setActiveTab("gaps")}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold transition-all",
                activeTab === "gaps"
                  ? "bg-brand-indigo text-white font-bold shadow-md ring-2 ring-brand-indigo/30"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/10"
              )}
            >
              <AlertTriangle className="size-4" />
              <span>Learning Gaps</span>
            </button>
            <button
              onClick={() => setActiveTab("quiz")}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold transition-all",
                activeTab === "quiz"
                  ? "bg-brand-indigo text-white font-bold shadow-md ring-2 ring-brand-indigo/30"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/10"
              )}
            >
              <ListChecks className="size-4" />
              <span>Adaptive Quiz</span>
            </button>
            <button
              onClick={() => setActiveTab("progress")}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold transition-all",
                activeTab === "progress"
                  ? "bg-brand-indigo text-white font-bold shadow-md ring-2 ring-brand-indigo/30"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/10"
              )}
            >
              <TrendingUp className="size-4" />
              <span>Student Progress</span>
            </button>
            <button
              onClick={() => setActiveTab("agent")}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold transition-all",
                activeTab === "agent"
                  ? "bg-brand-indigo text-white font-bold shadow-md ring-2 ring-brand-indigo/30"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/10"
              )}
            >
              <Sparkles className="size-4" />
              <span>Learning Agent</span>
            </button>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT SIDEBAR: LECTURE SELECTOR & STUDENT PERSONA & NBA (4 cols) */}
        <aside className="lg:col-span-4 xl:col-span-4 space-y-6">
          {/* Lecture Context Selector */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B1020] p-5 sm:p-6 shadow-sm space-y-4">
            <div className="space-y-1">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BookOpen className="size-4.5 text-brand-indigo" />
                <span>Lecture Context</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                Select a compiled lecture to inspect intelligence models.
              </p>
            </div>
            <LecturePicker compact />
          </div>

          {/* Student Profile & Next Best Action */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B1020] p-5 sm:p-6 shadow-sm space-y-5">
            <div className="space-y-1">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <GraduationCap className="size-4.5 text-brand-indigo" />
                <span>Student Persona</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                Simulate adaptive learning &amp; accessibility recommendations.
              </p>
            </div>

            <select
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="w-full h-11 rounded-xl border border-slate-300 dark:border-white/15 bg-slate-50 dark:bg-[#0D1224] px-3.5 text-sm font-semibold text-slate-900 dark:text-white focus:border-brand-indigo focus:outline-none transition"
            >
              {students.map((s) => (
                <option key={s.student_id} value={s.student_id}>
                  {s.name || `Student ${s.student_id}`} ({s.accessibility_mode})
                </option>
              ))}
            </select>

            {/* NEXT BEST ACTION (NBA) HIGHLIGHT CARD */}
            {nextAction && (
              <div className="rounded-2xl border-2 border-brand-indigo/40 bg-brand-indigo/10 p-5 space-y-3 shadow-sm">
                <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-brand-indigo">
                  <Sparkles className="size-4" />
                  <span>Next Best Action (NBA)</span>
                </div>
                <p className="text-base font-bold text-slate-900 dark:text-white leading-snug">
                  {nextAction.label || nextAction.action_type}
                </p>
                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                  {nextAction.reasoning}
                </p>
                <div className="pt-1 flex items-center justify-between text-xs font-mono">
                  <span className="text-brand-indigo font-bold">Evidence → AI Reasoning</span>
                  <span className="text-emerald-500 font-bold flex items-center gap-1">
                    <Check className="size-3.5 stroke-[3]" /> Grounded
                  </span>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* RIGHT CONTENT AREA: TAB CONTENTS (8 cols) */}
        <main className="lg:col-span-8 xl:col-span-8 space-y-6 min-w-0">
          {/* TAB 1: KNOWLEDGE GRAPH */}
          {activeTab === "graph" && (
            <div className="space-y-6">
              {!graph ? (
                graphError ? (
                  <EmptyState
                    title="Knowledge Graph Unavailable"
                    description="Could not extract knowledge graph for this lecture. Ensure backend is running."
                  />
                ) : (
                  <Skeleton className="h-96" />
                )
              ) : (
                <>
                  {/* Summary Metric Counters */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="rounded-2xl bg-white dark:bg-[#0B1020] border border-slate-200 dark:border-white/10 p-5 shadow-sm space-y-1">
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Concepts Identified
                      </span>
                      <p className="text-3xl sm:text-4xl font-mono font-black text-slate-900 dark:text-white">
                        {graph.concepts.length}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white dark:bg-[#0B1020] border border-slate-200 dark:border-white/10 p-5 shadow-sm space-y-1">
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Graph Nodes
                      </span>
                      <p className="text-3xl sm:text-4xl font-mono font-black text-brand-indigo">
                        {graph.nodes.length}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white dark:bg-[#0B1020] border border-slate-200 dark:border-white/10 p-5 shadow-sm space-y-1">
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Multimodal Links
                      </span>
                      <p className="text-3xl sm:text-4xl font-mono font-black text-emerald-500">
                        {graph.edges.length}
                      </p>
                    </div>
                  </div>

                  {/* Concept List Card */}
                  <div className="rounded-2xl bg-white dark:bg-[#0B1020] border border-slate-200 dark:border-white/10 p-6 sm:p-7 shadow-sm space-y-5">
                    <div className="space-y-1 border-b border-slate-200 dark:border-white/10 pb-4">
                      <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-white">
                        Grounded Concept Mapping
                      </h2>
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        Key terms detected across speech transcripts and on-screen keyframes.
                      </p>
                    </div>

                    <div className="space-y-3">
                      {graph.concepts.map((c: KnowledgeConcept) => {
                        const isOpen = openLabel === c.label;
                        const sInfo = statusInfo(c.status);

                        return (
                          <div
                            key={c.concept_id || c.slug}
                            className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] p-4 sm:p-5 shadow-sm transition hover:border-brand-indigo/40"
                          >
                            <div
                              onClick={() => setOpenLabel(isOpen ? null : c.label)}
                              className="flex cursor-pointer items-center justify-between gap-4"
                            >
                              <div className="flex flex-wrap items-center gap-3 min-w-0">
                                <span className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                                  {c.label}
                                </span>
                                <span className={cn("px-3 py-1 rounded-full text-xs font-mono font-bold border", sInfo.badgeClass)}>
                                  {sInfo.label}
                                </span>
                              </div>
                              <ChevronDown className={cn("size-5 text-slate-400 transition-transform shrink-0", isOpen && "rotate-180")} />
                            </div>

                            {isOpen && (
                              <div className="mt-4 space-y-3 border-t border-slate-200 dark:border-white/10 pt-4 text-sm text-slate-700 dark:text-slate-300">
                                {c.speech && c.speech.length > 0 && (
                                  <div className="rounded-xl bg-slate-100 dark:bg-white/5 p-4 border border-slate-200 dark:border-white/10 space-y-1.5">
                                    <span className="font-bold text-slate-900 dark:text-white block">
                                      Spoken in Transcript:
                                    </span>
                                    <p className="italic text-slate-800 dark:text-slate-200">
                                      &ldquo;{c.speech[0].snippet}&rdquo;
                                    </p>
                                    {c.speech[0].start != null && (
                                      <Link
                                        href={`/lectures/${selectedId}?t=${c.speech[0].start}`}
                                        className="inline-flex items-center gap-1.5 font-bold font-mono text-xs text-brand-indigo hover:underline pt-1"
                                      >
                                        <Play className="size-3.5 fill-current" />
                                        <span>Jump to timestamp {formatClock(c.speech[0].start)}</span>
                                      </Link>
                                    )}
                                  </div>
                                )}

                                {c.visual && c.visual.length > 0 && (
                                  <div className="rounded-xl bg-blue-50/70 dark:bg-blue-950/30 p-4 border border-blue-200 dark:border-blue-900/30 space-y-1.5">
                                    <span className="font-bold text-blue-950 dark:text-blue-200 block">
                                      Shown Visually on Screen:
                                    </span>
                                    <p className="text-slate-800 dark:text-slate-200 font-mono text-xs">
                                      {c.visual[0].snippet || c.visual[0].visual_type || "visual frame detected"}
                                    </p>
                                    {c.visual[0].start != null && (
                                      <Link
                                        href={`/lectures/${selectedId}?t=${c.visual[0].start}`}
                                        className="inline-flex items-center gap-1.5 font-bold font-mono text-xs text-brand-indigo hover:underline pt-1"
                                      >
                                        <ScanText className="size-3.5" />
                                        <span>Jump to visual frame {formatClock(c.visual[0].start)}</span>
                                      </Link>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 2: LEARNING GAPS */}
          {activeTab === "gaps" && (
            <div className="space-y-6">
              {!gaps ? (
                <Skeleton className="h-96" />
              ) : (
                <>
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 sm:p-7 shadow-sm space-y-5">
                    <div className="space-y-1 border-b border-amber-500/20 pb-4">
                      <h2 className="text-xl sm:text-2xl font-display font-bold text-amber-900 dark:text-amber-300">
                        Lecture Learning Gaps
                      </h2>
                      <p className="text-sm sm:text-base text-amber-800/90 dark:text-slate-300">
                        Concepts that appear visually on screen or in quizzes but lack sufficient spoken explanations.
                      </p>
                    </div>

                    {gaps.gaps.length === 0 ? (
                      <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                        ✓ No cross-modal learning gaps detected in this lecture!
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {gaps.gaps.map((gap: LearningGap, i: number) => (
                          <div
                            key={i}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl bg-white dark:bg-[#0B1020] border border-amber-500/20 dark:border-white/10 p-4 sm:p-5 shadow-sm"
                          >
                            <div className="space-y-1 min-w-0">
                              <span className="text-base sm:text-lg font-bold text-slate-900 dark:text-white block truncate">
                                {gap.concept}
                              </span>
                              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                                {gap.reason?.[0] || "Visual topic shown with limited verbal coverage"}
                              </p>
                            </div>
                            <span className="shrink-0 px-3.5 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-xs font-mono font-bold w-fit">
                              Missing Verbal Context
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {studentGaps && (
                    <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B1020] p-6 sm:p-7 shadow-sm space-y-5">
                      <div className="space-y-1 border-b border-slate-200 dark:border-white/10 pb-4">
                        <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-white">
                          Student-Specific Knowledge Gaps
                        </h2>
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          Tailored to student {studentId} quiz performance and assessment history.
                        </p>
                      </div>

                      {studentGaps.gaps.length === 0 ? (
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          No student-specific weaknesses recorded yet for this lecture.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {studentGaps.gaps.map((w: StudentGap, idx: number) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] p-4 sm:p-5"
                            >
                              <div className="space-y-1 min-w-0">
                                <span className="text-base font-bold text-slate-900 dark:text-white block">
                                  {w.concept}
                                </span>
                                <p className="text-xs sm:text-sm font-mono text-slate-600 dark:text-slate-400">
                                  Accuracy: {Math.round((w.accuracy ?? 0) * 100)}% ({w.wrong} missed)
                                </p>
                              </div>
                              <span className="shrink-0 px-3 py-1 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-mono font-bold">
                                Needs Review
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* TAB 3: ADAPTIVE QUIZ & SEMANTIC GRADING */}
          {activeTab === "quiz" && (
            <div className="space-y-6">
              {!quiz ? (
                <EmptyState
                  title="No Quiz Available"
                  description="A quiz has not been generated for this lecture yet. Process the video with quiz generation enabled."
                />
              ) : (
                <form onSubmit={handleQuizSubmit} className="space-y-6">
                  <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B1020] p-6 sm:p-8 shadow-sm space-y-6">
                    <div className="space-y-1 border-b border-slate-200 dark:border-white/10 pb-4">
                      <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-white">
                        Lecture Assessment &amp; Adaptive Quiz
                      </h2>
                      <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300">
                        Answer the questions below to test your understanding. Short answers are evaluated via semantic AI grading.
                      </p>
                    </div>

                    <div className="space-y-6">
                      {quiz.questions.map((q, idx) => (
                        <div
                          key={idx}
                          className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] p-5 sm:p-6 space-y-4"
                        >
                          <p className="text-base sm:text-lg font-display font-semibold text-slate-900 dark:text-white leading-relaxed">
                            {idx + 1}. {q.question}
                          </p>

                          {q.type === "multiple_choice" ? (
                            <div className="space-y-2.5">
                              {q.options?.map((opt, oIdx) => (
                                <label
                                  key={oIdx}
                                  className={cn(
                                    "flex cursor-pointer items-center gap-3.5 p-4 rounded-xl border text-sm sm:text-base font-medium transition-all",
                                    answers[String(idx)] === opt
                                      ? "border-brand-indigo bg-brand-indigo/15 text-slate-900 dark:text-white ring-1 ring-brand-indigo/40"
                                      : "border-slate-200 dark:border-white/10 bg-white dark:bg-[#0D1224] text-slate-800 dark:text-slate-200 hover:border-brand-indigo/40"
                                  )}
                                >
                                  <input
                                    type="radio"
                                    name={`q_${idx}`}
                                    value={opt}
                                    checked={answers[String(idx)] === opt}
                                    onChange={(e) => setAnswers({ ...answers, [String(idx)]: e.target.value })}
                                    className="size-4 text-brand-indigo focus:ring-brand-indigo"
                                  />
                                  <span>{opt}</span>
                                </label>
                              ))}
                            </div>
                          ) : (
                            <div>
                              <textarea
                                value={answers[String(idx)] || ""}
                                onChange={(e) => setAnswers({ ...answers, [String(idx)]: e.target.value })}
                                placeholder="Explain your answer concisely based on the lecture evidence..."
                                rows={3}
                                className="w-full min-h-[90px] rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-[#0D1224] p-3.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-brand-indigo focus:outline-none"
                              />
                            </div>
                          )}

                          {quizResult?.results?.[idx] && (
                            <div
                              className={cn(
                                "flex items-start gap-3 rounded-xl p-4 text-sm font-medium",
                                quizResult.results[idx].correct
                                  ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                                  : "bg-rose-500/15 border border-rose-500/30 text-rose-800 dark:text-rose-300"
                              )}
                            >
                              {quizResult.results[idx].correct ? (
                                <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                              ) : (
                                <XCircle className="size-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                              )}
                              <div className="space-y-1">
                                <span className="font-bold text-base block">
                                  {quizResult.results[idx].correct ? "Correct!" : "Needs Improvement"}
                                </span>
                                <p className="leading-relaxed">{quizResult.results[idx].feedback}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}

                      {quizError && <p className="text-sm font-bold text-rose-500">{quizError}</p>}

                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200 dark:border-white/10">
                        {quizResult ? (
                          <div className="flex items-center gap-3">
                            <span className="text-base font-bold text-slate-900 dark:text-white">
                              Assessment Score:
                            </span>
                            <span
                              className={cn(
                                "px-4 py-1.5 rounded-full text-base font-mono font-black border",
                                quizResult.score_percent >= 75
                                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                  : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                              )}
                            >
                              {Math.round(quizResult.score_percent)}%
                            </span>
                          </div>
                        ) : (
                          <div />
                        )}

                        <Button
                          type="submit"
                          disabled={quizBusy}
                          size="lg"
                          className="gap-2.5 bg-brand-indigo hover:bg-brand-indigo/90 text-white font-bold text-base px-8 py-3.5 shadow-lg shadow-brand-indigo/30"
                        >
                          {quizBusy ? <Spinner className="size-5" /> : <Send className="size-5" />}
                          <span>Submit for Semantic AI Grading</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 4: STUDENT PROGRESS */}
          {activeTab === "progress" && (
            <div className="space-y-6">
              {nextAction && (
                <div className="rounded-2xl border-2 border-brand-indigo/40 bg-brand-indigo/10 p-6 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-brand-indigo">
                      <Sparkles className="size-4" />
                      AI Next Best Action (NBA)
                    </span>
                    <span className="px-3 py-1 rounded-full bg-brand-indigo/20 text-brand-indigo text-xs font-bold font-mono">
                      Adaptive Recommendation
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                    {nextAction.label || nextAction.action_type || "Recommended Step"}
                  </h3>
                  <p className="text-sm sm:text-base text-slate-700 dark:text-slate-200 leading-relaxed">
                    {nextAction.reasoning}
                  </p>
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B1020] p-6 sm:p-7 shadow-sm space-y-6">
                <div className="space-y-1 border-b border-slate-200 dark:border-white/10 pb-4">
                  <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-white">
                    Student Performance &amp; Mastery
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Summary for student {studentId}: {progress?.summary?.completed_lectures ?? 0} lectures completed, avg score: {Math.round(progress?.summary?.average_score ?? 0)}%.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 space-y-1">
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Lectures Completed
                    </span>
                    <p className="text-3xl font-mono font-black text-slate-900 dark:text-white">
                      {progress?.summary?.completed_lectures ?? 0}
                    </p>
                  </div>
                  <div className="p-5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 space-y-1">
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Average Mastery Score
                    </span>
                    <p className="text-3xl font-mono font-black text-brand-indigo">
                      {Math.round(progress?.summary?.average_score ?? 0)}%
                    </p>
                  </div>
                </div>

                {!progress?.strong_topics || progress.strong_topics.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    No mastery data recorded for this student yet. Complete a quiz to populate mastery levels.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Demonstrated Strong Topics
                    </p>
                    <div className="flex flex-wrap gap-2.5">
                      {progress.strong_topics.map((t, idx) => {
                        const name = typeof t === "string" ? t : t.topic || "Topic";
                        const score = typeof t === "string" ? null : t.score;
                        return (
                          <span
                            key={idx}
                            className="px-3.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-xs sm:text-sm font-semibold text-emerald-600 dark:text-emerald-400"
                          >
                            {name} {score !== null && score !== undefined ? `(${score}%)` : ""}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {progress?.lecture_history && progress.lecture_history.length > 0 && (
                  <div className="space-y-3 border-t border-slate-200 dark:border-white/10 pt-4">
                    <p className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Recent Lecture Assessment Attempts
                    </p>
                    <div className="space-y-2">
                      {progress.lecture_history.slice(0, 5).map((h, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 p-3.5 text-sm"
                        >
                          <span className="font-bold text-slate-900 dark:text-white">
                            {h.title || h.lecture || "Lecture Assessment"}
                          </span>
                          <span className="font-mono font-bold text-brand-indigo">
                            {h.last_score_percent ?? h.best_score ?? 0}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: AI LEARNING AGENT */}
          {activeTab === "agent" && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B1020] p-6 sm:p-8 shadow-sm space-y-6">
                <div className="space-y-1 border-b border-slate-200 dark:border-white/10 pb-4">
                  <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="size-6 text-brand-indigo" />
                    <span>Personal Learning Agent Insights</span>
                  </h2>
                  <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300">
                    Adaptive recommendations synthesized from student performance, quiz attempts, and modality preferences.
                  </p>
                </div>

                {!agentView ? (
                  <Skeleton className="h-48" />
                ) : (
                  <div className="space-y-6">
                    {agentView.insights && agentView.insights.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          Agent Observations
                        </p>
                        <div className="space-y-3">
                          {agentView.insights.map((ins, i) => (
                            <div
                              key={i}
                              className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] p-4 space-y-1"
                            >
                              <span className="font-mono font-bold text-brand-indigo uppercase text-xs block">
                                {ins.kind}
                              </span>
                              <p className="text-sm sm:text-base text-slate-800 dark:text-slate-200 leading-relaxed">
                                {ins.text}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-white/10">
                      <p className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Recommended Next Steps
                      </p>
                      <div className="space-y-3">
                        {agentView.recommended_actions.map((act: RecommendedAction, idx: number) => (
                          <div
                            key={idx}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] p-5"
                          >
                            <div className="space-y-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                                  {act.label || act.action_type}
                                </span>
                                {act.concept && (
                                  <span className="px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30 text-xs font-mono font-bold">
                                    {act.concept}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                                {act.reasoning}
                              </p>
                            </div>

                            {act.lecture_id && (
                              <Link href={`/lectures/${act.lecture_id}${act.timestamp ? `?t=${act.timestamp}` : ""}`}>
                                <Button
                                  size="sm"
                                  className="shrink-0 gap-1.5 bg-brand-indigo hover:bg-brand-indigo/90 text-white font-bold"
                                >
                                  <Play className="size-3.5 fill-current" />
                                  <span>Open Lecture</span>
                                </Button>
                              </Link>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
