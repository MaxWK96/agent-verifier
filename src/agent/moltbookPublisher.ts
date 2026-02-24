import * as fs   from "fs";
import * as path from "path";
import type { ParsedClaim }        from "./claimParser";
import type { VerificationResult } from "./creVerifier";
import { writeBin } from "../lib/jsonbin";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StoredVerdict {
  postId:       string;
  agentName:    string;
  claimText:    string;
  verdict:      string;
  confidence:   number;
  source:       string;
  currentValue: number | null;
  txHash:       string;
  verdictHash:  string;
  timestamp:    string;
  commentId?:   string;
}

// ─── Paths ────────────────────────────────────────────────────────────────────

const MEM_DIR       = path.join(process.cwd(), "memory");
const VERDICTS_FILE = path.join(MEM_DIR, "verdicts.json");
const VERIFIED_FILE = path.join(MEM_DIR, "verified-posts.json");

// ─── Rate limiter (max 50 Moltbook comments / hour) ──────────────────────────

const commentTimestamps: number[] = [];

function canPostComment(): boolean {
  const now = Date.now();
  while (commentTimestamps.length > 0 && now - commentTimestamps[0] > 3_600_000) {
    commentTimestamps.shift();
  }
  return commentTimestamps.length < 50;
}

function recordComment(): void {
  commentTimestamps.push(Date.now());
}

// ─── File helpers ─────────────────────────────────────────────────────────────

function loadJson<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch { /* corrupted — reset */ }
  return fallback;
}

function saveJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

// ─── Dedup helpers ────────────────────────────────────────────────────────────

export function isAlreadyVerified(postId: string): boolean {
  return (loadJson<string[]>(VERIFIED_FILE, [])).includes(postId);
}

export function markAsVerified(postId: string): void {
  const ids = loadJson<string[]>(VERIFIED_FILE, []);
  if (!ids.includes(postId)) {
    ids.push(postId);
    saveJson(VERIFIED_FILE, ids);
  }
}

// ─── Post creation ────────────────────────────────────────────────────────────

/** Create a Moltbook post and return the real post ID. */
export async function postToMoltbook(
  title:   string,
  content: string,
  submolt  = "chainlink-official"
): Promise<string> {
  const apiKey = process.env.MOLTBOOK_API_KEY;
  if (!apiKey) throw new Error("MOLTBOOK_API_KEY not set");

  const res = await fetch("https://www.moltbook.com/api/v1/posts", {
    method:  "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body:    JSON.stringify({ title, content, submolt_name: submolt }),
  });

  if (!res.ok) throw new Error(`Post to Moltbook failed ${res.status}: ${await res.text()}`);

  const data   = await res.json();
  const postId = data.id ?? data.postId ?? data.post?.id;
  if (!postId) throw new Error(`No post ID in Moltbook response: ${JSON.stringify(data)}`);
  return String(postId);
}

// ─── Comment building + posting ───────────────────────────────────────────────

/**
 * Build the verdict comment text (does NOT post anything).
 * @param txHash  Real tx hash string, or null if on-chain proof failed.
 */
export function buildVerdictComment(
  claim:   ParsedClaim,
  result:  VerificationResult,
  txHash:  string | null
): string {
  const ZERO_HASH = "0x" + "0".repeat(64);

  // Proof line — show shortened hash or a failure notice
  const proofLine = (txHash && txHash !== ZERO_HASH)
    ? `On-chain proof: ${txHash.slice(0, 6)}...${txHash.slice(-4)} (Sepolia)`
    : `On-chain proof: failed - check Sepolia balance`;

  // Value line — only use $ prefix for price claims
  let valueStr: string;
  if (result.currentValue !== null && claim.claimType === "price") {
    const label = claim.asset ?? "value";
    valueStr = `Current ${label}: $${result.currentValue.toLocaleString("en-US")} (${result.source})`;
  } else {
    // For weather / DeFi / gas: result.details is already properly formatted with % or gwei
    valueStr = result.details;
  }

  return (
    `🔍 CRE FACT-CHECK\n` +
    `Verdict: ${result.verdict} · ${result.confidence}% confidence\n` +
    `Claim: "${claim.claimText.slice(0, 120)}"\n` +
    `${valueStr}\n` +
    `Source: ${result.source}\n` +
    `${proofLine}\n` +
    `Verified by: Chainlink CRE Fact-Checker`
  );
}

/** Post a pre-built comment to a specific Moltbook post. Returns comment ID or null. */
export async function postVerdictComment(
  postId:  string,
  comment: string
): Promise<string | null> {
  const apiKey = process.env.MOLTBOOK_API_KEY;
  if (!apiKey) throw new Error("MOLTBOOK_API_KEY not set");

  if (!canPostComment()) {
    console.warn("  ⚠ Moltbook rate limit reached (50 comments/hour). Skipping.");
    return null;
  }

  const res = await fetch(
    `https://www.moltbook.com/api/v1/posts/${postId}/comments`,
    {
      method:  "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body:    JSON.stringify({ content: comment }),
    }
  );

  if (!res.ok) throw new Error(`Moltbook comment error ${res.status}: ${await res.text()}`);

  recordComment();
  const data = await res.json();
  return (data.id as string) ?? null;
}

/** Convenience wrapper: build + post in one call. */
export async function postVerdict(
  claim:   ParsedClaim,
  result:  VerificationResult,
  txHash:  string | null
): Promise<string | null> {
  const comment = buildVerdictComment(claim, result, txHash);
  return postVerdictComment(claim.postId, comment);
}

// ─── Persistence ─────────────────────────────────────────────────────────────

export async function saveVerdict(
  claim:       ParsedClaim,
  result:      VerificationResult,
  txHash:      string,
  verdictHash: string,
  commentId?:  string
): Promise<void> {
  const verdicts = loadJson<StoredVerdict[]>(VERDICTS_FILE, []);

  verdicts.unshift({
    postId:       claim.postId,
    agentName:    claim.agentName,
    claimText:    claim.claimText,
    verdict:      result.verdict,
    confidence:   result.confidence,
    source:       result.source,
    currentValue: result.currentValue,
    txHash,
    verdictHash,
    timestamp:    new Date().toISOString(),
    commentId,
  });

  const trimmed = verdicts.slice(0, 100);
  saveJson(VERDICTS_FILE, trimmed);

  const ok = await writeBin(trimmed).catch(() => false);
  console.log(`     ☁  JSONBin sync: ${ok ? "✓ synced" : "skipped (no credentials)"}`);
}
