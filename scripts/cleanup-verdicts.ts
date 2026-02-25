/**
 * Clean duplicate verdicts from both local memory/verdicts.json and JSONBin.
 * Deduplicates by first-5-words of claim text (most recent wins).
 *
 * Usage: npx tsx scripts/cleanup-verdicts.ts
 */
import "dotenv/config";
import * as fs from "fs";
import * as path from "path";

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

function claimTopicKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5)
    .join("");
}

function deduplicate(verdicts: StoredVerdict[]): StoredVerdict[] {
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

async function main() {
  // ── 1. Clean local file ──────────────────────────────────────────────────
  const localPath = path.join(process.cwd(), "memory", "verdicts.json");
  if (fs.existsSync(localPath)) {
    const raw    = fs.readFileSync(localPath, "utf-8");
    const all    = JSON.parse(raw) as StoredVerdict[];
    const clean  = deduplicate(all);
    fs.writeFileSync(localPath, JSON.stringify(clean, null, 2), "utf-8");
    console.log(`Local: ${all.length} → ${clean.length} verdicts`);
    clean.forEach((v, i) =>
      console.log(`  ${i + 1}. [${v.agentName}] ${v.claimText.slice(0, 70)}`)
    );
  } else {
    console.log("No local verdicts.json found.");
  }

  // ── 2. Clean JSONBin ─────────────────────────────────────────────────────
  const binId  = process.env.JSONBIN_BIN_ID;
  const apiKey = process.env.JSONBIN_API_KEY;

  if (!binId || !apiKey) {
    console.log("\nJSONBin: skipped (no credentials)");
    return;
  }

  console.log("\nFetching JSONBin...");
  const getRes = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
    headers: { "X-Master-Key": apiKey },
  });
  if (!getRes.ok) {
    console.error("JSONBin read failed:", getRes.status);
    return;
  }
  const json   = await getRes.json() as { record: unknown };
  const remote = Array.isArray(json.record) ? (json.record as StoredVerdict[]) : [];
  const clean  = deduplicate(remote);

  console.log(`JSONBin: ${remote.length} → ${clean.length} verdicts`);
  clean.forEach((v, i) =>
    console.log(`  ${i + 1}. [${v.agentName}] ${v.claimText.slice(0, 70)}`)
  );

  const putRes = await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Master-Key": apiKey },
    body: JSON.stringify(clean),
  });

  console.log(`JSONBin write: ${putRes.ok ? "✓ cleaned" : "✗ failed " + putRes.status}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
