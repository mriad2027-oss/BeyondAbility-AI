import type { AskResponse, LectureRecord, LearningProgress, MetricsResponse } from "@/types/backend";
import { fileBaseName } from "@/lib/format";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export const apiBase = () => API_BASE.replace(/\/$/, "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
      else if (Array.isArray(body?.detail)) detail = body.detail.map((d: { msg?: string }) => d.msg).join("; ");
    } catch {
      /* keep default */
    }
    throw new ApiError(res.status, detail);
  }
  return (await res.json()) as T;
}

export async function getHealth() {
  return request<{ status: string; service: string; version: string }>("/health");
}

export async function getSystemStatus() {
  return request<import("@/types/backend").SystemStatus>("/system/status");
}

export async function listLectures() {
  return request<{ lectures: LectureRecord[] }>("/lectures");
}

export async function getResult(jobId: string) {
  return request<Record<string, unknown>>(`/result/${encodeURIComponent(jobId)}`);
}

export async function getPipelineStatus(jobId: string) {
  return request<import("@/types/backend").PipelineStatus>(
    `/lectures/${encodeURIComponent(jobId)}/pipeline-status`
  );
}

export async function getTimeline(jobId: string) {
  return request<import("@/types/backend").TimelineResponse>(
    `/lectures/${encodeURIComponent(jobId)}/timeline`
  );
}

export async function getMissing(jobId: string, mode = "blind") {
  return request<import("@/types/backend").MissingResponse>(
    `/lectures/${encodeURIComponent(jobId)}/missing?mode=${encodeURIComponent(mode)}`
  );
}

export async function getVisualEvents(jobId: string) {
  return request<import("@/types/backend").VisualEventsResponse>(
    `/lectures/${encodeURIComponent(jobId)}/visual-events`
  );
}

export async function getVisualUnderstanding(jobId: string) {
  return request<import("@/types/backend").VisualUnderstandingResponse>(
    `/lectures/${encodeURIComponent(jobId)}/visual-understanding`
  );
}

export async function getAudioDescription(jobId: string) {
  return request<import("@/types/backend").AudioDescriptionResponse>(
    `/lectures/${encodeURIComponent(jobId)}/audio-description`
  );
}

export async function getTranscript(jobId: string) {
  return request<{ transcript_text: string; segments: import("@/types/backend").TranscriptSegment[] }>(
    `/lectures/${encodeURIComponent(jobId)}/transcript`
  );
}

export async function getAccessibility(jobId: string, mode = "blind") {
  return request<import("@/types/backend").AccessibilityResult>(
    `/lectures/${encodeURIComponent(jobId)}/accessibility?mode=${encodeURIComponent(mode)}`
  );
}

export async function getAccessibilityScore(jobId: string) {
  return request<import("@/types/backend").AccessibilityScore>(
    `/lectures/${encodeURIComponent(jobId)}/accessibility-score`
  );
}

export async function getAccessibilityReport(jobId: string) {
  return request<import("@/types/backend").AccessibilityReport>(
    `/lectures/${encodeURIComponent(jobId)}/report`
  );
}

export async function getMetrics(jobId: string) {
  return request<MetricsResponse>(`/lectures/${encodeURIComponent(jobId)}/metrics`);
}

export async function getPresentation(jobId: string) {
  return request<Record<string, unknown>>(`/lectures/${encodeURIComponent(jobId)}/presentation`);
}

export async function getReplay(jobId: string, timestamp: number) {
  return request<import("@/types/backend").ReplayResponse>(
    `/lectures/${encodeURIComponent(jobId)}/replay?timestamp=${encodeURIComponent(String(timestamp))}`
  );
}

export async function askQuestion(jobId: string, question: string): Promise<AskResponse> {
  return request<AskResponse>("/ask", {
    method: "POST",
    body: JSON.stringify({ job_id: jobId, question }),
  });
}

export async function listQuizzes() {
  return request<{ quizzes: string[] }>("/quizzes");
}

export async function getQuiz(quizId: string) {
  return request<import("@/types/backend").Quiz>(`/quizzes/${encodeURIComponent(quizId)}`);
}

