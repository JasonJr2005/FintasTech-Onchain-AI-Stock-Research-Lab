"use client";

import { BrowserProvider, Contract, JsonRpcSigner, formatUnits } from "ethers";
import { MOCK_USDC_ABI, SIGNAL_REGISTRY_ABI, VAULT_ABI } from "./abis";

// Addresses are written into this file by `scripts/deploy.js`.
// A fallback stub is shipped so the app still compiles in environments where
// the blockchain hasn't been deployed yet.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const addresses = (() => {
  try {
    // webpack / turbopack will inline this JSON at build time
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("./addresses.json") as DeploymentMeta;
  } catch {
    return null;
  }
})();

export interface DeploymentMeta {
  network: string;
  chainId: number;
  deployedAt: string;
  deployer: string;
  contracts: {
    MockUSDC: string;
    FintasSignalRegistry: string;
    FintasVault: string;
  };
}

export function getDeployment(): DeploymentMeta | null {
  return addresses;
}

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}

export function hasMetaMask(): boolean {
  return typeof window !== "undefined" && typeof window.ethereum !== "undefined";
}

/**
 * Networks this educational dApp is willing to talk to.
 *   - 31337     : Hardhat / localhost (development)
 *   - 11155111  : Sepolia testnet (public demo)
 *
 * Every other chain (Ethereum mainnet = 1, BSC = 56, Polygon = 137,
 * Arbitrum = 42161, Optimism = 10, ...) is treated as a real-value network
 * and refused at the UI layer.  This is part of the "no real money" guarantee.
 */
export const ALLOWED_CHAIN_IDS: ReadonlySet<number> = new Set([31337, 11155111]);

export const CHAIN_NAMES: Record<number, string> = {
  31337: "Hardhat Localhost",
  11155111: "Sepolia Testnet",
  1: "Ethereum Mainnet",
  56: "BNB Smart Chain",
  137: "Polygon",
  42161: "Arbitrum One",
  10: "Optimism",
  8453: "Base",
};

export function isAllowedChain(chainId: number): boolean {
  return ALLOWED_CHAIN_IDS.has(chainId);
}

export function describeChain(chainId: number): string {
  return CHAIN_NAMES[chainId] ?? `Unknown (chainId ${chainId})`;
}

export async function connectWallet(): Promise<{
  provider: BrowserProvider;
  signer: JsonRpcSigner;
  address: string;
  chainId: number;
}> {
  if (!hasMetaMask()) throw new Error("请先安装 MetaMask 浏览器扩展");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const provider = new BrowserProvider(window.ethereum as any);
  await provider.send("eth_requestAccounts", []);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  const net = await provider.getNetwork();
  return { provider, signer, address, chainId: Number(net.chainId) };
}

export async function switchToLocalhost() {
  if (!hasMetaMask() || !window.ethereum?.request) return;
  const HARDHAT_HEX = "0x7a69"; // 31337
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: HARDHAT_HEX }],
    });
  } catch (e: unknown) {
    // chain not yet added
    const err = e as { code?: number };
    if (err.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: HARDHAT_HEX,
            chainName: "Hardhat Localhost",
            rpcUrls: ["http://127.0.0.1:8545"],
            nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          },
        ],
      });
    } else {
      throw e;
    }
  }
}

export function usdcContract(runner: BrowserProvider | JsonRpcSigner) {
  const d = getDeployment();
  if (!d) throw new Error("No deployment artifacts found. Run `npm run deploy:local` first.");
  return new Contract(d.contracts.MockUSDC, MOCK_USDC_ABI, runner);
}

export function vaultContract(runner: BrowserProvider | JsonRpcSigner) {
  const d = getDeployment();
  if (!d) throw new Error("No deployment artifacts found.");
  return new Contract(d.contracts.FintasVault, VAULT_ABI, runner);
}

export function registryContract(runner: BrowserProvider | JsonRpcSigner) {
  const d = getDeployment();
  if (!d) throw new Error("No deployment artifacts found.");
  return new Contract(d.contracts.FintasSignalRegistry, SIGNAL_REGISTRY_ABI, runner);
}

export function formatUSDC(raw: bigint): string {
  return Number(formatUnits(raw, 6)).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatNav(raw: bigint): string {
  return Number(formatUnits(raw, 18)).toFixed(6);
}

export function shortAddr(a: string): string {
  if (!a) return "";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
