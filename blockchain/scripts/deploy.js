const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

// Hard refuse deployments to any mainnet / L2 with real value.
// Allowed: hardhat & localhost (31337), Sepolia testnet (11155111).
const ALLOWED_CHAIN_IDS = new Set([31337n, 11155111n]);

async function main() {
  const { ethers, network } = hre;

  const chainId = (await ethers.provider.getNetwork()).chainId;
  if (!ALLOWED_CHAIN_IDS.has(chainId)) {
    throw new Error(
      `FintasTech refuses to deploy on chainId ${chainId}. ` +
        "This is an educational paper-trading project. Allowed chains: " +
        "Hardhat local (31337) and Sepolia (11155111)."
    );
  }

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("\n================================================");
  console.log(" FintasTech — EDUCATIONAL / RESEARCH USE ONLY");
  console.log(" NOT INVESTMENT ADVICE.  NO REAL FUNDS.");
  console.log("================================================");
  console.log(`Network :  ${network.name} (chainId ${chainId})`);
  console.log(`Deployer:  ${deployer.address}`);
  console.log(`Balance :  ${ethers.formatEther(balance)} ETH\n`);

  // 1. MockUSDC
  const USDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await USDC.deploy();
  await usdc.waitForDeployment();
  console.log("MockUSDC              :", await usdc.getAddress());

  // 2. FintasSignalRegistry
  const Registry = await ethers.getContractFactory("FintasSignalRegistry");
  const registry = await Registry.deploy(deployer.address);
  await registry.waitForDeployment();
  console.log("FintasSignalRegistry  :", await registry.getAddress());

  // 3. FintasVault
  const Vault = await ethers.getContractFactory("FintasVault");
  const vault = await Vault.deploy(
    await usdc.getAddress(),
    await registry.getAddress(),
    deployer.address, // admin
    deployer.address, // oracle (rotate later)
    deployer.address, // guardian
    "FintasTech AI Vault",
    "fAIV"
  );
  await vault.waitForDeployment();
  console.log("FintasVault           :", await vault.getAddress());

  // Write deployment artifact for frontend + oracle bridge.
  // `chainId` above is a bigint (for the allow-list check); JSON serializes
  // cleanly only as a Number, so we widen it here.
  const chainIdNum = Number(chainId);
  const out = {
    network: network.name,
    chainId: chainIdNum,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      MockUSDC: await usdc.getAddress(),
      FintasSignalRegistry: await registry.getAddress(),
      FintasVault: await vault.getAddress(),
    },
  };

  const outDir = path.resolve(__dirname, "..", "deployments");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${network.name}.json`);
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));

  // Also copy a human-readable summary to the frontend folder for direct consumption
  const feDir = path.resolve(__dirname, "..", "..", "frontend", "src", "lib");
  if (fs.existsSync(feDir)) {
    const feAddressesPath = path.join(feDir, "addresses.json");
    fs.writeFileSync(feAddressesPath, JSON.stringify(out, null, 2));
    console.log(`\nAddresses written to  : ${feAddressesPath}`);
  }
  console.log(`Deployment artifact   : ${outPath}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
