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
      <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading Learning Intelligence...</div>}>
        <LearningIntelligenceBody />
      </Suspense>
    </WorkspaceProvider>
  );
}

function statusInfo(status: string) {
  switch (status) {
    case "EXPLAINED":
      return { variant: "info" as const, label: "Explained in speech" };
    case "PARTIALLY_EXPLAINED":
      return { variant: "violet" as const, label: "Explained + shown" };
    case "VISUALLY_SHOWN":
      return { variant: "warning" as const, label: "Shown on screen" };
    case "ASSESSED":
      return { variant: "warning" as const, label: "Assessed" };
    case "MISSING_EXPLANATION":
      return { variant: "danger" as const, label: "Missing explanation" };
    default:
      return { variant: "danger" as const, label: "Unknown" };
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
    <div className="mx-auto max-w-7xl space-y-6 pb-12 min-w-0 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between min-w-0">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600">
              <BrainCircuit className="size-6" aria-hidden />
            </span>
            <span className="truncate">Learning Intelligence</span>
          </h1>
          <p className="mt-1 text-sm text-app-soft">
            Evidence-grounded concept graphs, disparity gaps, adaptive quizzes with semantic grading, and student progress.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1 w-full sm:w-auto min-w-0">
          <button
            onClick={() => setActiveTab("graph")}
            className={cn(
              "flex flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-lg px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold transition-all",
              activeTab === "graph" ? "bg-white text-brand-indigo shadow-sm" : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Network className="size-3.5 sm:size-4" />
            <span className="truncate">Knowledge Graph</span>
          </button>
          <button
            onClick={() => setActiveTab("gaps")}
            className={cn(
              "flex flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-lg px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold transition-all",
              activeTab === "gaps" ? "bg-white text-brand-indigo shadow-sm" : "text-slate-600 hover:text-slate-900"
            )}
          >
            <AlertTriangle className="size-3.5 sm:size-4" />
            <span className="truncate">Learning Gaps</span>
          </button>
          <button
            onClick={() => setActiveTab("quiz")}
            className={cn(
              "flex flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-lg px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold transition-all",
              activeTab === "quiz" ? "bg-white text-brand-indigo shadow-sm" : "text-slate-600 hover:text-slate-900"
            )}
          >
            <ListChecks className="size-3.5 sm:size-4" />
            <span className="truncate">Adaptive Quiz</span>
          </button>
          <button
            onClick={() => setActiveTab("progress")}
            className={cn(
              "flex flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-lg px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold transition-all",
              activeTab === "progress" ? "bg-white text-brand-indigo shadow-sm" : "text-slate-600 hover:text-slate-900"
            )}
          >
            <TrendingUp className="size-3.5 sm:size-4" />
            <span className="truncate">Student Progress</span>
          </button>
          <button
            onClick={() => setActiveTab("agent")}
            className={cn(
              "flex flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-lg px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold transition-all",
              activeTab === "agent" ? "bg-white text-brand-indigo shadow-sm" : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Sparkles className="size-3.5 sm:size-4" />
            <span className="truncate">Learning Agent</span>
          </button>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Left Side: Selectors */}
        <aside className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Lecture Context</CardTitle>
              <CardDescription className="text-xs">Select a lecture to view intelligence models.</CardDescription>
            </CardHeader>
            <CardContent>
              <LecturePicker compact />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Student Profile</CardTitle>
              <CardDescription className="text-xs">Simulate adaptive learning &amp; recommendations.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <select
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs text-slate-800 focus:border-brand-indigo focus:outline-none"
              >
                {students.map((s) => (
                  <option key={s.student_id} value={s.student_id}>
                    {s.name || `Student ${s.student_id}`} ({s.accessibility_mode})
                  </option>
                ))}
              </select>

              {nextAction && (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-brand-indigo">
                    <Sparkles className="size-3.5" />
                    Next Best Action (NBA)
                  </div>
                  <p className="mt-1 text-slate-700 leading-relaxed font-semibold">{nextAction.label || nextAction.action_type}</p>
                  <p className="mt-0.5 text-slate-600 leading-relaxed">{nextAction.reasoning}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </aside>

        {/* Right Side: Tab Contents */}
        <main className="min-w-0">
          {/* TAB 1: KNOWLEDGE GRAPH */}
          {activeTab === "graph" && (
            <div className="space-y-4">
              {!graph ? (
                graphError ? (
                  <EmptyState title="Knowledge Graph Unavailable" description="Could not extract knowledge graph for this lecture." />
                ) : (
                  <Skeleton className="h-96" />
                )
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Card className="p-4">
                      <span className="text-xs font-semibold text-app-soft uppercase tracking-wider">Concepts</span>
                      <p className="mt-1 text-2xl font-bold text-slate-900">{graph.concepts.length}</p>
                    </Card>
                    <Card className="p-4">
                      <span className="text-xs font-semibold text-app-soft uppercase tracking-wider">Graph Nodes</span>
                      <p className="mt-1 text-2xl font-bold text-brand-indigo">{graph.nodes.length}</p>
                    </Card>
                    <Card className="p-4">
                      <span className="text-xs font-semibold text-app-soft uppercase tracking-wider">Multimodal Links</span>
                      <p className="mt-1 text-2xl font-bold text-emerald-600">{graph.edges.length}</p>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Grounded Concept Mapping</CardTitle>
                      <CardDescription>
                        Key terms detected across speech transcripts and on-screen keyframes.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {graph.concepts.map((c: KnowledgeConcept) => {
                        const isOpen = openLabel === c.label;
                        const sInfo = statusInfo(c.status);

                        return (
                          <div
                            key={c.concept_id || c.slug}
                            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-indigo/40"
                          >
                            <div
                              onClick={() => setOpenLabel(isOpen ? null : c.label)}
                              className="flex cursor-pointer items-center justify-between"
                            >
                              <div className="flex items-center gap-3">
                                <span className="font-semibold text-slate-900">{c.label}</span>
                                <Badge variant={sInfo.variant}>{sInfo.label}</Badge>
                              </div>
                              <ChevronDown className={cn("size-4 text-slate-400 transition-transform", isOpen && "rotate-180")} />
                            </div>

                            {isOpen && (
                              <div className="mt-4 space-y-3 border-t border-slate-100 pt-3 text-xs text-slate-600">
                                {c.speech && c.speech.length > 0 && (
                                  <div className="rounded-lg bg-slate-50 p-2.5">
                                    <span className="font-semibold text-slate-800">Spoken in transcript: </span>
                                    <span>&ldquo;{c.speech[0].snippet}&rdquo;</span>
                                    {c.speech[0].start != null && (
                                      <Link
                                        href={`/lectures/${selectedId}?t=${c.speech[0].start}`}
                                        className="ml-2 inline-flex items-center gap-1 font-semibold text-brand-indigo hover:underline"
                                      >
                                        <Play className="size-3" />
                                        {formatClock(c.speech[0].start)}
                                      </Link>
                                    )}
                                  </div>
                                )}

                                {c.visual && c.visual.length > 0 && (
                                  <div className="rounded-lg bg-blue-50/50 p-2.5">
                                    <span className="font-semibold text-slate-800">Shown visually on screen: </span>
                                    <span>{c.visual[0].snippet || c.visual[0].visual_type || "visual frame"}</span>
                                    {c.visual[0].start != null && (
                                      <Link
                                        href={`/lectures/${selectedId}?t=${c.visual[0].start}`}
                                        className="ml-2 inline-flex items-center gap-1 font-semibold text-brand-indigo hover:underline"
                                      >
                                        <ScanText className="size-3" />
                                        {formatClock(c.visual[0].start)}
                                      </Link>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          )}

          {/* TAB 2: LEARNING GAPS */}
          {activeTab === "gaps" && (
            <div className="space-y-4">
              {!gaps ? (
                <Skeleton className="h-96" />
              ) : (
                <>
                  <Card className="border-amber-200 bg-amber-50/40">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base text-amber-900">Lecture Learning Gaps</CardTitle>
                      <CardDescription className="text-amber-800/80">
                        Concepts that appear on screen or in quizzes but lack clear spoken explanations.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {gaps.gaps.length === 0 ? (
                        <p className="text-sm font-medium text-emerald-700">✓ No learning gaps detected in this lecture!</p>
                      ) : (
                        <div className="space-y-2">
                          {gaps.gaps.map((gap: LearningGap, i: number) => (
                            <div key={i} className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm">
                              <div>
                                <span className="font-semibold text-slate-900">{gap.concept}</span>
                                <p className="text-xs text-slate-500">{gap.reason?.[0] || "Visual topic shown with limited verbal coverage"}</p>
                              </div>
                              <Badge variant="warning">Missing Verbal Context</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {studentGaps && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Student-Specific Knowledge Gaps</CardTitle>
                        <CardDescription>Tailored to {studentId} quiz performance and assessment history.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {studentGaps.gaps.length === 0 ? (
                          <p className="text-sm text-slate-600">No student-specific weaknesses recorded yet for this lecture.</p>
                        ) : (
                          <div className="space-y-2">
                            {studentGaps.gaps.map((w: StudentGap, idx: number) => (
                              <div key={idx} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                                <div>
                                  <span className="font-semibold text-slate-800">{w.concept}</span>
                                  <p className="text-xs text-slate-500">
                                    Accuracy: {Math.round((w.accuracy ?? 0) * 100)}% ({w.wrong} missed)
                                  </p>
                                </div>
                                <Badge variant="danger">Needs Review</Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </div>
          )}

          {/* TAB 3: ADAPTIVE QUIZ & SEMANTIC GRADING */}
          {activeTab === "quiz" && (
            <div className="space-y-4">
              {!quiz ? (
                <EmptyState
                  title="No Quiz Available"
                  description="A quiz has not been generated for this lecture yet. Process the video with quiz generation enabled."
                />
              ) : (
                <form onSubmit={handleQuizSubmit} className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Lecture Assessment</CardTitle>
                      <CardDescription>
                        Answer the questions below to test your understanding. Short answers are evaluated via semantic AI grading.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {quiz.questions.map((q, idx) => (
                        <div key={idx} className="rounded-xl border border-slate-200 p-4">
                          <p className="font-semibold text-slate-900">
                            {idx + 1}. {q.question}
                          </p>

                          {q.type === "multiple_choice" ? (
                            <div className="mt-3 space-y-2">
                              {q.options?.map((opt, oIdx) => (
                                <label key={oIdx} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                                  <input
                                    type="radio"
                                    name={`q_${idx}`}
                                    value={opt}
                                    checked={answers[String(idx)] === opt}
                                    onChange={(e) => setAnswers({ ...answers, [String(idx)]: e.target.value })}
                                    className="text-brand-indigo focus:ring-brand-indigo"
                                  />
                                  <span>{opt}</span>
                                </label>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-3">
                              <textarea
                                value={answers[String(idx)] || ""}
                                onChange={(e) => setAnswers({ ...answers, [String(idx)]: e.target.value })}
                                placeholder="Explain your answer concisely..."
                                rows={2}
                                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-brand-indigo focus:outline-none focus:ring-1 focus:ring-brand-indigo"
                              />
                            </div>
                          )}

                          {quizResult?.results?.[idx] && (
                            <div
                              className={cn(
                                "mt-3 flex items-start gap-2 rounded-lg p-2.5 text-xs",
                                quizResult.results[idx].correct ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
                              )}
                            >
                              {quizResult.results[idx].correct ? (
                                <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                              ) : (
                                <XCircle className="size-4 shrink-0 text-red-600" />
                              )}
                              <div>
                                <span className="font-semibold">
                                  {quizResult.results[idx].correct ? "Correct!" : "Incorrect."}
                                </span>{" "}
                                <span>{quizResult.results[idx].feedback}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}

                      {quizError && <p className="text-xs text-red-600">{quizError}</p>}

                      <div className="flex items-center justify-between pt-2">
                        {quizResult && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900">Score:</span>
                            <Badge variant={quizResult.score_percent >= 75 ? "success" : "warning"}>
                              {Math.round(quizResult.score_percent)}%
                            </Badge>
                          </div>
                        )}
                        <Button type="submit" disabled={quizBusy} className="ml-auto">
                          {quizBusy ? <Spinner className="mr-2" /> : <Send className="mr-2 size-4" />}
                          Submit for AI Grading
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </form>
              )}
            </div>
          )}

          {/* TAB 4: STUDENT PROGRESS */}
          {activeTab === "progress" && (
            <div className="space-y-4">
              {nextAction && (
                <Card className="border-indigo-100 bg-indigo-50/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-indigo">
                        <Sparkles className="size-4" />
                        AI Next Best Action (NBA)
                      </span>
                      <Badge variant="violet">Adaptive Recommendation</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-base font-bold text-slate-900">{nextAction.label || nextAction.action_type || "Recommended Step"}</p>
                    <p className="text-sm text-slate-700">{nextAction.reasoning}</p>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Student Performance &amp; Mastery</CardTitle>
                  <CardDescription>
                    Summary for student {studentId}: {progress?.summary?.completed_lectures ?? 0} lectures completed, avg score: {Math.round(progress?.summary?.average_score ?? 0)}%.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!progress?.strong_topics || progress.strong_topics.length === 0 ? (
                    <p className="text-xs text-app-soft">No mastery data recorded for this student yet. Take a quiz to populate mastery levels.</p>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Strong Topics</p>
                      <div className="flex flex-wrap gap-2">
                        {progress.strong_topics.map((t, idx) => {
                          const name = typeof t === "string" ? t : t.topic || "Topic";
                          const score = typeof t === "string" ? null : t.score;
                          return (
                            <Badge key={idx} variant="success">
                              {name} {score !== null && score !== undefined ? `(${score}%)` : ""}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {progress?.lecture_history && progress.lecture_history.length > 0 && (
                    <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
                      <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Recent Lecture Attempts</p>
                      {progress.lecture_history.slice(0, 5).map((h, idx) => (
                        <div key={idx} className="flex items-center justify-between rounded-lg bg-slate-50 p-2 text-xs">
                          <span className="font-medium text-slate-800">{h.title || h.lecture || "Lecture"}</span>
                          <span className="font-bold text-brand-indigo">{h.last_score_percent ?? h.best_score ?? 0}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 5: AI LEARNING AGENT */}
          {activeTab === "agent" && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="size-5 text-violet-600" />
                    Personal Learning Agent Insights
                  </CardTitle>
                  <CardDescription>
                    Adaptive recommendations synthesized from student performance, quiz attempts, and modality preferences.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!agentView ? (
                    <Skeleton className="h-48" />
                  ) : (
                    <>
                      {agentView.insights && agentView.insights.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-700">Agent Observations</p>
                          {agentView.insights.map((ins, i) => (
                            <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800">
                              <span className="font-bold text-brand-indigo uppercase text-[10px] block mb-1">{ins.kind}</span>
                              <p className="leading-relaxed">{ins.text}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-700">Recommended Next Steps</p>
                        {agentView.recommended_actions.map((act: RecommendedAction, idx: number) => (
                          <div key={idx} className="flex items-start justify-between rounded-xl border border-slate-200 p-3 bg-white">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-slate-900">{act.label || act.action_type}</span>
                                {act.concept && <Badge variant="info">{act.concept}</Badge>}
                              </div>
                              <p className="text-xs text-slate-600">{act.reasoning}</p>
                            </div>
                            {act.lecture_id && (
                              <Link href={`/lectures/${act.lecture_id}${act.timestamp ? `?t=${act.timestamp}` : ""}`}>
                                <Button size="sm" variant="secondary" className="shrink-0 ml-3">
                                  <Play className="size-3 mr-1" /> Open
                                </Button>
                              </Link>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
