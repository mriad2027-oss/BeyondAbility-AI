"use client";

import * as React from "react";
import { useState, useRef, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  MessageSquareText,
  X,
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  Bot,
  User,
  Lightbulb,
  ArrowRight,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { assistantChat, assistantStream, type AssistantChatResponse } from "@/lib/api";
import { cn } from "@/lib/format";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  evidence?: Array<{ time?: string; type?: string; snippet?: string }>;
  isStreaming?: boolean;
}

const QUICK_PROMPTS = [
  "What am I looking at right now?",
  "Explain this section simply",
  "Give me a quiz hint",
  "Turn on captions",
  "Turn on audio descriptions",
];

export default function GlobalAssistant() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi! I'm EduAccess AI, your educational accessibility companion. Ask me anything about the lecture, what's on screen, or say 'Turn on captions' or 'Turn on audio descriptions'!",
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const handleSendRef = useRef<(customText?: string) => Promise<void>>(async () => {});

  // Auto-scroll on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // Speech recognition initialization
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const reco = new SpeechRecognition();
        reco.continuous = false;
        reco.interimResults = false;
        reco.lang = document.documentElement.lang === "ar" ? "ar-EG" : "en-US";
        reco.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            setInputValue(transcript);
            handleSendRef.current(transcript);
          }
        };
        reco.onerror = () => setIsListening(false);
        reco.onend = () => setIsListening(false);
        recognitionRef.current = reco;
      }
    }
  }, []);

  const toggleMic = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.lang = document.documentElement.lang === "ar" ? "ar-EG" : "en-US";
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const speakText = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    if (isSpeaking) {
      setIsSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = document.documentElement.lang === "ar" ? "ar" : "en-US";
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const getActiveContext = () => {
    // Extract lecture ID if on /lectures/[jobId]
    const match = pathname.match(/\/lectures\/([^\/]+)/);
    const lectureId = match ? decodeURIComponent(match[1]) : undefined;

    // Read current video timestamp from window if video player dispatched it
    const currentTimestamp = (window as any).__eduaccess_current_time || 0.0;
    const currentSegment = (window as any).__eduaccess_current_segment || "";
    const currentVisual = (window as any).__eduaccess_current_visual || "";

    return {
      page: pathname,
      lecture_id: lectureId,
      timestamp: currentTimestamp,
      current_segment: currentSegment,
      current_visual_event: currentVisual,
    };
  };

  const handleSend = async (customText?: string) => {
    const textToSend = (customText || inputValue).trim();
    if (!textToSend || isLoading) return;

    setInputValue("");
    const userMsg: Message = {
      id: `u_${Date.now()}`,
      role: "user",
      content: textToSend,
    };
    const assistantMsgId = `a_${Date.now()}`;
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsLoading(true);

    const context = getActiveContext();
    const history = messages.slice(-4).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      let fullReply = "";
      for await (const chunk of assistantStream({
        message: textToSend,
        context,
        history,
      })) {
        if (chunk.token) {
          fullReply += chunk.token;
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMsgId ? { ...m, content: fullReply } : m))
          );
        }

        // Handle tool action if present
        if (chunk.action) {
          handleAction(chunk.action, chunk.action_payload);
        }

        if (chunk.done) break;
      }

      setMessages((prev) =>
        prev.map((m) => (m.id === assistantMsgId ? { ...m, isStreaming: false } : m))
      );

      if (speechEnabled && fullReply) {
        speakText(fullReply);
      }
    } catch {
      // Fallback to standard chat endpoint if streaming interrupted
      try {
        const res: AssistantChatResponse = await assistantChat({
          message: textToSend,
          context,
          history,
        });

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: res.reply,
                  evidence: res.evidence,
                  isStreaming: false,
                }
              : m
          )
        );

        if (res.action) {
          handleAction(res.action, res.action_payload);
        }

        if (speechEnabled && res.reply) {
          speakText(res.reply);
        }
      } catch (err: any) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: "I ran into a temporary error reaching the intelligence service. Please try again.",
                  isStreaming: false,
                }
              : m
          )
        );
      }
    } finally {
      setIsLoading(false);
    }
  };
  handleSendRef.current = handleSend;

  const handleAction = (action: string, payload?: Record<string, unknown>) => {
    if (action === "toggle_captions") {
      window.dispatchEvent(new CustomEvent("eduaccess:toggle_captions", { detail: { enabled: payload?.enabled } }));
    } else if (action === "toggle_audio_description") {
      window.dispatchEvent(new CustomEvent("eduaccess:toggle_audio_description", { detail: { enabled: payload?.enabled } }));
    } else if (action === "font_size") {
      window.dispatchEvent(new CustomEvent("eduaccess:font_size", { detail: { delta: payload?.delta } }));
    } else if (action === "open_quiz") {
      const match = pathname.match(/\/lectures\/([^\/]+)/);
      if (match) {
        router.push("/quiz");
      }
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="EduAccess AI Assistant"
        className={cn(
          "eduaccess-assistant-trigger fixed bottom-6 right-6 z-50 flex size-14 items-center justify-center rounded-full shadow-lg transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-brand-indigo/30",
          isOpen
            ? "bg-slate-800 text-white rotate-90 scale-95"
            : "bg-gradient-to-r from-brand-indigo via-brand-blue to-purple-600 text-white hover:scale-105 shadow-brand-indigo/40"
        )}
      >
        {isOpen ? (
          <X className="size-6" />
        ) : (
          <div className="relative">
            <MessageSquareText className="size-6" />
            <span className="absolute -top-1 -right-1 flex size-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full size-3 bg-emerald-500"></span>
            </span>
          </div>
        )}
      </button>

      {/* Floating Chat Drawer */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="EduAccess AI Assistant Dialog"
          className="eduaccess-assistant-panel fixed bottom-24 right-6 z-50 flex h-[580px] w-[380px] sm:w-[420px] flex-col rounded-3xl border border-app-edge bg-white/95 shadow-2xl backdrop-blur-xl transition-all duration-300 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-app-edge/80 bg-slate-50/90 px-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-indigo to-purple-600 text-white shadow-sm">
                <Sparkles className="size-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                  EduAccess Assistant
                  <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">Lecture-aware</span>
                </p>
                <p className="text-[11px] text-app-muted">Context-aware educational AI</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSpeechEnabled(!speechEnabled)}
                aria-label={speechEnabled ? "Mute audio narration" : "Enable spoken responses"}
                className={cn(
                  "rounded-lg p-1.5 transition-colors",
                  speechEnabled
                    ? "bg-brand-indigo/10 text-brand-indigo"
                    : "text-slate-400 hover:text-slate-700"
                )}
              >
                {speechEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close Assistant"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* Quick Prompts Bar */}
          <div className="border-b border-app-edge/60 bg-white/60 px-3 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => handleSend(prompt)}
                disabled={isLoading}
                className="whitespace-nowrap rounded-full border border-app-edge bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-brand-indigo/40 hover:text-brand-indigo transition shadow-xs"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "flex gap-2.5 max-w-[88%]",
                  m.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                )}
              >
                <div
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold shadow-xs",
                    m.role === "user"
                      ? "bg-slate-800 text-white"
                      : "bg-brand-indigo text-white"
                  )}
                >
                  {m.role === "user" ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
                </div>

                <div
                  className={cn(
                    "rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-xs",
                    m.role === "user"
                      ? "bg-brand-indigo text-white rounded-tr-xs"
                      : "bg-slate-100 text-slate-800 rounded-tl-xs"
                  )}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  {m.isStreaming && (
                    <span className="inline-block w-1.5 h-3 ml-1 bg-brand-indigo animate-pulse" />
                  )}

                  {m.evidence && m.evidence.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-200/80 space-y-1">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                        Lecture Evidence:
                      </p>
                      {m.evidence.map((ev, i) => (
                        <div key={i} className="text-[11px] text-slate-600 flex items-start gap-1">
                          {ev.time && (
                            <span className="font-mono text-brand-indigo bg-brand-indigo/10 px-1 rounded text-[10px]">
                              {ev.time}
                            </span>
                          )}
                          <span className="truncate">{ev.snippet}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {m.role === "assistant" && m.content && !m.isStreaming && (
                    <div className="mt-1.5 flex justify-end">
                      <button
                        onClick={() => speakText(m.content)}
                        aria-label="Read response aloud"
                        className="text-[11px] text-slate-400 hover:text-slate-700 flex items-center gap-1 transition"
                      >
                        <Volume2 className="size-3" /> Read
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <div className="border-t border-app-edge/80 bg-white p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2 rounded-2xl border border-app-edge bg-slate-50 px-3 py-1.5 focus-within:border-brand-indigo focus-within:ring-2 focus-within:ring-brand-indigo/20 transition"
            >
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={isListening ? "Listening..." : "Ask EduAccess AI anything..."}
                disabled={isLoading}
                className="flex-1 bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />

              <button
                type="button"
                onClick={toggleMic}
                aria-label={isListening ? "Stop listening" : "Speech input"}
                className={cn(
                  "p-1.5 rounded-lg transition",
                  isListening
                    ? "bg-rose-500 text-white animate-pulse"
                    : "text-slate-400 hover:text-slate-700"
                )}
              >
                {isListening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
              </button>

              <button
                type="submit"
                disabled={isLoading || !inputValue.trim()}
                aria-label="Send message"
                className="flex size-7 items-center justify-center rounded-xl bg-brand-indigo text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand-indigo/90 transition shadow-xs"
              >
                <Send className="size-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
