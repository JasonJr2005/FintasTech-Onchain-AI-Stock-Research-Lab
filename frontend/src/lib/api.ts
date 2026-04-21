// FintasTech Research API client — EDUCATIONAL / RESEARCH USE ONLY.
// Endpoints below return descriptive research signals and paper-trading
// simulation data. They never return investment advice.

const BASE = "/api";

/* ── Search ── */
export async function searchSymbols(query: string): Promise<SymbolSearchResult[]> {
  const res = await fetch(`${BASE}/v1/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) return [];
  return res.json();
}
// Backwards-compat alias
export const searchStocks = searchSymbols;

/* ── Analysis ── */
export async function analyzeSymbol(
  symbol: string,
  riskTolerance: string = "moderate",
): Promise<AnalysisResult> {
  const res = await fetch(
    `${BASE}/v1/analyze/${encodeURIComponent(symbol)}?risk_tolerance=${riskTolerance}`,
  );
  if (!res.ok) throw new Error("Analysis failed");
  return res.json();
}
export const analyzeStock = analyzeSymbol;

export async function batchAnalyze(
  symbols: string,
  riskTolerance: string = "moderate",
): Promise<AnalysisResult[]> {
  const res = await fetch(
    `${BASE}/v1/batch-analyze?symbols=${encodeURIComponent(symbols)}&risk_tolerance=${riskTolerance}`,
  );
  if (!res.ok) throw new Error("Batch analysis failed");
  return res.json();
}

/* ── Masters ── */
export async function getMasters(): Promise<MasterProfile[]> {
  const res = await fetch(`${BASE}/v1/masters`);
  if (!res.ok) return [];
  return res.json();
}

/* ── Presets ── */
export async function getPresets(): Promise<WatchlistPreset[]> {
  const res = await fetch(`${BASE}/v1/presets`);
  if (!res.ok) return [];
  return res.json();
}

/* ── Backtest ── */
export async function runBacktest(
  req: BacktestRequest,
): Promise<BacktestResponse> {
  const res = await fetch(`${BASE}/v1/backtest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  return parseOrThrow<BacktestResponse>(res, "回测失败");
}

/* ── Paper-trading simulator ── */
async function parseOrThrow<T>(res: Response, fallback: string): Promise<T> {
  if (res.ok) return res.json();
  let msg = fallback;
  try {
    const body = await res.json();
    if (body && typeof body === "object" && "detail" in body) {
      msg = String(body.detail);
    }
  } catch {
    /* ignore */
  }
  throw new Error(msg);
}

export async function getSimulationState(): Promise<SimulationState> {
  const res = await fetch(`${BASE}/v1/simulation/state`);
  return parseOrThrow<SimulationState>(res, "模拟盘状态获取失败");
}

export async function refreshSimulationPrices(): Promise<SimulationState> {
  const res = await fetch(`${BASE}/v1/simulation/refresh`, { method: "POST" });
  return parseOrThrow<SimulationState>(res, "刷新行情失败");
}

export async function rebalanceSimulation(
  symbols: string[],
  riskTolerance: string = "moderate",
): Promise<SimulationState> {
  const res = await fetch(`${BASE}/v1/simulation/rebalance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbols, risk_tolerance: riskTolerance }),
  });
  return parseOrThrow<SimulationState>(res, "研究循环失败");
}

export async function resetSimulation(
  initialCapital: number = 100000,
): Promise<SimulationState> {
  const res = await fetch(`${BASE}/v1/simulation/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initial_capital: initialCapital }),
  });
  return parseOrThrow<SimulationState>(res, "重置模拟盘失败");
}