export async function submitQuiz(payload: {
  quiz_id: string;
  answers: Record<string, string>;
  lesson_title?: string;
  student_id?: string;
}) {
  return request<import("@/types/backend").QuizSubmissionResponse>("/quizzes/submit", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listStudents() {
  return request<{ students: import("@/types/backend").StudentRecord[] }>("/students");
}

export async function getStudent(studentId: string) {
  return request<import("@/types/backend").StudentDetail>(`/students/${encodeURIComponent(studentId)}`);
}

export async function getStudentProgress(studentId: string): Promise<LearningProgress> {
  return request<LearningProgress>(
    `/students/${encodeURIComponent(studentId)}/progress`
  );
}

export async function getKnowledgeGraph(jobId: string) {
  return request<import("@/types/backend").KnowledgeGraphResponse>(
    `/lectures/${encodeURIComponent(jobId)}/knowledge-graph`
  );
}

export async function getConcepts(jobId: string) {
  return request<import("@/types/backend").ConceptsResponse>(
    `/lectures/${encodeURIComponent(jobId)}/concepts`
  );
}

export async function getLectureGaps(jobId: string) {
  return request<import("@/types/backend").LearningGapsResponse>(
    `/lectures/${encodeURIComponent(jobId)}/learning-gaps`
  );
}

export async function explainConcept(jobId: string, concept: string) {
  return request<import("@/types/backend").ConceptExplanation>(
    `/lectures/${encodeURIComponent(jobId)}/concepts/${encodeURIComponent(concept)}/explain`
  );
}

export async function getStudentLectureGaps(jobId: string, studentId: string) {
  return request<import("@/types/backend").StudentGapsResponse>(
    `/lectures/${encodeURIComponent(jobId)}/students/${encodeURIComponent(studentId)}/learning-gaps`
  );
}

export async function getLearningAgent(studentId: string) {
  return request<import("@/types/backend").LearningAgentView>(
    `/students/${encodeURIComponent(studentId)}/learning-agent`
  );
}

export async function getNextAction(studentId: string) {
  return request<import("@/types/backend").NextActionResponse>(
    `/students/${encodeURIComponent(studentId)}/next-action`
  );
}

export async function getLearningInsights(studentId: string) {
  return request<import("@/types/backend").LearningInsightsResponse>(
    `/students/${encodeURIComponent(studentId)}/learning-insights`
  );
}

export async function saveProfile(payload: import("@/types/backend").ProfileUpdatePayload) {
  return request<{ status: string; profile: import("@/types/backend").StudentProfile }>(
    `/students/${encodeURIComponent(payload.student_id)}/profile`,
    { method: "POST", body: JSON.stringify(payload) }
  );
}

export async function uploadVideo(file: File) {
  const form = new FormData();
  form.append("file", file);
  return request<{ job_id: string; filename: string; size_bytes: number }>("/upload", {
    method: "POST",
    body: form,
  });
}

export async function startProcessing(payload: {
  job_id: string;
  mode?: string;
  student_id?: string;
  accessibility_mode?: string;
}) {
  return request<{ job_id: string; status: string }>("/process", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function videoUrl(job: Record<string, unknown>): string | null {
  const result = (job?.result as Record<string, unknown> | undefined) ?? {};
  const videoPath =
    (result.video_path as string | undefined) ??
    (job?.video_path as string | undefined);
  if (!videoPath) return null;
  return `${apiBase()}/files/videos/${fileBaseName(videoPath)}`;
}

export function narrationUrl(result: { narration_audio_path?: string } | undefined): string | null {
  if (!result?.narration_audio_path) return null;
  return `${apiBase()}/files/outputs/${fileBaseName(result.narration_audio_path)}`;
}

export function eventAudioUrl(
  result: { accessibility_events?: Array<{ start: number; narration_audio_path?: string }> },
  start: number | null | undefined
): string | null {
  if (!result || start == null) return null;
  const ev = (result.accessibility_events ?? []).find(
    (e) => Math.abs(Number(e.start) - Number(start)) < 0.01
  );
  if (!ev?.narration_audio_path) return null;
  return `${apiBase()}/files/outputs/${fileBaseName(ev.narration_audio_path)}`;
}

/**
 * Resolve a backend file URL to an absolute, browser-fetchable URL.
 * The backend's /audio-description endpoint returns relative /files/... paths,
 * which must be anchored to the backend base URL or `new Audio(...)` would
 * resolve them against the frontend origin (where no /files route exists).
 */
export function resolveFileUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${apiBase()}${url.startsWith("/") ? url : `/${url}`}`;
}

export async function checkBackend(): Promise<boolean> {
  try {
    await getHealth();
    return true;
  } catch {
    return false;
  }
}

export interface AssistantChatPayload {
  message: string;
  context?: {
    page?: string;
    lecture_id?: string;
    timestamp?: number;
    current_segment?: string;
    current_concept?: string;
    accessibility_mode?: string;
  };
  history?: Array<{ role: string; content: string }>;
}

export interface AssistantChatResponse {
  reply: string;
  action?: string | null;
  action_payload?: Record<string, unknown>;
  evidence?: Array<{ time?: string; type?: string; snippet?: string }>;
}

export async function assistantChat(payload: AssistantChatPayload): Promise<AssistantChatResponse> {
  return request<AssistantChatResponse>("/api/v1/assistant/chat", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function* assistantStream(payload: AssistantChatPayload): AsyncGenerator<{ token: string; done: boolean; action?: string; action_payload?: Record<string, unknown> }, void, unknown> {
  const res = await fetch(`${apiBase()}/api/v1/assistant/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok || !res.body) {
    const errorText = await res.text().catch(() => "Streaming request failed");
    throw new ApiError(res.status, errorText);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("data:")) {
        const jsonStr = trimmed.slice(5).trim();
        if (!jsonStr) continue;
        try {
          const parsed = JSON.parse(jsonStr);
          yield parsed;
        } catch {
          // ignore malformed line
        }
      }
    }
  }
}
