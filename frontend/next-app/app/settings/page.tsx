"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import {
  Settings,
  Save,
  User,
  ShieldAlert,
  Volume2,
  Eye,
  Ear,
  Brain,
  Sliders,
  Gauge,
  Check,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { WorkspaceProvider, useWorkspace } from "@/components/lecture/WorkspaceProvider";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/loading";
import { getStudent, saveProfile, listStudents } from "@/lib/api";
import { cn } from "@/lib/format";
import { useRtl } from "@/components/layout/AppShell";

interface ModeDefinition {
  id: string;
  label: string;
  desc: string;
  Icon: React.ComponentType<{ className?: string }>;
  badgeText: string;
  accentColor: string;
}

const MODES: ModeDefinition[] = [
  {
    id: "blind",
    label: "Blind",
    desc: "Prioritizes synchronized Audio Descriptions and synthesized speech at natural lecture pauses to deliver semantic visual context audibly.",
    Icon: Volume2,
    badgeText: "Audio Description Priority",
    accentColor: "text-blue-500 dark:text-blue-400",
  },
  {
    id: "low_vision",
    label: "Low Vision",
    desc: "Provides synchronized audio descriptions alongside high-contrast formatted OCR code and mathematical syntax extraction.",
    Icon: Eye,
    badgeText: "High Contrast + Audio",
    accentColor: "text-sky-500 dark:text-sky-400",
  },
  {
    id: "hearing",
    label: "Deaf / Hard of Hearing",
    desc: "Multi-modal synchronized captions + timestamped transcripts + visual concept mapping. (Egyptian Sign Language is Future Scope).",
    Icon: Ear,
    badgeText: "Captions + Concept Maps",
    accentColor: "text-indigo-500 dark:text-indigo-400",
  },
  {
    id: "cognitive",
    label: "Cognitive Support",
    desc: "Structured concept chunking, distraction-free navigation, and clear Next Best Action (NBA) learning guidance.",
    Icon: Brain,
    badgeText: "Concept Chunking + NBA",
    accentColor: "text-purple-500 dark:text-purple-400",
  },
  {
    id: "standard",
    label: "Standard",
    desc: "Balanced multimodal accessibility without specific sensory adaptations.",
    Icon: Sliders,
    badgeText: "Standard Multimodal",
    accentColor: "text-emerald-500 dark:text-emerald-400",
  },
];

const DETAILS = ["low", "medium", "high"] as const;
const LANGUAGES = ["en", "ar"] as const;
const DIFFICULTY = ["easy", "medium", "hard", "adaptive"] as const;

export default function SettingsPage() {
  return (
    <WorkspaceProvider>
      <SettingsBody />
    </WorkspaceProvider>
  );
}

