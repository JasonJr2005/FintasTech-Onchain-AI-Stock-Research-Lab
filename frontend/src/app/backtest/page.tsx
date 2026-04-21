"use client";

import { useState } from "react";
import { runBacktest, type BacktestResponse } from "@/lib/api";
import StockSearch from "@/components/StockSearch";
import { useT } from "@/lib/i18n/context";

export default function BacktestPage() {
  const { t } = useT();
  const [symbols, setSymbols] = useState<string[]>(["AAPL", "MSFT"]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [capital, setCapital] = useState("100000");
  const [risk, setRisk] = useState("moderate");
  const [rebalDays, setRebalDays] = useState("20");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BacktestResponse | null>(null);
  const [error, setError] = useState("");

  function addSymbol(sym: string) {
    const s = sym.toUpperCase();
    if (!symbols.includes(s)) setSymbols([...symbols, s]);
  }

  async function submit() {
    if (symbols.length === 0) {
      setError("请至少添加一只股票");
      return;
    }
    setError("");
    setLoading(true);
    setResult(null);
    try {
      const resp = await runBacktest({
        symbols,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        initial_capital: Number(capital) || 100000,
        risk_tolerance: risk,
        rebalance_days: Number(rebalDays) || 20,
      });
      setResult(resp);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "回测失败");
    } finally {
      setLoading(false);
    }
  }

  const maxVal = result ? Math.max(...result.equity_curve.map((p) => p.value)) : 0;
  const minVal = result ? Math.min(...result.equity_curve.map((p) => p.value)) : 0;

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-10">
      <div className="mb-8">
        <div className="mb-2 inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-accent">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          {t("backtest.tag")}
        </div>
        <h2 className="text-3xl font-semibold tracking-tight">{t("backtest.title")}</h2>
        <p className="mt-1 text-sm text-muted">{t("backtest.subtitle")}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="surface p-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-dim">
              股票池
            </label>
            <StockSearch onSelect={addSymbol} placeholder="添加股票…" fullWidth />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {symbols.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-elev)] py-1 pl-2 pr-1 font-mono text-[12px] text-white"
                >
                  {s}
                  <button
                    onClick={() => setSymbols(symbols.filter((x) => x !== s))}
                    className="flex h-4 w-4 items-center justify-center rounded text-dim hover:bg-[rgba(248,113,113,0.12)] hover:text-[#fca5a5]"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="起始日期">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input-base"
              />
            </Field>
            <Field label="结束日期">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input-base"
              />
            </Field>
          </div>
          <Field label="初始资金（美元）">
            <input
              value={capital}
              onChange={(e) => setCapital(e.target.value)}
              type="number"
              className="input-base"
            />
          </Field>
          <Field label="调仓周期（天）">
            <input
              value={rebalDays}
              onChange={(e) => setRebalDays(e.target.value)}
              type="number"
              className="input-base"
            />
          </Field>
          <Field label="风险偏好">
            <select
              value={risk}
              onChange={(e) => setRisk(e.target.value)}
              className="input-base"
            >
              <option value="conservative">保守型</option>
              <option value="moderate">稳健型</option>
              <option value="aggressive">进取型</option>
            </select>
          </Field>
          <button onClick={submit} disabled={loading} className="btn-primary w-full">
            {loading ? "回测运行中…" : "开始回测"}
          </button>
          {error && <p className="text-xs text-loss">{error}</p>}
        </div>

        <div>
          {loading && (
            <div className="surface flex h-64 flex-col items-center justify-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              <p className="text-sm text-muted">正在回测，加载历史数据并模拟交易…</p>
            </div>
          )}

          {!loading && !result && (
            <div className="surface flex h-64 items-center justify-center p-10 text-center text-sm text-dim">
              在左侧配置后点击「开始回测」，结果将显示在这里
            </div>
          )}

          {result && (
            <div className="space-y-6">
              {(result.notes || (result.dropped_symbols && result.dropped_symbols.length > 0)) && (
                <div className="surface border-[rgba(251,191,36,0.25)] bg-[rgba(251,191,36,0.05)] p-4 text-sm text-warn">
                  {result.notes && <p className="leading-relaxed">{result.notes}</p>}
                  {result.dropped_symbols && result.dropped_symbols.length > 0 && (
                    <p className="mt-1 text-[11px] text-dim">
                      已跳过：
                      <span className="font-mono">
                        {result.dropped_symbols.join(", ")}
                      </span>
                    </p>
                  )}
                  {result.loaded_symbols && result.loaded_symbols.length > 0 && (
                    <p className="mt-0.5 text-[11px] text-dim">
                      实际参与回测：
                      <span className="font-mono">
                        {result.loaded_symbols.join(", ")}
                      </span>
                    </p>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <KPI label="最终净值" value={`$${result.final_value.toLocaleString()}`} />
                <KPI
                  label="总收益"
                  value={`${result.total_return_pct >= 0 ? "+" : ""}${result.total_return_pct.toFixed(2)}%`}
                  tone={result.total_return_pct >= 0 ? "gain" : "loss"}
                />
                <KPI
                  label="年化收益"
                  value={`${result.annualized_return_pct >= 0 ? "+" : ""}${result.annualized_return_pct.toFixed(2)}%`}
                  tone={result.annualized_return_pct >= 0 ? "gain" : "loss"}
                />
                <KPI
                  label="最大回撤"
                  value={`${result.max_drawdown_pct.toFixed(2)}%`}
                  tone="loss"
                />
                <KPI
                  label="夏普比率"
                  value={result.sharpe_ratio != null ? result.sharpe_ratio.toFixed(2) : "—"}
                />
                <KPI label="交易次数" value={String(result.trades)} />
                <KPI
                  label="初始资金"
                  value={`$${result.initial_capital.toLocaleString()}`}
                />
                <KPI label="数据天数" value={String(result.equity_curve.length)} />
              </div>

              {result.equity_curve.length > 0 && (
                <div className="surface p-6">
                  <h4 className="mb-4 text-xs font-medium uppercase tracking-wider text-dim">
                    净值曲线
                  </h4>
                  <div className="relative h-56 w-full">
                    <svg
                      viewBox={`0 0 ${result.equity_curve.length} 100`}
                      className="h-full w-full"
                      preserveAspectRatio="none"
                    >
                      <defs>
                        <linearGradient id="btArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.32" />
                          <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
                        </linearGradient>
                        <linearGradient id="btLine" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#a78bfa" />
                          <stop offset="100%" stopColor="#4f46e5" />
                        </linearGradient>
                      </defs>
                      <polygon
                        fill="url(#btArea)"
                        points={
                          "0,100 " +
                          result.equity_curve
                            .map(
                              (p, i) =>
                                `${i},${100 - ((p.value - minVal) / (maxVal - minVal + 1)) * 90 - 5}`,
                            )
                            .join(" ") +
                          ` ${result.equity_curve.length - 1},100`
                        }
                      />
                      <polyline
                        fill="none"
                        stroke="url(#btLine)"
                        strokeWidth="0.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={result.equity_curve
                          .map(
                            (p, i) =>
                              `${i},${100 - ((p.value - minVal) / (maxVal - minVal + 1)) * 90 - 5}`,
                          )
                          .join(" ")}
                      />
                    </svg>
                    <div className="absolute bottom-0 left-0 flex w-full justify-between text-[10px] text-dim">
                      <span>{result.equity_curve[0]?.date}</span>
                      <span>
                        {result.equity_curve[result.equity_curve.length - 1]?.date}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-dim">
        {label}
      </label>
      {children}
    </div>
  );
}
function KPI({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "gain" | "loss";
}) {
  const color =
    tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : "text-white";
  return (
    <div className="surface px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider text-dim">{label}</p>
      <p className={`mt-1 font-mono text-lg font-semibold tabular ${color}`}>{value}</p>
    </div>
  );
}
