"use client";

import type { AnalystSignal } from "@/lib/api";
import SignalBadge from "./SignalBadge";

interface Props {
  signals: AnalystSignal[];
}

const GLYPH: Record<string, string> = {
  technical_analyst: "▲",
  fundamental_analyst: "◆",
  valuation_analyst: "◇",
  sentiment_analyst: "◉",
};

export default function AnalystPanel({ signals }: Props) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {signals.map((s) => (
        <div key={s.analyst} className="surface flex items-start gap-3 p-4">
          <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--border-strong)] bg-[var(--bg-elev)] text-[10px] text-accent">
            {GLYPH[s.analyst] ?? "∘"}
          </span>
          <div className="flex-1">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-[13px] font-medium">
                {s.analyst_display}
              </span>
              <SignalBadge signal={s.signal} size="sm" />
              <span className="ml-auto text-[11px] text-dim">
                置信度 {Math.round(s.confidence * 100)}%
              </span>
            </div>
            <p className="text-[13px] leading-relaxed text-muted">
              {s.reasoning}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
