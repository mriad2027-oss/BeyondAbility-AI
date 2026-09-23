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
    const job = searchParams.get("job") || searchParams.get("jobId");
    if (job) {
      router.replace(`/lectures/${encodeURIComponent(job)}?tab=report`);
    } else {
      router.replace("/lectures");
    }
  }, [router, searchParams]);

  return <PageLoader label="Opening Accessibility Report..." />;
}