const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

const DIR = { Bearish: 0, Neutral: 1, Bullish: 2 };

describe("FintasSignalRegistry", function () {
  async function deploy() {
    const [admin, oracle, attacker, other] = await ethers.getSigners();
    const Reg = await ethers.getContractFactory("FintasSignalRegistry");
    const reg = await Reg.deploy(admin.address);
    await reg.waitForDeployment();
    await reg.grantOracle(oracle.address);
    return { reg, admin, oracle, attacker, other };
  }

  it("admin can grant / revoke oracle role", async () => {
    const { reg, admin, other } = await deploy();
    const ORACLE_ROLE = await reg.ORACLE_ROLE();
    expect(await reg.hasRole(ORACLE_ROLE, other.address)).to.equal(false);
    await reg.connect(admin).grantOracle(other.address);
    expect(await reg.hasRole(ORACLE_ROLE, other.address)).to.equal(true);
    await reg.connect(admin).revokeOracle(other.address);
    expect(await reg.hasRole(ORACLE_ROLE, other.address)).to.equal(false);
  });

  it("oracle can push a signal and history is preserved", async () => {
    const { reg, oracle } = await deploy();
    const hash = ethers.keccak256(ethers.toUtf8Bytes("AAPL reasoning v1"));

    await expect(
      reg.connect(oracle).pushSignal("AAPL", DIR.Bullish, 7500, 4200, hash)
    ).to.emit(reg, "SignalPushed");

    const latest = await reg.getLatest("AAPL");
    expect(latest.direction).to.equal(DIR.Bullish);
    expect(latest.confidenceBps).to.equal(7500);
    expect(latest.scoreBps).to.equal(4200);
    expect(latest.reasoningHash).to.equal(hash);

    await reg.connect(oracle).pushSignal("AAPL", DIR.Neutral, 5000, 100, hash);
    expect(await reg.historyLength("AAPL")).to.equal(2n);
    const first = await reg.getHistoryAt("AAPL", 0);
    expect(first.direction).to.equal(DIR.Bullish);
  });

  it("non-oracle cannot push signals (access control)", async () => {
    const { reg, attacker } = await deploy();
    const hash = ethers.ZeroHash;
    await expect(
      reg.connect(attacker).pushSignal("AAPL", DIR.Bullish, 5000, 100, hash)
    ).to.be.revertedWithCustomError(reg, "AccessControlUnauthorizedAccount");
  });

  it("rejects invalid confidence and score", async () => {
    const { reg, oracle } = await deploy();
    const hash = ethers.ZeroHash;
    await expect(
      reg.connect(oracle).pushSignal("AAPL", DIR.Bullish, 10001, 0, hash)
    ).to.be.revertedWithCustomError(reg, "InvalidConfidence");
    await expect(
      reg.connect(oracle).pushSignal("AAPL", DIR.Bullish, 5000, 10001, hash)
    ).to.be.revertedWithCustomError(reg, "InvalidScore");
    await expect(
      reg.connect(oracle).pushSignal("AAPL", DIR.Bullish, 5000, -10001, hash)
    ).to.be.revertedWithCustomError(reg, "InvalidScore");
  });

  it("rejects empty symbol", async () => {
    const { reg, oracle } = await deploy();
    await expect(
      reg.connect(oracle).pushSignal("", DIR.Bullish, 5000, 100, ethers.ZeroHash)
    ).to.be.revertedWithCustomError(reg, "EmptySymbol");
  });

  it("isFresh reflects staleness window", async () => {
    const { reg, oracle } = await deploy();
    await reg.connect(oracle).pushSignal("AAPL", DIR.Bullish, 5000, 100, ethers.ZeroHash);
    expect(await reg.isFresh("AAPL")).to.equal(true);
    await time.increase(2 * 24 * 3600);
    expect(await reg.isFresh("AAPL")).to.equal(false);
  });

  it("tracks symbol list across multiple tickers", async () => {
    const { reg, oracle } = await deploy();
    await reg.connect(oracle).pushSignal("AAPL", DIR.Bullish, 5000, 100, ethers.ZeroHash);
    await reg.connect(oracle).pushSignal("MSFT", DIR.Neutral, 5000, 0, ethers.ZeroHash);
    await reg.connect(oracle).pushSignal("AAPL", DIR.Bearish, 6000, -200, ethers.ZeroHash);
    expect(await reg.trackedSymbolsCount()).to.equal(2n);
  });
});
