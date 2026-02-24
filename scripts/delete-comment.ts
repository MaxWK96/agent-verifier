/**
 * Find and delete comments our agent posted to Moltbook.
 *
 * Usage:
 *   npm run delete-comment -- auto             # scan m/chainlink-official + known post, delete ours
 *   npm run delete-comment -- list             # probe /agents/me/comments endpoints
 *   npm run delete-comment -- <commentId>      # delete one specific comment by ID
 */
import "dotenv/config";

const apiKey    = process.env.MOLTBOOK_API_KEY;
const AGENT_NAME = (process.env.MOLTBOOK_AGENT_NAME ?? "cre-factchecker").toLowerCase();

if (!apiKey) {
  console.error("✗ MOLTBOOK_API_KEY not set");
  process.exit(1);
}

const HEADERS = {
  Authorization:  `Bearer ${apiKey}`,
  "Content-Type": "application/json",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface MoltbookComment {
  id:      string;
  content: string;
  author:  { name?: string; username?: string; handle?: string; [k: string]: unknown };
  [k: string]:  unknown;
}

interface MoltbookPost {
  id:    string;
  title?: string;
  [k: string]: unknown;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isOurComment(c: MoltbookComment): boolean {
  const a = c.author ?? {};
  const names = [a.name, a.username, a.handle].map((v) => String(v ?? "").toLowerCase());
  return names.some((n) => n === AGENT_NAME || n.includes("factcheck") || n.includes("cre-fact"));
}

async function fetchJson(url: string): Promise<{ ok: boolean; status: number; data: unknown; raw: string }> {
  const res  = await fetch(url, { headers: HEADERS });
  const raw  = await res.text();
  let data: unknown = null;
  try { data = JSON.parse(raw); } catch { /* leave null */ }
  return { ok: res.ok, status: res.status, data, raw };
}

// ─── Fetch comments on one post ───────────────────────────────────────────────

async function getOurCommentsOnPost(postId: string): Promise<MoltbookComment[]> {
  const url    = `https://www.moltbook.com/api/v1/posts/${postId}/comments`;
  const result = await fetchJson(url);

  console.log(`  GET ${url} → ${result.status}`);

  if (!result.ok) {
    console.log(`  Response: ${result.raw.slice(0, 200)}`);
    return [];
  }

  const arr: MoltbookComment[] = Array.isArray(result.data)
    ? result.data
    : ((result.data as Record<string, unknown>)?.comments as MoltbookComment[]) ?? [];

  console.log(`  Found ${arr.length} comment(s) total on post ${postId}`);

  // Log every comment's author so we can diagnose name mismatches
  for (const c of arr) {
    const authorStr = JSON.stringify(c.author);
    const preview   = String(c.content ?? "").slice(0, 60).replace(/\n/g, " ");
    console.log(`    comment ${c.id}  author=${authorStr}  "${preview}"`);
  }

  return arr.filter(isOurComment);
}

// ─── Fetch posts from a submolt ───────────────────────────────────────────────

async function getPostsFromSubmolt(submolt: string): Promise<MoltbookPost[]> {
  const url    = `https://www.moltbook.com/api/v1/posts?submolt=${submolt}&limit=25`;
  const result = await fetchJson(url);

  console.log(`  GET ${url} → ${result.status}`);

  if (!result.ok) {
    console.log(`  Response: ${result.raw.slice(0, 200)}`);
    return [];
  }

  const arr: MoltbookPost[] = Array.isArray(result.data)
    ? result.data
    : ((result.data as Record<string, unknown>)?.posts as MoltbookPost[]) ?? [];

  console.log(`  Found ${arr.length} post(s) in m/${submolt}`);
  return arr;
}

// ─── Delete one comment ───────────────────────────────────────────────────────

async function deleteComment(commentId: string): Promise<boolean> {
  const url = `https://www.moltbook.com/api/v1/comments/${commentId}`;
  const res = await fetch(url, { method: "DELETE", headers: HEADERS });
  const raw = await res.text();

  console.log(`  DELETE ${url} → ${res.status}`);
  console.log(`  Response body: ${raw.slice(0, 300) || "(empty)"}`);

  if (res.ok || res.status === 204) {
    console.log(`  ✅  Deleted comment ${commentId}`);
    return true;
  }

  console.log(`  ✗  Failed to delete comment ${commentId} (status ${res.status})`);
  return false;
}

// ─── AUTO mode ────────────────────────────────────────────────────────────────

async function autoDelete(): Promise<void> {
  console.log(`\n🔍 AUTO MODE — scanning for comments by "${AGENT_NAME}"\n`);

  // Collect all post IDs to scan
  const knownPostId = "96c35241-13d0-43f9-9bcb-995df05d4bd6";
  const postIds     = new Set<string>([knownPostId]);

  // Also pull current posts from m/chainlink-official
  console.log("── Fetching posts from m/chainlink-official ──");
  const posts = await getPostsFromSubmolt("chainlink-official");
  for (const p of posts) postIds.add(p.id);

  console.log(`\nScanning ${postIds.size} post(s) for our comments…\n`);

  let totalFound   = 0;
  let totalDeleted = 0;

  for (const postId of postIds) {
    console.log(`── Post ${postId} ──`);
    const ours = await getOurCommentsOnPost(postId);

    if (ours.length === 0) {
      console.log(`  No comments by us on this post.\n`);
      continue;
    }

    console.log(`  Found ${ours.length} comment(s) by us — deleting…`);
    totalFound += ours.length;

    for (const comment of ours) {
      const ok = await deleteComment(comment.id);
      if (ok) totalDeleted++;
    }
    console.log();
  }

  console.log("── Summary ──────────────────────────────────");
  console.log(`  Posts scanned : ${postIds.size}`);
  console.log(`  Comments found: ${totalFound}`);
  console.log(`  Deleted       : ${totalDeleted}`);

  if (totalFound === 0) {
    console.log(
      "\n  No comments matched author name '" + AGENT_NAME + "'.\n" +
      "  If the agent posted under a different name, check the author list above.\n" +
      "  You can delete manually with:  npm run delete-comment -- <commentId>"
    );
  }
}

// ─── LIST mode — probe /agents/me endpoints ───────────────────────────────────

async function listMode(): Promise<void> {
  console.log("Probing /agents/me/comments endpoints…\n");

  const endpoints = [
    "https://www.moltbook.com/api/v1/agents/me/comments",
    "https://www.moltbook.com/api/v1/me/comments",
    "https://www.moltbook.com/api/v1/agents/me/posts",
  ];

  for (const url of endpoints) {
    const result = await fetchJson(url);
    console.log(`${url} → ${result.status}`);
    if (result.ok) {
      console.log(JSON.stringify(result.data, null, 2));
      return;
    }
    console.log(`  ${result.raw.slice(0, 150)}\n`);
  }

  console.log("No list endpoint available. Use:  npm run delete-comment -- auto");
}

// ─── SINGLE delete mode ───────────────────────────────────────────────────────

async function singleDelete(commentId: string): Promise<void> {
  console.log(`Deleting comment ${commentId}…\n`);
  const ok = await deleteComment(commentId);
  if (!ok) process.exit(1);
}

// ─── Entry ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const arg = process.argv[2];

  if (arg === "auto")       await autoDelete();
  else if (!arg || arg === "list") await listMode();
  else                      await singleDelete(arg);
}

main().catch((err) => {
  console.error("✗ Error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
