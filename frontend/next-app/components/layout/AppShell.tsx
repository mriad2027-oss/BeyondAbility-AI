"use client";

import * as React from "react";
import { useState, createContext, useContext, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  BookOpenCheck,
  Upload,
  BrainCircuit,
  Settings,
  Sparkles,
  Accessibility,
  Menu,
  Eye,
  X,
  ChevronRight,
  Circle,
} from "lucide-react";
import { cn } from "@/lib/format";
import GlobalAssistant from "@/components/assistant/GlobalAssistant";
import AccessibilityToolbar from "@/components/accessibility/AccessibilityToolbar";

type Direction = "ltr" | "rtl";
type InterfaceLanguage = "en" | "ar";

type RtlContextValue = {
  dir: Direction;
  language: InterfaceLanguage;
  setLanguage: (language: InterfaceLanguage) => void;
  toggleRtl: () => void;
};

const RTL_CONTEXT = createContext<RtlContextValue>({
  dir: "ltr",
  language: "en",
  setLanguage: () => {},
  toggleRtl: () => {},
});
export const useRtl = () => useContext(RTL_CONTEXT);

interface NavEntry {
  href: string;
  label: string;
  icon: typeof Home;
  exact?: boolean;
  crumb: string;
}

const PRIMARY_NAV: NavEntry[] = [
  { href: "/", label: "Home", icon: Home, exact: true, crumb: "Overview" },
  { href: "/upload", label: "Compiler", icon: Upload, crumb: "Compiler Workspace" },
  { href: "/lectures", label: "Accessibility Studio", icon: BookOpenCheck, crumb: "Studio" },
  { href: "/learning", label: "Learning Intelligence", icon: BrainCircuit, crumb: "Intelligence" },
  { href: "/settings", label: "Settings", icon: Settings, crumb: "Settings" },
];

const ARABIC_UI: Record<string, string> = {
  "PRIMARY NAVIGATION": "التنقل الأساسي",
  Home: "الرئيسية",
  Compiler: "المُجَمِّع",
  Lectures: "المحاضرات",
  "Lecture Library": "مكتبة المحاضرات",
  "Upload & Process": "رفع ومعالجة",
  "Upload & Compile": "رفع وتجميع",
  COMPILER: "المُجَمِّع",
  "Accessibility Studio": "استوديو إمكانية الوصول",
  "ACCESSIBILITY STUDIO": "استوديو إمكانية الوصول",
  "LEARNING INTELLIGENCE": "الذكاء التعليمي",
  "Learning Intelligence": "الذكاء التعليمي",
  LEARNING: "التعلّم",
  INTELLIGENCE: "الذكاء",
  ACCESSIBILITY: "إمكانية الوصول",
  SETTINGS: "الإعدادات",
  Settings: "الإعدادات",
  "Profile & Settings": "الملف والإعدادات",
  "Ask the Video": "اسأل الفيديو",
  "Grounded Ask": "سؤال موثّق",
  "What am I Missing?": "ما الذي فاتني؟",
  "Visual Timeline": "الخط الزمني المرئي",
  "Audio Description": "الوصف الصوتي",
  "Quiz & Results": "الاختبار والنتائج",
  "Adaptive Quiz": "اختبار متكيّف",
  "Learning Progress": "تقدّم التعلّم",
  "Progress & NBA": "التقدّم وأفضل خطوة تالية",
  "Knowledge Graph": "خريطة المعرفة",
  "Learning Gaps": "فجوات التعلّم",
  "Learning Agent": "مساعد التعلّم",
  "Next Best Action": "أفضل خطوة تالية",
  "Accessibility Report": "تقرير إمكانية الوصول",
  "Accessibility mode": "وضع إمكانية الوصول",
  "View accessibility report": "عرض تقرير إمكانية الوصول",
  "Lecture intelligence": "ذكاء المحاضرات",
  "The Accessibility Compiler": "مُجَمِّع إمكانية الوصول",
  "Open navigation": "فتح قائمة التنقل",
  "Switch reading direction": "تبديل لغة الواجهة واتجاه القراءة",
  Overview: "نظرة عامة",
  "Compiler Workspace": "مساحة عمل المُجَمِّع",
  Studio: "الاستوديو",
  Intelligence: "الذكاء",
  Standard: "قياسي",
  Ready: "جاهز",
  "Accessibility Twin": "التوأم الوصولي",
  Workspace: "مساحة العمل",
  Navigation: "التنقل",
  Close: "إغلاق",
};

