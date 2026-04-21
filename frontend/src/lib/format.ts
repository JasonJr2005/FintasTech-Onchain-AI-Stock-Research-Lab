// Unified currency / number formatting for the dApp.
// All paper-trading values are denominated in whatever currency the underlying
// ticker trades in — so we must never hard-code "$" for an HK or CN holding.

const SUFFIX_CURRENCY: Record<string, string> = {
  ".HK": "HKD",
  ".SS": "CNY",
  ".SZ": "CNY",
  ".T": "JPY",
  ".KS": "KRW",
  ".KQ": "KRW",
  ".L": "GBP",
  ".PA": "EUR",
  ".DE": "EUR",
  ".AS": "EUR",
  ".SI": "SGD",
  ".AX": "AUD",
  ".TO": "CAD",
  ".TW": "TWD",
  ".BK": "THB",
};

export function inferCurrency(symbol: string): string {
  if (!symbol) return "USD";
  const s = symbol.toUpperCase();
  for (const [suffix, cur] of Object.entries(SUFFIX_CURRENCY)) {
    if (s.endsWith(suffix)) return cur;
  }
  return "USD";
}

const SYMBOL_FOR: Record<string, string> = {
  USD: "$",
  HKD: "HK$",
  CNY: "¥",
  JPY: "¥",
  GBP: "£",
  EUR: "€",
  KRW: "₩",
  SGD: "S$",
  AUD: "A$",
  CAD: "C$",
  TWD: "NT$",
  THB: "฿",
};

export function currencySymbol(code?: string | null): string {
  if (!code) return "$";
  return SYMBOL_FOR[code.toUpperCase()] ?? code.toUpperCase() + " ";
}

/** Format a price (3-decimal precision for small prices, 2-dec for big). */
export function fmtPrice(value: number, currency?: string | null): string {
  if (!Number.isFinite(value)) return "—";
  const sym = currencySymbol(currency);
  const decimals = value < 10 ? 3 : 2;
  return `${sym}${value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/** Format a currency amount (no fractional cents above $10k for readability). */
export function fmtMoney(value: number, currency?: string | null): string {
  if (!Number.isFinite(value)) return "—";
  const sym = currencySymbol(currency);
  const decimals = Math.abs(value) >= 10000 ? 0 : 2;
  return `${sym}${value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function fmtPct(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

export function fmtShares(value: number): string {
  if (!Number.isFinite(value)) return "—";
  // professional paper-trading platforms typically show 4 decimals when
  // fractional shares exist, plain integers otherwise
  return Number.isInteger(value)
    ? value.toString()
    : value.toFixed(4).replace(/\.?0+$/, "");
}
