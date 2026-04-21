const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

const USDC = (n) => ethers.parseUnits(n.toString(), 6);
const ONE = 10n ** 18n;
const DIR = { Bearish: 0, Neutral: 1, Bullish: 2 };

async function setup() {
  const [admin, oracle, guardian, alice, bob, attacker] = await ethers.getSigners();

  const USDCFactory = await ethers.getContractFactory("MockUSDC");
  const usdc = await USDCFactory.deploy();
  await usdc.waitForDeployment();

  const RegFactory = await ethers.getContractFactory("FintasSignalRegistry");
  const registry = await RegFactory.deploy(admin.address);
  await registry.waitForDeployment();
  await registry.grantOracle(oracle.address);

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

  // Seed test accounts
  for (const u of [alice, bob, attacker]) {
    await usdc.mint(u.address, USDC(100_000));
    await usdc.connect(u).approve(await vault.getAddress(), ethers.MaxUint256);
  }

  return { usdc, registry, vault, admin, oracle, guardian, alice, bob, attacker };
}

describe("FintasVault — deposits & withdrawals", function () {
  it("initial state is sane", async () => {
    const { vault } = await setup();
    expect(await vault.navPerShare()).to.equal(ONE);
    expect(await vault.highWaterMark()).to.equal(ONE);
    expect(await vault.totalSupply()).to.equal(0n);
    expect(await vault.decimals()).to.equal(6);
  });

  it("mints shares at 1:1 on first deposit", async () => {
    const { vault, alice } = await setup();
    // Vault inherits asset decimals (6). With NAV=1e18, shares = assets.
    await expect(vault.connect(alice).deposit(USDC(1000)))
      .to.emit(vault, "Deposited")
      .withArgs(alice.address, USDC(1000), USDC(1000), ONE);
    expect(await vault.balanceOf(alice.address)).to.equal(USDC(1000));
  });

  it("withdraw returns underlying priced at NAV (no fee at par)", async () => {
    const { usdc, vault, alice } = await setup();
    await vault.connect(alice).deposit(USDC(1000));
    const shares = await vault.balanceOf(alice.address);
    const balBefore = await usdc.balanceOf(alice.address);
    await vault.connect(alice).withdraw(shares);
    const balAfter = await usdc.balanceOf(alice.address);
    expect(balAfter - balBefore).to.equal(USDC(1000));
    expect(await vault.balanceOf(alice.address)).to.equal(0n);
  });

  it("rejects zero-amount deposit / withdraw", async () => {
    const { vault, alice } = await setup();
    await expect(vault.connect(alice).deposit(0)).to.be.revertedWithCustomError(vault, "ZeroAmount");
    await expect(vault.connect(alice).withdraw(0)).to.be.revertedWithCustomError(vault, "ZeroAmount");
  });

  it("multiple depositors share NAV growth proportionally", async () => {
    const { usdc, vault, oracle, alice, bob } = await setup();
    await vault.connect(alice).deposit(USDC(1000));
    // Alice enters at 1.0, then a +3% move before Bob arrives
    await time.increase(20 * 60);
    await vault.connect(oracle).reportPerformance(300);
    await vault.connect(bob).deposit(USDC(1000));

    // Another +2% move benefits both
    await time.increase(20 * 60);
    await vault.connect(oracle).reportPerformance(200);

    const aliceShares = await vault.balanceOf(alice.address);
    const bobShares = await vault.balanceOf(bob.address);
    // Alice's share value should be > Bob's (she caught the first +3%).
    expect(await vault.sharesToAssets(aliceShares)).to.be.gt(
      await vault.sharesToAssets(bobShares)
    );
  });
});

