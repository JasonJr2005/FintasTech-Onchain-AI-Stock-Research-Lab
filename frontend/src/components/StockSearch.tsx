"use client";

import { useEffect, useRef, useState } from "react";
import { searchSymbols, type SymbolSearchResult } from "@/lib/api";

interface Props {
  onSelect: (symbol: string) => void;
  placeholder?: string;
  /** Clear the input after a selection. Default true. */
  clearOnSelect?: boolean;
  /** Full-width instead of max-width. */
  fullWidth?: boolean;
}

export default function StockSearch({
  onSelect,
  placeholder = "搜索代码或公司名…",
  clearOnSelect = true,
  fullWidth = false,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SymbolSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 1) {
      setResults([]);
      return;
    }
    clearTimeout(timer.current);
    setLoading(true);
    timer.current = setTimeout(() => {
      searchSymbols(query.trim())
        .then((r) => setResults(r))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 280);
  }, [query]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    setHighlight(0);
  }, [results.length]);

  function pick(sym: string) {
    onSelect(sym.trim().toUpperCase());
    setOpen(false);
    if (clearOnSelect) setQuery("");
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(0, results.length - 1)));
      setOpen(true);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
      setOpen(true);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (open && results.length > 0) {
        pick(results[highlight]?.symbol || results[0].symbol);
      } else if (query.trim()) {
        pick(query.trim());
      }
      return;
    }
    if (e.key === "Escape") setOpen(false);
  }

  const width = fullWidth ? "w-full" : "w-full max-w-md";

  return (
    <div ref={containerRef} className={`relative ${width}`}>
      <div className="relative">
        <svg
          viewBox="0 0 24 24"
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fg-dim)]"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKey}
          placeholder={placeholder}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          className="input-base pl-10 pr-20"
        />
        {loading && (
          <span className="absolute right-[68px] top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        )}
        <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-[var(--border)] bg-[var(--bg-elev)] px-1.5 py-0.5 font-mono text-[10px] text-dim">
          ⏎ 添加
        </kbd>
      </div>

      {open && (results.length > 0 || query.trim().length > 0) && (
        <ul className="absolute z-50 mt-1.5 max-h-72 w-full overflow-y-auto rounded-xl border border-[var(--border-strong)] bg-[var(--bg-card)] p-1 shadow-card">
          {results.length === 0 && (
            <li className="px-3 py-2.5 text-xs text-dim">
              无搜索结果 · 按
              <kbd className="mx-1 rounded bg-[var(--bg-elev)] px-1 py-0.5 font-mono text-[10px]">
                ⏎
              </kbd>
              直接添加 <b className="text-white">{query.toUpperCase()}</b>
            </li>
          )}
          {results.map((r, i) => (
            <li key={r.symbol + i}>
              <button
                onClick={() => pick(r.symbol)}
                onMouseEnter={() => setHighlight(i)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  i === highlight
                    ? "bg-[var(--accent-glow)] text-white"
                    : "text-muted hover:bg-[var(--bg-hover)] hover:text-white"
                }`}
              >
                <span className="flex items-baseline gap-2 truncate">
                  <span className="font-mono text-[13px] font-medium text-white">
                    {r.symbol}
                  </span>
                  <span className="truncate text-[12px] text-muted">
                    {r.name}
                  </span>
                </span>
                {r.exchange && (
                  <span className="shrink-0 text-[10px] uppercase tracking-wider text-dim">
                    {r.exchange}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
