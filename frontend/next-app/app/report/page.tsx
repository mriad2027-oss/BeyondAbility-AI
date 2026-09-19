"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageLoader } from "@/components/ui/loading";

export default function ReportRedirectPage() {
  return (
    <Suspense fallback={<PageLoader label="Redirecting to Accessibility Report..." />}>
      <ReportRedirectBody />
    </Suspense>
  );
}

function ReportRedirectBody() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const job = searchParams.get("job") || searchParams.get("jobId") || "DEMO_python_loops";
    router.replace(`/lectures/${encodeURIComponent(job)}?tab=report`);
  }, [router, searchParams]);

  return <PageLoader label="Redirecting to Accessibility Workspace (Report)..." />;
}