"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { AnalysisResult } from "@/lib/api";
import { analyzeSymbol, rebalanceSimulation } from "@/lib/api";
import SignalBadge from "@/components/SignalBadge";
import RiskGauge from "@/components/RiskGauge";
import AnalystPanel from "@/components/AnalystPanel";
import ActionCard from "@/components/ActionCard";
import StockSearch from "@/components/StockSearch";
import { currencySymbol, fmtPrice, inferCurrency } from "@/lib/format";
import { useT } from "@/lib/i18n/context";

const RISK_KEY = "fintastech.risk.v1";

export default function AnalysisView() {
  const { t } = useT();
  const params = useSearchParams();
  const router = useRouter();
  const initial = params.get("symbol") ?? "AAPL";

  const [symbol, setSymbol] = useState(initial);
  const [risk, setRisk] = useState("moderate");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [addingToSim, setAddingToSim] = useState(false);
  const [fetchErr, setFetchErr] = useState<string>("");

  // Pick up the user's persisted risk choice from /settings (if any).
  useEffect(() => {
    try {
      const r = localStorage.getItem(RISK_KEY);
      if (r) setRisk(r);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setFetchErr("");
    analyzeSymbol(symbol, risk)
      .then((r) => {
        setResult(r);
      })
      .catch((e) => {
        setResult(null);
        setFetchErr(e instanceof Error ? e.message : String(e));
      })
      .finally(() => setLoading(false));
  }, [symbol, risk]);

  const currency = result?.currency || inferCurrency(symbol);
  const sym = currencySymbol(currency);

  const coreSignals =
    result?.signals?.filter((s) =>
      [
        "technical_analyst",
        "fundamental_analyst",
        "valuation_analyst",
        "sentiment_analyst",
      ].includes(s.analyst),
    ) ?? [];
  const masterSignals =
    result?.signals?.filter(
      (s) =>
        ![
          "technical_analyst",
          "fundamental_analyst",
          "valuation_analyst",
          "sentiment_analyst",
        ].includes(s.analyst),
    ) ?? [];

  async function addToSimulation() {
    setAddingToSim(true);
    try {
      await rebalanceSimulation([symbol], risk);
      router.push("/simulation");
    } catch {
      setAddingToSim(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            {t("analysis.tag")}
          </div>
          <h2 className="text-3xl font-semibold tracking-tight">{t("analysis.title")}</h2>
          <p className="mt-1 text-sm text-muted">{t("analysis.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <StockSearch
            onSelect={(sym) => setSymbol(sym)}
            placeholder="AAPL · 0700.HK · 600519.SS …"
          />
          <select
            value={risk}
            onChange={(e) => setRisk(e.target.value)}
            className="input-base !w-auto min-w-[9rem] !py-2 font-medium"
          >
            <option value="conservative">保守型</option>
            <option value="moderate">稳健型</option>
            <option value="aggressive">进取型</option>
          </select>
        </div>
      </div>

      {loading && (
        <div className="surface flex h-72 flex-col items-center justify-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="text-sm text-muted">
            正在获取 <span className="font-mono text-white">{symbol}</span>{" "}
            的实时数据并运行 18 位分析师…
          </p>
        </div>
      )}

      {!loading && fetchErr && (
        <div className="surface p-10 text-center">
          <p className="text-loss">请求失败：{fetchErr}</p>
          <p className="mt-2 text-sm text-muted">
            后端未启动或网络错误 — 请运行 <code className="font-mono text-accent">./start.sh</code> 后重试。
          </p>
        </div>
      )}

      {!loading && !fetchErr && result?.error && (
        <div className="surface p-10 text-center">
          <p className="text-loss">无法分析 {symbol}：{result.error}</p>
          <p className="mt-2 text-sm text-muted">
            请检查代码是否正确（美股 <code className="font-mono text-accent">AAPL</code>{" "}
            · 港股 <code className="font-mono text-accent">0700.HK</code>{" "}
            · A 股 <code className="font-mono text-accent">600519.SS</code> /{" "}
            <code className="font-mono text-accent">000001.SZ</code>）
          </p>
        </div>
      )}

      {!loading && !fetchErr && result && !result.error && (
        <div className="space-y-8">
          {/* Hero */}
          <div className="surface flex flex-wrap items-start gap-8 p-7">
            <div className="flex-1">
              <div className="mb-1.5 flex items-center gap-3">
                <h2 className="font-mono text-3xl font-semibold tracking-tight">
                  {result.symbol}
                </h2>
                <SignalBadge signal={result.overall_signal} size="lg" />
                <span className="chip chip-neutral">
                  {currency}
                  {result.exchange ? ` · ${result.exchange}` : ""}
                </span>
              </div>
              <p className="text-sm text-muted">{result.name}</p>
              <p className="mt-5 font-mono text-4xl font-semibold tabular">
                {result.current_price > 0 ? (
                  fmtPrice(result.current_price, currency)
                ) : (
                  <span className="text-dim">—</span>
                )}
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  onClick={addToSimulation}
                  disabled={addingToSim || result.current_price === 0}
                  className="btn-primary"
                >
                  {addingToSim ? "加入中…" : "加入模拟盘并运行循环 →"}
                </button>
                <a href="/simulation" className="btn-ghost">
                  查看模拟盘
                </a>
              </div>
            </div>
            <ActionCard
              signal={result.overall_signal}
              weightPct={result.illustrative_weight_pct}
            />
          </div>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="surface flex flex-col items-center justify-center p-6">
              <div className="relative flex items-center justify-center">
                <svg width={128} height={128} className="-rotate-90">
                  <circle
                    cx={64}
                    cy={64}
                    r={54}
                    fill="none"
                    strokeWidth={6}
                    className="stroke-white/5"
                  />
                  <circle
                    cx={64}
                    cy={64}
                    r={54}
                    fill="none"
                    strokeWidth={6}
                    strokeDasharray={2 * Math.PI * 54}
                    strokeDashoffset={2 * Math.PI * 54 * (1 - result.overall_confidence)}
                    strokeLinecap="round"
                    className={`transition-all duration-700 ${
                      result.overall_confidence > 0.6
                        ? "stroke-[#34d399]"
                        : result.overall_confidence > 0.3
                          ? "stroke-accent"
                          : "stroke-[var(--fg-dim)]"
                    }`}
                  />
                </svg>
                <span className="absolute font-mono text-2xl font-semibold tabular">
                  {Math.round(result.overall_confidence * 100)}%
                </span>
              </div>
              <span className="mt-3 text-[11px] uppercase tracking-wider text-dim">
                综合置信度 · 18 位分析师
              </span>
            </div>

            <div className="surface p-6">
              <h4 className="mb-4 text-xs font-medium uppercase tracking-wider text-dim">
                风险评估
              </h4>
              <RiskGauge score={result.risk_score} />
              <div className="mt-4 space-y-1.5 text-[12px] text-muted">
                {result.technical.volatility_pct != null && (
                  <Row
                    label="年化波动率"
                    value={`${Number(result.technical.volatility_pct).toFixed(1)}%`}
                  />
                )}
                <Row label="趋势方向" value={String(result.technical.trend || "—")} />
                <Row label="动量强度" value={String(result.technical.momentum || "—")} />
              </div>
            </div>

            <div className="surface p-6">
              <h4 className="mb-4 text-xs font-medium uppercase tracking-wider text-dim">
                技术指标
              </h4>
              <div className="space-y-1.5 text-[12px]">
                <Ind label="RSI (14)" value={result.technical.rsi} />
                <Ind label="MA10" value={result.technical.ma_short} prefix={sym} />
                <Ind label="MA50" value={result.technical.ma_long} prefix={sym} />
                <Ind label="MACD" value={result.technical.macd} precision={4} />
                <Ind
                  label="布林上轨"
                  value={result.technical.bollinger_upper}
                  prefix={sym}
                />
                <Ind
                  label="布林下轨"
                  value={result.technical.bollinger_lower}
                  prefix={sym}
                />
              </div>
            </div>
          </div>

          {/* Core analysts */}
          <div>
            <h3 className="mb-4 text-base font-semibold tracking-tight">
              核心分析师
            </h3>
            <AnalystPanel signals={coreSignals} />
          </div>

          {masterSignals.length > 0 && (
            <div>
              <h3 className="mb-4 text-base font-semibold tracking-tight">
                金融大师意见 ·{" "}
                <span className="text-muted">{masterSignals.length} 位</span>
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                {masterSignals.map((s) => (
                  <div key={s.analyst} className="surface p-4">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-medium">{s.analyst_display}</span>
                      <SignalBadge signal={s.signal} size="sm" />
                      <span className="ml-auto text-[11px] text-dim">
                        置信度 {Math.round(s.confidence * 100)}%
                      </span>
                    </div>
                    <p className="text-[13px] leading-relaxed text-muted">
                      {s.reasoning}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="surface p-6">
            <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-dim">
              综合分析摘要
            </h3>
            <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-muted">
              {result.summary}
            </pre>
          </div>

          <p className="text-center text-[11px] text-dim">
            {result.disclaimer} · EDUCATIONAL USE ONLY · NOT INVESTMENT ADVICE
          </p>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-dim">{label}</span>
      <span className="font-mono tabular text-white">{value}</span>
    </div>
  );
}
function Ind({
  label,
  value,
  prefix = "",
  precision = 2,
}: {
  label: string;
  value: unknown;
  prefix?: string;
  precision?: number;
}) {
  const display =
    value != null ? `${prefix}${Number(value).toFixed(precision)}` : "—";
  return (
    <div className="flex items-center justify-between">
      <span className="text-dim">{label}</span>
      <span className="font-mono tabular text-white">{display}</span>
    </div>
  );
}
