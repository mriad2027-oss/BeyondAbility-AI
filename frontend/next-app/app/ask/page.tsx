"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageLoader } from "@/components/ui/loading";

export default function AskRedirectPage() {
  return (
    <Suspense fallback={<PageLoader label="Redirecting to Ask the Video..." />}>
      <AskRedirectBody />
    </Suspense>
  );
}

function AskRedirectBody() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const job = searchParams.get("job") || searchParams.get("jobId");
    if (job) {
      router.replace(`/lectures/${encodeURIComponent(job)}?tab=ask`);
    } else {
      router.replace("/lectures");
    }
  }, [router, searchParams]);

  return <PageLoader label="Opening Video QA Console..." />;
}