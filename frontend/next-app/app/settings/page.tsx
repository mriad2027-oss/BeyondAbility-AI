"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { Settings, Save, User, Languages, ShieldAlert, Sparkles, CheckCircle2 } from "lucide-react";
import { WorkspaceProvider, useWorkspace } from "@/components/lecture/WorkspaceProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/loading";
import { getStudent, saveProfile, listStudents } from "@/lib/api";
import { cn } from "@/lib/format";
import { useRtl } from "@/components/layout/AppShell";

const MODES = [
  {
    id: "blind",
    label: "Blind",
    desc: "Prioritizes synchronized Audio Descriptions and narrated content to deliver semantic visual information audibly.",
  },
  {
    id: "low_vision",
    label: "Low Vision",
    desc: "Provides both synchronized audio descriptions and enhanced OCR text with high-contrast formatting.",
  },
  {
    id: "hearing",
    label: "Deaf / Hard of Hearing",
    desc: "Captions + Timestamped Transcripts + Visual Concept Mapping. (Egyptian Sign Language is NOT IMPLEMENTED.)",
  },
  {
    id: "cognitive",
    label: "Cognitive Support",
    desc: "Structured concept chunking, simplified navigation, and clear Next Best Action guidance.",
  },
  {
    id: "standard",
    label: "Standard",
    desc: "Balanced multimodal accessibility without specific sensory adaptations.",
  },
] as const;

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
  const { loading } = useWorkspace();
  const { setLanguage } = useRtl();
  const [students, setStudents] = useState<Array<{ student_id: string; name: string }>>([]);
  const [studentId, setStudentId] = useState("001");
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    listStudents().then((r) => {
      setStudents(r.students);
      if (r.students.length && !r.students.some((s) => s.student_id === "001")) {
        setStudentId(r.students[0].student_id);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    getStudent(studentId)
      .then((r) => {
        setProfile({ ...r.profile, name: r.profile.name ?? studentId });
        const savedLanguage = r.profile.preferred_language;
        if (savedLanguage === "en" || savedLanguage === "ar") setLanguage(savedLanguage);
      })
      .catch(() => setProfile(null));
  }, [studentId, setLanguage]);

  if (loading) return null;

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
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <span className="flex size-9 items-center justify-center rounded-xl bg-slate-200/60 text-slate-700">
            <Settings className="size-5" aria-hidden />
          </span>
          Profile &amp; Settings
        </h1>
        <p className="mt-1 text-sm text-app-soft">
          Personalize how EduAccess AI adapts video intelligence, audio descriptions, and learning guidance for you.
        </p>
      </div>

      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="size-4 text-brand-indigo" aria-hidden /> Active Student Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="student" className="mb-1 block text-xs font-semibold text-slate-700">Select Student</label>
              <select
                id="student"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full rounded-xl border border-app-edge bg-app-panel2 px-3 py-2 text-sm text-slate-800"
              >
                {students.map((s) => (
                  <option key={s.student_id} value={s.student_id}>{s.name} ({s.student_id})</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="name" className="mb-1 block text-xs font-semibold text-slate-700">Display Name</label>
              <input
                id="name"
                value={String(profile?.name ?? "")}
                onChange={(e) => set("name", e.target.value)}
                className="w-full rounded-xl border border-app-edge bg-app-panel2 px-3 py-2 text-sm text-slate-800"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {profile && (
        <>
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-base">Accessibility Mode</CardTitle>
              <CardDescription>Select your preferred sensory adaptation profile.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2.5 sm:grid-cols-2">
                {MODES.map((m) => {
                  const active = mode === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => set("accessibility_mode", m.id)}
                      aria-pressed={active}
                      className={cn(
                        "rounded-xl border p-3.5 text-left transition-all",
                        active
                          ? "border-brand-indigo/60 bg-brand-indigo/5 ring-1 ring-brand-indigo/30 shadow-xs"
                          : "border-app-edge bg-slate-50/50 hover:bg-slate-100/70"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-slate-900">{m.label}</p>
                        {active && <Badge variant="info" className="text-[10px]">Active</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-app-soft leading-relaxed">{m.desc}</p>
                    </button>
                  );
                })}
              </div>

              {/* Honest Limitation Disclaimer for EgSL */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 text-xs text-slate-700 space-y-1">
                <p className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                  <ShieldAlert className="size-4 text-slate-500" />
                  Honest Capability Scope: Deaf / Hard of Hearing
                </p>
                <p className="text-[11px] leading-relaxed text-slate-600">
                  <strong>Currently Supported:</strong> Whisper multilingual synchronized captions, timestamped transcripts, and visual concept maps.
                </p>
                <p className="text-[11px] leading-relaxed text-slate-500">
                  <strong>Explicit Limitation:</strong> Egyptian Sign Language (EgSL) automated avatar translation is <em>not implemented</em> in this release and represents an active area for future research.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-base">Content Preferences</CardTitle>
              <CardDescription>Configure audio description playback speed and learning difficulty.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Audio Description Detail">
                <select
                  value={String(profile.description_detail ?? "medium")}
                  onChange={(e) => set("description_detail", e.target.value)}
                  className="w-full rounded-xl border border-app-edge bg-app-panel2 px-3 py-2 text-sm text-slate-800"
                >
                  {DETAILS.map((d) => <option key={d} value={d}>{d.toUpperCase()}</option>)}
                </select>
              </Field>
              <Field label="Narration Speech Rate">
                <input
                  type="range"
                  min={0.5}
                  max={1.5}
                  step={0.1}
                  value={Number(profile.speech_rate ?? 1.0)}
                  onChange={(e) => set("speech_rate", Number(e.target.value))}
                  className="w-full accent-brand-indigo"
                />
                <p className="mt-1 text-xs text-app-muted font-mono">{Number(profile.speech_rate ?? 1.0).toFixed(1)}x</p>
              </Field>
              <Field label="Adaptive Quiz Difficulty">
                <select
                  value={String(profile.quiz_difficulty ?? "adaptive")}
                  onChange={(e) => set("quiz_difficulty", e.target.value)}
                  className="w-full rounded-xl border border-app-edge bg-app-panel2 px-3 py-2 text-sm text-slate-800"
                >
                  {DIFFICULTY.map((d) => <option key={d} value={d}>{d.toUpperCase()}</option>)}
                </select>
              </Field>
              <Field label="Interface Language / Reading Direction">
                <select
                  value={String(profile.preferred_language ?? "en")}
                  onChange={(e) => {
                    const language = e.target.value === "ar" ? "ar" : "en";
                    set("preferred_language", language);
                    setLanguage(language);
                  }}
                  className="w-full rounded-xl border border-app-edge bg-app-panel2 px-3 py-2 text-sm text-slate-800"
                >
                  {LANGUAGES.map((l) => <option key={l} value={l}>{l === "en" ? "English (LTR)" : "العربية (RTL)"}</option>)}
                </select>
              </Field>
            </CardContent>
          </Card>

          <div className="flex items-center gap-3">
            <Button onClick={save} disabled={saving} className="gap-2 font-semibold">
              {saving ? <Spinner /> : <Save className="size-4" aria-hidden />} Save Profile Preferences
            </Button>
            {saved && <p className="text-sm font-semibold text-emerald-600 flex items-center gap-1"><CheckCircle2 className="size-4" /> Preferences saved successfully.</p>}
          </div>
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-700">{label}</label>
      {children}
    </div>
  );
}
