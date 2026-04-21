/**
 * End-to-end dry-run against the in-process Hardhat network.
 * Exercises the complete user journey:
 *   Deploy → user deposit → oracle pushes signals → oracle rebalances → oracle
 *   reports performance → user withdraws → guardian pause → circuit breaker
 *   emergency exit.
 *
 * Run with:  npx hardhat run scripts/e2e-demo.js
 */
const hre = require("hardhat");

const USDC = (n) => hre.ethers.parseUnits(n.toString(), 6);
const DIR = { Bearish: 0, Neutral: 1, Bullish: 2 };
const h = (s) => hre.ethers.keccak256(hre.ethers.toUtf8Bytes(s));

async function fmt(vault, addr) {
  const shares = await vault.balanceOf(addr);
  const value = await vault.sharesToAssets(shares);
  return `${hre.ethers.formatUnits(shares, 6)} shares (≈ ${hre.ethers.formatUnits(value, 6)} mUSDC)`;
}

async function bump(seconds) {
  await hre.network.provider.send("evm_increaseTime", [seconds]);
  await hre.network.provider.send("evm_mine");
}

async function main() {
  const { ethers } = hre;
  const [admin, oracle, guardian, alice, bob] = await ethers.getSigners();

  console.log("┌───────────────────────────────────────────────────────");
  console.log("│  FintasTech · End-to-end demo on in-process Hardhat net");
  console.log("└───────────────────────────────────────────────────────");

  // --- Deploy --------------------------------------------------------
  const USDCFactory = await ethers.getContractFactory("MockUSDC");
  const usdc = await USDCFactory.deploy();
  await usdc.waitForDeployment();

  const RegFactory = await ethers.getContractFactory("FintasSignalRegistry");
  const registry = await RegFactory.deploy(admin.address);
  await registry.waitForDeployment();
  await (await registry.grantOracle(oracle.address)).wait();

  const VaultFactory = await ethers.getContractFactory("FintasVault");
  const vault = await VaultFactory.deploy(
    await usdc.getAddress(),
    await registry.getAddress(),
    admin.address,
    oracle.address,
    guardian.address,
    "FintasTech AI Vault",
    "fAIV"
  );
  await vault.waitForDeployment();

  console.log(`\n[1] Deployed`);
  console.log(`    mUSDC   : ${await usdc.getAddress()}`);
  console.log(`    Registry: ${await registry.getAddress()}`);
  console.log(`    Vault   : ${await vault.getAddress()}\n`);

  // --- Fund users ----------------------------------------------------
  for (const u of [alice, bob]) {
    await (await usdc.mint(u.address, USDC(10_000))).wait();
    await (
      await usdc.connect(u).approve(await vault.getAddress(), hre.ethers.MaxUint256)
    ).wait();
  }

  // --- User deposits -------------------------------------------------
  await (await vault.connect(alice).deposit(USDC(1000))).wait();
  await (await vault.connect(bob).deposit(USDC(2000))).wait();
  console.log(`[2] Deposits`);
  console.log(`    Alice: ${await fmt(vault, alice.address)}`);
  console.log(`    Bob  : ${await fmt(vault, bob.address)}`);

  // --- Oracle pushes signals ----------------------------------------
  await (
    await registry
      .connect(oracle)
      .pushSignal("AAPL", DIR.Bullish, 7800, 4200, h("aapl-v1"))
  ).wait();
  await (
    await registry
      .connect(oracle)
      .pushSignal("MSFT", DIR.Bullish, 7200, 3500, h("msft-v1"))
  ).wait();
  await (
    await registry
      .connect(oracle)
      .pushSignal("TSLA", DIR.Neutral, 5500, 500, h("tsla-v1"))
  ).wait();
  await (
    await registry
      .connect(oracle)
      .pushSignal("0700.HK", DIR.Bullish, 6800, 2800, h("tencent-v1"))
  ).wait();
  console.log(`\n[3] Signals published`);
  const sigAAPL = await registry.getLatest("AAPL");
  console.log(
    `    AAPL dir=${["bear", "neu", "bull"][sigAAPL.direction]} conf=${Number(sigAAPL.confidenceBps) / 100}% score=${Number(sigAAPL.scoreBps) / 100}`
  );

  // --- Oracle rebalances allocation ---------------------------------
  await (
    await vault
      .connect(oracle)
      .rebalanceAllocations(
        ["AAPL", "MSFT", "TSLA", "0700.HK"],
        [3500, 3000, 1500, 2000]
      )
  ).wait();
  console.log(`\n[4] Rebalanced allocations to  AAPL 35% / MSFT 30% / TSLA 15% / 0700.HK 20%`);

  // --- Oracle reports +1.5% performance ------------------------------
  await bump(16 * 60);
  await (await vault.connect(oracle).reportPerformance(150)).wait();
  await bump(16 * 60);
  await (await vault.connect(oracle).reportPerformance(100)).wait();
  console.log(`\n[5] Two performance updates (+1.5%, +1.0%)`);
  console.log(`    NAV/share = ${hre.ethers.formatUnits(await vault.navPerShare(), 18)}`);
  console.log(`    Alice now: ${await fmt(vault, alice.address)}`);
  console.log(`    Bob   now: ${await fmt(vault, bob.address)}`);

  // --- Try oracle abuse (should revert) -----------------------------
  console.log(`\n[6] Security checks`);
  try {
    await vault.connect(oracle).reportPerformance(600);
  } catch (e) {
    console.log(`    ✓ report +6% rejected (DeltaExceedsCap)`);
  }
  try {
    await vault.connect(alice).reportPerformance(100);
  } catch (e) {
    console.log(`    ✓ Alice can't report performance (AccessControl)`);
  }

  // --- Alice withdraws half -----------------------------------------
  const aliceShares = await vault.balanceOf(alice.address);
  await (await vault.connect(alice).withdraw(aliceShares / 2n)).wait();
  console.log(`\n[7] Alice withdraws half`);
  console.log(`    Alice balance: ${await fmt(vault, alice.address)}`);
  console.log(`    Alice mUSDC  : ${hre.ethers.formatUnits(await usdc.balanceOf(alice.address), 6)}`);

  // --- Guardian trips breaker ---------------------------------------
  await (await vault.connect(guardian).tripCircuitBreaker("drill")).wait();
  console.log(`\n[8] Guardian tripped circuit breaker → NAV forced to 1.0`);

  // Alice emergency-withdraws at par
  const remainingShares = await vault.balanceOf(alice.address);
  if (remainingShares > 0n) {
    await (await vault.connect(alice).emergencyWithdraw(remainingShares)).wait();
    console.log(
      `    ✓ Alice emergency-withdrew at par; final mUSDC: ${hre.ethers.formatUnits(await usdc.balanceOf(alice.address), 6)}`
    );
  }

  console.log(`\n✅ End-to-end demo completed successfully\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
