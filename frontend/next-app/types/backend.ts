export type TrustLevel = "VERIFIED" | "UNCERTAIN" | "UNAVAILABLE" | string;

export interface LectureRecord {
  job_id: string;
  filename: string;
  status: "done" | "partial" | "processing" | "queued" | "failed" | string;
  progress?: number;
  current_stage?: string | null;
  error?: string | null;
  created_at?: string;
  updated_at?: string;
  duration?: number | null;
  student_id?: string | null;
  assets: Record<string, boolean>;
  stage_status?: Record<string, string>;
  has_result: boolean;
  cached: boolean;
}

export interface TranscriptSegment {
  id?: number;
  seek?: number;
  start: number;
  end: number;
  text: string;
  tokens?: number[];
  temperature?: number;
  avg_logprob?: number;
  compression_ratio?: number;
  no_speech_prob?: number;
}

export interface AccessibilityEvent {
  segment_id?: string;
  start: number;
  end: number;
  play_start?: number;
  transcript?: string;
  description?: string;
  should_describe?: boolean;
  priority?: string;
  importance?: number;
  reason?: string;
  confidence?: number;
  interrupts_speech?: boolean;
  source?: string;
  source_refs?: { transcript_segments?: string[]; visual_events?: string[] };
  narration_audio_path?: string;
}

export interface VisualEventItem {
  event_id?: string;
  start: number;
  end: number;
  type?: string;
  description?: string;
  transcript_context?: string;
  confidence?: number;
  source_frames?: string[];
  ocr_text?: string;
  importance?: number;
}

export interface AnalysisItem {
  lecture_id?: string;
  event_id?: string;
  start?: number;
  end?: number;
  duration?: number;
  type?: string;
  description?: string;
  ocr_text?: string;
  source?: string;
  source_refs?: Record<string, unknown>;
  importance?: number;
  visual_complement_score?: number;
  confidence?: number;
  readable?: boolean;
  trust?: TrustLevel | { trust?: TrustLevel; confidence?: number; reason?: string };
  relation_summary?: string;
  has_visual_content?: boolean;
  transcript_context?: string;
}

export interface AccessibilityResult {
  job_id?: string;
  schema_version?: string;
  language?: string;
  learning_objectives?: string[];
  important_concepts?: string[];
  accessibility_profile?: { id?: string; mode?: string; language?: string };
  visual_events?: VisualEventItem[];
  accessibility_events?: AccessibilityEvent[];
  captions?: Array<{ start: number; end: number; text: string }>;
  metrics?: Record<string, unknown>;
  summary?: Record<string, unknown>;
  quality_score?: number;
  quiz_reference?: string;
}

export interface LectureResult {
  job_id?: string;
  accessibility_events?: AccessibilityEvent[];
  accessibility_metrics?: Record<string, unknown>;
  accessibility_profile?: Record<string, unknown>;
  accessibility_quality_score?: number;
  segments?: TranscriptSegment[];
  captions?: Array<{ start: number; end: number; text: string }>;
  frames?: string[];
  full_narration?: string;
  narration_audio_path?: string;
  quiz_id?: string;
  srt_path?: string;
  stage_status?: Record<string, string>;
  transcript_path?: string;
  transcript_text?: string;
  video_metadata?: { duration?: number; width?: number; height?: number; fps?: number };
  visual_analysis?: AnalysisItem[];
  visual_events?: VisualEventItem[];
  visual_events_path?: string;
  cached?: boolean;
  accessibility_segments?: unknown;
}

export interface ResultResponse {
  job_id?: string;
  status?: string;
  progress?: number;
  current_stage?: string | null;
  error?: string | null;
  result?: LectureResult;
}

export interface ScoreComponent {
  value: number;
  label: string;
  detail: string;
  evidence_value: number;
  cap: number;
  contribution: number;
}

export interface ScoreBreakdown {
  modality_baseline: number;
  verified_remediation_benefit: number;
  unresolved_disparities_penalty: number;
  total_weighted: number;
}

