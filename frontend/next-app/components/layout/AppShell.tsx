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
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#B85C38] via-[#B85C38] to-[#6C63A8] text-white shadow-sm shadow-[#B85C38]/20">
        <Accessibility className="size-[18px]" aria-hidden />
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#B85C38] via-[#B85C38] to-[#6C63A8] text-white shadow-sm shadow-[#B85C38]/25 relative">
        <Accessibility className="size-5.5" aria-hidden />
        <span className="absolute -bottom-1 -right-1 size-2.5 rounded-full bg-[#5F8A62] ring-2 ring-[#FFFDFC]" aria-hidden />
      </div>
      <div className="leading-tight text-center hidden group-hover:block">
        <p className="text-[13px] font-bold tracking-tight text-[#2F2924] whitespace-nowrap">
          EduAccess <span className="gradient-text">AI</span>
        </p>
      </div>
    </div>
  );
}

function getCurrentCrumb(pathname: string, dir: Direction): string {
  const match = PRIMARY_NAV.find((n) =>
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
    standard: "Standard",
    blind: "Blind",
    lv: "Low Vision",
    deaf: "Deaf/HoH",
    cognitive: "Cognitive",
  }[profileMode];

  return (
    <aside
      className={cn(
        "fixed inset-y-0 z-40 hidden lg:flex flex-col items-center py-5 border-[#E3D8CB] bg-[#FBF8F2]/95 backdrop-blur-md text-[#51483F] transition-all duration-300 ease-out group shadow-sm",
        dir === "rtl" ? "right-0 border-l" : "left-0 border-r",
        hovered ? "w-60" : "w-[68px]"
      )}
      dir={dir}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex flex-col items-center gap-6 w-full px-2 flex-1">
        <div className="flex flex-col items-center gap-1.5">
          <LogoMark dir={dir} />
          {hovered && (
            <p className="meta-label !text-[#B85C38] hidden group-hover:block whitespace-nowrap mt-1 font-bold">
              {localize("The Accessibility Compiler", dir)}
            </p>
          )}
        </div>

        <nav aria-label="Primary Navigation" className="flex flex-col items-center gap-1.5 w-full">
          {hovered && (
            <div className="w-full px-3 mb-1">
              <div className="section-rail-left">
                <span className="section-rail-label !text-[#7A7067]">{localize("Navigation", dir)}</span>
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
                    "flex items-center rounded-xl transition-all w-full cursor-pointer",
                    hovered
                      ? active
                        ? "bg-[#B85C38]/10 text-[#B85C38] ring-1 ring-[#B85C38]/30 px-3 py-2 text-sm font-bold shadow-xs"
                        : "text-[#51483F] hover:text-[#2F2924] hover:bg-[#F1E8DC] px-3 py-2 text-sm font-medium"
                      : active
                        ? "size-10 rounded-xl bg-[#B85C38]/10 text-[#B85C38] ring-1 ring-[#B85C38]/30 flex items-center justify-center mx-auto shadow-xs"
                        : "size-10 rounded-xl text-[#7A7067] hover:text-[#2F2924] hover:bg-[#F1E8DC] flex items-center justify-center mx-auto"
                  )}
                  title={!hovered ? localize(item.label, dir) : undefined}
                >
                  <Icon
                    className={cn(
                      "shrink-0",
                      hovered ? "size-[18px]" : "size-[19px]",
                      active ? "text-[#B85C38]" : "text-[#7A7067]"
                    )}
                    aria-hidden
                  />
                  {hovered && (
                    <span className="whitespace-nowrap ml-2.5">{localize(item.label, dir)}</span>
                  )}
                  {hovered && active && (
                    <ChevronRight
                      className={cn(
                        "ml-auto size-3.5 text-[#B85C38]",
                        dir === "rtl" && "rotate-180"
                      )}
                      aria-hidden
                    />
                  )}
                </a>
              </div>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col items-center gap-4 w-full">
          {hovered && (
            <div className="w-full px-3">
              <div className="rounded-xl bg-[#FFFDFC] border border-[#E4D9CC] p-3 shadow-surface">
                <div className="mb-2 flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-[#7A7067]">
                  <Sparkles className="size-3 text-[#C49A5A]" aria-hidden />
                  {localize("Accessibility mode", dir)}
                </div>
                <div className="flex gap-1 mb-2">
                  <button
                    onClick={() => setLanguage("en")}
                    aria-pressed={dir === "ltr"}
                    className={cn(
                      "flex-1 rounded-lg px-2 py-1 text-[10px] font-bold transition cursor-pointer",
                      dir === "ltr"
                        ? "bg-[#B85C38] text-white shadow-xs"
                        : "bg-[#F1E8DC] text-[#51483F] border border-[#DDD0C0] hover:bg-[#EDE2D3]"
                    )}
                  >
                    EN
                  </button>
                  <button
                    onClick={() => setLanguage("ar")}
                    aria-pressed={dir === "rtl"}
                    className={cn(
                      "flex-1 rounded-lg px-2 py-1 text-[10px] font-bold transition cursor-pointer",
                      dir === "rtl"
                        ? "bg-[#B85C38] text-white shadow-xs"
                        : "bg-[#F1E8DC] text-[#51483F] border border-[#DDD0C0] hover:bg-[#EDE2D3]"
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
              onClick={() =>
                setProfileMode((m) =>
                  m === "standard"
                    ? "blind"
                    : m === "blind"
                    ? "lv"
                    : m === "lv"
                    ? "deaf"
                    : m === "deaf"
                    ? "cognitive"
                    : "standard"
                )
              }
              className={cn(
                "relative flex items-center rounded-xl transition-all w-full cursor-pointer",
                hovered ? "nav-rail-item" : "slim-nav-icon mx-auto"
              )}
            >
              <Circle
                aria-hidden
                className={cn(
                  "shrink-0 absolute -top-0.5 -right-0.5 size-3",
                  profileMode === "standard"
                    ? "text-[#B85C38]"
                    : profileMode === "blind"
                    ? "text-[#5B82A6]"
                    : profileMode === "lv"
                    ? "text-[#5F9A9A]"
                    : profileMode === "deaf"
                    ? "text-[#B77932]"
                    : "text-[#5F8A62]"
                )}
                style={{ fill: "currentColor" }}
              />
              {React.createElement(profileIcon, {
                className: cn(
                  "shrink-0",
                  hovered ? "size-[18px] text-[#51483F]" : "size-[20px] text-[#51483F]"
                ),
                "aria-hidden": "true",
              })}
              {hovered && (
                <>
                  <span className="text-sm font-medium">{localize(profileLabel, dir)}</span>
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
      <div className="absolute inset-0 bg-[#2F2924]/40 backdrop-blur-xs" onClick={onClose} aria-hidden />
      <div
        className={cn(
          "relative h-full bg-[#FBF8F2] shadow-float flex flex-col",
          dir === "rtl" ? "w-72 border-l border-[#E3D8CB]" : "w-72 border-r border-[#E3D8CB]"
        )}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#E3D8CB]">
          <div className="flex items-center gap-2.5">
            <LogoMark small dir={dir} />
            <div className="leading-tight">
              <p className="text-sm font-bold tracking-tight text-[#2F2924]">
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
            <X className="size-5 text-[#51483F]" />
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
                {active && (
                  <ChevronRight
                    className={cn("ml-auto size-3.5 text-[#B85C38]", dir === "rtl" && "rotate-180")}
                    aria-hidden
                  />
                )}
              </a>
            );
          })}
        </nav>

        <div className="p-3 border-t border-[#E3D8CB]">
          <div className="rounded-xl bg-[#FFFDFC] border border-[#E4D9CC] p-3 shadow-surface">
            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#7A7067]">
              <Sparkles className="size-3 text-[#C49A5A]" aria-hidden />
              {localize("Accessibility mode", dir)}
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setLanguage("en")}
                aria-pressed={dir === "ltr"}
                className={cn(
                  "flex-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition cursor-pointer",
                  dir === "ltr"
                    ? "bg-[#B85C38] text-white"
                    : "bg-[#F1E8DC] text-[#51483F] border border-[#DDD0C0] hover:bg-[#EDE2D3]"
                )}
              >
                English
              </button>
              <button
                onClick={() => setLanguage("ar")}
                aria-pressed={dir === "rtl"}
                className={cn(
                  "flex-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition cursor-pointer",
                  dir === "rtl"
                    ? "bg-[#B85C38] text-white"
                    : "bg-[#F1E8DC] text-[#51483F] border border-[#DDD0C0] hover:bg-[#EDE2D3]"
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
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between px-4 sm:px-6 border-b border-[#E3D8CB] bg-[#FBF8F2]/95 backdrop-blur-md shadow-xs">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenMobile}
          aria-label={localize("Open navigation", dir)}
          className="flex size-9 items-center justify-center rounded-lg border border-[#DDD0C0] bg-[#FFFDFC] text-[#51483F] hover:text-[#2F2924] hover:border-[#B85C38]/40 hover:bg-[#F1E8DC] transition lg:hidden"
        >
          <Menu className="size-5" />
        </button>
        <div className="hidden lg:flex items-center gap-2.5 min-w-0">
          <span className="font-mono text-[13px] sm:text-sm font-bold tracking-wider text-[#40372F] uppercase">
            EduAccess AI
          </span>
          <span className="text-[#DDD0C0] font-mono text-sm select-none" aria-hidden>/</span>
          <span className="font-mono text-[12px] sm:text-[13px] font-bold tracking-wider text-[#B85C38] uppercase bg-[#FFF8F4] border border-[#E8C2B2] px-2.5 py-0.5 rounded-md shadow-xs">
            {crumb}
          </span>
        </div>
        <div className="lg:hidden flex items-center gap-2.5 min-w-0">
          <LogoMark small dir={dir} />
          <span className="font-mono text-xs sm:text-sm font-bold tracking-wide text-[#40372F] uppercase truncate">
            {crumb}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E4F0E5] border border-[#B9D2BC] shadow-xs">
          <span className="size-2 rounded-full bg-[#5F8A62] ring-2 ring-[#5F8A62]/30 animate-pulse" aria-hidden />
          <span className="text-xs sm:text-[12.5px] font-mono font-bold text-[#416A47] tracking-wide">
            {localize("Ready", dir)}
          </span>
        </div>
        <button
          onClick={() => {
            const ev = new CustomEvent("eduaccess-toggle-language");
            window.dispatchEvent(ev);
          }}
          aria-label={localize("Switch reading direction", dir)}
          className="inline-flex items-center gap-2 rounded-lg border border-[#DDD0C0] bg-[#FFFDFC] px-3 py-1.5 text-xs sm:text-sm font-mono font-bold text-[#51483F] hover:text-[#2F2924] hover:border-[#B85C38]/60 hover:bg-[#FFF8F4] transition shadow-xs focus:outline-none focus:ring-2 focus:ring-[#B85C38]/30 cursor-pointer"
          dir="ltr"
        >
          <Accessibility className="size-4 text-[#B85C38]" aria-hidden />
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
      <div dir={dir} className="flex min-h-screen bg-[#F7F1E8] text-[#2F2924]">
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
            "fixed bottom-28 z-30 md:hidden rounded-full border border-[#DDD0C0] bg-[#FFFDFC] px-3 py-2 text-[11px] font-bold text-[#51483F] shadow-xs transition hover:text-[#B85C38] hover:border-[#B85C38]",
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