function localize(value: string, dir: Direction) {
  return dir === "rtl" ? (ARABIC_UI[value] ?? value) : value;
}

function LogoMark({ small = false, dir = "ltr" }: { small?: boolean; dir?: Direction }) {
  if (small) {
    return (
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-indigo via-brand-indigo to-brand-blue text-white shadow-sm shadow-brand-indigo/25">
        <Accessibility className="size-[18px]" aria-hidden />
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-indigo via-brand-indigo to-brand-blue text-white shadow-sm shadow-brand-indigo/30 relative">
        <Accessibility className="size-5.5" aria-hidden />
        <span className="absolute -bottom-1 -right-1 size-2.5 rounded-full bg-emerald-500 ring-2 ring-white" aria-hidden />
      </div>
      <div className="leading-tight text-center hidden group-hover:block">
        <p className="text-[13px] font-bold tracking-tight text-slate-900 whitespace-nowrap">
          EduAccess <span className="gradient-text">AI</span>
        </p>
      </div>
    </div>
  );
}

function getCurrentCrumb(pathname: string, dir: Direction): string {
  const match = PRIMARY_NAV.find(n =>
    n.exact ? pathname === n.href : pathname.startsWith(n.href)
  );
  if (!match) return localize("Overview", dir);
  if (match.exact && pathname === "/") return localize(match.crumb, dir);
  const idMatch = pathname.split("/")[2];
  if (idMatch && !isNaN(Number(idMatch))) {
    return `${localize(match.crumb, dir)} · #${idMatch.slice(0, 6)}`;
  }
  return localize(match.crumb, dir);
}

function SlimSidebar({
  current,
  dir,
  setLanguage,
}: {
  current: string;
  dir: Direction;
  setLanguage: (language: InterfaceLanguage) => void;
}) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  const [profileMode, setProfileMode] = useState<"standard" | "blind" | "lv" | "deaf" | "cognitive">("standard");

  const profileIcon = {
    standard: Accessibility,
    blind: Eye,
    lv: Eye,
    deaf: Accessibility,
    cognitive: BrainCircuit,
  }[profileMode];
  const profileLabel = {
    standard: "Standard", blind: "Blind", lv: "Low Vision",
    deaf: "Deaf/HoH", cognitive: "Cognitive",
  }[profileMode];

  return (
    <aside
      className={cn(
        "fixed inset-y-0 z-40 hidden lg:flex flex-col items-center py-5 border-[#1E294B] bg-[#080B18]/95 backdrop-blur text-slate-300 transition-all duration-300 ease-out group shadow-2xl",
        dir === "rtl" ? "right-0 border-l" : "left-0 border-r",
        hovered ? (dir === "rtl" ? "w-60" : "w-60") : "w-[68px]"
      )}
      dir={dir}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex flex-col items-center gap-6 w-full px-2 flex-1">
        <div className="flex flex-col items-center gap-1.5">
          <LogoMark dir={dir} />
          {hovered && (
            <p className="meta-label !text-indigo-400 hidden group-hover:block whitespace-nowrap mt-1">
              {localize("The Accessibility Compiler", dir)}
            </p>
          )}
        </div>

        <nav aria-label="Primary Navigation" className="flex flex-col items-center gap-1.5 w-full">
          {hovered && (
            <div className="w-full px-3 mb-1">
              <div className="section-rail-left">
                <span className="section-rail-label !text-slate-400">{localize("Navigation", dir)}</span>
              </div>
            </div>
          )}
          {PRIMARY_NAV.map((item) => {
            const active = item.exact ? current === item.href : current.startsWith(item.href);
            const Icon = item.icon;
            return (
              <div key={item.href} className="relative w-full flex items-center px-1.5 group/item">
                <a
                  href={item.href}
                  onClick={(e) => {
                    e.preventDefault();
                    router.push(item.href);
                  }}
                  aria-current={active ? "page" : undefined}
                  aria-label={localize(item.label, dir)}
                  className={cn(
                    "flex items-center rounded-xl transition-all w-full",
                    hovered
                      ? active
                        ? "bg-brand-indigo/20 text-white ring-1 ring-brand-indigo/40 px-3 py-2 text-sm font-semibold shadow-sm"
                        : "text-slate-400 hover:text-white hover:bg-white/5 px-3 py-2 text-sm font-medium"
                      : active
                        ? "size-10 rounded-xl bg-brand-indigo/25 text-white ring-1 ring-brand-indigo/40 flex items-center justify-center mx-auto shadow-sm"
                        : "size-10 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 flex items-center justify-center mx-auto",
                  )}
                  title={!hovered ? localize(item.label, dir) : undefined}
                >
                  <Icon className={cn("shrink-0", hovered ? "size-[18px]" : "size-[19px]", active ? "text-brand-cyan" : "text-slate-400")} aria-hidden />
                  {hovered && (
                    <span className="whitespace-nowrap ml-2.5">{localize(item.label, dir)}</span>
                  )}
                  {hovered && active && (
                    <ChevronRight className={cn(
                      "ml-auto size-3.5 text-brand-cyan", dir === "rtl" && "rotate-180"
                    )} aria-hidden />
                  )}
                </a>
              </div>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col items-center gap-4 w-full">
          {hovered && (
            <div className="w-full px-3">
              <div className="rounded-xl bg-[#0D1224] border border-[#1E294B] p-3 shadow-surface">
                <div className="mb-2 flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                  <Sparkles className="size-3 text-amber-400" aria-hidden />
                  {localize("Accessibility mode", dir)}
                </div>
                <div className="flex gap-1 mb-2">
                  <button
                    onClick={() => setLanguage("en")}
                    aria-pressed={dir === "ltr"}
                    className={cn(
                      "flex-1 rounded-lg px-2 py-1 text-[10px] font-semibold transition",
                      dir === "ltr"
                        ? "bg-brand-indigo text-white"
                        : "bg-white/5 text-slate-400 ring-1 ring-white/10 hover:text-white"
                    )}
                  >
                    EN
                  </button>
                  <button
                    onClick={() => setLanguage("ar")}
                    aria-pressed={dir === "rtl"}
                    className={cn(
                      "flex-1 rounded-lg px-2 py-1 text-[10px] font-semibold transition",
                      dir === "rtl"
                        ? "bg-brand-indigo text-white"
                        : "bg-white/5 text-slate-400 ring-1 ring-white/10 hover:text-white"
                    )}
                    lang="ar"
                  >
                    عربي
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col items-center gap-1.5 pb-2 w-full px-2">
            <button
              aria-label={profileLabel}
              onClick={() => setProfileMode(m =>
                m === "standard" ? "blind" : m === "blind" ? "lv" : m === "lv" ? "deaf" : m === "deaf" ? "cognitive" : "standard"
              )}
              className={cn(
                "relative flex items-center rounded-xl transition-all w-full",
                hovered
                  ? "nav-rail-item"
                  : "slim-nav-icon mx-auto"
              )}
            >
              <Circle aria-hidden className={cn("shrink-0 absolute -top-0.5 -right-0.5 size-3",
                profileMode === "standard" ? "text-brand-indigo" :
                profileMode === "blind" ? "text-brand-cyan" :
                profileMode === "lv" ? "text-brand-blue" :
                profileMode === "deaf" ? "text-brand-amber" : "text-brand-emerald"
              )} style={{ fill: "currentColor" }} />
              {React.createElement(profileIcon, {
                className: cn("shrink-0", hovered ? "size-[18px] text-slate-500" : "size-[20px] text-slate-500"),
                "aria-hidden": "true"
              })}
              {hovered && (
                <>
                  <span className="text-sm">{localize(profileLabel, dir)}</span>
                  <span className="ml-auto badge-pill-slate">
                    {localize("Standard", dir)}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

function MobileDrawer({
  current,
  open,
  onClose,
  dir,
  setLanguage,
}: {
  current: string;
  open: boolean;
  onClose: () => void;
  dir: Direction;
  setLanguage: (language: InterfaceLanguage) => void;
}) {
  const router = useRouter();
  if (!open) return null;
  return (
    <div className={cn("fixed inset-0 z-50 flex lg:hidden", dir === "rtl" && "justify-end")}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className={cn(
        "relative h-full bg-white shadow-float flex flex-col",
        dir === "rtl" ? "w-72 border-l border-slate-200" : "w-72 border-r border-slate-200",
      )}>
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-200/70">
          <div className="flex items-center gap-2.5">
            <LogoMark small dir={dir} />
            <div className="leading-tight">
              <p className="text-sm font-bold tracking-tight text-slate-900">
                EduAccess <span className="gradient-text">AI</span>
              </p>
              <p className="meta-label">{localize("Workspace", dir)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={localize("Close", dir)}
            className="slim-nav-icon"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav aria-label="Primary Navigation" className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-1">
          <div className="px-2 pb-2 pt-1">
            <div className="section-rail-left">
              <span className="section-rail-label">{localize("Navigation", dir)}</span>
            </div>
          </div>
          {PRIMARY_NAV.map((item) => {
            const active = item.exact ? current === item.href : current.startsWith(item.href);
            const Icon = item.icon;
            return (
              <a
                key={item.href}
                href={item.href}
                onClick={(e) => {
                  e.preventDefault();
                  router.push(item.href);
                  onClose();
                }}
                aria-current={active ? "page" : undefined}
                className={cn("nav-rail-item", active && "nav-rail-item-active")}
              >
                <Icon className="size-[18px]" aria-hidden />
                <span>{localize(item.label, dir)}</span>
                {active && <ChevronRight className={cn("ml-auto size-3.5", dir === "rtl" && "rotate-180")} aria-hidden />}
              </a>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-200/70">
          <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-3 shadow-surface">
            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <Sparkles className="size-3 text-amber-500" aria-hidden />
              {localize("Accessibility mode", dir)}
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setLanguage("en")}
                aria-pressed={dir === "ltr"}
                className={cn(
                  "flex-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition",
                  dir === "ltr"
                    ? "bg-brand-indigo text-white"
                    : "bg-white text-slate-500 ring-1 ring-slate-200 hover:text-slate-700"
                )}
              >
                English
              </button>
              <button
                onClick={() => setLanguage("ar")}
                aria-pressed={dir === "rtl"}
                className={cn(
                  "flex-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition",
                  dir === "rtl"
                    ? "bg-brand-indigo text-white"
                    : "bg-white text-slate-500 ring-1 ring-slate-200 hover:text-slate-700"
                )}
                lang="ar"
              >
                العربية
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContextualTopBar({
  current,
  dir,
  onOpenMobile,
}: {
  current: string;
  dir: Direction;
  onOpenMobile: () => void;
}) {
  const crumb = getCurrentCrumb(current, dir);
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between px-4 sm:px-6 border-b border-[#1E294B] bg-[#080B18]/95 backdrop-blur-md shadow-md">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenMobile}
          aria-label={localize("Open navigation", dir)}
          className="flex size-9 items-center justify-center rounded-lg border border-[#1E294B] bg-[#0D1224] text-slate-200 hover:text-white hover:border-brand-indigo/50 hover:bg-white/5 transition lg:hidden"
        >
          <Menu className="size-5" />
        </button>
        <div className="hidden lg:flex items-center gap-2.5 min-w-0">
          <span className="font-mono text-[13px] sm:text-sm font-bold tracking-wider text-slate-200 uppercase">
            EduAccess AI
          </span>
          <span className="text-slate-500 font-mono text-sm select-none" aria-hidden>/</span>
          <span className="font-mono text-[13px] sm:text-sm font-bold tracking-wider text-brand-indigo dark:text-[#A78BFA] uppercase bg-brand-indigo/15 border border-brand-indigo/30 px-2.5 py-0.5 rounded-md shadow-sm">
            {crumb}
          </span>
        </div>
        <div className="lg:hidden flex items-center gap-2.5 min-w-0">
          <LogoMark small dir={dir} />
          <span className="font-mono text-xs sm:text-sm font-bold tracking-wide text-slate-100 uppercase truncate">
            {crumb}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 shadow-sm">
          <span className="size-2 rounded-full bg-emerald-400 ring-2 ring-emerald-400/20 animate-pulse" aria-hidden />
          <span className="text-xs sm:text-[13px] font-mono font-bold text-emerald-300 tracking-wide">
            {localize("Ready", dir)}
          </span>
        </div>
        <button
          onClick={() => {
            const ev = new CustomEvent("eduaccess-toggle-language");
            window.dispatchEvent(ev);
          }}
          aria-label={localize("Switch reading direction", dir)}
          className="inline-flex items-center gap-2 rounded-lg border border-[#1E294B] bg-[#0D1224] px-3 py-1.5 text-xs sm:text-sm font-mono font-bold text-slate-100 hover:text-white hover:border-brand-indigo/60 hover:bg-brand-indigo/15 transition shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-indigo/40"
          dir="ltr"
        >
          <Accessibility className="size-4 text-brand-indigo dark:text-[#A78BFA]" aria-hidden />
          <span>{dir === "ltr" ? "عربى" : "EN"}</span>
        </button>
      </div>
    </header>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const [language, setLanguageState] = useState<InterfaceLanguage>("en");
  const [mobileOpen, setMobileOpen] = useState(false);
  const dir: Direction = language === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    try {
      const storedLanguage = localStorage.getItem("eduaccess_language");
      if (storedLanguage === "ar" || storedLanguage === "en") {
        setLanguageState(storedLanguage);
        return;
      }
      const storedDirection = localStorage.getItem("eduaccess_dir");
      if (storedDirection === "rtl") setLanguageState("ar");
    } catch { /* SSR */ }
  }, []);

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = language;
    try {
      localStorage.setItem("eduaccess_language", language);
      localStorage.setItem("eduaccess_dir", dir);
    } catch { /* private mode */ }
  }, [dir, language]);

  useEffect(() => {
    const handler = () => {
      setLanguageState((current) => (current === "en" ? "ar" : "en"));
    };
    window.addEventListener("eduaccess-toggle-language", handler);
    return () => window.removeEventListener("eduaccess-toggle-language", handler);
  }, []);

  const setLanguage = useCallback((nextLanguage: InterfaceLanguage) => {
    setLanguageState(nextLanguage);
  }, []);
  const toggleRtl = useCallback(() => {
    setLanguageState((current) => (current === "en" ? "ar" : "en"));
  }, []);

  return (
    <RTL_CONTEXT.Provider value={{ dir, language, setLanguage, toggleRtl }}>
      <div dir={dir} className="flex min-h-screen bg-app-bg text-slate-800">
        <SlimSidebar current={pathname} dir={dir} setLanguage={setLanguage} />
        <MobileDrawer
          current={pathname}
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          dir={dir}
          setLanguage={setLanguage}
        />

        <div className={cn(
          "flex min-w-0 flex-1 flex-col",
          dir === "rtl" ? "lg:pr-[68px]" : "lg:pl-[68px]"
        )}>
          <ContextualTopBar
            current={pathname}
            dir={dir}
            onOpenMobile={() => setMobileOpen(true)}
          />
          <main className="flex-1 min-w-0 overflow-x-hidden">
            {children}
          </main>
        </div>

        <button
          onClick={toggleRtl}
          aria-label={localize("Switch reading direction", dir)}
          className={cn(
            "fixed bottom-28 z-30 md:hidden rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-600 shadow-sm transition hover:text-brand-indigo",
            dir === "rtl" ? "left-4" : "right-4"
          )}
          dir="ltr"
        >
          {dir === "ltr" ? "ع" : "A"}
        </button>

        <AccessibilityToolbar />
        <GlobalAssistant />
      </div>
    </RTL_CONTEXT.Provider>
  );
}