describe("FintasVault — oracle performance updates", function () {
  it("reports small positive delta and updates nav + HWM", async () => {
    const { vault, oracle } = await setup();
    await time.increase(20 * 60);
    await expect(vault.connect(oracle).reportPerformance(100))
      .to.emit(vault, "PerformanceReported");
    const nav = await vault.navPerShare();
    expect(nav).to.be.gt(ONE);
    expect(await vault.highWaterMark()).to.equal(nav);
  });

  it("caps |delta| at MAX_DELTA_BPS_PER_UPDATE", async () => {
    const { vault, oracle } = await setup();
    await time.increase(20 * 60);
    await expect(vault.connect(oracle).reportPerformance(501))
      .to.be.revertedWithCustomError(vault, "DeltaExceedsCap");
    await expect(vault.connect(oracle).reportPerformance(-501))
      .to.be.revertedWithCustomError(vault, "DeltaExceedsCap");
  });

  it("rate-limits rapid updates", async () => {
    const { vault, oracle } = await setup();
    await time.increase(20 * 60);
    await vault.connect(oracle).reportPerformance(50);
    await expect(vault.connect(oracle).reportPerformance(50))
      .to.be.revertedWithCustomError(vault, "UpdateTooFrequent");
  });

  it("non-oracle cannot report performance", async () => {
    const { vault, attacker } = await setup();
    await time.increase(20 * 60);
    await expect(vault.connect(attacker).reportPerformance(50))
      .to.be.revertedWithCustomError(vault, "AccessControlUnauthorizedAccount");
  });
});

describe("FintasVault — rebalance allocations", function () {
  async function prep() {
    const env = await setup();
    const { registry, oracle } = env;
    const h = ethers.ZeroHash;
    await registry.connect(oracle).pushSignal("AAPL", DIR.Bullish, 7000, 3500, h);
    await registry.connect(oracle).pushSignal("MSFT", DIR.Bullish, 6500, 2500, h);
    return env;
  }

  it("rebalances when signals are fresh and weights sum to 10000", async () => {
    const { vault, oracle } = await prep();
    await expect(
      vault.connect(oracle).rebalanceAllocations(["AAPL", "MSFT"], [6000, 4000])
    ).to.emit(vault, "AllocationsRebalanced");
    const alloc = await vault.getAllocations();
    expect(alloc.length).to.equal(2);
    expect(alloc[0].weightBps).to.equal(6000);
  });

  it("rejects when weights don't sum to 10000", async () => {
    const { vault, oracle } = await prep();
    await expect(
      vault.connect(oracle).rebalanceAllocations(["AAPL", "MSFT"], [6000, 3000])
    ).to.be.revertedWithCustomError(vault, "InvalidAllocation");
  });

  it("rejects when a signal is stale or missing", async () => {
    const { vault, oracle } = await prep();
    await expect(
      vault.connect(oracle).rebalanceAllocations(["AAPL", "GOOG"], [5000, 5000])
    ).to.be.revertedWithCustomError(vault, "StaleOrMissingSignal");

    await time.increase(2 * 24 * 3600);
    await expect(
      vault.connect(oracle).rebalanceAllocations(["AAPL", "MSFT"], [5000, 5000])
    ).to.be.revertedWithCustomError(vault, "StaleOrMissingSignal");
  });
});

describe("FintasVault — performance fee", function () {
  it("charges fee only on profit and only up to cap", async () => {
    const { vault, admin, oracle, alice, bob, usdc } = await setup();
    await vault.connect(admin).setPerformanceFeeBps(1000); // 10%
    await expect(vault.connect(admin).setPerformanceFeeBps(2001))
      .to.be.revertedWithCustomError(vault, "FeeTooHigh");

    // Bob provides a large counterparty deposit so the vault has enough
    // USDC liquidity to settle Alice's +profit withdrawal in full.
    await vault.connect(bob).deposit(USDC(50_000));
    await vault.connect(alice).deposit(USDC(1000));
    // Apply +5% across updates (10 × 0.5%)
    for (let i = 0; i < 10; i++) {
      await time.increase(20 * 60);
      await vault.connect(oracle).reportPerformance(50);
    }
    const shares = await vault.balanceOf(alice.address);
    const before = await usdc.balanceOf(alice.address);
    const tx = await vault.connect(alice).withdraw(shares);
    const rc = await tx.wait();
    const after = await usdc.balanceOf(alice.address);
    const received = after - before;
    // Gross ~1051 USDC, profit=~51, fee=~5.1 → net ~1045.9
    expect(received).to.be.gt(USDC(1044));
    expect(received).to.be.lt(USDC(1047));
    // Event should be emitted
    const evt = rc.logs
      .map((l) => {
        try { return vault.interface.parseLog(l); } catch { return null; }
      })
      .find((e) => e && e.name === "Withdrawn");
    expect(evt.args.fee).to.be.gt(0n);
  });

  it("no fee when NAV never exceeded 1.0", async () => {
    const { vault, admin, oracle, alice, usdc } = await setup();
    await vault.connect(admin).setPerformanceFeeBps(1000);
    await vault.connect(alice).deposit(USDC(1000));

    for (let i = 0; i < 3; i++) {
      await time.increase(20 * 60);
      await vault.connect(oracle).reportPerformance(-50);
    }
    const shares = await vault.balanceOf(alice.address);
    const before = await usdc.balanceOf(alice.address);
    await vault.connect(alice).withdraw(shares);
    const after = await usdc.balanceOf(alice.address);
    expect(after - before).to.be.lt(USDC(1000)); // took a loss
  });
});

