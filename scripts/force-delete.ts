/**
 * Force-delete all posts and comments by our agent from Moltbook.
 * Tries multiple API endpoints to discover post IDs, then deletes/hides each.
 *
 * Usage:  npm run force-delete
 */
import "dotenv/config";

const apiKey = process.env.MOLTBOOK_API_KEY;
if (!apiKey) { console.error("✗ MOLTBOOK_API_KEY not set"); process.exit(1); }

const BASE = "https://www.moltbook.com/api/v1";
const HEADERS = {
  Authorization:  `Bearer ${apiKey}`,
  "Content-Type": "application/json",
};

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

async function get(url: string): Promise<{ status: number; body: unknown; raw: string }> {
  const res = await fetch(url, { headers: HEADERS });
  const raw = await res.text();
  let body: unknown = null;
  try { body = JSON.parse(raw); } catch { /* leave null */ }
  console.log(`  GET ${url} → ${res.status}`);
  return { status: res.status, body, raw };
}

async function del(url: string): Promise<{ status: number; raw: string }> {
  const res = await fetch(url, { method: "DELETE", headers: HEADERS });
  const raw = await res.text();
  console.log(`  DELETE ${url} → ${res.status}  ${raw.slice(0, 120) || "(empty)"}`);
  return { status: res.status, raw };
}

async function patch(url: string, body: unknown): Promise<{ status: number; raw: string }> {
  const res = await fetch(url, {
    method:  "PATCH",
    headers: HEADERS,
    body:    JSON.stringify(body),
  });
  const raw = await res.text();
  console.log(`  PATCH ${url} → ${res.status}  ${raw.slice(0, 120) || "(empty)"}`);
  return { status: res.status, raw };
}

// ─── Collect post IDs from every available endpoint ──────────────────────────

async function collectPostIds(): Promise<Set<string>> {
  const ids = new Set<string>();

  // 1. Agent profile by name
  console.log("\n── GET /agents/profile?name=cre-factchecker ──");
  const profile = await get(`${BASE}/agents/profile?name=cre-factchecker`);
  console.log("  Full response:", JSON.stringify(profile.body, null, 2));
  extractIds(profile.body, ids);

  // 2. /agents/me
  console.log("\n── GET /agents/me ──");
  const me = await get(`${BASE}/agents/me`);
  console.log("  Full response:", JSON.stringify(me.body, null, 2));
  extractIds(me.body, ids);

  // 3. Agent's own posts endpoint variations
  for (const path of [
    `${BASE}/agents/me/posts`,
    `${BASE}/agents/me/posts?limit=50`,
    `${BASE}/posts?author=cre-factchecker&limit=50`,
    `${BASE}/posts?agent=cre-factchecker&limit=50`,
  ]) {
    console.log(`\n── GET ${path} ──`);
    const r = await get(path);
    if (r.status < 400) {
      console.log("  Response:", JSON.stringify(r.body, null, 2).slice(0, 500));
      extractIds(r.body, ids);
    }
  }

  // 4. Scan multiple pages of chainlink-official for our posts
  console.log("\n── Scanning m/chainlink-official pages 1-4 for our posts ──");
  for (const offset of [0, 25, 50, 75]) {
    for (const param of ["submolt_name", "submolt"]) {
      const url = `${BASE}/posts?${param}=chainlink-official&limit=25&offset=${offset}&sort=new`;
      const r   = await get(url);
      if (r.status >= 400) continue;
      const posts = asPosts(r.body);
      const ours  = posts.filter(isOurs);
      if (ours.length > 0) {
        console.log(`  Found ${ours.length} of our post(s) at offset ${offset}`);
        ours.forEach((p) => ids.add(p.id));
      }
      if (posts.length === 0) break; // no more pages
    }
  }

  return ids;
}

// ─── Collect comment IDs for known post IDs ───────────────────────────────────