export interface GapCounts {
  detected_gaps: number;
  unresolved_gaps: number;
  remediated_gaps: number;
  total_assessable_moments: number;
  flagged_for_remediation: number;
  verified_remediated: number;
}

export interface AccessibilityScore {
  job_id: string;
  score: number;
  level: string;
  trust: { trust: TrustLevel; reason: string; records: number };
  basis: string;
  components: Record<string, ScoreComponent>;
  explanation: string[];
  methodology?: string;
  confidence?: { value: number; reason: string };
  breakdown?: ScoreBreakdown;
  gap_counts?: GapCounts;
}

export interface PipelineStage {
  name: string;
  status: "completed" | "cached" | "running" | "pending" | "skipped" | "failed" | string;
  cached?: boolean;
  seconds?: number | null;
  fallback?: string | null;
  note?: string | null;
  counts?: Record<string, number>;
}

export interface PipelineStatus {
  job_id: string;
  job_status: string;
  status?: string;
  progress?: number;
  current_stage?: string | null;
  error?: string | null;
  ready: boolean;
  stages: PipelineStage[];
}

export interface MissingItem {
  timestamp: number;
  timestamp_start: number;
  timestamp_end: number;
  ts: string;
  what_you_hear: string;
  missing_information: string;
  what_you_might_miss?: string;
  why_it_matters?: string;
  source_event?: string;
  source_type?: string;
  confidence?: number;
  status?: string;
  trust?: { trust?: TrustLevel; confidence?: number; reason?: string };
  recommendation?: string;
  complement_level?: string;
  visual_type?: string;
  importance?: number;
  severity?: "low" | "medium" | "high" | string;
  evidence?: Array<{ source_type?: string; timestamp?: number; trust?: string | TrustLevel; snippet?: string }> | string | null;
}

export interface MissingResponse {
  job_id: string;
  profile_mode: string;
  summary: {
    text: string;
    statuses: Array<{ event_id?: string; status: string; coverage?: number }>;
    status_counts: Record<string, number>;
    actionable_count: number;
    overall_coverage_ratio: number;
    overall_evidence_trust: { trust: TrustLevel; reason: string; records?: number };
  };
  items: MissingItem[];
}

export interface TimelineItem {
  time: number;
  duration?: number;
  type: "speech" | "visual" | "quiz" | string;
  title: string;
  description: string;
  confidence?: number;
  source_ref?: string;
  source?: string;
  importance?: number;
  visual_complement_score?: number;
  trust?: TrustLevel | { trust?: TrustLevel; confidence?: number; reason?: string };
  ocr_text?: string;
  visual_type?: string;
  complement_level?: string;
}

export interface TimelineResponse {
  job_id: string;
  timeline: TimelineItem[];
}

export interface VisualClaim {
  claim: string;
  evidence: string;
  confidence: number;
}

export interface VisualUnderstanding {
  event_id: string;
  start: number;
  end: number;
  source_frames?: string[];
  visual_type: string;
  scene_summary: string;
  objects: string[];
  text: string[];
  layout: string;
  actions: string[];
  relationships: string[];
  ocr_text: string;
  visual_claims: VisualClaim[];
  speech_context: string;
  complement_level: string;
  complement_reason?: string;
  trust: { trust?: TrustLevel; confidence?: number; reason?: string };
  description: string;
  accessibility_description: { short: string; standard: string };
  limitations: string[];
  lecture_id?: string;
}

export interface VisualUnderstandingResponse {
  job_id: string;
  records: VisualUnderstanding[];
}

export interface VisualEventsResponse {
  job_id: string;
  events: VisualEventItem[];
  analysis: AnalysisItem[];
  understanding?: VisualUnderstanding[];
}

export interface EvidenceRecord {
  source_type?: string;
  segment_id?: string;
  event_id?: string;
  timestamp?: number;
  end_timestamp?: number;
  confidence?: number;
  trust?: TrustLevel;
  text_hint?: string;
  snippet?: string;
}

