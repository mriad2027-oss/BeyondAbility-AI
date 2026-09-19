"use client";

import { useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { PageLoader } from "@/components/ui/loading";

export default function AgentRedirectPage() {
  return (
    <Suspense fallback={<PageLoader label="Redirecting to Learning Agent..." />}>
      <AgentRedirectBody />
    </Suspense>
  );
}

function AgentRedirectBody() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/learning?tab=agent");
  }, [router]);

  return <PageLoader label="Redirecting to Learning Intelligence (Agent)..." />;
}
