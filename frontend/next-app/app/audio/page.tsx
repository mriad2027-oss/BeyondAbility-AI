"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageLoader } from "@/components/ui/loading";

export default function AudioRedirectPage() {
  return (
    <Suspense fallback={<PageLoader label="Redirecting to Audio Description..." />}>
      <AudioRedirectBody />
    </Suspense>
  );
}

function AudioRedirectBody() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const job = searchParams.get("job") || searchParams.get("jobId") || "DEMO_python_loops";
    router.replace(`/lectures/${encodeURIComponent(job)}?tab=audio`);
  }, [router, searchParams]);

  return <PageLoader label="Redirecting to Accessibility Workspace (Audio Description)..." />;
}
