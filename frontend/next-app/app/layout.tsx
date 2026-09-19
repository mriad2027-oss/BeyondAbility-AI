import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import AppShell from "@/components/layout/AppShell";
import { PageLoader } from "@/components/ui/loading";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "EduAccess AI — Accessible Lecture Intelligence",
  description:
    "Turns educational videos into accessible learning experiences: captions, audio descriptions, grounded Ask-the-Video, adaptive quizzes and 'What am I missing?'",
  icons: {
    icon: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#F7F8FC",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" className={inter.variable}>
      <body className="font-sans">
        <AppShell>
          <Suspense fallback={<PageLoader label="Loading…" />}>{children}</Suspense>
        </AppShell>
      </body>
    </html>
  );
}
