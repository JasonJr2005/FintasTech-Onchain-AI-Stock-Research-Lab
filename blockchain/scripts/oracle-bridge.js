/**
 * FintasTech Oracle Bridge — EDUCATIONAL / RESEARCH USE ONLY.
 * -----------------------------------------------------------------------
 * Polls the research API (http://127.0.0.1:8000) for rule-based signals on
 * a configured watch-list and mirrors them on chain.
 *
 * What one cycle does, in order:
 *
 *   1. Snapshot previous prices & allocations (read from cache + chain).
 *   2. Fetch fresh analysis per symbol (/v1/analyze/<sym>) — this also
 *      returns the live price from Yahoo Finance.
 *   3. Publish each symbol's research signal:
 *        FintasSignalRegistry.pushSignal(sym, dir, conf, score, reasoningHash)
 *   4. REAL REALISED-RETURN NAV: if the vault held a non-empty allocation
 *      during the just-elapsed interval, compute the capital-weighted
 *      return over that interval using yesterday's vs today's prices:
 *          portfolio_return = Σ  (weight_i * (p1_i - p0_i) / p0_i)
 *      and push it on chain via FintasVault.reportPerformance(deltaBps).
 *      This is genuine paper-trading PnL — the same math a real long-only
 *      fund would report, just with no real orders executed.
 *   5. Rebalance the on-chain allocation for the NEXT interval based on
 *      today's AI conviction (long-only, weight ∝ bullish confidence).
 *   6. Persist a fresh price snapshot under `.oracle-cache/<network>.json`
 *      so the next cycle can compute realised return.
 *
 * No real money is moved. Signals are descriptive research outputs only.
 *
 * Usage (after `npm run deploy:local` + backend running):
 *   npx hardhat run scripts/oracle-bridge.js --network localhost
 *   npx hardhat run scripts/oracle-bridge.js --network localhost -- --once
 *
 * Environment:
 *   ORACLE_POLL_SECONDS  default 900   (>= vault MIN_UPDATE_INTERVAL)
 *   ORACLE_SYMBOLS       default "AAPL,MSFT,TSLA,0700.HK"
 *   API_BASE             default "http://127.0.0.1:8000"
 */

const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const API_BASE = process.env.API_BASE || "http://127.0.0.1:8000";
const SYMBOLS = (process.env.ORACLE_SYMBOLS || "AAPL,MSFT,TSLA,0700.HK")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const POLL_MS = Number(process.env.ORACLE_POLL_SECONDS || 900) * 1000;
const RUN_ONCE = process.argv.includes("--once");

const DIRECTION = { bearish: 0, neutral: 1, bullish: 2 };
const MAX_BPS = 10_000;
const MAX_DELTA_BPS = 500; // matches FintasVault.MAX_DELTA_BPS_PER_UPDATE

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Long-only conviction weighting — sizes positions by AI confidence.
 *   bullish → raw = confidence
 *   neutral → raw = confidence * 0.2   (small token exposure)
 *   bearish → raw = 0                  (no short on paper)
 * Returns null when every signal is bearish (AI would stay in cash).
 */
function convictionWeights(items) {
  const raw = items.map((it) => {
    if (it.direction === 2) return Math.max(0, it.confidence);
    if (it.direction === 1) return Math.max(0, it.confidence) * 0.2;
    return 0;
  });
  const total = raw.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;

  const bps = raw.map((r) => Math.floor((r / total) * MAX_BPS));
  const picks = items
    .map((it, i) => ({ sym: it.symbol, w: bps[i], raw: raw[i] }))
    .filter((p) => p.w > 0);
  if (picks.length === 0) return null;

  const sum = picks.reduce((a, p) => a + p.w, 0);
  const leftover = MAX_BPS - sum;
  if (leftover !== 0) {
    picks.sort((a, b) => b.raw - a.raw);
    picks[0].w += leftover;
  }
  return {
    symbols: picks.map((p) => p.sym),
    weightsBps: picks.map((p) => p.w),
  };
}

/**
 * Compute the capital-weighted return over the interval (p0 → p1).
 * This is the *actual* paper-trading PnL a long-only portfolio would have
 * earned if it held `allocations` at `p0` and marked to `p1`.
 *
 * Any symbol missing a price on either side is excluded and its weight
 * is redistributed proportionally — conservative and self-normalising.
 *
 * @returns {{deltaBps:number, components:Array<{sym:string,weightBps:number,retBps:number}>} | null}
 */