export interface AskResponse {
  answer: string;
  timestamps: number[];
  source_refs?: { transcript_segments?: string[]; visual_events?: string[] };
  evidence: EvidenceRecord[];
  trust: TrustLevel;
  trust_reason: string;
  evidence_records: number;
  status?: string;
  status_reason?: string;
  category?: string;
  why?: string[];
  conflict?: { flag: boolean; detail?: string };
  jump: {
    timestamp: number;
    end_timestamp?: number;
    source_type?: string;
    source_id?: string;
    label?: string;
  } | null;
  trust_explanation?: {
    lines: string[];
    sources_agree: boolean;
    heads_up: string;
    cap: string;
  };
}

export interface ReplayResponse {
  job_id: string;
  moment: { timestamp: number; end: number; event_id: string; type: string; seek_to: number };
  visual_event: VisualEventItem;
  transcript_context: string;
  ocr_text: string;
  readable: boolean;
  analysis?: AnalysisItem | null;
  what_you_might_miss: string;
  why_it_matters: string;
  trust: { trust: TrustLevel; reason: string };
  source_frames: string[];
}

export interface QuizQuestion {
  question: string;
  options?: string[];
  type: "multiple_choice" | "short_answer";
  concept?: string;
  source_refs?: { transcript_segments?: string[]; visual_events?: string[] };
}

export interface Quiz {
  quiz_id: string;
  questions: QuizQuestion[];
}

export interface QuizResultItem {
  question: string;
  type: string;
  chosen: string;
  answer: string;
  correct: boolean;
  score: number;
  feedback: string;
  concept: string;
  matched_concepts?: string[];
  missing_concepts?: string[];
}

export interface QuizSubmissionResponse {
  score_percent: number;
  correct_count: number;
  total: number;
  results: QuizResultItem[];
  weak_topics: Array<{ topic?: string; suggested?: string; confidence?: number }>;
  feedback: string;
  recommendation: string;
  next_difficulty: string;
  current_difficulty: string;
}

export interface StudentProfile {
  id?: string;
  accessibility_need?: string;
  preferred_output?: string;
  accessibility_mode?: string;
  speech_rate?: number;
  description_detail?: string;
  quiz_difficulty?: string;
  language?: string;
  preferred_language?: string;
  name?: string;
}

export interface StudentRecord {
  student_id: string;
  name: string;
  accessibility_mode: string;
}

export interface StudentDetail {
  student_id: string;
  profile: StudentProfile;
  history: {
    current_level?: string;
    previous_scores?: number[];
    weak_topics?: Array<{ topic: string; suggested?: string }>;
    strong_topics?: string[];
    attempts?: unknown[];
    completed_lectures?: number;
    average_score?: number;
    recent_activity?: unknown[];
  };
}

export interface ProgressPoint {
  quiz_id?: string;
  lecture?: string;
  attempts?: number;
  last_score?: number;
  best_score?: number;
  total_questions?: number;
  answered_questions?: number;
  first_attempt?: string;
  last_attempt?: string;
  title?: string;
  last_score_percent?: number;
}

export interface LearningProgress {
  student_id: string;
  generated_at: string;
  summary: {
    attempts: number;
    lectures_attempted: number;
    completed_lectures: number;
    average_score: number;
    current_difficulty: string;
    accessibility_mode: string;
    strong_topics: string[];
    based_on_history: boolean;
  };
  score_history: number[];
  lecture_history: ProgressPoint[];
  strong_topics: Array<string | { topic?: string; score?: number }>;
  repeatedly_missed: unknown[];
  needs_review: unknown[];
  next_action: {
    text: string;
    grounded_on: boolean;
    timestamp: number | null;
    source: string;
    suggested: string;
  };
}

export interface ScoreReportSection {
  segments?: number;
  transcript_segments?: number;
  words?: number;
  covered_seconds?: number;
  access?: string;
  merging_trust?: { trust: TrustLevel; reason: string };
}

