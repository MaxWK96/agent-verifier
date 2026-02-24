import "dotenv/config";

import type { ParsedClaim } from "./claimParser";
import { fetchMoltbookPosts, extractClaims } from "./claimParser";
import { verifyClaim }                        from "./creVerifier";
import { storeVerdictOnChain }                from "./onChainProof";
import {
  isAlreadyVerified,
  markAsVerified,
  postVerdict,
  saveVerdict,
} from "./moltbookPublisher";

const INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const RUN_ONCE    = process.argv.includes("--once");
const DEMO_MODE   = process.argv.includes("--demo");

// ─── Demo claims ─────────────────────────────────────────────────────────────
// Injected instead of live Moltbook feed when --demo is passed.

const DEMO_CLAIMS: ParsedClaim[] = [
  {
    postId:         "demo-001",
    agentName:      "demo-agent",
    claimType:      "price",
    claimText:      "ETH will exceed $3,500 by end of week",
    extractedValue: 3500,
    asset:          "ETH",
  },
  {
    postId:         "demo-002",
    agentName:      "demo-agent",
    claimType:      "weather",
    claimText:      "Stockholm precipitation probability >70% next 48h",
    extractedValue: 70,
    asset:          null,
  },
  {
    postId:         "demo-003",
    agentName:      "demo-agent",
    claimType:      "defi",
    claimText:      "Aave V3 TVL dropped 20% in 6h — circuit breaker threshold approaching",
    extractedValue: 20,
    asset:          null,
  },
];

// ─── Single cycle ────────────────────────────────────────────────────────────

async function runCycle(): Promise<void> {
  console.log(`\n[${new Date().toISOString()}] ── Starting fact-check cycle ──`);

  // 1. Collect claims — live feed or demo injection
  let claims: ParsedClaim[];

  if (DEMO_MODE) {
    console.log("  🎭 DEMO MODE — using hardcoded test claims (no Moltbook fetch)");
    // Filter out already-verified demo posts so re-runs don't skip them
    claims = DEMO_CLAIMS.filter((c) => !isAlreadyVerified(c.postId));
    console.log(`  ✔ ${claims.length} demo claim(s) queued`);
  } else {
    let posts;
    try {
      posts = await fetchMoltbookPosts();
      const tagged = posts as Array<{ _submolt?: string }>;
      const submolts = [...new Set(tagged.map((p) => p._submolt ?? "unknown"))].join(", m/");
      console.log(`  ✔ Fetched ${posts.length} posts from m/${submolts}`);
    } catch (err) {
      console.error("  ✗ Failed to fetch Moltbook posts:", errorMsg(err));
      return;
    }
    claims = extractClaims(posts);
    console.log(`  ✔ Extracted ${claims.length} verifiable claims`);
  }

  if (claims.length === 0) {
    console.log("  No new verifiable claims found. Sleeping until next cycle.");
    return;
  }

  // 3. Process each claim
  for (const claim of claims) {
    // 3a. Skip duplicates
    if (isAlreadyVerified(claim.postId)) {
      console.log(`  → Skip (already verified): post ${claim.postId}`);
      continue;
    }

    console.log(
      `\n  📋 Claim [${claim.claimType.toUpperCase()}]: "${claim.claimText.slice(0, 80)}..."`
    );

    try {
      // 3b. Verify
      const result = await verifyClaim(claim);
      console.log(
        `     Verdict: ${result.verdict} (${result.confidence}% confidence)\n` +
          `     ${result.details}`
      );

      // 3c. On-chain proof (non-blocking — agent continues if this fails)
      let txHash      = "0x" + "0".repeat(64);
      let verdictHash = txHash;

      try {
        const proof   = await storeVerdictOnChain(claim.postId, result.verdict, result.confidence);
        txHash        = proof.txHash;
        verdictHash   = proof.verdictHash;
        console.log(`     ⛓  On-chain proof: ${txHash}`);
      } catch (err) {
        console.warn(`     ⚠  On-chain proof skipped: ${errorMsg(err)}`);
      }

      // 3d. Post Moltbook comment (non-blocking)
      let commentId: string | undefined;
      try {
        const id  = await postVerdict(claim, result, txHash);
        commentId = id ?? undefined;
        console.log(`     💬 Moltbook comment posted${commentId ? ` (id: ${commentId})` : ""}`);
      } catch (err) {
        console.warn(`     ⚠  Moltbook comment failed: ${errorMsg(err)}`);
      }

      // 3e. Persist locally + sync to JSONBin
      await saveVerdict(claim, result, txHash, verdictHash, commentId);
      markAsVerified(claim.postId);

      // Courtesy delay between posts to avoid hammering APIs
      await sleep(2500);
    } catch (err) {
      console.error(`  ✗ Error processing post ${claim.postId}:`, errorMsg(err));
    }
  }

  console.log(`\n[${new Date().toISOString()}] ── Cycle complete ──`);
}

// ─── Entry point ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("🔍 CRE Fact-Checker Agent starting…");

  const modeLabel = DEMO_MODE
    ? "demo (3 hardcoded claims)"
    : RUN_ONCE
      ? "single run (--once)"
      : `polling every ${INTERVAL_MS / 60000} min`;
  console.log(`   Mode: ${modeLabel}`);

  await runCycle();

  if (!RUN_ONCE && !DEMO_MODE) {
    console.log(`\nNext cycle in ${INTERVAL_MS / 60000} minutes. Press Ctrl+C to stop.`);
    setInterval(runCycle, INTERVAL_MS);
  }
}

// ─── Utils ───────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function errorMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
