const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

/**
 * Seeds the locally-deployed FintasTech contracts with a realistic demo state:
 *   - Gives Alice & Bob some mUSDC
 *   - Alice deposits 1,000 mUSDC into the vault
 *   - Oracle pushes signals for 4 stocks (AAPL, MSFT, TSLA, 0700.HK)
 *   - Oracle calls rebalanceAllocations() with AI-recommended weights
 *   - Oracle reports two rounds of performance (+1.2% then -0.5%)
 *
 * Run AFTER `npm run deploy:local` on the same node.
 */
async function main() {
  const { ethers, network } = hre;
  const deployment = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, "..", "deployments", `${network.name}.json`),
      "utf8"
    )
  );

  const [deployer, alice, bob] = await ethers.getSigners();

  const usdc = await ethers.getContractAt("MockUSDC", deployment.contracts.MockUSDC);
  const registry = await ethers.getContractAt(
    "FintasSignalRegistry",
    deployment.contracts.FintasSignalRegistry
  );
  const vault = await ethers.getContractAt("FintasVault", deployment.contracts.FintasVault);

  console.log("Seeding demo state...");

  // Fund demo users
  const tenK = ethers.parseUnits("10000", 6);
  await (await usdc.mint(alice.address, tenK)).wait();
  await (await usdc.mint(bob.address, tenK)).wait();

  // Alice deposits
  await (await usdc.connect(alice).approve(await vault.getAddress(), ethers.MaxUint256)).wait();
  await (await vault.connect(alice).deposit(ethers.parseUnits("1000", 6))).wait();

  // Push AI signals (deployer is the oracle by default)
  const DIR = { Bearish: 0, Neutral: 1, Bullish: 2 };
  const h = (s) => ethers.keccak256(ethers.toUtf8Bytes(s));
  await (await registry.pushSignal("AAPL", DIR.Bullish, 7800, 4200, h("AAPL-v1"))).wait();
  await (await registry.pushSignal("MSFT", DIR.Bullish, 7200, 3500, h("MSFT-v1"))).wait();
  await (await registry.pushSignal("TSLA", DIR.Neutral, 5500, 500, h("TSLA-v1"))).wait();
  await (await registry.pushSignal("0700.HK", DIR.Bullish, 6800, 2800, h("TENCENT-v1"))).wait();

  // Rebalance AI allocation
  await (
    await vault.rebalanceAllocations(
      ["AAPL", "MSFT", "TSLA", "0700.HK"],
      [3500, 3000, 1500, 2000]
    )
  ).wait();

  // Report 2 rounds of performance after the 15-min min interval.
  // On a local hardhat node we can fast-forward time:
  await hre.network.provider.send("evm_increaseTime", [16 * 60]);
  await hre.network.provider.send("evm_mine");
  await (await vault.reportPerformance(120)).wait(); // +1.2%

  await hre.network.provider.send("evm_increaseTime", [16 * 60]);
  await hre.network.provider.send("evm_mine");
  await (await vault.reportPerformance(-50)).wait(); // -0.5%

  const nav = await vault.navPerShare();
  const alloc = await vault.getAllocations();
  console.log(`✓ Alice deposited 1,000 mUSDC`);
  console.log(`✓ 4 signals published`);
  console.log(`✓ Vault NAV/share = ${ethers.formatUnits(nav, 18)}`);
  console.log(`✓ Allocations: ${alloc.map((a) => `${a.symbol}:${Number(a.weightBps) / 100}%`).join(", ")}`);
  console.log("\nDemo state ready. Open the frontend and connect MetaMask to localhost:8545.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
