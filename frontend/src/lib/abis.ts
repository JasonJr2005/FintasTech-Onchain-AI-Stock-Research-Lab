// Minimal human-readable ABIs for the three FintasTech contracts.
// Using the ethers v6 "human-readable" ABI format keeps this file small
// and easy to audit compared with importing full Hardhat artifacts.

export const MOCK_USDC_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function faucet()",
  "event FaucetClaimed(address indexed user, uint256 amount)",
];

export const SIGNAL_REGISTRY_ABI = [
  "function getLatest(string symbol) view returns (tuple(uint8 direction, uint16 confidenceBps, int16 scoreBps, uint64 timestamp, bytes32 reasoningHash, address publishedBy))",
  "function isFresh(string symbol) view returns (bool)",
  "function trackedSymbolsCount() view returns (uint256)",
  "function trackedSymbols(uint256) view returns (bytes32)",
  "function symbolOf(bytes32) view returns (string)",
  "function historyLength(string symbol) view returns (uint256)",
  "function ORACLE_ROLE() view returns (bytes32)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function pushSignal(string symbol, uint8 direction, uint16 confidenceBps, int16 scoreBps, bytes32 reasoningHash)",
  "event SignalPushed(bytes32 indexed symbolHash, string symbol, uint8 direction, uint16 confidenceBps, int16 scoreBps, uint64 timestamp, address indexed publishedBy)",
];

export const VAULT_ABI = [
  "function asset() view returns (address)",
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function totalAssets() view returns (uint256)",
  "function navPerShare() view returns (uint256)",
  "function highWaterMark() view returns (uint256)",
  "function lastUpdateAt() view returns (uint256)",
  "function performanceFeeBps() view returns (uint256)",
  "function paused() view returns (bool)",
  "function circuitBreakerTripped() view returns (bool)",
  "function sharesToAssets(uint256 shares) view returns (uint256)",
  "function assetsToShares(uint256 assets) view returns (uint256)",
  "function allocationCount() view returns (uint256)",
  "function getAllocations() view returns (tuple(string symbol, uint16 weightBps)[])",
  "function deposit(uint256 assets) returns (uint256)",
  "function withdraw(uint256 shares) returns (uint256)",
  "function emergencyWithdraw(uint256 shares) returns (uint256)",
  "function rebalanceAllocations(string[] symbols, uint16[] weightsBps)",
  "function ORACLE_ROLE() view returns (bytes32)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "event Deposited(address indexed user, uint256 assets, uint256 shares, uint256 navPerShare)",
  "event Withdrawn(address indexed user, uint256 shares, uint256 assets, uint256 fee, uint256 navPerShare)",
  "event PerformanceReported(int256 deltaBps, uint256 newNav, uint256 newHighWaterMark)",
  "event AllocationsRebalanced(string[] symbols, uint16[] weightsBps)",
];
