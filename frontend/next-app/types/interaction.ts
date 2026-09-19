export type InteractionEventType =
  | "click"
  | "cursor"
  | "highlight"
  | "callout"
  | "ai_ask"
  | "ad_cue"
  | "gap_detected"
  | "code_exec";

export interface VideoInteractionEvent {
  id: string;
  timestamp: number; // in seconds
  duration?: number; // active display window in seconds (default 2.5s)
  type: InteractionEventType;
  x?: number; // horizontal coordinate 0-100%
  y?: number; // vertical coordinate 0-100%
  target?: string;
  label: string;
  description?: string;
  badge?: string;
  actionData?: {
    tab?: "overview" | "visual" | "audio" | "missing" | "timeline" | "ask" | "report";
    question?: string;
    answer?: string;
    citation?: string;
    codeSnippet?: string;
    targetSelector?: string;
  };
}
