"use client";

interface Props {
  signal: "bullish" | "bearish" | "neutral";
  size?: "sm" | "md" | "lg";
}

const CONFIG = {
  bullish: {
    label: "看多",
    bg: "bg-[rgba(52,211,153,0.1)]",
    border: "border-[rgba(52,211,153,0.25)]",
    text: "text-gain",
    dot: "bg-gain",
  },
  bearish: {
    label: "看空",
    bg: "bg-[rgba(248,113,113,0.1)]",
    border: "border-[rgba(248,113,113,0.25)]",
    text: "text-loss",
    dot: "bg-loss",
  },
  neutral: {
    label: "中性",
    bg: "bg-white/[0.04]",
    border: "border-[var(--border)]",
    text: "text-muted",
    dot: "bg-[var(--fg-dim)]",
  },
};

const SIZE = {
  sm: "text-[10.5px] px-1.5 py-0.5",
  md: "text-xs px-2.5 py-0.5",
  lg: "text-sm px-3 py-1",
};

export default function SignalBadge({ signal, size = "md" }: Props) {
  const c = CONFIG[signal];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border font-medium ${c.bg} ${c.border} ${c.text} ${SIZE[size]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}
