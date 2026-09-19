"use client";

import { useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { PageLoader } from "@/components/ui/loading";

export default function ProgressRedirectPage() {
  return (
    <Suspense fallback={<PageLoader label="Redirecting to Student Progress..." />}>
      <ProgressRedirectBody />
    </Suspense>
  );
}

function ProgressRedirectBody() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/learning?tab=progress");
  }, [router]);

  return <PageLoader label="Redirecting to Learning Intelligence (Progress)..." />;
}