/**
 * Deploy VerdictRegistry.sol to Sepolia and save the address to .env
 *
 * Usage:  npm run deploy:contract
 * Prereq: npm run compile   (or it compiles automatically via Hardhat)
 */
import pkg from "hardhat";
const { ethers } = pkg as typeof import("hardhat");
import * as dotenv from "dotenv";
import * as fs   from "fs";
import * as path from "path";

dotenv.config();

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();

  const balance = await deployer.provider.getBalance(deployer.address);
  const network = await deployer.provider.getNetwork();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Deploying VerdictRegistry");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Network:   ${network.name} (chainId: ${network.chainId})`);
  console.log(`  Deployer:  ${deployer.address}`);
  console.log(`  Balance:   ${ethers.formatEther(balance)} ETH`);

  if (balance === 0n) {
    throw new Error(
      "Deployer wallet has 0 ETH.\n" +
        "Get Sepolia ETH from: https://sepoliafaucet.com or https://faucet.quicknode.com/ethereum/sepolia"
    );
  }

  if (network.chainId !== 11155111n) {
    throw new Error(
      `Expected Sepolia (chainId 11155111), got chainId ${network.chainId}.\n` +
        "Make sure NEXT_PUBLIC_RPC_URL points to Sepolia."
    );
  }

  const Factory  = await ethers.getContractFactory("VerdictRegistry");
  const contract = await Factory.deploy();

  const deployTx = contract.deploymentTransaction();
  console.log(`\n  Deploy tx: ${deployTx?.hash ?? "unknown"}`);
  console.log("  Waiting for confirmation…");

  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log(`\n✅  VerdictRegistry deployed to: ${address}`);
  console.log(`    Etherscan: https://sepolia.etherscan.io/address/${address}`);

  // ── Save address to .env ──────────────────────────────────────────────────
  const envPath = path.join(process.cwd(), ".env");
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";

  if (envContent.includes("VERDICT_REGISTRY_ADDRESS=")) {
    envContent = envContent.replace(/VERDICT_REGISTRY_ADDRESS=.*/g, `VERDICT_REGISTRY_ADDRESS=${address}`);
  } else {
    envContent = envContent.trimEnd() + `\nVERDICT_REGISTRY_ADDRESS=${address}\n`;
  }

  fs.writeFileSync(envPath, envContent, "utf-8");
  console.log("    Address saved to .env as VERDICT_REGISTRY_ADDRESS");
}

main().catch((err) => {
  console.error("\n✗ Deploy failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