export async function buySimulation(
  symbol: string,
  opts: { shares?: number; notional?: number },
): Promise<OrderResponse> {
  const res = await fetch(`${BASE}/v1/simulation/buy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      symbol,
      shares: opts.shares,
      notional: opts.notional,
    }),
  });
  return parseOrThrow<OrderResponse>(res, "买入失败");
}

export async function sellSimulation(
  symbol: string,
  opts: { shares?: number; notional?: number },
): Promise<OrderResponse> {
  const res = await fetch(`${BASE}/v1/simulation/sell`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      symbol,
      shares: opts.shares,
      notional: opts.notional,
    }),
  });
  return parseOrThrow<OrderResponse>(res, "卖出失败");
}

export async function closeSimulationPosition(
  symbol: string,
): Promise<OrderResponse> {
  const res = await fetch(`${BASE}/v1/simulation/close`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbol }),
  });
  return parseOrThrow<OrderResponse>(res, "平仓失败");
}

/* ── Types ── */

export interface SymbolSearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
  currency?: string;
}
// Backwards-compat alias
export type StockSearchResult = SymbolSearchResult;

export interface AnalystSignal {
  analyst: string;
  analyst_display: string;
  signal: "bullish" | "bearish" | "neutral";
  confidence: number;
  reasoning: string;
  metrics: Record<string, number>;
}

export interface AnalysisResult {
  symbol: string;
  name: string;
  current_price: number;
  currency?: string;
  exchange?: string;
  generated_at: string;
  signals: AnalystSignal[];
  technical: Record<string, number | string | null>;
  fundamental: Record<string, number | null>;
  valuation: Record<string, number | string | null>;
  overall_signal: "bullish" | "bearish" | "neutral";
  overall_confidence: number;
  summary: string;
  /** Hypothetical paper-trading weight — NEVER a buy/sell recommendation. */
  illustrative_weight_pct: number;
  risk_score: number;
  disclaimer: string;
  error?: string;
}

export interface WatchlistPreset {
  key: string;
  label: string;
  description: string;
  symbols: string[];
  region: "US" | "HK" | "CN" | string;
}

export interface MasterProfile {
  key: string;
  name_en: string;
  name_cn: string;
  title: string;
  philosophy: string;
  icon: string;
}

export interface BacktestRequest {
  symbols: string[];
  start_date?: string;
  end_date?: string;
  initial_capital?: number;
  risk_tolerance?: string;
  rebalance_days?: number;
}

export interface BacktestResponse {
  initial_capital: number;
  final_value: number;
  total_return_pct: number;
  annualized_return_pct: number;
  max_drawdown_pct: number;
  sharpe_ratio: number | null;
  trades: number;
  equity_curve: { date: string; value: number }[];
  notes?: string;
  loaded_symbols?: string[];
  dropped_symbols?: string[];
}

export interface SimulatedHolding {
  symbol: string;
  shares: number;
  avg_cost: number;
  last_price: number;
  market_value: number;
  weight_pct: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
  currency: string;
  last_signal: "bullish" | "bearish" | "neutral" | null;
  last_confidence: number | null;
}

export interface SimulatedTrade {
  id?: string;
  timestamp: string;
  symbol: string;
  side: "buy" | "sell";
  shares: number;
  price: number;
  notional: number;
  reason: string;
  currency?: string;
}

export interface ResearchSignal {
  symbol: string;
  direction: "bullish" | "bearish" | "neutral";
  confidence: number;
  weight_pct: number;
  price: number;
  currency?: string;
  summary: string;
}

export interface SimulationState {
  initial_capital: number;
  cash: number;
  equity: number;
  invested_value: number;
  cash_pct: number;
  invested_pct: number;
  total_return_pct: number;
  holdings: SimulatedHolding[];
  recent_trades: SimulatedTrade[];
  trade_count: number;
  equity_curve: { ts: string; value: number }[];
  last_rebalance_at: string | null;
  disclaimer: string;
  /** Present on responses from /rebalance — the last research output. */
  research_signals?: ResearchSignal[];
}

export interface OrderResponse {
  ok: boolean;
  trade: SimulatedTrade;
  state: SimulationState;
}
