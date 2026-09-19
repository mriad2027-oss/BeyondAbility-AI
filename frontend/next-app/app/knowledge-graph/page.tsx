"use client";

import { useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { PageLoader } from "@/components/ui/loading";

export default function KnowledgeGraphRedirectPage() {
  return (
    <Suspense fallback={<PageLoader label="Redirecting to Knowledge Graph..." />}>
      <KnowledgeGraphRedirectBody />
    </Suspense>
  );
}

function KnowledgeGraphRedirectBody() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/learning?tab=graph");
  }, [router]);

  return <PageLoader label="Redirecting to Learning Intelligence (Knowledge Graph)..." />;
}
