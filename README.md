

# FintasTech · Research Lab

**An open-source lab where rule-based multi-agent equity research meets a transparent, on-chain auditable paper-trading vault.**

*Every signal is reproducible. Every allocation is auditable. Every NAV move is backed by actual price data.*

[License](./LICENSE)
[Solidity](./blockchain)
[Python](./pyproject.toml)
[Next.js](./frontend)
[i18n](./frontend/src/lib/i18n)

[English](#-english) · [中文](#-中文) · [Disclaimer](./DISCLAIMER.md)



> 💡 **No real ETH, no wallet top-ups required.** The whole stack runs on a local Hardhat chain with free test ETH and a mock stablecoin (mUSDC) faucet. Just claim test tokens from the built-in buttons — **please do not send real money to any address shown in this project**.

---

## 🇬🇧 English

### Vision — what this project actually teaches

FintasTech answers a question most "AI trading" repos never ask out loud:

> **How do you make an AI's investment logic *observable* — so that any third party can replay it, challenge it, and learn from it?**

The answer this project demonstrates has three layers, each with a concrete takeaway:


| Layer                      | What you build                                                                                                                                     | What you take away                                                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Multi-agent research**   | 14 master-investor heuristics (Buffett, Graham, Lynch, …) + 4 core analyst modules (tech / fundamental / valuation / sentiment) voting in parallel | A tangible mental model for how "ensemble" investment reasoning actually works — not magic, but layered rules you can step through |
| **Fund-grade paper vault** | A Solidity vault with NAV per share, high-water-mark, deposit / withdraw in ERC-20 shares, role-based permissions, circuit-breaker                 | A hands-on look at the internals of real fund accounting — why NAV moves, how performance fees crystallise, why cooldowns matter   |
| **Transparent provenance** | Every signal signed on chain with a `keccak256` of its reasoning; every allocation change triggers a traceable event                               | A working example of how Web3 primitives make research accountable in a way databases structurally cannot                          |


The value isn't "yet another trading bot." It's a **working demonstration of financial engineering, quant research and Web3 stitched together by one developer** — with enough polish (bilingual UI, one-click setup, live data) that anyone can open it and *see* the ideas in motion within 5 minutes.

### Feature tour

- `**/` Overview** — one-click presets (US mega-caps, HK tech, A-share liquor…) that immediately spin up a virtual portfolio.
- `**/simulation` Paper trade** — live virtual portfolio, per-bar research re-runs, manual buys/sells in a sandbox.
- `**/analysis` Single-stock research** — 18 analysts voting in parallel, fused directional signal, per-analyst reasoning, risk gauge.
- `**/backtest` Strategy backtest** — historical walk-forward replay with equity curve, Sharpe, max-drawdown.
- `**/vault` On-chain vault** — MetaMask connect, built-in mUSDC faucet, deposit/withdraw, **"Let AI analyse and anchor on-chain"** button, allocation table with live on-chain provenance.
- `**/settings`** — risk preference (conservative / moderate / aggressive) propagated app-wide.
- **Top-bar language switch** — full Chinese / English UI, zero i18n dependency.

### What's technically non-trivial

- **NAV moves from *realised* returns.** The oracle snapshots per-symbol prices every cycle; between cycles it computes the capital-weighted return on the vault's actual on-chain allocation and pushes it via `reportPerformance(deltaBps)` (capped to ±5% per update — the same fat-finger guardrail a real fund admin would use).
- **Conviction-weighted long-only allocation.** Bullish → weight ∝ confidence. Neutral → 0.2× confidence. Bearish → 0. Rounding drift flows to the strongest-conviction name, so the weights always sum to exactly 10,000 bps.
- **Two ways to anchor a signal** — a CLI oracle daemon *or* a wallet-signed button inside the dApp. Both go through `ORACLE_ROLE` on the same `FintasSignalRegistry`, producing identical audit trails.

### Architecture

```
                ┌───────── Yahoo Finance (live + historical) ─────────┐
                ▼                                                      ▼
      ┌──────────────────┐                                ┌────────────────────────┐
      │ 14 master models │◄─── blended illustrative ────►│ 4 core analyst modules │
      │ (Buffett, Graham,│      weight + confidence       │ tech / fund / val / sen│
      │  Lynch, …)       │                                 └────────────┬───────────┘
      └────────┬─────────┘                                              │
               └────────── composite signal (bull/bear/neu + conf) ─────┘
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        ▼                                ▼                                ▼
┌──────────────────┐           ┌────────────────────┐         ┌───────────────────────┐
│ Paper-trade book │           │ Walk-forward       │         │ Oracle bridge / wallet│
│ (local JSON)     │           │ backtest engine    │         │ → SignalRegistry.push │
│                  │           │                    │         │ → Vault.rebalance     │
│                  │           │                    │         │ → Vault.reportPerf(Δ)│
└──────────────────┘           └────────────────────┘         └───────────────────────┘
                                         │
                            Next.js dApp (React + ethers v6)
                              ↕ Hardhat local (chainId 31337)
```

### Quick start — step by step

> **Money reminder.** You won't spend a single cent of real ETH. Hardhat's local chain gives out 10,000 test ETH per default account, and the mUSDC faucet hands out 10,000 mock dollars on one click. **Ignore any "recharge your wallet" prompt — all top-ups happen through built-in scripts or UI buttons.**

**Prerequisites** · Node 20+ · Python 3.11+ · Git · a Chromium-based browser with [MetaMask](https://metamask.io)

**1. Clone & install**

```bash
git clone <this-repo-url> FintasTech
cd FintasTech
./start.sh          # creates a Python venv, installs deps,
                    # starts FastAPI on :8000 and Next.js on :3000
                    # then opens http://localhost:3000 for you
```

**2. Boot the local blockchain** (new terminal)

```bash
cd blockchain
npm install
npm run node        # local Hardhat chain at http://127.0.0.1:8545
                    # 20 pre-funded accounts, 10,000 test ETH each
```

**3. Deploy contracts** (another terminal, keep `npm run node` alive)

```bash
cd blockchain
npm run deploy:local    # deploys MockUSDC + SignalRegistry + Vault,
                        # writes addresses to deployments/localhost.json
```

**4. Hook up MetaMask**

- Add the network: **Hardhat Localhost** · RPC `http://127.0.0.1:8545` · Chain ID `31337` · Currency symbol `ETH`
- Pick one of:
  - **Easiest** — import Hardhat Account #0's private key (`0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`). It already has 10,000 test ETH **and** `ORACLE_ROLE`, so you can sign everything.
  - **Prefer your own account?** Copy your MetaMask address, then:
    ```bash
    cd blockchain
    FUND_TO=0xYourAddress npm run fund:local    # sends 100 test ETH
    ```
    (Running the `/vault` page while on 0 ETH will also show this exact command with your address pre-filled.)

**5. Use the dApp**

- Open `http://localhost:3000`. Click the **中文 / EN** toggle in the sidebar — the whole UI switches live.
- From the landing page, pick any research preset → a paper portfolio is built for you.
- Head to `/vault`:
  1. Click **Claim faucet** → you receive 10,000 mUSDC (repeatable every hour).
  2. Deposit, say, 1,000 mUSDC. You receive 1,000 vault shares (NAV starts at 1.0).
  3. Fill in a watch-list (e.g. `AAPL, MSFT, TSLA, 0700.HK`) and hit **Let AI analyse & anchor on-chain**. The dApp: calls the research API → signs per-symbol signals into `SignalRegistry` → calls `rebalanceAllocations` with conviction weights. Allocations appear in the table.

**6. Watch NAV realise returns** (optional, recommended)

```bash
cd blockchain
npx hardhat run scripts/oracle-bridge.js --network localhost
```

Every cycle (default 15 min) the oracle snapshots prices, computes the actual capital-weighted return on the vault's live allocation, and pushes a signed `reportPerformance(deltaBps)`. Refresh `/vault` and you'll see NAV, HWM and share value evolve — backed by real market data.

### Tech stack


| Layer           | Choice                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------- |
| Research & data | Python 3.11, FastAPI, `yfinance`, pandas, NumPy                                                   |
| Smart contracts | Solidity 0.8.24, OpenZeppelin `AccessControl` / `ReentrancyGuard` / `Pausable` / `ERC20`, Hardhat |
| Frontend        | Next.js 15 (App Router), React, Tailwind v4, ethers v6, MetaMask                                  |
| I18n            | Zero-dependency React Context + `useT()`                                                          |


### Project layout

```
├── src/fintastech/     # Python research pipeline (analysts, master models, backtest)
├── api/                # FastAPI service (/v1/analyze, /v1/backtest…)
├── blockchain/         # Hardhat workspace — contracts, deploy & oracle scripts
├── frontend/           # Next.js dApp
│   └── src/lib/i18n    # bilingual dictionary + LanguageProvider
├── DISCLAIMER.md       # full educational disclaimer (EN + 中文)
└── README.md
```

---

## 🇨🇳 中文

### 项目价值 — 它到底让人学到什么

多数开源「AI trading」项目回避的核心问题是：

> **怎么让 AI 的投资逻辑 *可被观察* ——让任何第三方能够复现它、质疑它、从中学习？**

FintasTech 的答案有三层，每一层都有明确的现实意义：


| 层           | 你构建的                                                          | 你带走的                                       |
| ----------- | ------------------------------------------------------------- | ------------------------------------------ |
| **多智能体研究**  | 14 位大师启发式（巴菲特、格雷厄姆、彼得·林奇 …）+ 4 位核心分析师（技术 / 基本面 / 估值 / 情绪）并行投票 | 对「集成式投资推理」形成直观认识：不是魔法，而是分层规则，可以逐步复盘        |
| **基金级模拟金库** | 带 NAV、历史最高净值、ERC-20 份额、角色化权限、熔断机制的 Solidity 金库                | 实打实体会真实基金后台的内在逻辑：NAV 为什么动、绩效费怎么计提、冷却间隔为何重要 |
| **透明化溯源**   | 每条信号带 `keccak256(reasoning)` 签名上链，每次调仓产生可追踪事件                 | 真切看到 Web3 原语如何让研究「可问责」——数据库从结构上做不到这一点      |


项目的价值不是「又一个交易机器人」，而是**把金融工程、量化研究与 Web3 缝在一起的一个完整可跑的 demo**——带有足够的打磨（中英双语、一键启动、实时数据），任何人打开 5 分钟内就能**看到**这些想法在跑起来。

这对想向导师 / HR 证明自己「三栖能力」的人来说，有意义的不是单一技术点，而是：**你能把一件牵涉三个陌生领域的事，系统地做出来、讲清楚、让别人 5 分钟上手。**

### 功能巡览

- `**/` 概览** — 一键运行预设研究组合（美股巨头 / 港股科技 / A 股白酒 …），即刻生成一份虚拟组合。
- `**/simulation` 模拟盘** — 实时虚拟组合，按 bar 重跑研究，支持手动买卖。
- `**/analysis` 个股研究** — 18 位分析师并行打分 + 综合方向 + 每位分析师的推理 + 风险雷达。
- `**/backtest` 策略回测** — 历史滚动向前回放，权益曲线、夏普、最大回撤。
- `**/vault` 链上金库** — MetaMask 连接、内置 mUSDC 水龙头、存取款、**「让 AI 分析并上链」** 按钮、带链上溯源的分配表。
- `**/settings`** — 风险偏好（保守 / 稳健 / 进取）全站同步。
- **顶栏语言切换** — 中英 UI 完整覆盖，零 i18n 依赖。

### 技术上不轻松的点

- **NAV 由_已实现_收益驱动。** Oracle 每轮快照每个标的的价格，把金库真实持仓的加权收益通过 `reportPerformance(deltaBps)` 上链（单次 ±5%，与真实基金后台的防呆阈值一致）。
- **置信度加权、只做多分配。** 看多 → 权重 ∝ 置信度；中性 → 0.2×；看空 → 0。舍入漂移归给最高置信度，保证权重精确加到 10,000 bps。
- **两条上链路径** —— 命令行 Oracle 守护进程 / 或 dApp 钱包签名按钮，都走同一个 `ORACLE_ROLE`、同一个 `FintasSignalRegistry`，产生一致的审计线索。

### 架构

```
                ┌───────── Yahoo Finance (实时 + 历史) ─────────┐
                ▼                                               ▼
      ┌──────────────────┐                           ┌──────────────────────┐
      │ 14 位大师模型     │◄── 加权合成 + 置信度 ───►│ 4 位核心分析师        │
      │ (巴菲特、格雷厄姆│                            │ 技术 / 基本面 / 估值  │
      │  彼得·林奇 …)   │                            │ / 情绪                │
      └────────┬─────────┘                           └──────────┬───────────┘
               └──── 综合信号 (bull/bear/neu + 置信度) ─────────┘
                                  │
        ┌─────────────────────────┼──────────────────────────┐
        ▼                         ▼                          ▼
┌──────────────────┐    ┌────────────────────┐    ┌─────────────────────────┐
│ 模拟盘账簿       │    │ 滚动向前回测       │    │ Oracle 桥 / 钱包签名    │
│ (本地 JSON)      │    │                    │    │ → SignalRegistry.push   │
│                  │    │                    │    │ → Vault.rebalance       │
│                  │    │                    │    │ → Vault.reportPerf(Δ)   │
└──────────────────┘    └────────────────────┘    └─────────────────────────┘
                                  │
                       Next.js dApp (React + ethers v6)
                         ↕ Hardhat 本地链 (chainId 31337)
```

### 使用步骤 — 手把手

> **关于钱的提醒**：你**不需要**花任何真金白银。Hardhat 本地链给每个默认账户发 10,000 测试 ETH，mUSDC 水龙头一键发 10,000 模拟美元。**如果哪里提示你「给钱包充值真 ETH」，那一定不是本项目的正常流程** —— 所有补给都走内置脚本或 UI 按钮。

**环境要求** · Node 20+ · Python 3.11+ · Git · Chromium 内核浏览器 + [MetaMask](https://metamask.io)

**1. 克隆 + 启动后端和前端**

```bash
git clone <仓库地址> FintasTech
cd FintasTech
./start.sh          # 自动创建 Python venv、装依赖、
                    # 起 FastAPI (:8000) 和 Next.js (:3000)
                    # 并帮你打开 http://localhost:3000
```

**2. 启动本地区块链**（新终端）

```bash
cd blockchain
npm install
npm run node        # Hardhat 本地链 http://127.0.0.1:8545
                    # 20 个预置账户，每个 10,000 测试 ETH
```

**3. 部署合约**（再新开一个终端，`npm run node` 不要关）

```bash
cd blockchain
npm run deploy:local    # 部署 MockUSDC + SignalRegistry + Vault
                        # 地址自动写入 deployments/localhost.json
```

**4. 配置 MetaMask**

- 添加网络：**Hardhat Localhost** · RPC `http://127.0.0.1:8545` · Chain ID `31337` · 货币符号 `ETH`
- 二选一：
  - **最省事** —— 导入 Hardhat Account #0 的私钥（`0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`）。这个账户自带 10,000 测试 ETH **并且**持有 `ORACLE_ROLE`，所有签名都能做。
  - **想用自己的钱包？** 复制你 MetaMask 的地址，然后：
    ```bash
    cd blockchain
    FUND_TO=0x你的地址 npm run fund:local    # 给你充 100 测试 ETH
    ```
    （在 `/vault` 页面如果检测到你余额为 0，也会把这条命令带上你的地址直接显示给你。）

**5. 玩起来**

- 打开 `http://localhost:3000`，在左侧栏点击 **中文 / EN** —— 整站 UI 实时切换。
- 首页任选一个预设研究组合，点击即跳模拟盘。
- 进入 `/vault`：
  1. 点 **领取 Faucet** → 收到 10,000 mUSDC（每小时可重复领）。
  2. 存入 1,000 mUSDC → 获得 1,000 份金库份额（NAV 初始为 1.0）。
  3. 填入自选股（如 `AAPL, MSFT, TSLA, 0700.HK`），点 **让 AI 分析并上链**。前端会：调研究 API → 钱包签名把每个标的的方向 + 置信度写入 `SignalRegistry` → 按置信度权重调用 `rebalanceAllocations`。下方分配表随即出现。

**6. 让 NAV 真实浮动**（可选，推荐）

```bash
cd blockchain
npx hardhat run scripts/oracle-bridge.js --network localhost
```

Oracle 每轮（默认 15 分钟）快照价格，按金库当前真实持仓计算区间加权收益，通过 `reportPerformance(deltaBps)` 上链。刷新 `/vault` 可以看到 NAV、历史最高值、份额估值随真实市场数据演化。

### 技术栈


| 层       | 选型                                                                                                |
| ------- | ------------------------------------------------------------------------------------------------- |
| 研究 / 数据 | Python 3.11, FastAPI, `yfinance`, pandas, NumPy                                                   |
| 智能合约    | Solidity 0.8.24, OpenZeppelin `AccessControl` / `ReentrancyGuard` / `Pausable` / `ERC20`, Hardhat |
| 前端      | Next.js 15 (App Router), React, Tailwind v4, ethers v6, MetaMask                                  |
| 国际化     | 零依赖 React Context + `useT()`                                                                      |


### 目录结构

```
├── src/fintastech/     # Python 研究 pipeline（分析师 / 大师模型 / 回测）
├── api/                # FastAPI 服务
├── blockchain/         # Hardhat 工作区（合约 + 部署 + Oracle 脚本）
├── frontend/           # Next.js dApp
│   └── src/lib/i18n    # 中英双语词典 + LanguageProvider
├── DISCLAIMER.md       # 教学免责声明（中英）
└── README.md
```

---

## License · 许可与免责

MIT © 2026 FintasTech contributors — see `[LICENSE](./LICENSE)`.

本项目仅用于学习与研究，所有输出为描述性研究信号，不构成投资建议，也不执行任何真实资金交易。完整声明见 `[DISCLAIMER.md](./DISCLAIMER.md)`。

*FOR EDUCATION AND RESEARCH USE ONLY. Research signals are descriptive only; not investment advice. See `[DISCLAIMER.md](./DISCLAIMER.md)` for full terms.*