export interface AccessibilityReport {
  job_id: string;
  lecture: string;
  duration_seconds: number;
  speech: ScoreReportSection;
  visual_understanding: ScoreReportSection & Record<string, unknown>;
  missing_information: ScoreReportSection & Record<string, unknown>;
  evidence: { records?: number; verified?: number; trust?: { trust: TrustLevel; reason: string } };
  accessibility_score: { score?: number; level?: string; trust?: { trust?: TrustLevel; reason?: string } };
  audio_description: { available?: boolean; events?: number | string };
  honest_statement: string;
}

export interface SystemStatus {
  status: string;
  dependencies: { ffmpeg: boolean; tesseract: boolean; whisper: boolean };
  whisper_model: string;
  tts_provider: string;
  vision_provider: string;
}

export interface ProfileUpdatePayload {
  student_id: string;
  name?: string;
  accessibility_mode: string;
  speech_rate?: number;
  description_detail?: string;
  preferred_language?: string;
  quiz_difficulty?: string;
}

export interface MetricsResponse {
  job_id: string;
  video_duration_seconds: number;
  transcript_segments: number;
  transcript_words: number;
  visual_events: number;
  visual_analysis_records: number;
  described_accessibility_events: number;
  accessibility_events: number;
  missing_information_items: number;
  quiz_questions: number;
  evidence_grounded_ask_answers: number;
  supported_ask_answers: number;
  verified_evidence_records: number;
  computed_at: string;
}

export interface AudioDescriptionCue {
  event_id: string;
  start: number;
  end: number;
  play_start: number;
  description: string;
  transcript: string;
  audio_url: string;
  audio_filename: string;
  priority: string;
  confidence: number;
  source_refs?: { transcript_segments?: string[]; visual_events?: string[] };
  visual_type?: string;
  complement_level?: string;
  verified?: boolean | null;
  accessibility_description?: string | null;
}

export interface AudioDescriptionResponse {
  job_id: string;
  available: boolean;
  source: "pipeline" | "none";
  cues: AudioDescriptionCue[];
  summary: {
    cues: number;
    covered_seconds: number;
    verified: number;
    narratable_but_no_audio: number;
  };
  reason?: string;
}

// ---------------------------------------------------------------------------
// Intelligent Multimodal Learning Engine types
// ---------------------------------------------------------------------------

export interface KnowledgeSpeechLink {
  segment_id?: string;
  timestamp: number;
  start: number;
  end: number;
  ts: string;
  type: "speech";
  snippet: string;
  match_strength?: string;
  matched_words?: string[];
}

export interface KnowledgeVisualLink {
  event_id?: string;
  timestamp: number;
  start: number;
  end: number;
  ts: string;
  type: "visual";
  visual_type?: string;
  snippet: string;
  trust?: string;
  readable?: boolean;
}

export interface KnowledgeAssessment {
  question_id?: string;
  question: string;
  type?: string;
  timestamp?: number | null;
  source_refs?: { transcript_segments?: string[]; visual_events?: string[] };
}

export interface KnowledgeConcept {
  concept_id: string;
  label: string;
  slug: string;
  source: "quiz" | "lesson_summary" | "vocabulary_matching" | string;
  assessed: boolean;
  status: string;
  status_reason?: string[];
  speech: KnowledgeSpeechLink[];
  speech_count: number;
  visual: KnowledgeVisualLink[];
  visual_count: number;
  assessment: KnowledgeAssessment[];
  assessment_count: number;
  first_timestamp: number | null;
}

export interface KnowledgeGraphNode {
  id: string;
  type: "concept" | "speech" | "visual" | "quiz";
  label: string;
  concept_id?: string;
  status?: string;
  assessed?: boolean;
  timestamp?: number | null;
  questions?: number;
}

export interface KnowledgeGraphEdge {
  source: string;
  target: string;
  rel: string;
  timestamp?: number | null;
  trust?: string;
  evidence?: string;
  question?: string;
}

