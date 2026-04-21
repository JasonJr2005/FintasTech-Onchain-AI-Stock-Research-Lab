# FintasTech — Disclaimer

**FOR EDUCATIONAL AND RESEARCH USE ONLY. NOT INVESTMENT ADVICE.**

English first, 中文在下方。

---

## English

FintasTech is an **open-source educational framework** that demonstrates:

1. Rule-based multi-agent stock research (14 "master investor" heuristics plus
   4 core analyst modules — fundamental, technical, valuation, sentiment).
2. A **paper-trading simulator** built on public market data (Yahoo Finance
   via `yfinance`).
3. An on-chain research vault and signal registry (Solidity + Hardhat) that
   mirrors the off-chain model's judgments to a tamper-evident ledger — using
   a **mock stablecoin (mUSDC)** only.

### What this project is NOT

- It is **not** an investment advisory service, broker-dealer, asset manager,
  or financial product of any kind.
- It does **not** provide personalized investment recommendations, suitability
  determinations, or buy/sell instructions.
- It does **not** execute real-money trades. There is no brokerage integration
  and none is provided in this repository.
- The signals published on chain (`bullish` / `bearish` / `neutral` with a
  confidence score) are **descriptive research outputs**, not offers or
  solicitations to transact in any security.

### Architectural safeguards against real-money misuse

This repository ships several mechanical safeguards so that casual users
cannot accidentally turn the code into a real-money system:

1. **Vault-level mock-asset guard.** `FintasVault`'s constructor reverts with
   `AssetNotMarkedAsMock` unless the underlying ERC20's symbol begins with the
   lowercase letter `m`. Real stablecoins (`USDC`, `DAI`, `USDT`, …) cannot be
   used without editing the contract.
2. **Deployment network allow-list.** `scripts/deploy.js` and
   `scripts/oracle-bridge.js` refuse to run on any chain other than Hardhat
   local (31337) and Sepolia testnet (11155111). Mainnet, BSC, Polygon,
   Arbitrum, Optimism, Base, etc. are rejected at script entry.
3. **Frontend chain allow-list.** The dApp refuses to talk to any chain that
   is not in `ALLOWED_CHAIN_IDS` (31337, 11155111).
4. **No broker / DEX integration.** The `execution/` Python package is a
   paper-trading simulator only. There is no order routing code path to a
   real market, exchange, or DEX.
5. **On-chain educational notice.** `FintasVault` emits an
   `EducationalUseOnly` event at construction stating the non-commercial
   purpose on the immutable ledger.

### Fork, modify, and use at your own risk

This software is released under the MIT license (see `LICENSE`). If you fork
this repository and **remove** any of the safeguards above in order to handle
real value, you are operating outside the authors' intent and assume all
legal, regulatory, and financial risk. The authors and contributors provide
**no warranty** and accept **no liability** for losses or damages arising
from any use of the software.

Nothing in this repository should be construed as:
- A solicitation to buy or sell any security, token, or derivative.
- A prediction of future performance of any asset.
- Tax, legal, accounting, or investment advice.

### Data and third-party content

- Market data is retrieved from Yahoo Finance via the `yfinance` library.
  Use of that data is subject to Yahoo's own terms of service.
- "Master investor" heuristics reference publicly known investment
  philosophies of historical figures (Buffett, Munger, Graham, Lynch, …).
  The rule-based scoring is a simplified pedagogical model; it does not
  represent the actual methodology of any living or deceased investor.

---

## 中文

FintasTech 是一个**开源学习项目**，目的在于演示：

1. 规则化多智能体股票研究（14 位"大师投资者"启发式 + 4 位核心分析师模块）。
2. 基于公开行情（Yahoo Finance）的**模拟盘（paper trading）**。
3. 一个链上研究金库 + 信号注册合约（Solidity + Hardhat），用于把离线模型的
   判断镜像到链上可审计账本。**仅接受 Mock 稳定币 mUSDC**。

### 本项目不是

- 不是投资咨询服务、经纪商、资管产品或任何形式的金融产品。
- 不提供个性化投资建议、合格性判断或买卖指令。
- 不会执行真实资金交易；仓库中未、也不会提供券商/交易所/DEX 对接代码。
- 链上发布的信号（`bullish` / `bearish` / `neutral` + 置信度）是**描述性研究
  输出**，不构成任何证券买卖要约或劝诱。

### 代码层面的"严禁真钱"硬护栏

1. **合约层 Mock 资产校验。** `FintasVault` 构造时会校验底层 ERC20 的 symbol
   必须以小写 `m` 开头，否则抛出 `AssetNotMarkedAsMock` 错误。USDC / DAI /
   USDT 等真实稳定币将无法被使用。
2. **部署脚本网络白名单。** `scripts/deploy.js` 与
   `scripts/oracle-bridge.js` 会拒绝在 Hardhat Local (31337) 与 Sepolia
   (11155111) 之外的任何链上运行。
3. **前端网络白名单。** dApp 会拒绝与非白名单链交互，弹出明显警告。
4. **无实盘对接。** `execution/` 模块仅为模拟盘。
5. **链上教学声明。** `FintasVault` 会在构造时触发 `EducationalUseOnly`
   事件，把"非商业、仅教学"的性质永久写在链上。

### Fork / 修改 / 后果自负

本仓库采用 MIT 许可证（见 `LICENSE`）。**任何将本代码 fork 后删除上述护栏
并用于真实资金的行为**，均超出作者本意，由使用者自行承担全部法律、监管
与财务风险。作者不提供任何保证，不对任何损失负责。

本仓库中任何内容均**不得**被解读为：
- 购买或出售任何证券、代币或衍生品的劝诱；
- 任何资产未来表现的预测；
- 任何税务、法律、会计或投资建议。