function SettingsBody() {
  const { setLanguage } = useRtl();
  const [students, setStudents] = useState<Array<{ student_id: string; name: string }>>([]);
  const [studentId, setStudentId] = useState("001");
  const [profile, setProfile] = useState<Record<string, unknown> | null>({
    student_id: "001",
    name: "Alex",
    accessibility_mode: "hearing",
    speech_rate: 1.0,
    description_detail: "medium",
    preferred_language: "en",
    quiz_difficulty: "adaptive",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    listStudents()
      .then((r) => {
        if (r.students && r.students.length > 0) {
          setStudents(r.students);
          if (!r.students.some((s) => s.student_id === "001")) {
            setStudentId(r.students[0].student_id);
          }
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    getStudent(studentId)
      .then((r) => {
        if (r && r.profile) {
          setProfile({ ...r.profile, name: r.profile.name ?? studentId });
          const savedLanguage = r.profile.preferred_language;
          if (savedLanguage === "en" || savedLanguage === "ar") setLanguage(savedLanguage);
        }
      })
      .catch(() => {});
  }, [studentId, setLanguage]);

  const mode = String(profile?.accessibility_mode ?? "standard");

  const set = (k: string, v: unknown) => setProfile((p) => ({ ...(p ?? {}), [k]: v }));

  const save = async () => {
    if (!profile || saving) return;
    setSaving(true);
    setSaved(false);
    try {
      await saveProfile({
        student_id: studentId,
        name: String(profile.name ?? ""),
        accessibility_mode: mode,
        speech_rate: Number(profile.speech_rate ?? 1.0),
        description_detail: String(profile.description_detail ?? "medium"),
        preferred_language: String(profile.preferred_language ?? "en"),
        quiz_difficulty: String(profile.quiz_difficulty ?? "adaptive"),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 space-y-10 min-w-0 overflow-x-hidden">
      {/* PAGE HEADER */}
      <div className="flex flex-col gap-3.5 min-w-0">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-indigo/10 border border-brand-indigo/20 text-brand-indigo font-mono text-xs font-semibold uppercase tracking-wider w-fit">
          <Settings className="size-3.5" />
          <span>Personalization Layer · Accessibility Configuration</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-display font-black tracking-tight text-slate-950 dark:text-[#F8FAFC] leading-[1.1]">
          Learner Profile &amp; Accessibility Settings
        </h1>
        <p className="text-base sm:text-lg lg:text-[19px] text-[#374151] dark:text-[#D1D5DB] max-w-3xl leading-relaxed font-normal">
          Personalize how EduAccess AI adapts video intelligence, audio description, and learning guidance for each learner.
        </p>
      </div>

      {/* SECTION 1: ACTIVE STUDENT PROFILE */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B1020] p-6 sm:p-8 shadow-sm space-y-6">
        <div className="space-y-1.5 border-b border-slate-200 dark:border-white/10 pb-4">
          <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-[#F8FAFC] flex items-center gap-2.5">
            <User className="size-5 text-brand-indigo" />
            <span>Active Student Profile</span>
          </h2>
          <p className="text-sm sm:text-base text-[#374151] dark:text-[#D1D5DB] leading-relaxed">
            Configure the active student persona and display name to calibrate personal knowledge graph tracking and recommendations.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label htmlFor="student" className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-700 dark:text-[#D1D5DB]">
              Select Student Record
            </label>
            <select
              id="student"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="w-full h-12 rounded-xl border border-slate-300 dark:border-white/15 bg-slate-50 dark:bg-[#0D1224] px-4 text-sm font-semibold text-slate-900 dark:text-[#F8FAFC] focus:border-brand-indigo focus:ring-2 focus:ring-brand-indigo/20 focus:outline-none transition shadow-sm"
            >
              {students.length > 0 ? (
                students.map((s) => (
                  <option key={s.student_id} value={s.student_id}>
                    {s.name} ({s.student_id})
                  </option>
                ))
              ) : (
                <option value="001">Alex (001)</option>
              )}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="name" className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-700 dark:text-[#D1D5DB]">
              Display Name
            </label>
            <input
              id="name"
              type="text"
              value={String(profile?.name ?? "")}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Student Name"
              className="w-full h-12 rounded-xl border border-slate-300 dark:border-white/15 bg-slate-50 dark:bg-[#0D1224] px-4 text-sm font-semibold text-slate-900 dark:text-[#F8FAFC] placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-brand-indigo focus:ring-2 focus:ring-brand-indigo/20 focus:outline-none transition shadow-sm"
            />
          </div>
        </div>
      </div>

      {profile && (
        <>
          {/* SECTION 2: ACCESSIBILITY MODE (CORE) */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B1020] p-6 sm:p-8 shadow-sm space-y-6">
            <div className="space-y-1.5 border-b border-slate-200 dark:border-white/10 pb-4">
              <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-[#F8FAFC] flex items-center gap-2.5">
                <Sliders className="size-5 text-brand-indigo" />
                <span>Accessibility Mode</span>
              </h2>
              <p className="text-sm sm:text-base text-[#374151] dark:text-[#D1D5DB] leading-relaxed">
                Select your preferred accessibility profile so EduAccess can adapt multimodal understanding, audio description, and learning guidance.
              </p>
            </div>

            {/* Profile Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              {MODES.map((m) => {
                const active = mode === m.id;
                const IconComponent = m.Icon;

                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => set("accessibility_mode", m.id)}
                    aria-pressed={active}
                    className={cn(
                      "rounded-2xl border p-5 sm:p-6 text-left transition-all flex flex-col justify-between gap-4 cursor-pointer relative",
                      active
                        ? "border-2 border-brand-indigo bg-brand-indigo/15 ring-2 ring-brand-indigo/30 shadow-md"
                        : "border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] hover:border-brand-indigo/40 hover:bg-brand-indigo/5"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3 w-full">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "size-12 rounded-xl flex items-center justify-center font-bold shrink-0 transition-all",
                            active
                              ? "bg-brand-indigo text-white shadow-sm"
                              : "bg-white dark:bg-white/10 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10"
                          )}
                        >
                          <IconComponent className="size-5" />
                        </div>
                        <div>
                          <span className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#F8FAFC] block">
                            {m.label}
                          </span>
                          <span className="text-xs font-mono font-medium text-slate-600 dark:text-[#AAB4C3]">
                            {m.badgeText}
                          </span>
                        </div>
                      </div>

                      {active ? (
                        <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-brand-indigo text-white shadow-sm flex items-center gap-1.5 shrink-0">
                          <Check className="size-3.5 stroke-[3]" /> ACTIVE
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold text-slate-500 dark:text-slate-400 bg-slate-200/50 dark:bg-white/5 shrink-0">
                          Select
                        </span>
                      )}
                    </div>

                    <p className="text-sm sm:text-[15px] text-[#374151] dark:text-[#D1D5DB] leading-relaxed">
                      {m.desc}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Honest Limitation Disclaimer for EgSL */}
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 sm:p-6 space-y-2.5 text-sm text-[#374151] dark:text-[#D1D5DB]">
              <p className="font-bold text-amber-900 dark:text-amber-300 flex items-center gap-2 text-sm sm:text-base">
                <ShieldAlert className="size-5 text-amber-500 shrink-0" />
                <span>Honest Capability Scope: Deaf / Hard of Hearing</span>
              </p>
              <p className="leading-relaxed text-[#111827] dark:text-[#F8FAFC]">
                <strong>Currently Supported:</strong> Whisper multilingual synchronized captions, timestamped searchable transcripts, and visual concept maps.
              </p>
              <p className="leading-relaxed text-[#374151] dark:text-[#D1D5DB]">
                <strong>Explicit Scope Boundary:</strong> Egyptian Sign Language (EgSL) automated avatar translation is <em>future scope (not implemented in this version)</em> and represents an active area for future research.
              </p>
            </div>
          </div>

          {/* SECTION 3: CONTENT PREFERENCES */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B1020] p-6 sm:p-8 shadow-sm space-y-6">
            <div className="space-y-1.5 border-b border-slate-200 dark:border-white/10 pb-4">
              <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-[#F8FAFC] flex items-center gap-2.5">
                <Gauge className="size-5 text-brand-indigo" />
                <span>Content Preferences</span>
              </h2>
              <p className="text-sm sm:text-base text-[#374151] dark:text-[#D1D5DB] leading-relaxed">
                Configure audio description narration speed, detail density, adaptive difficulty, and interface language.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Audio Description Detail */}
              <div className="space-y-2">
                <label htmlFor="desc-detail" className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-700 dark:text-[#D1D5DB]">
                  Audio Description Detail Density
                </label>
                <select
                  id="desc-detail"
                  value={String(profile.description_detail ?? "medium")}
                  onChange={(e) => set("description_detail", e.target.value)}
                  className="w-full h-12 rounded-xl border border-slate-300 dark:border-white/15 bg-slate-50 dark:bg-[#0D1224] px-4 text-sm font-semibold text-slate-900 dark:text-[#F8FAFC] focus:border-brand-indigo focus:ring-2 focus:ring-brand-indigo/20 focus:outline-none transition shadow-sm"
                >
                  {DETAILS.map((d) => (
                    <option key={d} value={d}>
                      {d.toUpperCase()} DETAIL
                    </option>
                  ))}
                </select>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-[#AAB4C3]">
                  Controls how densely visual descriptions are synthesized during pauses.
                </p>
              </div>

              {/* Narration Speech Rate */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="speech-rate" className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-700 dark:text-[#D1D5DB]">
                    Narration Speech Rate
                  </label>
                  <span className="font-mono text-sm font-bold text-brand-indigo bg-brand-indigo/10 px-2.5 py-0.5 rounded-md">
                    {Number(profile.speech_rate ?? 1.0).toFixed(1)}x speed
                  </span>
                </div>
                <div className="h-12 flex items-center px-1">
                  <input
                    id="speech-rate"
                    type="range"
                    min={0.5}
                    max={1.5}
                    step={0.1}
                    value={Number(profile.speech_rate ?? 1.0)}
                    onChange={(e) => set("speech_rate", Number(e.target.value))}
                    className="w-full accent-brand-indigo cursor-pointer h-2 bg-slate-200 dark:bg-white/10 rounded-lg"
                  />
                </div>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-[#AAB4C3]">
                  Adjusts the playback speed of synthesized audio description audio.
                </p>
              </div>

              {/* Adaptive Quiz Difficulty */}
              <div className="space-y-2">
                <label htmlFor="quiz-diff" className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-700 dark:text-[#D1D5DB]">
                  Adaptive Quiz Difficulty
                </label>
                <select
                  id="quiz-diff"
                  value={String(profile.quiz_difficulty ?? "adaptive")}
                  onChange={(e) => set("quiz_difficulty", e.target.value)}
                  className="w-full h-12 rounded-xl border border-slate-300 dark:border-white/15 bg-slate-50 dark:bg-[#0D1224] px-4 text-sm font-semibold text-slate-900 dark:text-[#F8FAFC] focus:border-brand-indigo focus:ring-2 focus:ring-brand-indigo/20 focus:outline-none transition shadow-sm"
                >
                  {DIFFICULTY.map((d) => (
                    <option key={d} value={d}>
                      {d.toUpperCase()}
                    </option>
                  ))}
                </select>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-[#AAB4C3]">
                  Determines how assessment questions dynamically calibrate to your mastery.
                </p>
              </div>

              {/* Interface Language */}
              <div className="space-y-2">
                <label htmlFor="pref-lang" className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-700 dark:text-[#D1D5DB]">
                  Interface Language &amp; Reading Direction
                </label>
                <select
                  id="pref-lang"
                  value={String(profile.preferred_language ?? "en")}
                  onChange={(e) => {
                    const language = e.target.value === "ar" ? "ar" : "en";
                    set("preferred_language", language);
                    setLanguage(language);
                  }}
                  className="w-full h-12 rounded-xl border border-slate-300 dark:border-white/15 bg-slate-50 dark:bg-[#0D1224] px-4 text-sm font-semibold text-slate-900 dark:text-[#F8FAFC] focus:border-brand-indigo focus:ring-2 focus:ring-brand-indigo/20 focus:outline-none transition shadow-sm"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l}>
                      {l === "en" ? "English (LTR)" : "العربية (RTL)"}
                    </option>
                  ))}
                </select>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-[#AAB4C3]">
                  Switches layout direction and primary system captions language.
                </p>
              </div>
            </div>
          </div>

          {/* SAVE ACTION BAR */}
          <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
            <Button
              onClick={save}
              disabled={saving}
              size="lg"
              className="w-full sm:w-auto gap-2.5 bg-brand-indigo hover:bg-brand-indigo/90 text-white font-bold text-base px-8 py-4 h-12 rounded-xl shadow-lg shadow-brand-indigo/30 transition-all hover:scale-[1.01]"
            >
              {saving ? <Spinner className="size-5" /> : <Save className="size-5" />}
              <span>Save Profile Preferences</span>
            </Button>

            {saved && (
              <p className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="size-5" />
                <span>Preferences saved successfully to local intelligence profile.</span>
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

