"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getPresets,
  getSimulationState,
  rebalanceSimulation,
  type SimulationState,
  type WatchlistPreset,
} from "@/lib/api";
import { useT } from "@/lib/i18n/context";

export default function Landing() {
  const router = useRouter();
  const { t, locale } = useT();
  const [state, setState] = useState<SimulationState | null>(null);
  const [presets, setPresets] = useState<WatchlistPreset[]>([]);
  const [starting, setStarting] = useState(false);
  const [progress, setProgress] = useState("");

  useEffect(() => {
    getSimulationState().then(setState).catch(() => setState(null));
    getPresets().then(setPresets).catch(() => setPresets([]));
  }, []);

  const hasPositions = (state?.holdings?.length ?? 0) > 0;

  async function startOneClick(preset: WatchlistPreset) {
    setStarting(true);
    setProgress(t("home.presets.starting.progress", { name: preset.label }));
    try {
      const s = await rebalanceSimulation(preset.symbols, "moderate");
      setState(s);
      setProgress(t("home.presets.starting.done"));
      setTimeout(() => router.push("/simulation"), 600);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setProgress(t("home.presets.starting.failed", { msg }));
      setStarting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-8 py-12">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--bg-elev)]/50 px-10 py-14">
        <div className="absolute -right-40 -top-40 h-96 w-96 rounded-full bg-accent-gradient opacity-20 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="relative">
          <span className="chip">
            <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-accent" />
            <span className="font-mono text-[11px] tracking-wider text-accent">
              {t("home.versionTag")}
            </span>
          </span>
          <h1 className="mt-5 text-5xl font-semibold tracking-tight">
            {t("home.heroPre")}{" "}
            <span className="bg-accent-gradient bg-clip-text text-transparent">
              {t("home.heroEmph")}
            </span>
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
            {t("home.heroDesc")}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/simulation" className="btn-primary">
              {t("home.ctaSim")}
            </Link>
            <Link href="/analysis" className="btn-ghost">
              {t("home.ctaAnalysis")}
            </Link>
            <Link href="/vault" className="btn-ghost">
              {t("home.ctaVault")}
            </Link>
          </div>

          {state && (
            <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
              <MiniStat
                label={t("home.stat.equity")}
                value={`$${Math.round(state.equity).toLocaleString()}`}
              />
              <MiniStat
                label={t("home.stat.return")}
                value={`${state.total_return_pct >= 0 ? "+" : ""}${state.total_return_pct.toFixed(2)}%`}
                tone={state.total_return_pct >= 0 ? "gain" : "loss"}
              />
              <MiniStat
                label={t("home.stat.holdings")}
                value={String(state.holdings.length)}
              />
              <MiniStat
                label={t("home.stat.lastCycle")}
                value={
                  state.last_rebalance_at
                    ? new Date(state.last_rebalance_at).toLocaleDateString(
                        locale === "zh" ? "zh-CN" : "en-US",
                      )
                    : "—"
                }
              />
            </div>
          )}
        </div>
      </section>

      {/* One-click presets */}
      <section className="mt-14">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              {t("home.presets.title")}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {t("home.presets.subtitle")}
            </p>
          </div>
          {starting && (
            <div className="flex items-center gap-2 text-xs text-accent">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              {progress}
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {presets.map((p) => (
            <button
              key={p.key}
              onClick={() => startOneClick(p)}
              disabled={starting}
              className="surface surface-hover group relative overflow-hidden p-5 text-left disabled:opacity-50"
            >
              <div className="absolute right-4 top-4 text-[10px] font-mono uppercase tracking-wider text-dim">
                {p.region}
              </div>
              <h3 className="mb-1.5 text-base font-semibold tracking-tight">
                {p.label}
              </h3>
              <p className="mb-4 text-xs leading-relaxed text-muted">
                {p.description}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {p.symbols.map((s) => (
                  <span
                    key={s}
                    className="rounded-md border border-[var(--border)] bg-[var(--bg-elev)] px-1.5 py-0.5 font-mono text-[10px] text-muted"
                  >
                    {s}
                  </span>
                ))}
              </div>
              <span className="mt-4 inline-flex items-center gap-1 text-[11px] font-medium text-accent opacity-0 transition-opacity group-hover:opacity-100">
                {t("home.presets.running")}
              </span>
            </button>
          ))}
        </div>

        {!presets.length && !starting && (
          <div className="surface p-6 text-center text-sm text-muted">
            {t("home.presets.noBackend")}
          </div>
        )}
      </section>

      {/* How it works */}
      <section className="mt-16">
        <h2 className="mb-6 text-2xl font-semibold tracking-tight">
          {t("home.how.title")}
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Step n="1" title={t("home.how.step1.title")} body={t("home.how.step1.body")} />
          <Step n="2" title={t("home.how.step2.title")} body={t("home.how.step2.body")} />
          <Step n="3" title={t("home.how.step3.title")} body={t("home.how.step3.body")} />
        </div>
      </section>

      <section className="mt-16 rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)]/60 p-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[rgba(251,191,36,0.3)] bg-[rgba(251,191,36,0.08)] text-[10px] font-semibold text-warn">
            !
          </span>
          <div className="text-[13px] leading-relaxed text-muted">
            {t("home.notice")}
            {hasPositions && <> {t("home.notice.hasPositions")}</>}
          </div>
        </div>
      </section>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "gain" | "loss";
}) {
  const color = tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : "text-white";
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-dim">{label}</p>
      <p className={`mt-1 font-mono text-xl font-semibold tabular ${color}`}>
        {value}
      </p>
    </div>
  );
}

function Step({
  n,
  title,
  body,
}: {
  n: string;
  title: string;
  body: string;
}) {
  return (
    <div className="surface p-6">
      <div className="mb-3 inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border-strong)] bg-accent-gradient font-mono text-xs font-semibold text-white">
        {n}
      </div>
      <h3 className="mb-2 text-base font-semibold tracking-tight">{title}</h3>
      <p className="text-sm leading-relaxed text-muted">{body}</p>
    </div>
  );
}
