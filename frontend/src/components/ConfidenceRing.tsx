"use client";

interface Props {
  value: number; // 0-1
  size?: number;
  label?: string;
}

export default function ConfidenceRing({
  value,
  size = 80,
  label = "置信度",
}: Props) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(1, Math.max(0, value)));
  const pct = Math.round(value * 100);

  const color =
    value > 0.6
      ? "stroke-emerald-400"
      : value > 0.3
        ? "stroke-amber-400"
        : "stroke-slate-500";

  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        width={size}
        height={size}
        className="-rotate-90"
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={4}
          className="stroke-white/5"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={4}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={`${color} transition-all duration-700`}
        />
      </svg>
      <span className="absolute mt-6 text-xl font-bold">{pct}%</span>
      <span className="mt-1 text-xs text-slate-500">{label}</span>
    </div>
  );
}
