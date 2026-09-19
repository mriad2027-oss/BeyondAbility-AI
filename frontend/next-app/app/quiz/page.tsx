"use client";

import { useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { PageLoader } from "@/components/ui/loading";

export default function QuizRedirectPage() {
  return (
    <Suspense fallback={<PageLoader label="Redirecting to Adaptive Quiz..." />}>
      <QuizRedirectBody />
    </Suspense>
  );
}

function QuizRedirectBody() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/learning?tab=quiz");
  }, [router]);

  return <PageLoader label="Redirecting to Learning Intelligence (Quiz)..." />;
}