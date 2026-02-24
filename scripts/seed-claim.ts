/**
 * Post a test claim to Moltbook and immediately run the full verification
 * pipeline on the real post ID returned by the API.
 *
 * Usage:  npm run seed
 */
import "dotenv/config";

import type { ParsedClaim }    from "../src/agent/claimParser";
import { verifyClaim }         from "../src/agent/creVerifier";
import { storeVerdictOnChain } from "../src/agent/onChainProof";
import {
  buildVerdictComment,
  postVerdictComment,
  saveVerdict,
  markAsVerified,
} from "../src/agent/moltbookPublisher";

const POST_TITLE   = "ETH price prediction: will exceed $3,500 by end of week";
const POST_CONTENT =
  "ETH will exceed $3,500 by Sunday based on current momentum indicators. " +
  "Strong support at $3,000 and increasing institutional demand.";

async function main(): Promise<void> {
  const apiKey = process.env.MOLTBOOK_API_KEY;
  if (!apiKey) throw new Error("MOLTBOOK_API_KEY not set — run: npm run register first");

  // 1. Post to Moltbook — capture real post ID
  console.log("1/4  Posting seed claim to m/chainlink-official…");
  const res = await fetch("https://www.moltbook.com/api/v1/posts", {
    method:  "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body:    JSON.stringify({ title: POST_TITLE, content: POST_CONTENT, submolt_name: "chainlink-official" }),
  });
  if (!res.ok) throw new Error(`Post failed ${res.status}: ${await res.text()}`);

  const data   = await res.json();
  const postId = String(data.id ?? data.postId ?? data.post?.id ?? "");
  if (!postId) throw new Error(`No post ID in response: ${JSON.stringify(data)}`);
  console.log(`     ✔ Post created → ${postId}`);

  // 2. Build ParsedClaim with real post ID
  const claim: ParsedClaim = {
    postId,
    agentName:      "seed-script",
    claimType:      "price",
    claimText:      POST_CONTENT,
    extractedValue: 3500,
    asset:          "ETH",
  };

  // 3. Verify against CRE sources
  console.log("2/4  Verifying claim against CRE sources…");
  const result = await verifyClaim(claim);
  console.log(`     Verdict: ${result.verdict} (${result.confidence}% confidence)\n     ${result.details}`);

  // 4. Store on-chain proof (Sepolia)
  console.log("3/4  Storing verdict on-chain (Sepolia)…");
  let txHash      = "0x" + "0".repeat(64);
  let verdictHash = txHash;
  try {
    const proof = await storeVerdictOnChain(postId, result.verdict, result.confidence);
    txHash      = proof.txHash;
    verdictHash = proof.verdictHash;
    console.log(`     ⛓  tx: ${txHash}`);
  } catch (err) {
    console.warn(`     ⚠  On-chain proof skipped: ${err instanceof Error ? err.message : err}`);
  }

  // 5. Post verdict comment to the real Moltbook post
  console.log("4/4  Posting verdict comment to Moltbook…");
  const commentText = buildVerdictComment(claim, result, txHash);
  console.log("     Comment preview:");
  commentText.split("\n").forEach((line) => console.log(`     │ ${line}`));

  let commentId: string | undefined;
  try {
    const id  = await postVerdictComment(postId, commentText);
    commentId = id ?? undefined;
    console.log(`     ✔ Comment posted${commentId ? ` (id: ${commentId})` : ""}`);
  } catch (err) {
    console.warn(`     ⚠  Comment failed: ${err instanceof Error ? err.message : err}`);
  }

  // 6. Save verdict locally + sync to JSONBin
  await saveVerdict(claim, result, txHash, verdictHash, commentId);
  markAsVerified(postId);

  console.log("\n✅  Seed complete!");
  console.log(`    Moltbook post:   https://moltbook.com/m/chainlink-official/${postId}`);
  if (txHash !== "0x" + "0".repeat(64)) {
    console.log(`    Etherscan proof: https://sepolia.etherscan.io/tx/${txHash}`);
  }
}

main().catch((err) => {
  console.error("✗ Seed error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
