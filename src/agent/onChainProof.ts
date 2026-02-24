import { ethers } from "ethers";

// Minimal ABI — only what we need
const ABI = [
  {
    inputs: [
      { internalType: "bytes32", name: "verdictHash", type: "bytes32" },
      { internalType: "string",  name: "verdict",     type: "string"  },
    ],
    name: "storeVerdict",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true,  internalType: "bytes32", name: "verdictHash", type: "bytes32" },
      { indexed: false, internalType: "string",  name: "verdict",     type: "string"  },
      { indexed: false, internalType: "uint256", name: "timestamp",   type: "uint256" },
    ],
    name: "VerdictStored",
    type: "event",
  },
];

export function computeVerdictHash(
  postId: string,
  verdict: string,
  confidence: number,
  timestamp: number
): string {
  return ethers.solidityPackedKeccak256(
    ["string", "string", "uint256", "uint256"],
    [postId, verdict, BigInt(Math.round(confidence)), BigInt(timestamp)]
  );
}

export async function storeVerdictOnChain(
  postId: string,
  verdict: string,
  confidence: number
): Promise<{ txHash: string; verdictHash: string }> {
  // ── Validate env vars up-front with clear messages ────────────────────────
  const privateKey      = process.env.PRIVATE_KEY;
  const rpcUrl          = process.env.NEXT_PUBLIC_RPC_URL;
  const contractAddress = process.env.VERDICT_REGISTRY_ADDRESS;

  if (!privateKey) {
    throw new Error("PRIVATE_KEY is not set in .env — add your Sepolia wallet private key");
  }
  if (!rpcUrl) {
    throw new Error("NEXT_PUBLIC_RPC_URL is not set in .env — add your Alchemy/Infura Sepolia URL");
  }
  if (!contractAddress) {
    throw new Error(
      "VERDICT_REGISTRY_ADDRESS is not set in .env — run `npm run deploy:contract` first"
    );
  }

  const normalizedKey = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet   = new ethers.Wallet(normalizedKey, provider);
  const contract = new ethers.Contract(contractAddress, ABI, wallet);

  const timestamp   = Math.floor(Date.now() / 1000);
  const verdictHash = computeVerdictHash(postId, verdict, confidence, timestamp);

  console.log(`     ⛓  Submitting verdict to VerdictRegistry…`);
  console.log(`        contract : ${contractAddress}`);
  console.log(`        hash     : ${verdictHash}`);
  console.log(`        verdict  : ${verdict}`);

  let tx: Awaited<ReturnType<typeof contract.storeVerdict>>;
  try {
    tx = await contract.storeVerdict(verdictHash, verdict);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`storeVerdict() call failed: ${msg}`);
  }

  console.log(`        tx hash  : ${tx.hash}`);
  console.log(`        waiting for confirmation…`);

  let receipt: Awaited<ReturnType<typeof tx.wait>>;
  try {
    receipt = await tx.wait();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`tx ${tx.hash} failed on-chain: ${msg}`);
  }

  console.log(`        confirmed in block ${receipt?.blockNumber ?? "?"}`);

  return { txHash: tx.hash as string, verdictHash };
}
