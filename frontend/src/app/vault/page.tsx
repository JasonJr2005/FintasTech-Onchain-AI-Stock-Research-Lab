"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BrowserProvider,
  Contract,
  JsonRpcSigner,
  formatUnits,
  parseUnits,
} from "ethers";
import {
  ALLOWED_CHAIN_IDS,
  connectWallet,
  describeChain,
  formatNav,
  formatUSDC,
  getDeployment,
  hasMetaMask,
  isAllowedChain,
  registryContract,
  shortAddr,
  switchToLocalhost,
  usdcContract,
  vaultContract,
} from "@/lib/web3";
import { analyzeSymbol } from "@/lib/api";
import { keccak256, toUtf8Bytes } from "ethers";
import { useT } from "@/lib/i18n/context";

const WATCHLIST_KEY = "fintastech.watchlist.v1";
const DEFAULT_WATCHLIST = ["AAPL", "MSFT", "TSLA", "0700.HK"];

type Allocation = { symbol: string; weightBps: bigint };
type Signal = {
  direction: number;
  confidenceBps: number;
  scoreBps: number;
  timestamp: number;
  publishedBy: string;
};

const DIR_KEYS = ["vault.alloc.dir.bear", "vault.alloc.dir.neu", "vault.alloc.dir.bull"];
const DIR_STYLES = [
  "chip chip-bearish",
  "chip chip-neutral",
  "chip chip-bullish",
];

