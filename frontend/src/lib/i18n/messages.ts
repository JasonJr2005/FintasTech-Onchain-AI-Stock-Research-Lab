// FintasTech i18n — Chinese (zh-CN) + English.
//
// Keys are grouped by page / feature; values are the two languages.
// To add a string: add `key: { zh: "…", en: "…" }`. Components read it
// via the `useT()` hook from `@/lib/i18n/context`.

export type Locale = "zh" | "en";

export const LOCALES: Locale[] = ["zh", "en"];

export const DEFAULT_LOCALE: Locale = "zh";

export const LOCALE_LABEL: Record<Locale, string> = {
  zh: "中文",
  en: "EN",
};

type Dict = Record<string, { zh: string; en: string }>;

export const MESSAGES: Dict = {
  // ── global ribbon + disclaimer ─────────────────────────────────────
  "ribbon.tag": { zh: "Edu", en: "Edu" },
  "ribbon.text": {
    zh: "仅供学习与研究 · 不构成任何投资建议 · 模拟盘 only · 严禁接入真实资金",
    en: "Educational research only · Not investment advice · Paper-trading only · No real-money connection",
  },
  "disclaimer.title": {
    zh: "开始使用前请阅读声明",
    en: "Please read before continuing",
  },
  "disclaimer.intro": {
    zh: "FintasTech 是开源学习项目，用于演示规则化多智能体股票研究与链上可审计的模拟盘（paper-trading）。",
    en: "FintasTech is an open-source educational project that demonstrates rule-based multi-agent equity research with on-chain auditable paper-trading.",
  },
  "disclaimer.bullet1": {
    zh: "所有输出均为描述性研究信号（看多/看空/中性）。",
    en: "All outputs are descriptive research signals (bullish / bearish / neutral).",
  },
  "disclaimer.bullet2": {
    zh: "本项目不提供投资建议，不推荐买入或卖出任何证券。",
    en: "This project does NOT provide investment advice and does NOT recommend buying or selling any security.",
  },
  "disclaimer.bullet3": {
    zh: "合约仅接受以 m 开头的 Mock 资产；不可用于真实资金。",
    en: "Vault only accepts mock ERC-20 assets whose symbol starts with 'm'. Cannot be pointed at real funds.",
  },
  "disclaimer.bullet4": {
    zh: "任何将本代码改造为实盘交易的行为，后果与风险由使用者自行承担。",
    en: "Any attempt to repurpose this code for live trading is at the user's sole risk and liability.",
  },
  "disclaimer.accept": {
    zh: "我已阅读并接受 · 继续使用",
    en: "I've read and accept — continue",
  },
  "disclaimer.full": {
    zh: "完整条款见仓库根目录 DISCLAIMER.md",
    en: "Full terms in DISCLAIMER.md at the repo root",
  },
  "footer.paperOnly": { zh: "Paper Trading Only", en: "Paper Trading Only" },
  "footer.stack": {
    zh: "开源 · Solidity + FastAPI + Next.js\n仅供学习研究。",
    en: "Open-source · Solidity + FastAPI + Next.js\nEducational use only.",
  },

  // ── sidebar nav ────────────────────────────────────────────────────
  "nav.section": { zh: "导航", en: "Navigate" },
  "nav.overview": { zh: "概览", en: "Overview" },
  "nav.simulation": { zh: "模拟盘", en: "Paper Trade" },
  "nav.analysis": { zh: "个股研究", en: "Research" },
  "nav.backtest": { zh: "策略回测", en: "Backtest" },
  "nav.vault": { zh: "链上金库", en: "On-chain Vault" },
  "nav.settings": { zh: "设置", en: "Settings" },
  "nav.brandSubtitle": { zh: "Research Lab", en: "Research Lab" },

  // ── landing / home ─────────────────────────────────────────────────
  "home.versionTag": {
    zh: "v0.4 · Paper Trading Only",
    en: "v0.4 · Paper Trading Only",
  },
  "home.heroPre": { zh: "AI 多智能体股票研究", en: "AI Multi-Agent Equity Research," },
  "home.heroEmph": { zh: "开箱即跑。", en: "zero-config." },
  "home.heroDesc": {
    zh: "14 位大师模型 + 4 位核心分析师 · 实时公开行情 · 链上可审计信号注册 · 全流程模拟盘。一键选定研究组合，立即生成可视化结果 —— 无需金融或编程背景。",
    en: "14 master models + 4 core analysts · live market data · on-chain auditable signal registry · full paper-trading loop. Pick a preset, get a visual answer in one click — no finance or coding background required.",
  },
  "home.ctaSim": { zh: "进入模拟盘 →", en: "Open paper-trade →" },
  "home.ctaAnalysis": { zh: "查看单只股票研究", en: "Single-stock research" },
  "home.ctaVault": { zh: "链上研究金库", en: "On-chain research vault" },
  "home.stat.equity": { zh: "虚拟总资产", en: "Virtual equity" },
  "home.stat.return": { zh: "总收益", en: "Total return" },
  "home.stat.holdings": { zh: "持仓数", en: "Holdings" },
  "home.stat.lastCycle": { zh: "上次循环", en: "Last cycle" },
  "home.presets.title": {
    zh: "一键开跑 · 预设研究组合",
    en: "One-click research presets",
  },
  "home.presets.subtitle": {
    zh: "点击任意组合立即运行 1 次研究循环并跳转至模拟盘 —— 无需任何配置",
    en: "Click any preset to run one research cycle and jump into the paper-trade — no setup required",
  },
  "home.presets.running": { zh: "运行一次研究循环 →", en: "Run one cycle →" },
  "home.presets.starting.progress": {
    zh: "正在调取 {name} 的实时行情…",
    en: "Fetching live quotes for {name}…",
  },
  "home.presets.starting.done": {
    zh: "完成！正在跳转到模拟盘…",
    en: "Done — jumping to the paper-trade…",
  },
  "home.presets.starting.failed": {
    zh: "失败：{msg}（请确认后端已启动：./start.sh）",
    en: "Failed: {msg} (check backend is running: ./start.sh)",
  },
  "home.presets.noBackend": {
    zh: "无法连接后端 API。请在终端执行 ./start.sh 启动服务，然后刷新本页。",
    en: "Cannot reach the research API. Run ./start.sh in a terminal, then refresh.",
  },
  "home.how.title": { zh: "它是怎么运作的？", en: "How does it work?" },
  "home.how.step1.title": { zh: "公开行情接入", en: "Public market-data layer" },
  "home.how.step1.body": {
    zh: "Yahoo Finance 获取美股、港股、A 股实时日频数据。无须付费 API key。",
    en: "Yahoo Finance for US / HK / CN equities, daily bars, no paid API key.",
  },
  "home.how.step2.title": { zh: "多智能体研究", en: "Multi-agent research" },
  "home.how.step2.body": {
    zh: "4 位核心分析师（技术/基本面/估值/情绪）+ 14 位金融大师模型并行评分，合成综合信号与置信度。",
    en: "4 core analysts (technical / fundamental / valuation / sentiment) + 14 investor-style master models score in parallel, fused into a composite signal with confidence.",
  },
  "home.how.step3.title": {
    zh: "模拟盘执行 & 链上审计",
    en: "Paper-trade execution & on-chain audit",
  },
  "home.how.step3.body": {
    zh: "依据示意权重调整本地虚拟仓位。研究结果可选地写入 FintasSignalRegistry 合约（仅 Hardhat / Sepolia）。",
    en: "Illustrative weights drive a local virtual portfolio. Signals optionally anchor in the FintasSignalRegistry contract (Hardhat / Sepolia only).",
  },
  "home.notice": {
    zh: "本项目仅用于学习与研究。所有研究信号均为规则化模型输出，不构成任何投资建议。合约通过 ChainId 白名单拒绝主网部署，且仅接受 Mock ERC20 资产（symbol 以「m」开头）。完整声明见 DISCLAIMER.md。",
    en: "This project is strictly for learning and research. All outputs are deterministic model signals and are NOT investment advice. The contracts refuse mainnet via a chain-ID allowlist and only accept mock ERC-20 assets (symbol starts with 'm'). Full terms in DISCLAIMER.md.",
  },
  "home.notice.hasPositions": {
    zh: "当前已有虚拟持仓，可随时在模拟盘页面重置。",
    en: "You have active virtual positions — reset them any time on the paper-trade page.",
  },

  // ── vault ──────────────────────────────────────────────────────────
  "vault.tag": {
    zh: "On-chain Research Vault · Paper Trading",
    en: "On-chain Research Vault · Paper Trading",
  },
  "vault.title": { zh: "链上研究金库", en: "On-chain Research Vault" },
  "vault.subtitle": {
    zh: "存入测试代币 mUSDC，由规则化多智能体研究信号驱动 NAV 波动，所有判断链上可审计。合约仅接受以 m 开头的 Mock 资产，任何时候可通过紧急熔断通道按 1:1 本金退出。",
    en: "Deposit the test token mUSDC; NAV is moved by rule-based multi-agent research signals and every decision is on-chain auditable. The vault accepts only mock assets whose symbol starts with 'm'. A circuit-breaker always lets you exit 1:1 on principal.",
  },
  "vault.notAdvice": {
    zh: "本功能不构成任何投资建议，也不支持真实资金。",
    en: "This is NOT investment advice and does NOT support real funds.",
  },
  "vault.noEthWarn.title": {
    zh: "你的 MetaMask 账户目前在本地链上有 0 测试 ETH — 所以付不起 gas。",
    en: "Your MetaMask account has 0 test ETH on the local chain — can't pay gas.",
  },
  "vault.noEthWarn.body": {
    zh: "在 Hardhat 本地链上 gas 是完全免费的，只是 MetaMask 新建的账户初始余额是 0，需要先给它充一点测试 ETH（虚拟、无真实价值）。任选下面一种方式即可：",
    en: "On Hardhat local, gas is completely free — new MetaMask accounts just start at 0 balance so they need a tiny top-up of test ETH (virtual, no value). Pick either option below:",
  },
  "vault.noEthWarn.methodA": {
    zh: "方式 A (推荐) — 一键水龙头脚本",
    en: "Option A (recommended) — one-shot faucet script",
  },
  "vault.noEthWarn.methodADesc": {
    zh: "复制你当前的钱包地址，在项目根目录跑这一行，就会立刻给你充 100 测试 ETH：",
    en: "Copy your address and run this in the project root to instantly fund 100 test ETH:",
  },
  "vault.noEthWarn.methodB": {
    zh: "方式 B — 直接导入 Hardhat 默认账户",
    en: "Option B — import the default Hardhat account",
  },
  "vault.noEthWarn.methodBDesc": {
    zh: "启动 npm run node 时终端会打印 20 个带 10,000 ETH 的账户和私钥。打开 MetaMask → 右上角头像 → 「添加账户或硬件钱包」→「导入账户」→ 粘贴其中任意一个私钥即可。切记只在本地 / 测试网用这些钥匙，永远不要往里转真币。",
    en: "`npm run node` prints 20 pre-funded accounts with 10,000 test ETH each. In MetaMask → avatar menu → Add account or hardware wallet → Import account → paste any of the private keys. Only use these keys on local / testnet — never send real money to them.",
  },
  "vault.noEthWarn.sepolia": {
    zh: "Sepolia 测试网也是免费的，但需要先去 Sepolia 水龙头领取 Sepolia ETH —— 步骤更多，推荐先用本地链熟悉流程。",
    en: "Sepolia testnet is free too but needs a faucet visit — more friction, we recommend starting on the local chain.",
  },
  "vault.copyAddr": { zh: "复制地址", en: "Copy address" },
  "vault.copyAddr.done": { zh: "已复制 ✓", en: "Copied ✓" },
  "vault.fundHint": {
    zh: "跑完几秒后 MetaMask 余额自动刷新。可以重复运行随时补充。",
    en: "MetaMask refreshes within seconds. Run again any time to top up.",
  },
  "vault.showPK": {
    zh: "查看 Hardhat Account #0 的默认私钥（仅本地测试用）",
    en: "Show Hardhat Account #0 default private key (local test only)",
  },
  "vault.pkHint": {
    zh: "地址: 0xf39Fd6e51aad88F6F4ce6aB8827279cfFFb92266 — 初始余额 10,000 test ETH。这是 Hardhat 官方文档公开的、每台机器都一样的测试钥匙。",
    en: "Address 0xf39Fd6e51aad88F6F4ce6aB8827279cfFFb92266 — 10,000 test ETH. This is the public, every-machine-same Hardhat docs key.",
  },
  "vault.ethOK": {
    zh: "本地链余额 {bal} 测试 ETH — 足够支付所有演示 gas，完全免费。",
    en: "Local chain balance: {bal} test ETH — enough for every demo tx, completely free.",
  },
  "vault.chainNotAllowed": {
    zh: "当前网络 {chain} 未在白名单中。本项目仅允许：{allowed}",
    en: "Network {chain} is not on the allowlist. This project only allows: {allowed}",
  },
  "vault.notDeployed": {
    zh: "尚未检测到部署信息。先在 blockchain/ 目录运行 npm run node 和 npm run deploy:local，之后刷新本页。",
    en: "No deployment found. Run `npm run node` and `npm run deploy:local` in `blockchain/`, then refresh.",
  },
  "vault.connectHint": {
    zh: "使用 MetaMask 连接钱包以开始与合约交互",
    en: "Connect MetaMask to interact with the contracts",
  },
  "vault.connect": { zh: "连接 MetaMask", en: "Connect MetaMask" },
  "vault.noMetaMask": {
    zh: "未检测到 MetaMask · 请先在 metamask.io 安装",
    en: "MetaMask not detected — install from metamask.io first",
  },
  "vault.stat.addr": { zh: "钱包地址", en: "Wallet" },
  "vault.stat.network": { zh: "网络", en: "Network" },
  "vault.stat.chain": { zh: "chainId {id}", en: "chainId {id}" },
  "vault.stat.notAllowed": { zh: "未在白名单", en: "Not on allowlist" },
  "vault.stat.usdc": { zh: "mUSDC 余额", en: "mUSDC balance" },
  "vault.stat.shares": { zh: "我持有的金库份额", en: "My vault shares" },
  "vault.stat.sharesHint": { zh: "≈ {val} mUSDC", en: "≈ {val} mUSDC" },
  "vault.switchLocal": {
    zh: "切换到 Hardhat Localhost",
    en: "Switch to Hardhat Localhost",
  },
  "vault.card.faucet.title": {
    zh: "1) 领取测试 mUSDC",
    en: "1) Claim test mUSDC",
  },
  "vault.card.faucet.subtitle": {
    zh: "一次 10,000 · 每小时可再次领取",
    en: "10,000 per claim · hourly cooldown",
  },
  "vault.card.faucet.action": { zh: "领取 Faucet", en: "Claim faucet" },
  "vault.card.faucet.busy": { zh: "领取中…", en: "Claiming…" },
  "vault.card.faucet.done": {
    zh: "✓ 已领取 10,000 mUSDC",
    en: "✓ Claimed 10,000 mUSDC",
  },
  "vault.card.deposit.title": {
    zh: "2) 存入金库（模拟盘）",
    en: "2) Deposit (paper trade)",
  },
  "vault.card.deposit.subtitle": {
    zh: "研究信号驱动 NAV · 无真实交易",
    en: "NAV moved by research signals · no real trading",
  },
  "vault.card.deposit.placeholder": {
    zh: "金额 (mUSDC)",
    en: "Amount (mUSDC)",
  },
  "vault.card.deposit.action": { zh: "存入", en: "Deposit" },
  "vault.card.deposit.paused": {
    zh: "金库已暂停，仅允许赎回",
    en: "Vault paused — withdrawals only",
  },
  "vault.card.deposit.done": {
    zh: "✓ 存入成功 · tx {tx}",
    en: "✓ Deposited · tx {tx}",
  },
  "vault.card.withdraw.title": { zh: "3) 赎回份额", en: "3) Withdraw" },
  "vault.card.withdraw.subtitle": {
    zh: "按当前 NAV 换算为 mUSDC（扣除绩效费如有）",
    en: "Shares → mUSDC at current NAV (minus performance fee if any)",
  },
  "vault.card.withdraw.placeholder": {
    zh: "全部赎回 (你有 {n} 份)",
    en: "All shares ({n} held)",
  },
  "vault.card.withdraw.action": { zh: "赎回", en: "Withdraw" },
  "vault.card.withdraw.emergency": { zh: "紧急赎回", en: "Emergency" },
  "vault.card.withdraw.cb": {
    zh: "熔断已触发 — 按 1:1 本金原路退出",
    en: "Circuit breaker active — 1:1 principal exit",
  },
  "vault.card.withdraw.done": {
    zh: "✓ 赎回成功 · tx {tx}",
    en: "✓ Withdrawn · tx {tx}",
  },
  "vault.card.state.title": { zh: "金库状态", en: "Vault state" },
  "vault.card.state.subtitle": { zh: "链上实时", en: "Live on-chain" },
  "vault.card.state.nav": { zh: "NAV / share", en: "NAV / share" },
  "vault.card.state.navPct": { zh: "相对 1.0", en: "vs. 1.0" },
  "vault.card.state.totalAssets": {
    zh: "总资产 (mUSDC)",
    en: "Total assets (mUSDC)",
  },
  "vault.card.state.totalSupply": {
    zh: "总份额供给",
    en: "Total share supply",
  },
  "vault.card.state.hwm": { zh: "历史最高 NAV", en: "High water mark" },
  "vault.card.state.status": { zh: "暂停 / 熔断", en: "Paused / CB" },
  "vault.oracle.title": {
    zh: "让 AI 分析你的自选股并上链",
    en: "Let AI analyse your watch-list and anchor it on-chain",
  },
  "vault.oracle.subtitle": {
    zh: "逗号 / 空格分隔，最多 12 个。置信度越高、方向越看多，分到的示意权重越大；看空标的权重 = 0（模拟盘只做多）。",
    en: "Comma / space separated, up to 12. Higher confidence & bullish → larger illustrative weight; bearish → 0 (paper-trade is long-only).",
  },
  "vault.oracle.perm": { zh: "权限:", en: "Permission:" },
  "vault.oracle.roleOK": { zh: "ORACLE ✓", en: "ORACLE ✓" },
  "vault.oracle.roleMissing": { zh: "非 Oracle", en: "Not Oracle" },
  "vault.oracle.input.placeholder": {
    zh: "例如：AAPL, MSFT, TSLA, 0700.HK",
    en: "e.g. AAPL, MSFT, TSLA, 0700.HK",
  },
  "vault.oracle.run": { zh: "让 AI 分析并上链", en: "Analyse & anchor on-chain" },
  "vault.oracle.running": { zh: "上链中…", en: "Signing…" },
  "vault.oracle.tip.ok": {
    zh: "调用研究 API → 签名 pushSignal + rebalanceAllocations",
    en: "Research API → pushSignal + rebalanceAllocations",
  },
  "vault.oracle.tip.noRole": {
    zh: "当前钱包没有 ORACLE_ROLE，切到部署者账户 (Hardhat Account #0) 再试",
    en: "Current wallet lacks ORACLE_ROLE — switch to the deployer (Hardhat Account #0).",
  },
  "vault.oracle.roleHint": {
    zh: "提示：本按钮会用当前钱包直接签发 on-chain 审计信号，因此需要 ORACLE_ROLE。在本地 Hardhat 上，部署脚本已把这个角色授给 Account #0 (0xf39F…92266)。在 MetaMask 里把它导入并切换到该账户即可。",
    en: "This button signs on-chain audit signals with the connected wallet, so it requires ORACLE_ROLE. On local Hardhat, the deploy script grants this role to Account #0 (0xf39F…92266). Import its key into MetaMask and switch to it.",
  },
  "vault.oracle.progress.fetch": {
    zh: "拉取 AI 分析中（{n} 个标的）…",
    en: "Fetching AI analysis ({n} symbols)…",
  },
  "vault.oracle.progress.push": { zh: "上链签发 {sym}…", en: "Signing {sym}…" },
  "vault.oracle.progress.rebalance": {
    zh: "上链调仓（rebalanceAllocations）…",
    en: "Rebalancing on-chain…",
  },
  "vault.oracle.err.empty": {
    zh: "请先填入至少一个标的（逗号或空格分隔）",
    en: "Enter at least one symbol (comma / space separated)",
  },
  "vault.oracle.err.tooMany": {
    zh: "一次最多分析 12 个标的，避免单笔 gas 过大",
    en: "Up to 12 symbols at once, to keep gas reasonable",
  },
  "vault.oracle.err.noRole": {
    zh: "当前钱包未持有 ORACLE_ROLE，无法上链签发研究信号。请切换到部署者账户（Hardhat Account #0：0xf39F...92266）或让管理员授权本账户的 ORACLE_ROLE。",
    en: "Current wallet lacks ORACLE_ROLE and cannot sign research signals on-chain. Switch to the deployer (Hardhat Account #0: 0xf39F…92266) or ask an admin to grant ORACLE_ROLE.",
  },
  "vault.oracle.err.allFailed": {
    zh: "所有标的 AI 分析都失败了，请检查研究 API 是否运行",
    en: "All AI analyses failed — check the research API is running",
  },
  "vault.oracle.done.noBullish": {
    zh: "✓ 已为 {n} 个标的上链签发信号；但所有信号都是看空/空仓，金库不做调仓。",
    en: "✓ Anchored {n} signals on-chain; all bearish / cash, so no rebalance.",
  },
  "vault.oracle.done.rebalanced": {
    zh: "✓ 已签发 {n} 条信号并上链调仓：{pretty}",
    en: "✓ Signed {n} signals and rebalanced on-chain: {pretty}",
  },
  "vault.empty.title": {
    zh: "金库当前没有 AI 分配",
    en: "Vault has no AI allocation yet",
  },
  "vault.empty.body": {
    zh: "存入的 mUSDC 现在只是在金库里静躺——尚未有任何 AI 研究信号告诉金库「以什么比例跟踪哪些标的」。点上方「让 AI 分析并上链」就会：① 调用研究 API 分析你的自选 ② 用钱包签名把每个标的的方向/置信度写入 FintasSignalRegistry ③ 按置信度加权的权重调用 FintasVault.rebalanceAllocations。完成后下方表格会出现。",
    en: "Deposited mUSDC is sitting idle — no AI signal has told the vault what to track. Clicking Analyse & anchor on-chain above will: ① call the research API; ② sign each symbol's direction + confidence into FintasSignalRegistry; ③ invoke FintasVault.rebalanceAllocations with conviction-weighted bps. The table below will then appear.",
  },
  "vault.alloc.title": {
    zh: "研究模型当前示意权重 · 链上信号",
    en: "Current illustrative weights · on-chain signals",
  },
  "vault.alloc.col.symbol": { zh: "标的", en: "Symbol" },
  "vault.alloc.col.weight": { zh: "模拟权重", en: "Weight" },
  "vault.alloc.col.dir": { zh: "研究方向", en: "Direction" },
  "vault.alloc.col.conf": { zh: "置信度", en: "Confidence" },
  "vault.alloc.col.score": { zh: "Score", en: "Score" },
  "vault.alloc.col.signed": { zh: "链上签发", en: "Signed" },
  "vault.alloc.dir.bear": { zh: "看空", en: "Bearish" },
  "vault.alloc.dir.neu": { zh: "中性", en: "Neutral" },
  "vault.alloc.dir.bull": { zh: "看多", en: "Bullish" },
  "vault.alloc.ago": { zh: "{n}m ago", en: "{n}m ago" },
  "vault.footer.network": { zh: "Network", en: "Network" },
  "vault.footer.vault": { zh: "Vault", en: "Vault" },
  "vault.footer.registry": { zh: "Registry", en: "Registry" },
  "vault.footer.usdc": { zh: "mUSDC", en: "mUSDC" },

  // ── settings ───────────────────────────────────────────────────────
  "settings.tag": {
    zh: "Simulation Parameters",
    en: "Simulation Parameters",
  },
  "settings.title": { zh: "模拟盘参数", en: "Simulation parameters" },
  "settings.subtitle": {
    zh: "这些设置只影响研究模型在模拟盘中的示意仓位权重，不构成任何投资建议。保存后，模拟盘 与 个股研究 会自动采用新的风险偏好。",
    en: "These settings only change the illustrative position weights used by the paper-trading simulator. They are not investment advice. Paper Trade and Research pages pick up the new risk preference immediately after save.",
  },
  "settings.risk.title": { zh: "风险偏好", en: "Risk preference" },
  "settings.profile.conservative.label": { zh: "保守型", en: "Conservative" },
  "settings.profile.conservative.desc": {
    zh: "模拟盘单标的上限约 10%，用于研究低波动风格",
    en: "Per-symbol cap ≈ 10%, useful for low-volatility studies",
  },
  "settings.profile.moderate.label": { zh: "稳健型", en: "Moderate" },
  "settings.profile.moderate.desc": {
    zh: "模拟盘单标的上限约 20%，平衡展示多数策略",
    en: "Per-symbol cap ≈ 20%, balanced view for most strategies",
  },
  "settings.profile.aggressive.label": { zh: "进取型", en: "Aggressive" },
  "settings.profile.aggressive.desc": {
    zh: "模拟盘单标的上限约 35%，便于观察高波动场景",
    en: "Per-symbol cap ≈ 35%, amplifies high-volatility observations",
  },
  "settings.horizon.label": {
    zh: "回测默认研究期限（月）",
    en: "Default backtest horizon (months)",
  },
  "settings.horizon.suffix": { zh: "个月", en: "months" },
  "settings.save": { zh: "保存设置", en: "Save settings" },
  "settings.saved": {
    zh: "已保存 ✓ 全站已生效",
    en: "Saved ✓ applied across the app",
  },

  // ── simulation / backtest / analysis (high-level only) ────────────
  "sim.tag": {
    zh: "Paper Trading · 模拟盘",
    en: "Paper Trading · simulator",
  },
  "sim.title": { zh: "AI 研究模拟盘", en: "AI research paper-trade" },
  "sim.subtitle": {
    zh: "规则化多智能体输出示意权重，驱动一个本地虚拟组合。所有数值仅供学习研究，不构成任何投资建议。",
    en: "Rule-based multi-agent output drives the illustrative weights of a local virtual portfolio. All numbers are for research and education only — not investment advice.",
  },
  "backtest.tag": { zh: "Historical Replay · 回测", en: "Historical replay · backtest" },
  "backtest.title": { zh: "策略回测", en: "Strategy backtest" },
  "backtest.subtitle": {
    zh: "把研究信号套到历史数据上，生成权益曲线与风险指标。基于历史表现的结论在未来不一定重现 — 本页不构成任何投资建议。",
    en: "Replay the research signal over historical data to produce an equity curve and risk metrics. Past performance does not guarantee future results — this page is not investment advice.",
  },
  "analysis.tag": { zh: "Single-stock Research", en: "Single-stock research" },
  "analysis.title": { zh: "个股研究", en: "Single-stock research" },
  "analysis.subtitle": {
    zh: "14 位大师模型 + 4 位核心分析师并行评分，输出综合方向与置信度。仅供学习研究，不构成任何投资建议。",
    en: "14 master models + 4 core analysts score in parallel, fused into a composite direction and confidence. For education only, not investment advice.",
  },

  // ── generic ────────────────────────────────────────────────────────
  "common.language": { zh: "语言", en: "Language" },
  "common.switchLang": { zh: "切换语言", en: "Switch language" },
};

/**
 * Resolve a message by key, with positional `{name}` interpolation.
 * Returns the key itself when missing so you immediately see what's
 * untranslated in the UI.
 */
export function t(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  const entry = MESSAGES[key];
  if (!entry) return key;
  let out = entry[locale] ?? entry.zh ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      out = out.replaceAll(`{${k}}`, String(v));
    }
  }
  return out;
}
