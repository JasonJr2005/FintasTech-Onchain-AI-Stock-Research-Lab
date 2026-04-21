"use client";

import { Suspense } from "react";
import AnalysisView from "./AnalysisView";

export default function AnalysisPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      }
    >
      <AnalysisView />
    </Suspense>
  );
}
