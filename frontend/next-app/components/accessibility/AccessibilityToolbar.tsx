"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import {
  Accessibility,
  Eye,
  Volume2,
  Tv,
  SunMoon,
  Type,
  Activity,
  Keyboard,
  Glasses,
  X,
  Check,
} from "lucide-react";
import { cn } from "@/lib/format";

interface AccessibilitySettings {
  captions: boolean;
  audioDescription: boolean;
  visualCompanion: boolean;
  highContrast: boolean;
  largeText: boolean;
  reducedMotion: boolean;
  screenReaderMode: boolean;
}

const DEFAULT_SETTINGS: AccessibilitySettings = {
  captions: true,
  audioDescription: true,
  visualCompanion: true,
  highContrast: false,
  largeText: false,
  reducedMotion: false,
  screenReaderMode: false,
};

export default function AccessibilityToolbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [settings, setSettings] = useState<AccessibilitySettings>(DEFAULT_SETTINGS);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("eduaccess_accessibility_settings");
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // ignore
    }
  }, []);

  // Apply settings to document element and dispatch sync events
  useEffect(() => {
    try {
      localStorage.setItem("eduaccess_accessibility_settings", JSON.stringify(settings));
    } catch {
      // ignore
    }

    const root = document.documentElement;

    // High contrast
    if (settings.highContrast) {
      root.classList.add("high-contrast");
    } else {
      root.classList.remove("high-contrast");
    }

    // Large text
    if (settings.largeText) {
      root.classList.add("text-large");
    } else {
      root.classList.remove("text-large");
    }

    // Reduced motion
    if (settings.reducedMotion) {
      root.classList.add("reduced-motion");
    } else {
      root.classList.remove("reduced-motion");
    }

    // Screen reader mode
    if (settings.screenReaderMode) {
      root.classList.add("screen-reader-mode");
    } else {
      root.classList.remove("screen-reader-mode");
    }

    // Notify window listeners
    window.dispatchEvent(
      new CustomEvent("eduaccess:accessibility_update", { detail: settings })
    );
  }, [settings]);

  // Assistant and voice commands set explicit values; they must not invert a
  // setting that is already in the requested state.
  useEffect(() => {
    const captions = (event: Event) => {
      const enabled = (event as CustomEvent<{ enabled?: boolean }>).detail?.enabled;
      setSettings((prev) => ({ ...prev, captions: typeof enabled === "boolean" ? enabled : !prev.captions }));
    };
    const descriptions = (event: Event) => {
      const enabled = (event as CustomEvent<{ enabled?: boolean }>).detail?.enabled;
      setSettings((prev) => ({ ...prev, audioDescription: typeof enabled === "boolean" ? enabled : !prev.audioDescription }));
    };
    const font = (event: Event) => {
      const delta = (event as CustomEvent<{ delta?: number }>).detail?.delta ?? 1;
      if (delta !== 0) setSettings((prev) => ({ ...prev, largeText: delta > 0 }));
    };
    window.addEventListener("eduaccess:toggle_captions", captions);
    window.addEventListener("eduaccess:toggle_audio_description", descriptions);
    window.addEventListener("eduaccess:font_size", font);
    return () => {
      window.removeEventListener("eduaccess:toggle_captions", captions);
      window.removeEventListener("eduaccess:toggle_audio_description", descriptions);
      window.removeEventListener("eduaccess:font_size", font);
    };
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle when not typing in an input/textarea
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        setShowShortcuts((prev) => !prev);
      } else if (e.key === "c" || e.key === "C") {
        setSettings((prev) => ({ ...prev, captions: !prev.captions }));
        window.dispatchEvent(new CustomEvent("eduaccess:toggle_captions"));
      } else if (e.key === "a" || e.key === "A") {
        setSettings((prev) => ({ ...prev, audioDescription: !prev.audioDescription }));
        window.dispatchEvent(new CustomEvent("eduaccess:toggle_audio_description"));
      } else if (e.key === "v" || e.key === "V") {
        setSettings((prev) => ({ ...prev, visualCompanion: !prev.visualCompanion }));
        window.dispatchEvent(new CustomEvent("eduaccess:toggle_visual_companion"));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const toggleSetting = (key: keyof AccessibilitySettings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <>
      {/* Floating Toolbar Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Accessibility Settings Toolbar"
        className="eduaccess-accessibility-trigger fixed bottom-6 left-6 z-40 flex size-12 items-center justify-center rounded-2xl border border-app-edge bg-white text-slate-700 shadow-md transition-all hover:border-brand-indigo/40 hover:text-brand-indigo hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-brand-indigo/20"
      >
        <Accessibility className="size-5" />
      </button>

      {/* Accessibility Settings Popover */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Accessibility Preferences"
          className="eduaccess-accessibility-panel fixed bottom-20 left-6 z-40 w-72 sm:w-80 rounded-3xl border border-app-edge bg-white/95 p-4 shadow-2xl backdrop-blur-xl transition-all"
        >
          <div className="flex items-center justify-between border-b border-app-edge/70 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Accessibility className="size-4 text-brand-indigo" />
                <h3 className="text-sm font-semibold text-slate-900">Accessibility Preferences</h3>
              </div>
              <p className="text-[10px] text-app-muted mt-0.5">WCAG-informed accessibility features</p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close Accessibility toolbar"
              className="rounded-lg p-1 text-slate-400 hover:text-slate-700"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mt-3 space-y-2">
            <label className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition">
              <div className="flex items-center gap-2.5 text-xs font-medium text-slate-700">
                <Eye className="size-4 text-brand-indigo" />
                Captions
              </div>
              <input
                type="checkbox"
                checked={settings.captions}
                onChange={() => toggleSetting("captions")}
                className="size-4 rounded border-slate-300 text-brand-indigo focus:ring-brand-indigo"
              />
            </label>

            <label className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition">
              <div className="flex items-center gap-2.5 text-xs font-medium text-slate-700">
                <Volume2 className="size-4 text-emerald-600" />
                Audio Description
              </div>
              <input
                type="checkbox"
                checked={settings.audioDescription}
                onChange={() => toggleSetting("audioDescription")}
                className="size-4 rounded border-slate-300 text-brand-indigo focus:ring-brand-indigo"
              />
            </label>

            <label className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition">
              <div className="flex items-center gap-2.5 text-xs font-medium text-slate-700">
                <Tv className="size-4 text-purple-600" />
                Visual Companion
              </div>
              <input
                type="checkbox"
                checked={settings.visualCompanion}
                onChange={() => toggleSetting("visualCompanion")}
                className="size-4 rounded border-slate-300 text-brand-indigo focus:ring-brand-indigo"
              />
            </label>

            <div className="border-t border-app-edge/60 my-2" />

            <label className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition">
              <div className="flex items-center gap-2.5 text-xs font-medium text-slate-700">
                <SunMoon className="size-4 text-amber-500" />
                High Contrast
              </div>
              <input
                type="checkbox"
                checked={settings.highContrast}
                onChange={() => toggleSetting("highContrast")}
                className="size-4 rounded border-slate-300 text-brand-indigo focus:ring-brand-indigo"
              />
            </label>

            <label className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition">
              <div className="flex items-center gap-2.5 text-xs font-medium text-slate-700">
                <Type className="size-4 text-blue-500" />
                Large Text
              </div>
              <input
                type="checkbox"
                checked={settings.largeText}
                onChange={() => toggleSetting("largeText")}
                className="size-4 rounded border-slate-300 text-brand-indigo focus:ring-brand-indigo"
              />
            </label>

            <label className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition">
              <div className="flex items-center gap-2.5 text-xs font-medium text-slate-700">
                <Activity className="size-4 text-rose-500" />
                Reduced Motion
              </div>
              <input
                type="checkbox"
                checked={settings.reducedMotion}
                onChange={() => toggleSetting("reducedMotion")}
                className="size-4 rounded border-slate-300 text-brand-indigo focus:ring-brand-indigo"
              />
            </label>

            <label className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition">
              <div className="flex items-center gap-2.5 text-xs font-medium text-slate-700">
                <Glasses className="size-4 text-indigo-500" />
                Screen Reader Mode
              </div>
              <input
                type="checkbox"
                checked={settings.screenReaderMode}
                onChange={() => toggleSetting("screenReaderMode")}
                className="size-4 rounded border-slate-300 text-brand-indigo focus:ring-brand-indigo"
              />
            </label>

            <button
              type="button"
              onClick={() => setShowShortcuts(true)}
              className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl border border-app-edge bg-slate-50 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 transition"
            >
              <Keyboard className="size-3.5" /> Keyboard Shortcuts (?)
            </button>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Dialog */}
      {showShortcuts && (
        <div
          role="dialog"
          aria-label="Keyboard Shortcuts"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
        >
          <div className="relative w-full max-w-md rounded-3xl border border-app-edge bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-app-edge/70 pb-3">
              <div className="flex items-center gap-2">
                <Keyboard className="size-5 text-brand-indigo" />
                <h3 className="text-base font-semibold text-slate-900">Accessible Shortcuts</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowShortcuts(false)}
                aria-label="Close shortcuts"
                className="rounded-lg p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-600">Play / Pause Video</span>
                <kbd className="rounded bg-slate-100 px-2 py-0.5 font-mono text-slate-800">Space</kbd>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-600">Seek 5s Forward / Backward</span>
                <kbd className="rounded bg-slate-100 px-2 py-0.5 font-mono text-slate-800">← / →</kbd>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-600">Toggle Captions</span>
                <kbd className="rounded bg-slate-100 px-2 py-0.5 font-mono text-slate-800">C</kbd>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-600">Toggle Audio Description</span>
                <kbd className="rounded bg-slate-100 px-2 py-0.5 font-mono text-slate-800">A</kbd>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-600">Toggle Visual Companion</span>
                <kbd className="rounded bg-slate-100 px-2 py-0.5 font-mono text-slate-800">V</kbd>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-600">Open this Shortcuts Dialog</span>
                <kbd className="rounded bg-slate-100 px-2 py-0.5 font-mono text-slate-800">?</kbd>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