async function collectCommentIds(postIds: string[]): Promise<Array<{ postId: string; commentId: string }>> {
  const result: Array<{ postId: string; commentId: string }> = [];

  // Also try /agents/me/comments
  for (const path of [`${BASE}/agents/me/comments`, `${BASE}/me/comments`]) {
    const r = await get(path);
    if (r.status < 400) {
      console.log("  Comments endpoint response:", JSON.stringify(r.body, null, 2).slice(0, 500));
    }
  }

  for (const postId of postIds) {
    console.log(`\n── Comments on post ${postId} ──`);
    const r = await get(`${BASE}/posts/${postId}/comments`);
    if (r.status >= 400) { console.log(`  Skipping (${r.status})`); continue; }

    const comments = asComments(r.body);
    console.log(`  Total comments: ${comments.length}`);
    for (const c of comments) {
      const authorName = String((c.author as Record<string, unknown>)?.name ?? "").toLowerCase();
      const preview    = String(c.content ?? "").replace(/\n/g, " ").slice(0, 80);
      console.log(`    id=${c.id}  author="${authorName}"  "${preview}"`);
      if (isOurAuthorName(authorName)) {
        result.push({ postId, commentId: c.id });
      }
    }
  }

  return result;
}

// ─── Delete/hide helpers ──────────────────────────────────────────────────────

async function destroyPost(postId: string): Promise<void> {
  console.log(`\n── Removing post ${postId} ──`);
  const d = await del(`${BASE}/posts/${postId}`);
  if (d.status < 400) { console.log(`  ✓ Deleted`); return; }

  // Try PATCH to unpublish/hide
  await patch(`${BASE}/posts/${postId}`, { published: false });
  await patch(`${BASE}/posts/${postId}`, { status: "hidden" });
  await patch(`${BASE}/posts/${postId}`, { visible: false });
}

async function destroyComment(commentId: string): Promise<boolean> {
  const d = await del(`${BASE}/comments/${commentId}`);
  return d.status < 400 || d.status === 204;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface Post    { id: string; author?: unknown; title?: string; [k: string]: unknown }
interface Comment { id: string; author?: unknown; content?: string; [k: string]: unknown }

function asPosts(body: unknown): Post[] {
  if (Array.isArray(body)) return body as Post[];
  const b = body as Record<string, unknown>;
  return (b?.posts ?? b?.data ?? b?.items ?? []) as Post[];
}

function asComments(body: unknown): Comment[] {
  if (Array.isArray(body)) return body as Comment[];
  const b = body as Record<string, unknown>;
  return (b?.comments ?? b?.data ?? b?.items ?? []) as Comment[];
}

function isOurAuthorName(name: string): boolean {
  return name === "cre-factchecker" || name.includes("factcheck") || name.includes("cre-fact");
}

function isOurs(post: Post): boolean {
  const a = (post.author ?? {}) as Record<string, unknown>;
  return ["name", "username", "handle"]
    .map((k) => String(a[k] ?? "").toLowerCase())
    .some(isOurAuthorName);
}

function extractIds(body: unknown, ids: Set<string>): void {
  const posts = asPosts(body);
  posts.filter(isOurs).forEach((p) => { ids.add(p.id); console.log(`  + post ID: ${p.id}`); });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("🔍 Force-delete — discovering and removing all cre-factchecker content\n");

  // Discover post IDs
  const postIds = await collectPostIds();
  console.log(`\n── Discovered ${postIds.size} post ID(s): ${[...postIds].join(", ") || "(none)"} ──\n`);

  // Find comments on ALL scanned posts (including posts by others that we commented on)
  // Re-scan chainlink-official to get all post IDs (not just ours)
  console.log("\n── Scanning for our comments on others' posts ──");
  const scanUrl  = `${BASE}/posts?submolt_name=chainlink-official&limit=25&sort=new`;
  const scanRes  = await get(scanUrl);
  const allPosts = asPosts(scanRes.body).map((p) => p.id);

  // Include our own post IDs too
  const allPostIds = [...new Set([...allPosts, ...postIds])];
  const toDeleteComments = await collectCommentIds(allPostIds);

  // Delete comments first
  console.log(`\n── Deleting ${toDeleteComments.length} comment(s) ──`);
  let commentsDeleted = 0;
  for (const { commentId, postId } of toDeleteComments) {
    process.stdout.write(`  comment ${commentId} on ${postId} … `);
    const ok = await destroyComment(commentId);
    console.log(ok ? "✓" : "✗");
    if (ok) commentsDeleted++;
  }

  // Delete/hide our posts
  console.log(`\n── Removing ${postIds.size} post(s) ──`);
  let postsDeleted = 0;
  for (const postId of postIds) {
    await destroyPost(postId);
    postsDeleted++;
  }

  console.log("\n── Summary ───────────────────────────────────────");
  console.log(`  Post IDs found  : ${postIds.size}`);
  console.log(`  Posts removed   : ${postsDeleted}`);
  console.log(`  Comments deleted: ${commentsDeleted}`);
}

main().catch((err) => {
  console.error("✗ Fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