export default function VaultPage() {
  const { t } = useT();
  const deployment = getDeployment();
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [address, setAddress] = useState<string>("");
  const [chainId, setChainId] = useState<number>(0);
  const [err, setErr] = useState<string>("");
  const [info, setInfo] = useState<string>("");
  const [busy, setBusy] = useState<string>("");

  const [usdcBalance, setUsdcBalance] = useState<bigint>(0n);
  const [sharesBalance, setSharesBalance] = useState<bigint>(0n);
  const [myAssetsValue, setMyAssetsValue] = useState<bigint>(0n);
  const [totalAssets, setTotalAssets] = useState<bigint>(0n);
  const [totalSupply, setTotalSupply] = useState<bigint>(0n);
  const [nav, setNav] = useState<bigint>(10n ** 18n);
  const [hwm, setHwm] = useState<bigint>(10n ** 18n);
  const [paused, setPaused] = useState<boolean>(false);
  const [cbTripped, setCbTripped] = useState<boolean>(false);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [signals, setSignals] = useState<(Signal & { symbol: string })[]>([]);
  const [ethBalance, setEthBalance] = useState<bigint>(0n);
  const [copied, setCopied] = useState<boolean>(false);

  const [depositAmount, setDepositAmount] = useState<string>("100");
  const [withdrawShares, setWithdrawShares] = useState<string>("");

  const [watchlistInput, setWatchlistInput] = useState<string>("");
  const [isOracle, setIsOracle] = useState<boolean>(false);
  const [oracleProgress, setOracleProgress] = useState<string>("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(WATCHLIST_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setWatchlistInput(parsed.join(", "));
          return;
        }
      }
    } catch {
      /* ignore */
    }
    setWatchlistInput(DEFAULT_WATCHLIST.join(", "));
  }, []);

  const notDeployed = !deployment || deployment.chainId === 0;

  // ---- Wallet connect --------------------------------------------------

  const connect = useCallback(async () => {
    setErr("");
    try {
      if (!hasMetaMask()) throw new Error(t("vault.noMetaMask"));
      const conn = await connectWallet();
      setProvider(conn.provider);
      setSigner(conn.signer);
      setAddress(conn.address);
      setChainId(conn.chainId);
      if (!isAllowedChain(conn.chainId)) {
        const allowed = Array.from(ALLOWED_CHAIN_IDS)
          .map((c) => `${describeChain(c)} (chainId ${c})`)
          .join(" · ");
        throw new Error(
          t("vault.chainNotAllowed", {
            chain: describeChain(conn.chainId),
            allowed,
          }),
        );
      }
    } catch (e: unknown) {
      setErr((e as Error).message || "connect failed");
    }
  }, [t]);

  const refresh = useCallback(async () => {
    if (!signer || !provider || notDeployed) return;
    if (!isAllowedChain(chainId)) return;
    try {
      const usdc = usdcContract(signer);
      const vault = vaultContract(signer);
      const registry = registryContract(signer);

      const [
        myUsdc,
        mySharesRaw,
        tAssets,
        tSupply,
        navRaw,
        hwmRaw,
        pausedFlag,
        cb,
        allocsRaw,
      ] = await Promise.all([
        usdc.balanceOf(address) as Promise<bigint>,
        vault.balanceOf(address) as Promise<bigint>,
        vault.totalAssets() as Promise<bigint>,
        vault.totalSupply() as Promise<bigint>,
        vault.navPerShare() as Promise<bigint>,
        vault.highWaterMark() as Promise<bigint>,
        vault.paused() as Promise<boolean>,
        vault.circuitBreakerTripped() as Promise<boolean>,
        vault.getAllocations() as Promise<Allocation[]>,
      ]);
      const myVal: bigint = await vault.sharesToAssets(mySharesRaw);

      try {
        const eth = await provider.getBalance(address);
        setEthBalance(eth);
      } catch {
        /* ignore — not fatal */
      }

      setUsdcBalance(myUsdc);
      setSharesBalance(mySharesRaw);
      setMyAssetsValue(myVal);
      setTotalAssets(tAssets);
      setTotalSupply(tSupply);
      setNav(navRaw);
      setHwm(hwmRaw);
      setPaused(pausedFlag);
      setCbTripped(cb);
      setAllocations(
        allocsRaw.map((a) => ({
          symbol: (a as unknown as { symbol: string; weightBps: bigint }).symbol,
          weightBps: (a as unknown as { symbol: string; weightBps: bigint }).weightBps,
        })),
      );

      // Fetch latest signal per allocated symbol
      const enriched: (Signal & { symbol: string })[] = [];
      for (const a of allocsRaw) {
        const sym = (a as unknown as { symbol: string }).symbol;
        try {
          const s = (await registry.getLatest(sym)) as unknown as {
            direction: bigint;
            confidenceBps: bigint;
            scoreBps: bigint;
            timestamp: bigint;
            publishedBy: string;
          };
          enriched.push({
            symbol: sym,
            direction: Number(s.direction),
            confidenceBps: Number(s.confidenceBps),
            scoreBps: Number(s.scoreBps),
            timestamp: Number(s.timestamp),
            publishedBy: s.publishedBy,
          });
        } catch {
          /* symbol never had a signal */
        }
      }
      setSignals(enriched);

      try {
        const oracleRole: string = await registry.ORACLE_ROLE();
        const [isOracleRegistry, isOracleVault] = await Promise.all([
          registry.hasRole(oracleRole, address) as Promise<boolean>,
          vault.hasRole(oracleRole, address) as Promise<boolean>,
        ]);
        setIsOracle(isOracleRegistry && isOracleVault);
      } catch {
        setIsOracle(false);
      }
    } catch (e) {
      console.error(e);
    }
  }, [signer, provider, address, notDeployed, chainId]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 6000);
    return () => clearInterval(t);
  }, [refresh]);

  // ---- User actions ---------------------------------------------------

  const claimFaucet = async () => {
    if (!signer) return;
    setBusy("faucet"); setErr(""); setInfo("");
    try {
      const usdc = usdcContract(signer);
      const tx = await (usdc as Contract).faucet();
      await tx.wait();
      setInfo(t("vault.card.faucet.done"));
      await refresh();
    } catch (e: unknown) {
      setErr((e as { shortMessage?: string; message?: string }).shortMessage || (e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const doDeposit = async () => {
    if (!signer) return;
    setBusy("deposit"); setErr(""); setInfo("");
    try {
      const usdc = usdcContract(signer);
      const vault = vaultContract(signer);
      const amount = parseUnits(depositAmount || "0", 6);
      if (amount <= 0n) throw new Error(t("vault.card.deposit.placeholder"));

      const allowance: bigint = await (usdc as Contract).allowance(
        address,
        deployment!.contracts.FintasVault,
      );
      if (allowance < amount) {
        const apTx = await (usdc as Contract).approve(
          deployment!.contracts.FintasVault,
          amount,
        );
        await apTx.wait();
      }
      const tx = await (vault as Contract).deposit(amount);
      const rc = await tx.wait();
      setInfo(t("vault.card.deposit.done", { tx: shortAddr(rc.hash) }));
      await refresh();
    } catch (e: unknown) {
      setErr((e as { shortMessage?: string; message?: string }).shortMessage || (e as Error).message);
    } finally {
      setBusy("");
    }
  };

  /**
   * End-to-end: "AI 分析并上链".
   *   1. parse the user's watchlist (comma/space separated)
   *   2. call /v1/analyze/<sym> for each
   *   3. use the connected wallet (must hold ORACLE_ROLE) to:
   *        a) registry.pushSignal() per symbol
   *        b) vault.rebalanceAllocations() with conviction-weighted bps
   * Conviction weighting: weight ∝ confidence for bullish, 0.2× for neutral,
   * 0 for bearish. Purely long, no shorts.
   */
  const aiAnalyzeAndPublish = async () => {
    if (!signer) return;
    const parsed = (watchlistInput || "")
      .split(/[,\s]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    if (parsed.length === 0) {
      setErr(t("vault.oracle.err.empty"));
      return;
    }
    if (parsed.length > 12) {
      setErr(t("vault.oracle.err.tooMany"));
      return;
    }

    if (!isOracle) {
      setErr(t("vault.oracle.err.noRole"));
      return;
    }

    setBusy("oracle");
    setErr("");
    setInfo("");
    setOracleProgress(t("vault.oracle.progress.fetch", { n: parsed.length }));

    try {
      const results = await Promise.all(
        parsed.map(async (sym) => {
          try {
            const r = await analyzeSymbol(sym);
            return { sym, r, ok: true as const };
          } catch (e) {
            return {
              sym,
              err: e instanceof Error ? e.message : String(e),
              ok: false as const,
            };
          }
        }),
      );

      const registry = registryContract(signer);
      const vault = vaultContract(signer);

      const published: {
        symbol: string;
        direction: number;
        confidence: number;
      }[] = [];

      for (const item of results) {
        if (!item.ok) {
          console.warn("analyze failed", item.sym, item.err);
          continue;
        }
        const r = item.r;
        const s = String(r.overall_signal || "").toLowerCase();
        const direction = s.includes("bull") ? 2 : s.includes("bear") ? 0 : 1;
        const confBps = Math.max(
          0,
          Math.min(10000, Math.round((r.overall_confidence ?? 0.5) * 10000)),
        );
        const raw =
          direction === 2
            ? r.overall_confidence ?? 0.5
            : direction === 0
              ? -(r.overall_confidence ?? 0.5)
              : 0;
        const scoreBps = Math.max(-10000, Math.min(10000, Math.round(raw * 10000)));
        const reasoningHash = keccak256(
          toUtf8Bytes((r.summary || item.sym).slice(0, 4096)),
        );
        setOracleProgress(t("vault.oracle.progress.push", { sym: item.sym }));
        const tx = await (registry as Contract).pushSignal(
          item.sym,
          direction,
          confBps,
          scoreBps,
          reasoningHash,
        );
        await tx.wait();
        published.push({
          symbol: item.sym,
          direction,
          confidence: r.overall_confidence ?? 0.5,
        });
      }

      if (published.length === 0) {
        throw new Error(t("vault.oracle.err.allFailed"));
      }

      // Conviction-weighted allocation (long-only, paper trading).
      const raw = published.map((p) =>
        p.direction === 2
          ? Math.max(0, p.confidence)
          : p.direction === 1
            ? Math.max(0, p.confidence) * 0.2
            : 0,
      );
      const totalRaw = raw.reduce((a, b) => a + b, 0);
      if (totalRaw <= 0) {
        setInfo(t("vault.oracle.done.noBullish", { n: published.length }));
        await refresh();
        return;
      }
      const picks = published
        .map((p, i) => ({ p, raw: raw[i] }))
        .filter((x) => x.raw > 0)
        .map((x) => ({
          symbol: x.p.symbol,
          raw: x.raw,
          bps: Math.floor((x.raw / totalRaw) * 10000),
        }));
      let sumBps = picks.reduce((a, p) => a + p.bps, 0);
      const leftover = 10000 - sumBps;
      if (leftover !== 0 && picks.length > 0) {
        picks.sort((a, b) => b.raw - a.raw);
        picks[0].bps += leftover;
      }

      setOracleProgress(t("vault.oracle.progress.rebalance"));
      const txR = await (vault as Contract).rebalanceAllocations(
        picks.map((p) => p.symbol),
        picks.map((p) => p.bps),
      );
      await txR.wait();

      try {
        localStorage.setItem(
          WATCHLIST_KEY,
          JSON.stringify(published.map((p) => p.symbol)),
        );
      } catch {
        /* ignore */
      }

      const pretty = picks
        .map((p) => `${p.symbol} ${(p.bps / 100).toFixed(1)}%`)
        .join(" · ");
      setInfo(t("vault.oracle.done.rebalanced", { n: published.length, pretty }));
      await refresh();
    } catch (e: unknown) {
      setErr(
        (e as { shortMessage?: string; message?: string }).shortMessage ||
          (e as Error).message ||
          "AI oracle publish failed",
      );
    } finally {
      setBusy("");
      setOracleProgress("");
    }
  };

  const doWithdraw = async () => {
    if (!signer) return;
    setBusy("withdraw"); setErr(""); setInfo("");
    try {
      const vault = vaultContract(signer);
      const shares = withdrawShares
        ? parseUnits(withdrawShares, 6)
        : sharesBalance;
      if (shares <= 0n) throw new Error(t("vault.card.withdraw.placeholder", { n: formatUSDC(sharesBalance) }));

      const tx = cbTripped
        ? await (vault as Contract).emergencyWithdraw(shares)
        : await (vault as Contract).withdraw(shares);
      const rc = await tx.wait();
      setInfo(t("vault.card.withdraw.done", { tx: shortAddr(rc.hash) }));
      await refresh();
    } catch (e: unknown) {
      setErr((e as { shortMessage?: string; message?: string }).shortMessage || (e as Error).message);
    } finally {
      setBusy("");
    }
  };

  // ---- Render ---------------------------------------------------------

  const pct = (bps: bigint | number) => (Number(bps) / 100).toFixed(2) + "%";
  const navPct = ((Number(nav) / 1e18) * 100 - 100).toFixed(3);
  const profitPositive = nav > 10n ** 18n;

  return (
    <main className="mx-auto max-w-[1400px] space-y-6 px-8 py-10">
      <header className="flex flex-col gap-2">
        <div className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-accent">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          {t("vault.tag")}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-white">
          {t("vault.title")}
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-muted">
          {t("vault.subtitle")}
          <b className="text-warn"> {t("vault.notAdvice")}</b>
        </p>
      </header>

      {/* "How do I get free gas?" wizard — shown whenever the connected
          wallet has 0 ETH on the local chain, which is the exact
          situation that causes "账户余额不足" in MetaMask. */}
      {address && chainId === 31337 && ethBalance === 0n && (
        <div className="rounded-xl border border-[rgba(251,191,36,0.35)] bg-[rgba(251,191,36,0.06)] p-5 text-sm leading-relaxed text-warn">
          <p className="mb-2 text-base font-semibold text-white">
            {t("vault.noEthWarn.title")}
          </p>
          <p className="mb-3 text-[13px] text-muted">{t("vault.noEthWarn.body")}</p>

          <div className="space-y-3">
            <div className="rounded-lg border border-[var(--border)] bg-black/30 p-4">
              <p className="mb-2 text-[12px] font-semibold text-white">
                {t("vault.noEthWarn.methodA")}
              </p>
              <p className="mb-2 text-[12px] text-muted">
                {t("vault.noEthWarn.methodADesc")}
              </p>
              <div className="mb-2 flex items-center gap-2">
                <code className="flex-1 overflow-x-auto rounded bg-black/60 px-3 py-1.5 font-mono text-[11px] text-accent">
                  {address}
                </code>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(address);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    } catch {
                      /* ignore */
                    }
                  }}
                  className="btn-ghost !px-3 !py-1.5 text-[11px]"
                >
                  {copied ? t("vault.copyAddr.done") : t("vault.copyAddr")}
                </button>
              </div>
              <pre className="overflow-x-auto rounded bg-black/60 px-3 py-2 font-mono text-[11px] text-[#86efac]">
                {`cd blockchain && FUND_TO=${address} npm run fund:local`}
              </pre>
              <p className="mt-2 text-[11px] text-dim">{t("vault.fundHint")}</p>
            </div>

            <div className="rounded-lg border border-[var(--border)] bg-black/30 p-4">
              <p className="mb-2 text-[12px] font-semibold text-white">
                {t("vault.noEthWarn.methodB")}
              </p>
              <p className="mb-2 text-[12px] text-muted">
                {t("vault.noEthWarn.methodBDesc")}
              </p>
              <details className="mt-1">
                <summary className="cursor-pointer text-[11px] text-accent hover:underline">
                  {t("vault.showPK")}
                </summary>
                <pre className="mt-2 overflow-x-auto rounded bg-black/60 px-3 py-2 font-mono text-[10px] text-[#86efac]">
                  0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
                </pre>
                <p className="mt-1 text-[11px] text-dim">{t("vault.pkHint")}</p>
              </details>
            </div>
          </div>

          <p className="mt-3 text-[11px] text-dim">{t("vault.noEthWarn.sepolia")}</p>
        </div>
      )}

      {address && chainId === 31337 && ethBalance > 0n && (
        <div className="rounded-xl border border-[rgba(52,211,153,0.25)] bg-[rgba(52,211,153,0.05)] px-4 py-2 text-[12px] text-[#86efac]">
          {t("vault.ethOK", { bal: Number(formatUnits(ethBalance, 18)).toFixed(4) })}
        </div>
      )}

      {address && !isAllowedChain(chainId) && (
        <div className="rounded-xl border border-[rgba(248,113,113,0.3)] bg-[rgba(248,113,113,0.06)] p-4 text-sm text-[#fca5a5]">
          {t("vault.chainNotAllowed", {
            chain: describeChain(chainId),
            allowed: Array.from(ALLOWED_CHAIN_IDS)
              .map((c) => `${describeChain(c)} (chainId ${c})`)
              .join(" · "),
          })}
        </div>
      )}

      {notDeployed && (
        <div className="rounded-xl border border-[rgba(251,191,36,0.3)] bg-[rgba(251,191,36,0.06)] p-4 text-sm text-warn">
          {t("vault.notDeployed")}
        </div>
      )}

      {!address ? (
        <div className="surface p-10 text-center">
          <p className="mb-5 text-sm text-muted">{t("vault.connectHint")}</p>
          <button onClick={connect} className="btn-primary">
            {t("vault.connect")}
          </button>
          {!hasMetaMask() && (
            <p className="mt-3 text-[11px] text-dim">
              {t("vault.noMetaMask")}{" "}
              <a
                className="text-accent hover:underline"
                href="https://metamask.io"
                target="_blank"
                rel="noreferrer"
              >
                metamask.io
              </a>
            </p>
          )}
        </div>
      ) : (
        <section className="surface grid grid-cols-1 gap-4 p-5 md:grid-cols-4">
          <Stat label={t("vault.stat.addr")} value={shortAddr(address)} />
          <Stat
            label={t("vault.stat.network")}
            value={describeChain(chainId)}
            hint={
              isAllowedChain(chainId)
                ? t("vault.stat.chain", { id: chainId })
                : t("vault.stat.notAllowed")
            }
          />
          <Stat label={t("vault.stat.usdc")} value={formatUSDC(usdcBalance)} />
          <Stat
            label={t("vault.stat.shares")}
            value={formatUSDC(sharesBalance)}
            hint={t("vault.stat.sharesHint", { val: formatUSDC(myAssetsValue) })}
          />
          {!isAllowedChain(chainId) && (
            <button
              onClick={switchToLocalhost}
              className="btn-ghost md:col-span-4"
            >
              {t("vault.switchLocal")}
            </button>
          )}
        </section>
      )}

      {address && (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card title={t("vault.card.faucet.title")} subtitle={t("vault.card.faucet.subtitle")}>
            <button
              onClick={claimFaucet}
              disabled={busy === "faucet"}
              className="btn-ghost w-full !text-[#86efac] !border-[rgba(52,211,153,0.25)] hover:!bg-[rgba(52,211,153,0.08)]"
            >
              {busy === "faucet" ? t("vault.card.faucet.busy") : t("vault.card.faucet.action")}
            </button>
          </Card>

          <Card
            title={t("vault.card.deposit.title")}
            subtitle={t("vault.card.deposit.subtitle")}
          >
            <div className="flex gap-2">
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="input-base flex-1"
                placeholder={t("vault.card.deposit.placeholder")}
              />
              <button
                onClick={doDeposit}
                disabled={busy === "deposit" || paused}
                className="btn-primary"
              >
                {busy === "deposit" ? "…" : t("vault.card.deposit.action")}
              </button>
            </div>
            {paused && (
              <p className="mt-2 text-[11px] text-warn">{t("vault.card.deposit.paused")}</p>
            )}
          </Card>

          <Card
            title={t("vault.card.withdraw.title")}
            subtitle={t("vault.card.withdraw.subtitle")}
          >
            <div className="flex gap-2">
              <input
                type="number"
                value={withdrawShares}
                onChange={(e) => setWithdrawShares(e.target.value)}
                className="input-base flex-1"
                placeholder={t("vault.card.withdraw.placeholder", { n: formatUSDC(sharesBalance) })}
              />
              <button
                onClick={doWithdraw}
                disabled={busy === "withdraw"}
                className="btn-danger"
              >
                {busy === "withdraw"
                  ? "…"
                  : cbTripped
                    ? t("vault.card.withdraw.emergency")
                    : t("vault.card.withdraw.action")}
              </button>
            </div>
            {cbTripped && (
              <p className="mt-2 text-[11px] text-warn">
                {t("vault.card.withdraw.cb")}
              </p>
            )}
          </Card>

          <Card title={t("vault.card.state.title")} subtitle={t("vault.card.state.subtitle")}>
            <dl className="grid grid-cols-2 gap-3 text-xs">
              <MiniStat label={t("vault.card.state.nav")} value={formatNav(nav)} tone={profitPositive ? "good" : "neutral"} />
              <MiniStat label={t("vault.card.state.navPct")} value={`${profitPositive ? "+" : ""}${navPct}%`} tone={profitPositive ? "good" : nav < 10n ** 18n ? "bad" : "neutral"} />
              <MiniStat label={t("vault.card.state.totalAssets")} value={formatUSDC(totalAssets)} />
              <MiniStat label={t("vault.card.state.totalSupply")} value={formatUSDC(totalSupply)} />
              <MiniStat label={t("vault.card.state.hwm")} value={formatNav(hwm)} />
              <MiniStat label={t("vault.card.state.status")} value={`${paused ? "Paused" : "Active"}${cbTripped ? " · CB" : ""}`} tone={paused || cbTripped ? "bad" : "good"} />
            </dl>
          </Card>
        </section>
      )}

      {address && isAllowedChain(chainId) && (
        <section className="surface p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">{t("vault.oracle.title")}</h2>
              <p className="mt-0.5 text-[11px] text-dim">{t("vault.oracle.subtitle")}</p>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-dim">
              <span>{t("vault.oracle.perm")}</span>
              {isOracle ? (
                <span className="chip chip-bullish">{t("vault.oracle.roleOK")}</span>
              ) : (
                <span className="chip chip-bearish">{t("vault.oracle.roleMissing")}</span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 md:flex-row">
            <input
              type="text"
              value={watchlistInput}
              onChange={(e) => setWatchlistInput(e.target.value)}
              placeholder={t("vault.oracle.input.placeholder")}
              className="input-base flex-1"
              disabled={busy === "oracle"}
            />
            <button
              onClick={aiAnalyzeAndPublish}
              disabled={busy === "oracle" || !isOracle}
              className="btn-primary whitespace-nowrap"
              title={isOracle ? t("vault.oracle.tip.ok") : t("vault.oracle.tip.noRole")}
            >
              {busy === "oracle" ? t("vault.oracle.running") : t("vault.oracle.run")}
            </button>
          </div>
          {oracleProgress && (
            <p className="mt-2 text-[11px] text-accent">{oracleProgress}</p>
          )}
          {!isOracle && (
            <p className="mt-2 text-[11px] text-warn">{t("vault.oracle.roleHint")}</p>
          )}
        </section>
      )}

      {address && allocations.length === 0 && isAllowedChain(chainId) && (
        <div className="rounded-xl border border-[rgba(96,165,250,0.28)] bg-[rgba(96,165,250,0.05)] p-5 text-sm text-[#93c5fd]">
          <p className="mb-1 font-semibold text-white">{t("vault.empty.title")}</p>
          <p className="text-[12px] leading-relaxed text-muted">{t("vault.empty.body")}</p>
        </div>
      )}

      {address && allocations.length > 0 && (
        <section className="surface overflow-hidden p-0">
          <h2 className="border-b border-[var(--border)] px-5 py-3 text-sm font-semibold">
            {t("vault.alloc.title")}
          </h2>
          <table className="w-full text-sm">
            <thead className="bg-white/[0.02] text-[10px] uppercase tracking-wider text-dim">
              <tr>
                <th className="px-4 py-2.5 text-left">{t("vault.alloc.col.symbol")}</th>
                <th className="px-4 py-2.5 text-right">{t("vault.alloc.col.weight")}</th>
                <th className="px-4 py-2.5 text-center">{t("vault.alloc.col.dir")}</th>
                <th className="px-4 py-2.5 text-right">{t("vault.alloc.col.conf")}</th>
                <th className="px-4 py-2.5 text-right">{t("vault.alloc.col.score")}</th>
                <th className="px-4 py-2.5 text-right">{t("vault.alloc.col.signed")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {allocations.map((a) => {
                const sig = signals.find((s) => s.symbol === a.symbol);
                const age = sig
                  ? Math.round((Date.now() / 1000 - sig.timestamp) / 60)
                  : null;
                return (
                  <tr key={a.symbol} className="hover:bg-[var(--bg-hover)]">
                    <td className="px-4 py-2.5 font-mono text-white">{a.symbol}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular text-muted">
                      {pct(a.weightBps)}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {sig ? (
                        <span className={DIR_STYLES[sig.direction]}>
                          {t(DIR_KEYS[sig.direction])}
                        </span>
                      ) : (
                        <span className="text-dim">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular text-muted">
                      {sig ? pct(sig.confidenceBps) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular text-muted">
                      {sig ? (sig.scoreBps / 100).toFixed(2) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[11px] text-dim">
                      {sig ? (
                        <>
                          {shortAddr(sig.publishedBy)} · {t("vault.alloc.ago", { n: age ?? 0 })}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {(info || err) && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            err
              ? "border-[rgba(248,113,113,0.3)] bg-[rgba(248,113,113,0.06)] text-[#fca5a5]"
              : "border-[rgba(52,211,153,0.3)] bg-[rgba(52,211,153,0.06)] text-[#86efac]"
          }`}
        >
          {err || info}
        </div>
      )}

      {deployment && !notDeployed && (
        <footer className="surface px-5 py-4 text-[11px] text-dim">
          <p>
            <b className="text-muted">{t("vault.footer.network")}</b> {deployment.network} · chainId{" "}
            {deployment.chainId}
          </p>
          <p>
            <b className="text-muted">{t("vault.footer.vault")}</b>{" "}
            <span className="font-mono">{deployment.contracts.FintasVault}</span>
          </p>
          <p>
            <b className="text-muted">{t("vault.footer.registry")}</b>{" "}
            <span className="font-mono">
              {deployment.contracts.FintasSignalRegistry}
            </span>
          </p>
          <p>
            <b className="text-muted">{t("vault.footer.usdc")}</b>{" "}
            <span className="font-mono">{deployment.contracts.MockUSDC}</span>
          </p>
        </footer>
      )}
    </main>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="surface p-5">
      <h3 className="text-sm font-semibold">{title}</h3>
      {subtitle && (
        <p className="mb-4 mt-0.5 text-[11px] text-dim">{subtitle}</p>
      )}
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-dim">{label}</p>
      <p className="mt-1 font-mono text-base text-white">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-dim">{hint}</p>}
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "good" | "bad" | "neutral";
}) {
  const color =
    tone === "good" ? "text-gain" : tone === "bad" ? "text-loss" : "text-white";
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-dim">{label}</dt>
      <dd className={`mt-0.5 font-mono tabular ${color}`}>{value}</dd>
    </div>
  );
}

// unused import silencer (ethers helpers stay referenced)
void formatUnits;