describe("FintasVault — guardian controls & circuit breaker", function () {
  it("guardian can pause; deposits blocked, withdrawals allowed", async () => {
    const { vault, guardian, alice } = await setup();
    await vault.connect(alice).deposit(USDC(500));
    await vault.connect(guardian).pause();
    await expect(vault.connect(alice).deposit(USDC(100))).to.be.revertedWithCustomError(
      vault,
      "EnforcedPause"
    );
    const shares = await vault.balanceOf(alice.address);
    await expect(vault.connect(alice).withdraw(shares)).to.not.be.reverted;
  });

  it("non-admin cannot unpause", async () => {
    const { vault, guardian, attacker } = await setup();
    await vault.connect(guardian).pause();
    await expect(vault.connect(attacker).unpause()).to.be.revertedWithCustomError(
      vault,
      "AccessControlUnauthorizedAccount"
    );
  });

  it("circuit breaker forces NAV → 1.0 and enables emergencyWithdraw", async () => {
    const { vault, oracle, guardian, alice } = await setup();
    await vault.connect(alice).deposit(USDC(1000));
    // Push NAV up by ~3%
    for (let i = 0; i < 3; i++) {
      await time.increase(20 * 60);
      await vault.connect(oracle).reportPerformance(100);
    }
    expect(await vault.navPerShare()).to.be.gt(ONE);

    await vault.connect(guardian).tripCircuitBreaker("oracle compromise");
    expect(await vault.navPerShare()).to.equal(ONE);
    expect(await vault.circuitBreakerTripped()).to.equal(true);

    const shares = await vault.balanceOf(alice.address);
    await expect(vault.connect(alice).emergencyWithdraw(shares)).to.not.be.reverted;
  });

  it("emergencyWithdraw only works when circuit breaker is tripped", async () => {
    const { vault, alice } = await setup();
    await vault.connect(alice).deposit(USDC(100));
    const shares = await vault.balanceOf(alice.address);
    await expect(
      vault.connect(alice).emergencyWithdraw(shares)
    ).to.be.revertedWithCustomError(vault, "NotCircuitBreakerMode");
  });
});

describe("FintasVault — reentrancy & liquidity safety", function () {
  it("withdraw reverts when vault is underfunded relative to NAV", async () => {
    // Force an underfunded state by griefing: alice deposits, oracle pumps NAV,
    // another withdrawal attempt above available balance should revert cleanly.
    const { vault, oracle, alice } = await setup();
    await vault.connect(alice).deposit(USDC(1000));

    // Pump NAV +5% cumulative via 5×+1%
    for (let i = 0; i < 5; i++) {
      await time.increase(20 * 60);
      await vault.connect(oracle).reportPerformance(100);
    }
    const shares = await vault.balanceOf(alice.address);
    // Alice should be owed ~1050 USDC but the vault only holds 1000 USDC.
    await expect(vault.connect(alice).withdraw(shares))
      .to.be.revertedWithCustomError(vault, "InsufficientLiquidity");
  });
});
