"use client";

import { useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { PageLoader } from "@/components/ui/loading";

export default function LearningGapsRedirectPage() {
  return (
    <Suspense fallback={<PageLoader label="Redirecting to Learning Gaps..." />}>
      <LearningGapsRedirectBody />
    </Suspense>
  );
}

function LearningGapsRedirectBody() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/learning?tab=gaps");
  }, [router]);

  return <PageLoader label="Redirecting to Learning Intelligence (Learning Gaps)..." />;
}
