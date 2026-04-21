// FintasTech — local-chain ETH faucet for MetaMask.
//
// Hardhat's default node pre-funds 20 deterministic accounts with
// 10,000 test ETH each. When you create a FRESH account inside MetaMask
// and connect it to Hardhat Localhost, that account has 0 ETH, so
// MetaMask refuses to sign any tx ("账户余额不足 / insufficient balance").
//
// This script takes that MetaMask address and transfers 100 test ETH
// to it from Hardhat's default funder (account #0). Purely local —
// these coins have zero real-world value.
//
// Usage (from `blockchain/` directory):
//   FUND_TO=0xYourMetaMaskAddress npm run fund:local
//
// Or equivalently:
//   FUND_TO=0xYourMetaMaskAddress npx hardhat run scripts/fund-local.js --network localhost

const hre = require("hardhat");

async function main() {
  const target = (process.env.FUND_TO || "").trim();
  if (!target) {
    console.error(
      "\n❌ Missing FUND_TO env var.\n\n" +
        "Paste your MetaMask wallet address (the one you want to top up) like this:\n\n" +
        "   FUND_TO=0xABC...123 npm run fund:local\n"
    );
    process.exit(1);
  }
  if (!hre.ethers.isAddress(target)) {
    console.error(`\n❌ "${target}" doesn't look like a valid Ethereum address.\n`);
    process.exit(1);
  }

  const net = await hre.ethers.provider.getNetwork();
  if (Number(net.chainId) !== 31337) {
    console.error(
      `\n❌ This script only runs against Hardhat localhost (chainId 31337). ` +
        `Current chainId is ${net.chainId}.\n`
    );
    process.exit(1);
  }

  const [funder] = await hre.ethers.getSigners();
  const amount = hre.ethers.parseEther("100");

  const before = await hre.ethers.provider.getBalance(target);
  console.log(
    `\n💧 Sending 100 test ETH\n` +
      `   from ${await funder.getAddress()} (Hardhat account #0)\n` +
      `   to   ${target}\n` +
      `   current balance: ${hre.ethers.formatEther(before)} ETH`
  );

  const tx = await funder.sendTransaction({ to: target, value: amount });
  const receipt = await tx.wait();

  const after = await hre.ethers.provider.getBalance(target);
  console.log(
    `\n✅ Funded. tx ${receipt.hash}\n` +
      `   new balance: ${hre.ethers.formatEther(after)} ETH (≈ ${hre.ethers.formatEther(
        after
      )} for gas)\n\n` +
      `Now go back to MetaMask — the balance refreshes within a few seconds. ` +
      `You can re-run this script any time to top up again.\n`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
