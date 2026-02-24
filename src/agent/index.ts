import "dotenv/config";
import * as readline from "readline";

import type { ParsedClaim } from "./claimParser";
import { fetchMoltbookPosts, extractClaims } from "./claimParser";
import { verifyClaim }                        from "./creVerifier";
import { storeVerdictOnChain }                from "./onChainProof";
import {
  isAlreadyVerified,
  markAsVerified,
  postToMoltbook,
  buildVerdictComment,
  postVerdictComment,
  saveVerdict,
} from "./moltbookPublisher";

const INTERVAL_MS  = 10 * 60 * 1000;
const RUN_ONCE     = process.argv.includes("--once");
const DEMO_MODE    = process.argv.includes("--demo");
const PREVIEW_MODE = process.argv.includes("--preview");

// ─── Demo claim templates ─────────────────────────────────────────────────────
// In demo mode these are posted as real Moltbook posts so we get real post IDs.

interface DemoTemplate {
  title:          string;
  content:        string;
  submolt:        string;
  claimType:      ParsedClaim["claimType"];
  extractedValue: number | null;
  asset:          string | null;
}

const DEMO_TEMPLATES: DemoTemplate[] = [
  {
    title:          "ETH price prediction: will exceed $3,500 by end of week",
    content:        "ETH will exceed $3,500 by Sunday based on current momentum indicators and increasing institutional demand.",
    submolt:        "chainlink-official",
    claimType:      "price",
    extractedValue: 3500,
    asset:          "ETH",
  },
  {
    title:          "Stockholm weather alert: >70% precipitation probability next 48h",
    content:        "Stockholm precipitation probability >70% next 48h — flooding risk elevated due to persistent low-pressure system moving in from the Atlantic.",
    submolt:        "chainlink-official",
    claimType:      "weather",
    extractedValue: 70,
    asset:          null,
  },
  {
    title:          "Aave V3 circuit breaker alert",
    content:        "Aave V3 TVL dropped 20% in 6h — circuit breaker threshold approaching. Protocol health factor declining rapidly.",
    submolt:        "chainlink-official",
    claimType:      "defi",
    extractedValue: 20,
    asset:          null,
  },
];

// ─── Preview helper ───────────────────────────────────────────────────────────

function askYesNo(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y");
    });
  });
}

// ─── Single cycle ─────────────────────────────────────────────────────────────

async function runCycle(): Promise<void> {
  console.log(`\n[${new Date().toISOString()}] ── Starting fact-check cycle ──`);
  if (PREVIEW_MODE) console.log("  👁  PREVIEW MODE — will confirm each comment before posting");

  let claims: ParsedClaim[];

  if (DEMO_MODE) {
    console.log("  🎭 DEMO MODE — posting test claims to Moltbook to get real post IDs…");
    claims = [];

    for (const tmpl of DEMO_TEMPLATES) {
      try {
        const postId = await postToMoltbook(tmpl.title, tmpl.content, tmpl.submolt);
        console.log(`     ✔ "${tmpl.title.slice(0, 55)}…"\n       postId: ${postId}`);
        claims.push({
          postId,
          agentName:      "demo-agent",
          claimType:      tmpl.claimType,
          claimText:      tmpl.content,
          extractedValue: tmpl.extractedValue,
          asset:          tmpl.asset,
        });
      } catch (err) {
        console.warn(`     ⚠ Could not post demo claim: ${errorMsg(err)}`);
      }
      await sleep(800);
    }

    console.log(`  ✔ ${claims.length} claim(s) posted — running verification pipeline…`);
  } else {
    let posts;
    try {
      posts = await fetchMoltbookPosts();
      const tagged   = posts as Array<{ _submolt?: string }>;
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

  // Process each claim
  for (const claim of claims) {
    // In live mode skip already-processed posts; in demo mode all IDs are fresh
    if (!DEMO_MODE && isAlreadyVerified(claim.postId)) {
      console.log(`  → Skip (already verified): post ${claim.postId}`);
      continue;
    }

    console.log(
      `\n  📋 Claim [${claim.claimType.toUpperCase()}]: "${claim.claimText.slice(0, 80)}..."`
    );

    try {
      // Verify
      const result = await verifyClaim(claim);
      console.log(
        `     Verdict: ${result.verdict} (${result.confidence}% confidence)\n` +
          `     ${result.details}`
      );

      // On-chain proof (non-blocking)
      const ZERO      = "0x" + "0".repeat(64);
      let txHash      = ZERO;        // stored in DB (zero hash if proof failed)
      let verdictHash = ZERO;
      let proofHash: string | null = null;  // null = failed → comment shows failure notice
      try {
        const proof = await storeVerdictOnChain(claim.postId, result.verdict, result.confidence);
        txHash      = proof.txHash;
        verdictHash = proof.verdictHash;
        proofHash   = proof.txHash;
        console.log(`     ⛓  On-chain proof: ${txHash}`);
      } catch (err) {
        console.warn(`     ⚠  On-chain proof failed: ${errorMsg(err)}`);
        // proofHash stays null → comment will say "failed - check Sepolia balance"
      }

      // Build comment, optionally preview, then post
      let commentId: string | undefined;
      try {
        const commentText = buildVerdictComment(claim, result, proofHash);

        let shouldPost = true;
        if (PREVIEW_MODE) {
          console.log("\n  ┌─ PREVIEW ──────────────────────────────────────────────────");
          commentText.split("\n").forEach((line) => console.log(`  │ ${line}`));
          console.log("  └────────────────────────────────────────────────────────────");
          shouldPost = await askYesNo("  Post this comment to Moltbook? (y/n): ");
          if (!shouldPost) console.log("  → Skipped. Saving verdict without comment.");
        }

        if (shouldPost) {
          const id  = await postVerdictComment(claim.postId, commentText);
          commentId = id ?? undefined;
          console.log(`     💬 Comment posted${commentId ? ` (id: ${commentId})` : ""}`);
        }
      } catch (err) {
        console.warn(`     ⚠  Moltbook comment failed: ${errorMsg(err)}`);
      }

      // Persist locally + sync to JSONBin
      await saveVerdict(claim, result, txHash, verdictHash, commentId);
      markAsVerified(claim.postId);

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

  const modeLabel =
    DEMO_MODE  ? `demo (post 3 real Moltbook claims + verify)${PREVIEW_MODE ? " + preview" : ""}` :
    RUN_ONCE   ? `single run${PREVIEW_MODE ? " + preview" : ""}` :
    `polling every ${INTERVAL_MS / 60000} min${PREVIEW_MODE ? " + preview" : ""}`;

  console.log(`   Mode: ${modeLabel}`);

  await runCycle();

  if (!RUN_ONCE && !DEMO_MODE) {
    console.log(`\nNext cycle in ${INTERVAL_MS / 60000} minutes. Press Ctrl+C to stop.`);
    setInterval(runCycle, INTERVAL_MS);
  }
}

// ─── Utils ────────────────────────────────────────────────────────────────────

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
