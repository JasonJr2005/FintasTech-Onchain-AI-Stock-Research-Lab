"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import SignalBadge from "@/components/SignalBadge";
import StockSearch from "@/components/StockSearch";
import {
  buySimulation,
  closeSimulationPosition,
  getPresets,
  getSimulationState,
  rebalanceSimulation,
  refreshSimulationPrices,
  resetSimulation,
  sellSimulation,
  type ResearchSignal,
  type SimulationState,
  type WatchlistPreset,
} from "@/lib/api";
import {
  fmtMoney,
  fmtPct,
  fmtPrice,
  fmtShares,
  inferCurrency,
} from "@/lib/format";
import { useT } from "@/lib/i18n/context";

const DEFAULT_SYMBOLS = ["AAPL", "MSFT", "NVDA"];
const WATCHLIST_KEY = "fintastech.watchlist.v1";
const RISK_KEY = "fintastech.risk.v1";

type OrderMode = "shares" | "dollars";

export default function SimulationPage() {
  const { t } = useT();
  const [state, setState] = useState<SimulationState | null>(null);
  const [symbols, setSymbols] = useState<string[]>(DEFAULT_SYMBOLS);
  const [risk, setRisk] = useState("moderate");
  const [busy, setBusy] = useState<string>("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [presets, setPresets] = useState<WatchlistPreset[]>([]);
  const [lastResearch, setLastResearch] = useState<ResearchSignal[]>([]);

  // Manual-order form state
  const [orderSymbol, setOrderSymbol] = useState("");
  const [orderMode, setOrderMode] = useState<OrderMode>("dollars");
  const [orderAmount, setOrderAmount] = useState("");

  // Initial load
  useEffect(() => {
    try {
      const raw = localStorage.getItem(WATCHLIST_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) setSymbols(parsed);
      }
      const r = localStorage.getItem(RISK_KEY);
      if (r) setRisk(r);
    } catch {
      /* ignore */
    }
    getPresets().then(setPresets).catch(() => setPresets([]));
  }, []);

  // Persist watch-list + risk
  useEffect(() => {
    try {
      localStorage.setItem(WATCHLIST_KEY, JSON.stringify(symbols));
    } catch {
      /* ignore */
    }
  }, [symbols]);
  useEffect(() => {
    try {
      localStorage.setItem(RISK_KEY, risk);
    } catch {
      /* ignore */
    }
  }, [risk]);

  const refresh = useCallback(async () => {
    try {
      const s = await getSimulationState();
      setState(s);
    } catch (e) {
      setErr(
        `无法获取模拟盘状态：${e instanceof Error ? e.message : String(e)}（请确认后端已启动：./start.sh）`,
      );
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function clearMsgs() {
    setErr("");
    setInfo("");
  }

  async function doRebalance() {
    if (symbols.length === 0) {
      setErr("请先添加至少一只股票");
      return;
    }
    setBusy("rebalance");
    clearMsgs();
    try {
      const s = await rebalanceSimulation(symbols, risk);
      setState(s);
      if (s.research_signals && s.research_signals.length > 0) {
        setLastResearch(s.research_signals);
        const tradedThisCycle = s.research_signals.filter((r) => r.weight_pct > 0).length;
        setInfo(
          tradedThisCycle === 0
            ? "本轮所有标的综合信号为中性 / 看空；Paper 盘不做多空操作，故无交易。"
            : `本轮研究已完成，涉及 ${s.research_signals.length} 只标的。`,
        );
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  }

  async function doReset() {
    if (
      !confirm("确定要清空所有虚拟持仓并把资金重置为 $100,000 吗？此操作不可撤销。")
    )
      return;
    setBusy("reset");
    clearMsgs();
    try {
      const s = await resetSimulation(100000);
      setState(s);
      setLastResearch([]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  }

  async function doRefreshPrices() {
    setBusy("refresh");
    clearMsgs();
    try {
      const s = await refreshSimulationPrices();
      setState(s);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  }

  async function doManualOrder(side: "buy" | "sell") {
    clearMsgs();
    const sym = orderSymbol.trim().toUpperCase();
    if (!sym) {
      setErr("请先输入或选择股票代码");
      return;
    }
    const amt = parseFloat(orderAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setErr("请输入一个大于 0 的数量 / 金额");
      return;
    }
    const opts =
      orderMode === "dollars" ? { notional: amt } : { shares: amt };

    setBusy(`${side}:${sym}`);
    try {
      const resp =
        side === "buy"
          ? await buySimulation(sym, opts)
          : await sellSimulation(sym, opts);
      setState(resp.state);
      setOrderAmount("");
      setInfo(
        `${side === "buy" ? "模拟买入" : "模拟卖出"} ${sym} 成功：` +
          `${fmtShares(resp.trade.shares)} 股 @ ${fmtPrice(resp.trade.price, resp.trade.currency)} · ` +
          `合计 ${fmtMoney(resp.trade.notional, resp.trade.currency)}`,
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  }

  async function doClose(sym: string) {
    clearMsgs();
    setBusy(`close:${sym}`);
    try {
      const resp = await closeSimulationPosition(sym);
      setState(resp.state);
      setInfo(
        `已清仓 ${sym}：${fmtShares(resp.trade.shares)} 股 @ ${fmtPrice(resp.trade.price, resp.trade.currency)}`,
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  }

  function addSym(sym: string) {
    const s = sym.toUpperCase().trim();
    if (!s) return;
    if (!symbols.includes(s)) setSymbols([...symbols, s]);
  }
  function removeSym(sym: string) {
    setSymbols(symbols.filter((x) => x !== sym));
  }
  function loadPreset(p: WatchlistPreset) {
    setSymbols(p.symbols);
    setInfo(`已载入 ${p.label}（${p.symbols.length} 只）`);
  }

  // Equity curve
  const curve = state?.equity_curve ?? [];
  const curveBounds = useMemo(() => {
    if (curve.length === 0) return { min: 0, max: 0 };
    const vals = curve.map((p) => p.value);
    const mn = Math.min(...vals);
    const mx = Math.max(...vals);
    const pad = Math.max((mx - mn) * 0.1, mx * 0.002, 1);
    return { min: mn - pad, max: mx + pad };
  }, [curve]);

  const equityTone = state && state.total_return_pct >= 0 ? "gain" : "loss";

  return (
    <div className="mx-auto max-w-[1440px] px-6 py-8 lg:px-10 lg:py-10">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            {t("sim.tag")}
          </div>
          <h2 className="text-3xl font-semibold tracking-tight">{t("sim.title")}</h2>
          <p className="mt-1 text-sm text-muted">{t("sim.subtitle")}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={risk}
            onChange={(e) => setRisk(e.target.value)}
            className="input-base !w-auto min-w-[10rem] !py-2 font-medium"
            aria-label="风险偏好"
          >
            <option value="conservative">保守型 · 单标 ≤ 10%</option>
            <option value="moderate">稳健型 · 单标 ≤ 20%</option>
            <option value="aggressive">进取型 · 单标 ≤ 35%</option>
          </select>
          <button
            onClick={doRefreshPrices}
            disabled={busy !== ""}
            className="btn-ghost"
            title="重新拉取所有持仓的实时价格"
          >
            {busy === "refresh" ? "刷新中…" : "刷新行情"}
          </button>
          <button
            onClick={doRebalance}
            disabled={busy !== "" || symbols.length === 0}
            className="btn-primary"
          >
            {busy === "rebalance" ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
                运行中…
              </>
            ) : (
              <>运行研究循环 · {symbols.length} 标的</>
            )}
          </button>
          <button onClick={doReset} disabled={busy !== ""} className="btn-danger">
            重置
          </button>
        </div>
      </div>

      {/* Status messages */}
      {err && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-[rgba(248,113,113,0.3)] bg-[rgba(248,113,113,0.06)] px-4 py-3 text-sm text-[#fca5a5]">
          <span className="mt-0.5 font-mono text-xs">!</span>
          <span>{err}</span>
        </div>
      )}
      {info && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-[rgba(139,92,246,0.25)] bg-[rgba(139,92,246,0.05)] px-4 py-3 text-sm text-accent">
          <span className="mt-0.5 font-mono text-xs">i</span>
          <span>{info}</span>
        </div>
      )}

      {/* KPI grid */}
      <div className="grid gap-4 md:grid-cols-5">
        <Kpi
          label="虚拟总资产"
          value={state ? fmtMoney(state.equity, "USD") : "—"}
        />
        <Kpi
          label="总收益率"
          value={state ? fmtPct(state.total_return_pct) : "—"}
          tone={equityTone}
          large
        />
        <Kpi
          label="可用现金"
          value={state ? fmtMoney(state.cash, "USD") : "—"}
          sub={
            state ? `${state.cash_pct.toFixed(1)}% 现金` : undefined
          }
        />
        <Kpi
          label="持仓市值"
          value={state ? fmtMoney(state.invested_value, "USD") : "—"}
          sub={
            state ? `${state.invested_pct.toFixed(1)}% 仓位` : undefined
          }
        />
        <Kpi
          label="持仓数 · 交易数"
          value={
            state
              ? `${state.holdings.length} · ${state.trade_count}`
              : "—"
          }
          sub="起始 $100,000"
        />
      </div>

      {/* Equity curve */}
      <div className="surface mt-6 overflow-hidden p-6">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold">模拟净值曲线</h4>
            <p className="text-[11px] text-dim">
              每次刷新行情 / 运行研究 / 下单 后自动采样
            </p>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="inline-flex items-center gap-1.5 text-muted">
              <span className="h-2 w-2 rounded-full bg-accent" /> 净值
            </span>
            <span className="inline-flex items-center gap-1.5 text-muted">
              <span className="h-[2px] w-3 bg-[var(--border-strong)]" /> 起始
              $100,000
            </span>
            {state && curve.length > 0 && (
              <span className="font-mono text-muted">
                最新 {fmtMoney(curve[curve.length - 1].value, "USD")}
              </span>
            )}
          </div>
        </div>

        <div className="relative h-56 w-full">
          {curve.length > 1 ? (
            <>
              <svg
                viewBox={`0 0 ${curve.length} 100`}
                className="h-full w-full"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="eqLine" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#a78bfa" />
                    <stop offset="100%" stopColor="#4f46e5" />
                  </linearGradient>
                </defs>
                {state && (
                  <line
                    x1="0"
                    x2={curve.length - 1}
                    y1={
                      100 -
                      ((state.initial_capital - curveBounds.min) /
                        (curveBounds.max - curveBounds.min + 1e-9)) *
                        90 -
                      5
                    }
                    y2={
                      100 -
                      ((state.initial_capital - curveBounds.min) /
                        (curveBounds.max - curveBounds.min + 1e-9)) *
                        90 -
                      5
                    }
                    stroke="rgba(255,255,255,0.10)"
                    strokeWidth="0.25"
                    strokeDasharray="1 1"
                  />
                )}
                <polygon
                  fill="url(#eqGrad)"
                  points={
                    "0,100 " +
                    curve
                      .map(
                        (p, i) =>
                          `${i},${
                            100 -
                            ((p.value - curveBounds.min) /
                              (curveBounds.max - curveBounds.min + 1e-9)) *
                              90 -
                            5
                          }`,
                      )
                      .join(" ") +
                    ` ${curve.length - 1},100`
                  }
                />
                <polyline
                  fill="none"
                  stroke="url(#eqLine)"
                  strokeWidth="0.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={curve
                    .map(
                      (p, i) =>
                        `${i},${
                          100 -
                          ((p.value - curveBounds.min) /
                            (curveBounds.max - curveBounds.min + 1e-9)) *
                            90 -
                          5
                        }`,
                    )
                    .join(" ")}
                />
              </svg>
              <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-2 font-mono text-[10px] text-dim">
                <span>{fmtMoney(curveBounds.max, "USD")}</span>
                <span>{fmtMoney(curveBounds.min, "USD")}</span>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-dim">
              运行一次研究循环，或手动下一笔模拟单，曲线就会在这里出现
            </div>
          )}
        </div>
      </div>

      {/* Main grid: left = watchlist + presets + manual order; right = holdings, research, trades */}
      <div className="mt-6 grid gap-6 xl:grid-cols-[360px_1fr]">
        {/* LEFT COLUMN */}
        <div className="space-y-6">
          {/* Manual order panel — the professional paper-trading entry point */}
          <div className="surface p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">手动下单</h3>
              <span className="chip chip-neutral">市价单 · 即时成交</span>
            </div>

            <div className="space-y-3">
              <StockSearch
                onSelect={(s) => setOrderSymbol(s)}
                placeholder="输入股票代码（AAPL / 0700.HK / 600519.SS）"
                fullWidth
                clearOnSelect={false}
              />
              {orderSymbol && (
                <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] px-3 py-2 text-[13px]">
                  <span className="font-mono text-white">{orderSymbol}</span>
                  <span className="font-mono text-[11px] text-dim">
                    {inferCurrency(orderSymbol)}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={`rounded-lg border px-3 py-2 text-xs transition ${
                    orderMode === "dollars"
                      ? "border-accent bg-[rgba(139,92,246,0.08)] text-accent"
                      : "border-[var(--border)] bg-[var(--bg-elev)] text-dim hover:text-white"
                  }`}
                  onClick={() => setOrderMode("dollars")}
                >
                  按金额
                </button>
                <button
                  type="button"
                  className={`rounded-lg border px-3 py-2 text-xs transition ${
                    orderMode === "shares"
                      ? "border-accent bg-[rgba(139,92,246,0.08)] text-accent"
                      : "border-[var(--border)] bg-[var(--bg-elev)] text-dim hover:text-white"
                  }`}
                  onClick={() => setOrderMode("shares")}
                >
                  按股数
                </button>
              </div>

              <input
                type="number"
                min="0"
                step={orderMode === "dollars" ? "100" : "1"}
                placeholder={
                  orderMode === "dollars"
                    ? "金额 / 例：1000"
                    : "股数 / 例：10"
                }
                value={orderAmount}
                onChange={(e) => setOrderAmount(e.target.value)}
                className="input-base"
              />

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => doManualOrder("buy")}
                  disabled={busy.startsWith("buy") || busy.startsWith("sell")}
                  className="rounded-lg bg-[#10b981] px-3 py-2.5 text-sm font-medium text-white transition hover:bg-[#0ea770] disabled:opacity-50"
                >
                  {busy.startsWith("buy") ? "买入中…" : "模拟买入"}
                </button>
                <button
                  type="button"
                  onClick={() => doManualOrder("sell")}
                  disabled={busy.startsWith("buy") || busy.startsWith("sell")}
                  className="rounded-lg bg-[#f43f5e] px-3 py-2.5 text-sm font-medium text-white transition hover:bg-[#e11d48] disabled:opacity-50"
                >
                  {busy.startsWith("sell") ? "卖出中…" : "模拟卖出"}
                </button>
              </div>

              <p className="text-[11px] leading-relaxed text-dim">
                下单以最新公开收盘价成交，无滑点 / 无佣金，仅用于学习演示。
              </p>
            </div>
          </div>

          {/* Watch-list editor */}
          <div className="surface p-5">
            <h3 className="mb-3 text-sm font-semibold">研究监控列表</h3>
            <StockSearch
              onSelect={addSym}
              placeholder="搜索代码或公司名"
              fullWidth
            />

            {symbols.length === 0 ? (
              <p className="mt-4 text-xs text-dim">
                列表为空 · 搜索后按回车即可加入
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {symbols.map((s) => (
                  <span
                    key={s}
                    className="group inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-elev)] py-1 pl-2 pr-1 font-mono text-[12px] text-white"
                  >
                    {s}
                    <button
                      onClick={() => removeSym(s)}
                      className="flex h-4 w-4 items-center justify-center rounded text-dim hover:bg-[rgba(248,113,113,0.12)] hover:text-[#fca5a5]"
                      aria-label={`移除 ${s}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="mt-4 text-[11px] leading-relaxed text-dim">
              点击顶部「运行研究循环」让 18 位 AI 分析师自动调仓，
              也可以直接在上面的「手动下单」中逐笔交易。
            </p>
          </div>

          {/* Presets */}
          <div className="surface p-5">
            <h3 className="mb-3 text-sm font-semibold">预设快捷组</h3>
            <p className="mb-3 text-[11px] text-dim">
              一键替换监控列表 · 仅用于演示学习，非组合推荐
            </p>
            <div className="space-y-2">
              {presets.map((p) => (
                <button
                  key={p.key}
                  onClick={() => loadPreset(p)}
                  className="group flex w-full items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] px-3 py-2 text-left transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]"
                >
                  <div>
                    <p className="text-[13px] font-medium text-white">
                      {p.label}
                    </p>
                    <p className="text-[10px] text-dim">
                      {p.symbols.length} 只 · {p.region}
                    </p>
                  </div>
                  <span className="text-[10px] text-dim group-hover:text-accent">
                    载入 →
                  </span>
                </button>
              ))}
              {presets.length === 0 && (
                <p className="text-[11px] text-dim">
                  预设加载失败（后端未启动？）
                </p>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6 min-w-0">
          {/* Holdings */}
          <div className="surface overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
              <h3 className="text-sm font-semibold">当前虚拟持仓</h3>
              {state?.last_rebalance_at && (
                <span className="text-[11px] text-dim">
                  上次研究循环 ·{" "}
                  {new Date(state.last_rebalance_at).toLocaleString()}
                </span>
              )}
            </div>
            {!state || state.holdings.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <p className="text-sm text-muted">尚无虚拟持仓</p>
                <p className="mt-1 text-[11px] text-dim">
                  可从左侧「手动下单」买入第一笔，或点击「运行研究循环」让 AI
                  自动调仓
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[880px] text-sm">
                  <thead className="bg-white/[0.02] text-[10px] uppercase tracking-wider text-dim">
                    <tr>
                      <Th>标的</Th>
                      <Th center>信号</Th>
                      <Th right>股数</Th>
                      <Th right>成本</Th>
                      <Th right>现价</Th>
                      <Th right>市值</Th>
                      <Th right>权重</Th>
                      <Th right>盈亏</Th>
                      <Th center>操作</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {state.holdings.map((h) => (
                      <tr
                        key={h.symbol}
                        className="transition-colors hover:bg-[var(--bg-hover)]"
                      >
                        <Td mono>
                          <div className="flex items-center gap-2">
                            <span>{h.symbol}</span>
                            <span className="text-[10px] text-dim">
                              {h.currency}
                            </span>
                          </div>
                        </Td>
                        <Td center>
                          {h.last_signal ? (
                            <SignalBadge signal={h.last_signal} size="sm" />
                          ) : (
                            <span className="text-dim">—</span>
                          )}
                        </Td>
                        <Td right mono>
                          {fmtShares(h.shares)}
                        </Td>
                        <Td right mono>
                          {fmtPrice(h.avg_cost, h.currency)}
                        </Td>
                        <Td right mono>
                          {fmtPrice(h.last_price, h.currency)}
                        </Td>
                        <Td right mono>
                          {fmtMoney(h.market_value, h.currency)}
                        </Td>
                        <Td right mono>
                          {h.weight_pct.toFixed(1)}%
                        </Td>
                        <Td right mono>
                          <span
                            className={
                              h.unrealized_pnl_pct >= 0
                                ? "text-gain"
                                : "text-loss"
                            }
                          >
                            {fmtPct(h.unrealized_pnl_pct)}
                          </span>
                        </Td>
                        <Td center>
                          <button
                            onClick={() => doClose(h.symbol)}
                            disabled={busy !== ""}
                            className="rounded-md border border-[var(--border)] bg-[var(--bg-elev)] px-2 py-1 text-[11px] text-dim transition hover:border-[rgba(248,113,113,0.3)] hover:text-[#fca5a5] disabled:opacity-40"
                          >
                            {busy === `close:${h.symbol}` ? "…" : "清仓"}
                          </button>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Research signals */}
          {lastResearch.length > 0 && (
            <div className="surface overflow-hidden">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
                <h3 className="text-sm font-semibold">本轮研究信号</h3>
                <span className="text-[11px] text-dim">
                  {lastResearch.length} 只标的 · 来自 18 位 AI 分析师的合成结果
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-white/[0.02] text-[10px] uppercase tracking-wider text-dim">
                    <tr>
                      <Th>标的</Th>
                      <Th center>方向</Th>
                      <Th right>置信度</Th>
                      <Th right>示意权重</Th>
                      <Th right>当前价</Th>
                      <Th>模型摘要</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {lastResearch.map((r) => (
                      <tr
                        key={r.symbol}
                        className="transition-colors hover:bg-[var(--bg-hover)]"
                      >
                        <Td mono>
                          <div className="flex items-center gap-2">
                            <span>{r.symbol}</span>
                            <span className="text-[10px] text-dim">
                              {r.currency || inferCurrency(r.symbol)}
                            </span>
                          </div>
                        </Td>
                        <Td center>
                          <SignalBadge signal={r.direction} size="sm" />
                        </Td>
                        <Td right mono>
                          {(r.confidence * 100).toFixed(0)}%
                        </Td>
                        <Td right mono>
                          {r.weight_pct > 0
                            ? `${r.weight_pct.toFixed(1)}%`
                            : "—"}
                        </Td>
                        <Td right mono>
                          {r.price > 0
                            ? fmtPrice(r.price, r.currency)
                            : "—"}
                        </Td>
                        <Td muted>{r.summary || "—"}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="border-t border-[var(--border)] px-5 py-2.5 text-[10px] text-dim">
                即使本轮没有触发模拟交易，这里也能看到每只标的的完整研究输出。
              </p>
            </div>
          )}

          {/* Trade history */}
          {state && state.recent_trades.length > 0 && (
            <div className="surface overflow-hidden">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
                <h3 className="text-sm font-semibold">
                  交易流水（最近 {Math.min(state.recent_trades.length, 50)} 条）
                </h3>
                <span className="text-[11px] text-dim">
                  共 {state.trade_count} 笔
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-sm">
                  <thead className="bg-white/[0.02] text-[10px] uppercase tracking-wider text-dim">
                    <tr>
                      <Th>时间</Th>
                      <Th>标的</Th>
                      <Th center>方向</Th>
                      <Th right>股数</Th>
                      <Th right>价格</Th>
                      <Th right>名义金额</Th>
                      <Th>来源</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {state.recent_trades.slice(0, 50).map((t, i) => (
                      <tr
                        key={t.id ?? `${t.timestamp}-${i}`}
                        className="transition-colors hover:bg-[var(--bg-hover)]"
                      >
                        <Td muted>
                          {new Date(t.timestamp).toLocaleString()}
                        </Td>
                        <Td mono>{t.symbol}</Td>
                        <Td center>
                          <span
                            className={`chip ${
                              t.side === "buy"
                                ? "chip-bullish"
                                : "chip-bearish"
                            }`}
                          >
                            {t.side === "buy" ? "买入" : "卖出"}
                          </span>
                        </Td>
                        <Td right mono>
                          {fmtShares(t.shares)}
                        </Td>
                        <Td right mono>
                          {fmtPrice(t.price, t.currency)}
                        </Td>
                        <Td right mono>
                          {fmtMoney(t.notional, t.currency)}
                        </Td>
                        <Td muted>{t.reason}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="mt-10 text-center text-[11px] text-dim">
        {state?.disclaimer ??
          "EDUCATIONAL USE ONLY · 所有持仓与交易均为虚拟，不构成任何投资建议"}
      </p>
    </div>
  );
}

/* ----------------------- helpers ----------------------- */

function Kpi({
  label,
  value,
  tone,
  large,
  sub,
}: {
  label: string;
  value: string;
  tone?: "gain" | "loss";
  large?: boolean;
  sub?: string;
}) {
  const color =
    tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : "text-white";
  return (
    <div className="surface p-5">
      <p className="text-[10px] uppercase tracking-[0.14em] text-dim">{label}</p>
      <p
        className={`mt-1.5 font-mono tabular font-semibold ${color} ${
          large ? "text-3xl" : "text-xl"
        }`}
      >
        {value}
      </p>
      {sub && <p className="mt-1 font-mono text-[11px] text-dim">{sub}</p>}
    </div>
  );
}

function Th({
  children,
  right,
  center,
}: {
  children: React.ReactNode;
  right?: boolean;
  center?: boolean;
}) {
  const align = right ? "text-right" : center ? "text-center" : "text-left";
  return <th className={`px-4 py-2.5 font-medium ${align}`}>{children}</th>;
}

function Td({
  children,
  right,
  center,
  mono,
  muted,
}: {
  children: React.ReactNode;
  right?: boolean;
  center?: boolean;
  mono?: boolean;
  muted?: boolean;
}) {
  const align = right ? "text-right" : center ? "text-center" : "text-left";
  const font = mono ? "font-mono tabular" : "";
  const color = muted ? "text-dim text-xs" : "";
  return (
    <td className={`px-4 py-2.5 ${align} ${font} ${color}`}>{children}</td>
  );
}
