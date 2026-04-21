"use client";

interface Props {
  signal: "bullish" | "bearish" | "neutral";
  weightPct: number;
}

const CFG: Record<
  Props["signal"],
  { label: string; glyph: string; tint: string; border: string }
> = {
  bullish: {
    label: "模型方向 · 看多",
    glyph: "↗",
    tint: "bg-[rgba(52,211,153,0.08)] text-gain",
    border: "border-[rgba(52,211,153,0.25)]",
  },
  bearish: {
    label: "模型方向 · 看空",
    glyph: "↘",
    tint: "bg-[rgba(248,113,113,0.08)] text-loss",
    border: "border-[rgba(248,113,113,0.25)]",
  },
  neutral: {
    label: "模型方向 · 中性",
    glyph: "→",
    tint: "bg-white/[0.03] text-muted",
    border: "border-[var(--border-strong)]",
  },
};

export default function ActionCard({ signal, weightPct }: Props) {
  const c = CFG[signal] ?? CFG.neutral;
  return (
    <div
      className={`min-w-[260px] rounded-2xl border p-6 ${c.tint} ${c.border}`}
    >
      <div className="mb-2 text-3xl leading-none">{c.glyph}</div>
      <h3 className="text-base font-semibold">{c.label}</h3>
      {signal !== "neutral" && (
        <p className="mt-1 text-[13px] text-muted">
          示意模拟盘权重{" "}
          <span className="font-mono text-white">
            {weightPct.toFixed(1)}%
          </span>
          （仅供学习 · 非建议）
        </p>
      )}
      <p className="mt-4 text-[10px] uppercase tracking-[0.16em] text-dim">
        Research Signal · Not Investment Advice
      </p>
    </div>
  );
}