function realisedReturn(prevPrices, currPrices, allocations) {
  if (!prevPrices || !allocations || allocations.length === 0) return null;

  const parts = [];
  let usableWeight = 0;

  for (const a of allocations) {
    const sym = a.symbol;
    const p0 = Number(prevPrices[sym]);
    const p1 = Number(currPrices[sym]);
    const w = Number(a.weightBps) / MAX_BPS;
    if (!isFinite(p0) || !isFinite(p1) || p0 <= 0 || w <= 0) continue;
    const ret = (p1 - p0) / p0;
    parts.push({ sym, w, ret });
    usableWeight += w;
  }
  if (parts.length === 0 || usableWeight <= 0) return null;

  let portRet = 0;
  for (const p of parts) portRet += (p.w / usableWeight) * p.ret;

  const deltaBps = clamp(Math.round(portRet * MAX_BPS), -MAX_DELTA_BPS, MAX_DELTA_BPS);

  return {
    deltaBps,
    components: parts.map((p) => ({
      sym: p.sym,
      weightBps: Math.round((p.w / usableWeight) * MAX_BPS),
      retBps: Math.round(p.ret * MAX_BPS),
    })),
  };
}

function pickDirection(signal) {
  const s = String(signal || "").toLowerCase();
  if (s.includes("bull")) return DIRECTION.bullish;
  if (s.includes("bear")) return DIRECTION.bearish;
  return DIRECTION.neutral;
}

async function fetchAnalysis(symbol) {
  const url = `${API_BASE}/v1/analyze/${encodeURIComponent(symbol)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${symbol}: HTTP ${res.status}`);
  return await res.json();
}