export interface KnowledgeGraphResponse {
  job_id: string;
  concepts: KnowledgeConcept[];
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  evidence: { segments: number; visual_events: number; quiz_questions: number };
  generated_at: string;
}

export interface ConceptMapping {
  concept: string;
  concept_id: string;
  speech: KnowledgeSpeechLink[];
  visual: KnowledgeVisualLink[];
  has_speech: boolean;
  has_visual: boolean;
  verified_visual: boolean;
  first_timestamp: number | null;
  status: string;
  assessed: boolean;
  source: string;
  assessment_count: number;
}

export interface ConceptsResponse {
  job_id: string;
  concepts: ConceptMapping[];
}

export interface LearningGap {
  concept_id: string;
  concept: string;
  status: string;
  source: string;
  assessed: boolean;
  kinds: string[];
  reason: string[];
  speech_count: number;
  visual_count: number;
  assessment_count: number;
  related_evidence: Array<{ kind: string; event_id?: string; timestamp?: number; ts?: string; snippet?: string; question?: string }>;
  timestamp?: number | null;
}

export interface LearningGapsResponse {
  lecture_id: string;
  concepts_reviewed: number;
  gap_count: number;
  critical_gap_count: number;
  gaps: LearningGap[];
  coverage: { concepts_total: number; concepts_covered: number; assessed_and_explained: number };
  generated_at: string;
  based_on_history: boolean;
}

export interface StudentGap {
  concept: string;
  concept_id: string;
  correct: number;
  total: number;
  accuracy: number;
  wrong: number;
  type: string;
  recommended_evidence: { timestamp: number | null; ts: string | null; source: string };
  missed_questions: Array<{ question: string }>;
  quiz_id?: string;
}

export interface StudentGapsResponse {
  student_id: string;
  gap_count: number;
  based_on_history: boolean;
  gaps: StudentGap[];
  note?: string;
  generated_at: string;
}

export interface ConceptExplanation {
  concept: string;
  concept_id: string;
  lecture_id: string;
  status: string;
  headline: string;
  covered: boolean;
  partial: boolean;
  not_covered: boolean;
  reasons: string[];
  spoken: Array<{ segment_id: string; timestamp: number; ts: string; start: number; end: number; snippet: string }>;
  shown: Array<{ event_id: string; timestamp: number; ts: string; snippet: string; visual_type?: string; unverified?: boolean }>;
  assessed: boolean;
  closest_covered: Array<{ concept: string; concept_id: string; status: string; timestamp: number | null; ts?: string }>;
}

export interface RecommendedAction {
  action_type: "REVIEW_VIDEO" | "LISTEN_TO_AUDIO_DESCRIPTION" | "READ_TRANSCRIPT"
    | "REVIEW_VISUAL" | "EXPLAIN_CONCEPT" | "RETAKE_QUIZ" | "PRACTICE_CONCEPT" | string;
  label: string;
  reasoning: string;
  lecture_id?: string | null;
  concept?: string | null;
  concept_id?: string | null;
  timestamp?: number | null;
  ts?: string | null;
  grounded_on: boolean;
  priority?: number;
}

export interface AgentInsight {
  kind: string;
  text: string;
  mastered?: string[];
  needs_work?: string[];
  trend?: string;
  preferred_action?: string;
}

export interface LearningAgentView {
  student_id: string;
  profile: StudentProfile;
  has_history: boolean;
  insights: AgentInsight[];
  recommended_actions: RecommendedAction[];
  generated_at: string;
}

export interface NextActionResponse {
  student_id: string;
  action_type: string;
  label: string;
  reasoning: string;
  lecture_id?: string | null;
  concept?: string | null;
  concept_id?: string | null;
  timestamp?: number | null;
  ts?: string | null;
  grounded_on: boolean;
  insufficient_history: boolean;
}

export interface LearningInsightsResponse {
  student_id: string;
  has_history: boolean;
  insights: AgentInsight[];
  recommended_actions: RecommendedAction[];
  generated_at: string;
}