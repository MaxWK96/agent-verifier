import { NextResponse } from "next/server";
import * as fs   from "fs";
import * as path from "path";
import { readBin } from "@/lib/jsonbin";

export const dynamic = "force-dynamic";

// Build a topic key from the first 5 significant words of the claim text.
// This catches duplicates that share the same opening (even with different endings)
// e.g. "ETH will exceed $3,500 by end of week" and "ETH will exceed $3,500 by Sunday..."
function claimTopicKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5)
    .join("");
}

// Deduplicate by claim topic (first 5 words), keeping only the most recent per topic.
// Falls back to postId dedup for any remaining exact duplicates.
function deduplicateVerdicts(verdicts: StoredVerdict[]): StoredVerdict[] {
  const seenTopics = new Set<string>();
  const seenIds    = new Set<string>();
  return verdicts.filter((v) => {
    const topic = claimTopicKey(v.claimText);
    if (seenTopics.has(topic) || seenIds.has(v.postId)) return false;
    seenTopics.add(topic);
    seenIds.add(v.postId);
    return true;
  });
}

interface StoredVerdict {
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

export async function GET() {
  try {
    // 1. Try JSONBin (populated by the live agent, works on Vercel)
    const binData = await readBin<StoredVerdict[]>([]);
    if (binData.length > 0) {
      const deduped = deduplicateVerdicts(binData);
      return NextResponse.json({ verdicts: deduped.slice(0, 20), count: deduped.length });
    }

    // 2. Fallback: local file (dev / self-hosted)
    const filePath = path.join(process.cwd(), "memory", "verdicts.json");
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ verdicts: [], count: 0 });
    }

    const raw    = fs.readFileSync(filePath, "utf-8");
    const all    = JSON.parse(raw) as StoredVerdict[];
    const last20 = Array.isArray(all) ? deduplicateVerdicts(all).slice(0, 20) : [];

    return NextResponse.json({ verdicts: last20, count: last20.length });
  } catch (err) {
    console.error("[/api/verdicts] Error:", err);
    return NextResponse.json(
      { verdicts: [], count: 0, error: "Failed to load verdicts" },
      { status: 500 }
    );
  }
}