async function loadDeployment() {
  const p = path.resolve(__dirname, "..", "deployments", `${hre.network.name}.json`);
  if (!fs.existsSync(p)) {
    throw new Error(`Deployment file not found: ${p}\nRun scripts/deploy.js first.`);
  }
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

// ---- Price snapshot cache ---------------------------------------------
//
// Stored as JSON under blockchain/.oracle-cache/<network>.json. Survives
// restarts so the FIRST tick after reboot can still compute a realised
// return. It is safe to delete — the oracle will simply skip one tick.
const CACHE_DIR = path.resolve(__dirname, "..", ".oracle-cache");

function cachePath() {
  return path.join(CACHE_DIR, `${hre.network.name}.json`);
}

function loadSnapshot() {
  try {
    const raw = fs.readFileSync(cachePath(), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveSnapshot(snap) {
  try {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(cachePath(), JSON.stringify(snap, null, 2), "utf8");
  } catch (e) {
    console.warn(`  ⚠ snapshot save failed: ${e.message}`);
  }
}

async function tick(vault, registry) {
  console.log(`\n[${new Date().toISOString()}] Oracle cycle — ${SYMBOLS.length} symbols`);

  // 1. Read allocations LIVE during the just-elapsed interval (pre-rebalance).
  //    This is the weighting whose realised return we'll book on chain.
  let liveAllocations = [];
  try {
    const raw = await vault.getAllocations();
    liveAllocations = raw.map((a) => ({
      symbol: a.symbol,
      weightBps: Number(a.weightBps),
    }));
  } catch (e) {
    console.log(`  ⚠ getAllocations failed: ${e.shortMessage || e.message}`);
  }

  // 2. Fetch fresh analysis (also gives us the current price).
  //    We union SYMBOLS with any symbol currently held by the vault so the
  //    snapshot covers everything needed for return computation.
  const universe = Array.from(
    new Set([...SYMBOLS, ...liveAllocations.map((a) => a.symbol)])
  );

  const currPrices = {};
  const published = [];

  for (const sym of universe) {
    try {
      const data = await fetchAnalysis(sym);
      const price = Number(data.current_price);
      if (isFinite(price) && price > 0) currPrices[sym] = price;

      // Only symbols in the configured watch-list get a push-signal. Extra
      // allocation-only symbols are priced for return math but not re-signed.
      if (!SYMBOLS.includes(sym)) continue;

      const direction = pickDirection(data.overall_signal);
      const confidence = clamp(
        Math.round((data.overall_confidence ?? 0.5) * 10000),
        0,
        10000
      );
      const raw =
        direction === 2
          ? data.overall_confidence ?? 0.5
          : direction === 0
            ? -(data.overall_confidence ?? 0.5)
            : 0;
      const score = clamp(Math.round(raw * 10000), -10000, 10000);
      const reasoning = (data.summary || "").slice(0, 4096);
      const reasoningHash = hre.ethers.keccak256(
        hre.ethers.toUtf8Bytes(reasoning || sym)
      );

      const tx = await registry.pushSignal(sym, direction, confidence, score, reasoningHash);
      await tx.wait();
      published.push({
        symbol: sym,
        direction,
        confidence: data.overall_confidence ?? 0.5,
      });
      console.log(
        `  ✓ ${sym.padEnd(10)} px=${price.toFixed(2)} dir=${["bear", "neu", "bull"][direction]} conf=${(confidence / 100).toFixed(1)}%`
      );
    } catch (e) {
      console.log(`  × ${sym.padEnd(10)} ${e.message}`);
    }
  }

  // 3. REAL NAV: if we have a prior snapshot AND live allocations, compute
  //    the realised weighted return over the interval and push it on chain.
  const snap = loadSnapshot();
  if (snap?.prices && liveAllocations.length > 0) {
    const realised = realisedReturn(snap.prices, currPrices, liveAllocations);
    if (realised) {
      try {
        const block = await hre.ethers.provider.getBlock("latest");
        const nowTs = BigInt(block.timestamp);
        const lastAt = await vault.lastUpdateAt();
        const minIv = await vault.MIN_UPDATE_INTERVAL();
        if (nowTs < lastAt + minIv) {
          const wait = Number(lastAt + minIv - nowTs);
          console.log(
            `  → reportPerformance skipped: vault cooldown ${wait}s ` +
              `(would have booked ${realised.deltaBps} bps realised)`
          );
        } else {
          const tx = await vault.reportPerformance(realised.deltaBps);
          await tx.wait();
          const elapsedMin = Math.round(
            (Date.now() - new Date(snap.updatedAt).getTime()) / 60000
          );
          const breakdown = realised.components
            .map(
              (c) => `${c.sym} ${(c.weightBps / 100).toFixed(1)}%·${(c.retBps / 100).toFixed(2)}%`
            )
            .join(" · ");
          console.log(
            `  → reportPerformance(${realised.deltaBps} bps) realised over ` +
              `${elapsedMin}m — ${breakdown}`
          );
        }
      } catch (e) {
        console.log(`  ⚠ reportPerformance skipped: ${e.shortMessage || e.message}`);
      }
    } else {
      console.log(
        "  → reportPerformance skipped: no overlap between snapshot and live allocations"
      );
    }
  } else {
    console.log(
      snap
        ? "  → reportPerformance skipped: vault has no active allocation yet"
        : "  → reportPerformance skipped: no prior price snapshot (first cycle)"
    );
  }

  // 4. Rebalance for the NEXT interval using today's AI conviction.
  if (published.length > 0) {
    const plan = convictionWeights(published);
    if (!plan) {
      console.log(
        "  → rebalanceAllocations skipped: no bullish/neutral conviction — " +
          "AI would currently stay in cash. Existing allocations left intact."
      );
    } else {
      try {
        const tx = await vault.rebalanceAllocations(plan.symbols, plan.weightsBps);
        await tx.wait();
        const pretty = plan.symbols
          .map((s, i) => `${s}:${(plan.weightsBps[i] / 100).toFixed(1)}%`)
          .join(", ");
        console.log(`  → rebalanceAllocations (AI conviction) — ${pretty}`);
      } catch (e) {
        console.log(`  ⚠ rebalanceAllocations skipped: ${e.shortMessage || e.message}`);
      }
    }
  }

  // 5. Persist this cycle's prices so the next tick can mark-to-market.
  if (Object.keys(currPrices).length > 0) {
    saveSnapshot({
      updatedAt: new Date().toISOString(),
      network: hre.network.name,
      prices: currPrices,
    });
  }
}

// Hard refuse running this educational script against a real-value network.
// Allowed: hardhat (31337), localhost (31337), Sepolia testnet (11155111).
const ALLOWED_CHAIN_IDS = new Set([31337n, 11155111n]);

async function main() {
  const deployment = await loadDeployment();
  const [oracleSigner] = await hre.ethers.getSigners();

  const chainId = (await hre.ethers.provider.getNetwork()).chainId;
  if (!ALLOWED_CHAIN_IDS.has(chainId)) {
    throw new Error(
      `FintasTech oracle-bridge refuses to run on chainId ${chainId}. ` +
        "This is an educational paper-trading project. Allowed chains: " +
        "Hardhat local (31337) and Sepolia (11155111)."
    );
  }

  console.log(`Oracle EOA : ${oracleSigner.address}`);
  console.log(`Network    : ${hre.network.name} (chainId ${chainId})`);
  console.log(`API base   : ${API_BASE}`);
  console.log(`Symbols    : ${SYMBOLS.join(", ")}`);
  console.log(`Poll every : ${POLL_MS / 1000}s${RUN_ONCE ? " (run-once)" : ""}`);
  console.log(`Cache file : ${cachePath()}`);

  const registry = await hre.ethers.getContractAt(
    "FintasSignalRegistry",
    deployment.contracts.FintasSignalRegistry,
    oracleSigner
  );
  const vault = await hre.ethers.getContractAt(
    "FintasVault",
    deployment.contracts.FintasVault,
    oracleSigner
  );

  do {
    try {
      await tick(vault, registry);
    } catch (e) {
      console.error("cycle error:", e);
    }
    if (!RUN_ONCE) await new Promise((r) => setTimeout(r, POLL_MS));
  } while (!RUN_ONCE);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
