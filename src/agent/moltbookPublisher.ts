import * as fs   from "fs";
import * as path from "path";
import type { ParsedClaim }       from "./claimParser";
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

const MEM_DIR            = path.join(process.cwd(), "memory");
const VERDICTS_FILE      = path.join(MEM_DIR, "verdicts.json");
const VERIFIED_FILE      = path.join(MEM_DIR, "verified-posts.json");

// Simple in-memory rate limiter for Moltbook comments (max 50/hour)
const commentTimestamps: number[] = [];

function canPostComment(): boolean {
  const now = Date.now();
  // Remove timestamps older than 1 hour
  while (commentTimestamps.length > 0 && now - commentTimestamps[0] > 3_600_000) {
    commentTimestamps.shift();
  }
  return commentTimestamps.length < 50;
}

function recordComment(): void {
  commentTimestamps.push(Date.now());
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadJson<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch { /* corrupted file — reset */ }
  return fallback;
}

function saveJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

// ─── Dedup helpers ───────────────────────────────────────────────────────────

export function isAlreadyVerified(postId: string): boolean {
  const ids: string[] = loadJson(VERIFIED_FILE, []);
  return ids.includes(postId);
}

export function markAsVerified(postId: string): void {
  const ids: string[] = loadJson(VERIFIED_FILE, []);
  if (!ids.includes(postId)) {
    ids.push(postId);
    saveJson(VERIFIED_FILE, ids);
  }
}

// ─── Comment posting ─────────────────────────────────────────────────────────

export async function postVerdict(
  claim:   ParsedClaim,
  result:  VerificationResult,
  txHash:  string
): Promise<string | null> {
  const apiKey = process.env.MOLTBOOK_API_KEY;
  if (!apiKey) throw new Error("MOLTBOOK_API_KEY not set");

  if (!canPostComment()) {
    console.warn("  ⚠ Moltbook rate limit reached (50 comments/hour). Skipping comment.");
    return null;
  }

  const shortTx      = `${txHash.slice(0, 6)}...${txHash.slice(-4)}`;
  const valueLabel   = claim.asset ?? "value";
  const valueStr     = result.currentValue !== null
    ? `Current ${valueLabel}: $${result.currentValue.toLocaleString("en-US")} (${result.source})`
    : result.details;

  const comment =
    `🔍 CRE FACT-CHECK\n` +
    `Verdict: ${result.verdict} · ${result.confidence}% confidence\n` +
    `Claim: "${claim.claimText.slice(0, 120)}"\n` +
    `${valueStr}\n` +
    `Source: ${result.source}\n` +
    `On-chain proof: ${shortTx} (Sepolia)\n` +
    `Verified by: Chainlink CRE Fact-Checker`;

  const res = await fetch(
    `https://www.moltbook.com/api/v1/posts/${claim.postId}/comments`,
    {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: comment }),
    }
  );

  if (!res.ok) {
    throw new Error(`Moltbook comment error ${res.status}: ${await res.text()}`);
  }

  recordComment();
  const data = await res.json();
  return (data.id as string) ?? null;
}

// ─── Persistence ─────────────────────────────────────────────────────────────

export async function saveVerdict(
  claim:       ParsedClaim,
  result:      VerificationResult,
  txHash:      string,
  verdictHash: string,
  commentId?:  string
): Promise<void> {
  const verdicts: StoredVerdict[] = loadJson(VERDICTS_FILE, []);

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

  // Keep last 100 to prevent unbounded growth
  const trimmed = verdicts.slice(0, 100);
  saveJson(VERDICTS_FILE, trimmed);

  // Mirror to JSONBin so the live Vercel deployment sees real verdicts
  const ok = await writeBin(trimmed).catch(() => false);
  console.log(`     ☁  JSONBin sync: ${ok ? "✓ synced" : "skipped (no credentials)"}`);
}
