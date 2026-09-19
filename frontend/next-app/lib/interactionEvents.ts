import type { VideoInteractionEvent } from "@/types/interaction";
import type { AnalysisItem, MissingItem, AudioDescriptionCue } from "@/types/backend";

/**
 * Storytelling Interaction Events for DEMO_python_loops
 * Synchronized with the real lecture moments, OCR code snippets, gaps, and AD cues.
 */
export const DEMO_INTERACTION_EVENTS: VideoInteractionEvent[] = [
  {
    id: "demo-ocr-1",
    timestamp: 4.0,
    duration: 3.2,
    type: "highlight",
    x: 35,
    y: 38,
    target: "code-editor",
    label: "OCR Code Extraction",
    description: "Visual Engine detected on-screen definition: fruits = ['apple', 'banana', 'cherry']",
    badge: "OCR KEYFRAME",
    actionData: {
      codeSnippet: "fruits = ['apple', 'banana', 'cherry']",
      tab: "visual",
    },
  },
  {
    id: "demo-gap-1",
    timestamp: 14.5,
    duration: 3.5,
    type: "gap_detected",
    x: 75,
    y: 68,
    target: "missing-tab",
    label: "Accessibility Gap Detected",
    description: "Cross-Modal Difference: Code on screen lacks explicit verbal description in spoken audio",
    badge: "WHAT AM I MISSING?",
    actionData: {
      tab: "missing",
    },
  },
  {
    id: "demo-ad-cue-3",
    timestamp: 26.5,
    duration: 3.5,
    type: "ad_cue",
    x: 48,
    y: 46,
    target: "ad-player",
    label: "Synchronized Audio Description #3",
    description: "Dual-audio layer narrates: 'A for loop iterates over each fruit and prints it in turn'",
    badge: "AD CUE 3 / 6",
    actionData: {
      tab: "audio",
    },
  },
  {
    id: "demo-ai-ask-1",
    timestamp: 36.0,
    duration: 4.0,
    type: "ai_ask",
    x: 82,
    y: 24,
    target: "ask-button",
    label: "Ask the Video — Grounded AI",
    description: "Interactive Question: 'What is inside the fruits list?' → Verified Citation [00:00–00:05]",
    badge: "VERIFIED CITATION",
    actionData: {
      tab: "ask",
      question: "What is inside the fruits list?",
      answer: "The list contains three strings: \"apple\", \"banana\", \"cherry\".",
      citation: "[00:00 – 00:05]",
    },
  },
  {
    id: "demo-score-1",
    timestamp: 48.0,
    duration: 3.5,
    type: "highlight",
    x: 86,
    y: 82,
    target: "scorecard",
    label: "Accessibility Health Score",
    description: "100% Score: 80% Baseline Modality + 20% Verified Remediation Benefit",
    badge: "METHODOLOGY AUDIT",
    actionData: {
      tab: "report",
    },
  },
];

/**
 * Generate interaction events dynamically for any lecture based on its real pipeline assets.
 */
export function getLectureInteractionEvents(
  jobId: string,
  analysis: AnalysisItem[] = [],
  missing: MissingItem[] = [],
  adCues: AudioDescriptionCue[] = []
): VideoInteractionEvent[] {
  if (jobId.toUpperCase().includes("DEMO")) {
    return DEMO_INTERACTION_EVENTS;
  }

  const events: VideoInteractionEvent[] = [];

  // 1. Add Visual OCR events
  analysis.slice(0, 3).forEach((item, idx) => {
    const t = Number(item.start ?? (idx + 1) * 8);
    events.push({
      id: `vis-${idx}-${t}`,
      timestamp: t,
      duration: 3.0,
      type: "highlight",
      x: 35 + (idx % 2) * 20,
      y: 35 + (idx % 3) * 15,
      label: `Visual Event #${idx + 1}`,
      description: item.description || "On-screen visual content detected by OCR keyframe extraction",
      badge: "VISUAL OCR",
      actionData: { tab: "visual" },
    });
  });

  // 2. Add Disparity Gap events
  missing.slice(0, 3).forEach((m, idx) => {
    const t = Number(m.timestamp_start ?? m.timestamp ?? (idx + 1) * 15);
    events.push({
      id: `gap-${idx}-${t}`,
      timestamp: t,
      duration: 3.2,
      type: "gap_detected",
      x: 70,
      y: 65,
      label: "Visual Gap Detected",
      description: m.what_you_might_miss || "Content visible on screen without spoken narration",
      badge: "GAP DETECTED",
      actionData: { tab: "missing" },
    });
  });

  // 3. Add Audio Description events
  adCues.slice(0, 4).forEach((cue, idx) => {
    const t = Number(cue.start);
    events.push({
      id: `ad-${idx}-${t}`,
      timestamp: t,
      duration: 3.0,
      type: "ad_cue",
      x: 50,
      y: 50,
      label: `Audio Description #${idx + 1}`,
      description: cue.description || cue.transcript || "Synchronized Audio Description voiceover cue",
      badge: `AD CUE ${idx + 1}`,
      actionData: { tab: "audio" },
    });
  });

  return events.sort((a, b) => a.timestamp - b.timestamp);
}
